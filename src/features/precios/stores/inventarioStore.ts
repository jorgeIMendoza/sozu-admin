import { create } from "zustand";
import type { Modelo, Propiedad, Proyecto, Torre } from "../types/dominio";
import {
  obtenerInventarioProyecto,
  obtenerProyectosSozu,
  type InventarioProyecto,
} from "../services/inventarioReal";

/**
 * INVENTARIO REAL EN MEMORIA
 *
 * El módulo de Precios leía su inventario de constantes de módulo
 * (`mocks/inventario.ts`), de forma síncrona, desde catorce archivos. El
 * inventario real llega por red, así que hace falta un lugar donde vivan los
 * datos ya cargados.
 *
 * Se usa un store de Zustand y no un contexto de React a propósito: además de
 * los componentes, lo consumen `motorStore` (otro store de Zustand) y el
 * servicio de precios, que corren fuera del árbol. Con un store, esos leen
 * `useInventarioStore.getState()` y los componentes se suscriben normal, sin
 * duplicar la carga ni obligar a que todo pase por props.
 *
 * El inventario se cachea por proyecto: cambiar de desarrollo y volver no
 * vuelve a pedir ~1000 unidades.
 */

const VACIO: InventarioProyecto = { torres: [], modelos: [], propiedades: [] };

/** Índices por id, para que los consumidores no recorran arreglos en cada render. */
export interface IndicesProyecto {
  torresPorId: Record<string, Torre>;
  modelosPorId: Record<string, Modelo>;
  propiedadesPorId: Record<string, Propiedad>;
}

function indexar(inv: InventarioProyecto): IndicesProyecto {
  return {
    torresPorId: Object.fromEntries(inv.torres.map((t) => [t.id_torre, t])),
    modelosPorId: Object.fromEntries(inv.modelos.map((m) => [m.id_modelo, m])),
    propiedadesPorId: Object.fromEntries(inv.propiedades.map((p) => [p.id_propiedad, p])),
  };
}

interface EstadoInventario {
  /** Proyectos comercializados por SOZU. Universo del selector de Precios. */
  proyectos: Proyecto[];
  proyectosCargados: boolean;
  cargandoProyectos: boolean;
  /** Inventario ya cargado, por id de proyecto. */
  porProyecto: Record<string, InventarioProyecto>;
  indices: Record<string, IndicesProyecto>;
  /** Proyectos con una carga en vuelo. */
  cargando: Record<string, boolean>;
  error: string | null;
}

interface AccionesInventario {
  cargarProyectos: () => Promise<Proyecto[]>;
  cargarInventario: (idProyecto: string) => Promise<InventarioProyecto>;
  /** Descarta lo cacheado y vuelve a pedirlo. */
  recargar: (idProyecto: string) => Promise<InventarioProyecto>;
  inventarioDe: (idProyecto: string | null | undefined) => InventarioProyecto;
  indicesDe: (idProyecto: string | null | undefined) => IndicesProyecto;
}

const INDICES_VACIOS: IndicesProyecto = {
  torresPorId: {},
  modelosPorId: {},
  propiedadesPorId: {},
};

export const useInventarioStore = create<EstadoInventario & AccionesInventario>()(
  (set, get) => ({
    proyectos: [],
    proyectosCargados: false,
    cargandoProyectos: false,
    porProyecto: {},
    indices: {},
    cargando: {},
    error: null,

    cargarProyectos: async () => {
      const s = get();
      if (s.proyectosCargados) return s.proyectos;
      if (s.cargandoProyectos) return s.proyectos;

      set({ cargandoProyectos: true, error: null });
      try {
        const proyectos = await obtenerProyectosSozu();
        set({ proyectos, proyectosCargados: true, cargandoProyectos: false });
        return proyectos;
      } catch (e) {
        set({
          cargandoProyectos: false,
          error:
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los proyectos comercializados por SOZU.",
        });
        return [];
      }
    },

    cargarInventario: async (idProyecto) => {
      const s = get();
      const cacheado = s.porProyecto[idProyecto];
      if (cacheado) return cacheado;
      if (s.cargando[idProyecto]) return VACIO;

      set((st) => ({ cargando: { ...st.cargando, [idProyecto]: true }, error: null }));
      try {
        const inv = await obtenerInventarioProyecto(idProyecto);
        set((st) => ({
          porProyecto: { ...st.porProyecto, [idProyecto]: inv },
          indices: { ...st.indices, [idProyecto]: indexar(inv) },
          cargando: { ...st.cargando, [idProyecto]: false },
          // El número de unidades se conoce hasta aquí: la lista de proyectos
          // se resuelve con dos consultas y no lo trae, para poder pintarse de
          // inmediato.
          proyectos: st.proyectos.map((p) =>
            p.id_proyecto === idProyecto
              ? { ...p, num_departamentos: inv.propiedades.length }
              : p,
          ),
        }));
        return inv;
      } catch (e) {
        set((st) => ({
          cargando: { ...st.cargando, [idProyecto]: false },
          error:
            e instanceof Error
              ? e.message
              : "No se pudo cargar el inventario del proyecto.",
        }));
        return VACIO;
      }
    },

    recargar: async (idProyecto) => {
      set((st) => {
        const porProyecto = { ...st.porProyecto };
        const indices = { ...st.indices };
        delete porProyecto[idProyecto];
        delete indices[idProyecto];
        return { porProyecto, indices };
      });
      return get().cargarInventario(idProyecto);
    },

    inventarioDe: (idProyecto) =>
      (idProyecto ? get().porProyecto[idProyecto] : undefined) ?? VACIO,

    indicesDe: (idProyecto) =>
      (idProyecto ? get().indices[idProyecto] : undefined) ?? INDICES_VACIOS,
  }),
);

/** ¿Hay una carga en vuelo para este proyecto? */
export const estaCargando = (s: EstadoInventario, idProyecto: string | null): boolean =>
  !!idProyecto && !!s.cargando[idProyecto];

/** ¿Ya se resolvió la carga de este proyecto (aunque haya venido vacía)? */
export const estaCargado = (s: EstadoInventario, idProyecto: string | null): boolean =>
  !!idProyecto && s.porProyecto[idProyecto] !== undefined;
