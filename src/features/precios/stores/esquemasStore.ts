import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EsquemaFinanciamiento } from "../types/dominio";
import { ESQUEMAS_SEMILLA } from "../mocks/esquemas";
import {
  actualizarEsquemaReal,
  cambiarActivoEsquemaReal,
  crearEsquemaReal,
  marcarBaseEsquemaReal,
  obtenerEsquemasProyecto,
} from "../services/esquemasReales";

interface EstadoEsquemas {
  esquemasPorProyecto: Record<string, EsquemaFinanciamiento[]>;
  esquemaSeleccionado: string | null;
  /** Proyectos con una carga en vuelo, para no dispararla dos veces. */
  cargando: Record<string, boolean>;
  /** Proyectos ya traídos de la base, aunque hayan venido vacíos. */
  cargados: Record<string, boolean>;
  errorCarga: string | null;
  /** Último fallo al escribir en la base, para que la pantalla lo diga. */
  errorEscritura: string | null;
}

const estadoInicial: EstadoEsquemas = {
  esquemasPorProyecto: structuredClone(ESQUEMAS_SEMILLA),
  esquemaSeleccionado: null,
  cargando: {},
  cargados: {},
  errorCarga: null,
  errorEscritura: null,
};

export type DatosEsquema = Omit<
  EsquemaFinanciamiento,
  "id_esquema" | "id_proyecto" | "activo" | "creado_en"
>;

interface AccionesEsquemas {
  getEsquemas: (idProyecto: string) => EsquemaFinanciamiento[];
  /** Proyecto al que pertenece un esquema ya cargado, o `null`. */
  proyectoDe: (idEsquema: string) => string | null;
  /**
   * Trae de `esquemas_pago` los esquemas del proyecto y reemplaza los que
   * hubiera en memoria.
   *
   * Reemplaza y no mezcla: la base es la fuente de la verdad de la política
   * comercial —es lo que ve el prospecto en su oferta— y fusionar dejaría
   * esquemas fantasma que ya nadie ofrece. Se hace una sola vez por proyecto
   * y por sesión; `recargarEsquemas` fuerza volver a traerlos.
   */
  cargarEsquemas: (idProyecto: string) => Promise<void>;
  recargarEsquemas: (idProyecto: string) => Promise<void>;
  /**
   * Todas las acciones que siguen escriben en `esquemas_pago` y luego recargan.
   *
   * Escribir y releer, en vez de actualizar la copia local, porque esta tabla
   * la comparten Precios, Editar Proyecto y las ofertas a prospectos: la base
   * es la única versión de la verdad y una copia optimista se desincroniza en
   * cuanto alguien más toca lo mismo.
   *
   * Ninguna rechaza: un fallo queda en `errorEscritura` para que la pantalla lo
   * muestre sin que cada botón tenga que envolverse en un try.
   */
  crearEsquema: (idProyecto: string, datos: DatosEsquema) => Promise<void>;
  actualizarEsquema: <C extends keyof EsquemaFinanciamiento>(
    idEsquema: string,
    campo: C,
    valor: EsquemaFinanciamiento[C],
  ) => void;
  reemplazarEsquema: (idEsquema: string, datos: DatosEsquema) => Promise<void>;
  marcarComoBase: (idEsquema: string) => Promise<void>;
  desactivarEsquema: (idEsquema: string) => Promise<void>;
  reactivarEsquema: (idEsquema: string) => Promise<void>;
  duplicarEsquema: (idEsquema: string) => Promise<void>;
  seleccionarEsquema: (idEsquema: string | null) => void;
  reset: () => void;
}

/** Normaliza estados persistidos anteriores (localStorage viejo o vacío). */
function normalizar(estado: unknown): EstadoEsquemas {
  const base = structuredClone(estadoInicial);
  const s = (estado ?? {}) as Partial<EstadoEsquemas>;
  const mapa: Record<string, EsquemaFinanciamiento[]> = { ...base.esquemasPorProyecto };
  for (const [id, lista] of Object.entries(s.esquemasPorProyecto ?? {})) {
    if (!Array.isArray(lista) || lista.length === 0) continue;
    const normalizados = lista.map((e) => ({
      ...(base.esquemasPorProyecto[id]?.[0] ?? {}),
      ...e,
      tipo_esquema: e.tipo_esquema ?? "preventa",
      tramos: e.tramos ?? [{ peso: 0.2 }, { peso: 0.3 }, { peso: 0.5 }],
      modo_escalonamiento: e.modo_escalonamiento ?? "lineal",
      meses_enganche: e.meses_enganche ?? 1,
      mes_inicio_mensualidades: e.mes_inicio_mensualidades ?? 1,
      factor_crecimiento: e.factor_crecimiento ?? 0.05,
    }));
    // Incorpora esquemas semilla nuevos que un localStorage viejo no conoce.
    const vistos = new Set(normalizados.map((e) => e.id_esquema));
    const faltantes = (base.esquemasPorProyecto[id] ?? []).filter(
      (e) => !vistos.has(e.id_esquema),
    );
    mapa[id] = [...normalizados, ...faltantes];
  }
  return {
    esquemasPorProyecto: mapa,
    esquemaSeleccionado: s.esquemaSeleccionado ?? null,
    // Las banderas de carga no se restauran: cada sesión vuelve a pedir los
    // esquemas a la base, porque la política comercial pudo cambiar fuera de
    // esta pantalla y un caché viejo se vería igual que uno vigente.
    cargando: {},
    cargados: {},
    errorCarga: null,
    errorEscritura: null,
  };
}

export const useEsquemasStore = create<EstadoEsquemas & AccionesEsquemas>()(
  persist(
    (set, get) => {
      /** Aplica una transformación a la lista que contiene el esquema dado. */
      const mutar = (
        idEsquema: string,
        fn: (
          lista: EsquemaFinanciamiento[],
          idProyecto: string,
        ) => EsquemaFinanciamiento[],
      ) =>
        set((s) => {
          const entrada = Object.entries(s.esquemasPorProyecto).find(([, lista]) =>
            lista.some((e) => e.id_esquema === idEsquema),
          );
          if (!entrada) return s;
          const [idProyecto, lista] = entrada;
              return {
            ...s,
            esquemasPorProyecto: {
              ...s.esquemasPorProyecto,
              [idProyecto]: fn(lista, idProyecto),
            },
          };
        });

      /** Escribe en la base y relee; el fallo queda a la vista, no en consola. */
      const escribir = async (idProyecto: string, fn: () => Promise<void>) => {
        try {
          await fn();
          set((st) => ({ ...st, errorEscritura: null }));
        } catch (e) {
          set((st) => ({
            ...st,
            errorEscritura:
              e instanceof Error ? e.message : "No se pudo guardar el esquema.",
          }));
        }
        await get().recargarEsquemas(idProyecto);
      };

      return {
        ...structuredClone(estadoInicial),

        getEsquemas: (idProyecto) => get().esquemasPorProyecto[idProyecto] ?? [],

        cargarEsquemas: async (idProyecto) => {
          const s = get();
          if (!idProyecto || s.cargados[idProyecto] || s.cargando[idProyecto]) return;
          await get().recargarEsquemas(idProyecto);
        },

        recargarEsquemas: async (idProyecto) => {
          if (!idProyecto) return;
          set((st) => ({ ...st, cargando: { ...st.cargando, [idProyecto]: true } }));
          try {
            const lista = await obtenerEsquemasProyecto(idProyecto);
            set((st) => ({
              ...st,
              esquemasPorProyecto: { ...st.esquemasPorProyecto, [idProyecto]: lista },
              cargando: { ...st.cargando, [idProyecto]: false },
              cargados: { ...st.cargados, [idProyecto]: true },
              errorCarga: null,
            }));
          } catch (e) {
            set((st) => ({
              ...st,
              cargando: { ...st.cargando, [idProyecto]: false },
              errorCarga:
                e instanceof Error
                  ? e.message
                  : "No se pudieron cargar los esquemas de financiamiento del proyecto.",
            }));
          }
        },

        /** Proyecto al que pertenece un esquema ya cargado. */
        proyectoDe: (idEsquema: string): string | null => {
          const entrada = Object.entries(get().esquemasPorProyecto).find(([, lista]) =>
            lista.some((e) => e.id_esquema === idEsquema),
          );
          return entrada?.[0] ?? null;
        },

        crearEsquema: async (idProyecto, datos) => {
          await escribir(idProyecto, () => crearEsquemaReal(idProyecto, datos));
        },

        actualizarEsquema: (idEsquema, campo, valor) =>
          mutar(idEsquema, (lista) =>
            lista.map((e) => (e.id_esquema === idEsquema ? { ...e, [campo]: valor } : e)),
          ),

        reemplazarEsquema: async (idEsquema, datos) => {
          const idProyecto = get().proyectoDe(idEsquema);
          if (!idProyecto) return;
          await escribir(idProyecto, async () => {
            await actualizarEsquemaReal(idEsquema, datos);
            // El base se marca aparte: hay un índice único que no admite dos.
            if (datos.es_base) {
              await marcarBaseEsquemaReal(idProyecto, idEsquema, datos.tipo_esquema);
            }
          });
        },

        marcarComoBase: async (idEsquema) => {
          const idProyecto = get().proyectoDe(idEsquema);
          if (!idProyecto) return;
          const esquema = (get().esquemasPorProyecto[idProyecto] ?? []).find(
            (e) => e.id_esquema === idEsquema,
          );
          if (!esquema) return;
          await escribir(idProyecto, async () => {
            const guardado = await marcarBaseEsquemaReal(
              idProyecto,
              idEsquema,
              esquema.tipo_esquema,
            );
            if (!guardado) {
              throw new Error(
                "La columna es_base todavía no existe en la base. La marca no se guardó: " +
                  "aplica el DDL 20260821_esquemas_pago_campos_motor_precios.md.",
              );
            }
          });
        },

        desactivarEsquema: async (idEsquema) => {
          const idProyecto = get().proyectoDe(idEsquema);
          if (!idProyecto) return;
          await escribir(idProyecto, () => cambiarActivoEsquemaReal(idEsquema, false));
        },

        reactivarEsquema: async (idEsquema) => {
          const idProyecto = get().proyectoDe(idEsquema);
          if (!idProyecto) return;
          await escribir(idProyecto, () => cambiarActivoEsquemaReal(idEsquema, true));
        },

        duplicarEsquema: async (idEsquema) => {
          const idProyecto = get().proyectoDe(idEsquema);
          if (!idProyecto) return;
          const original = (get().esquemasPorProyecto[idProyecto] ?? []).find(
            (e) => e.id_esquema === idEsquema,
          );
          if (!original) return;
          const { id_esquema: _i, id_proyecto: _p, activo: _a, creado_en: _c, ...datos } =
            structuredClone(original);
          await escribir(idProyecto, () =>
            crearEsquemaReal(idProyecto, {
              ...datos,
              nombre: `${original.nombre} (copia)`,
              // La copia nunca nace como referencia: el índice único lo impediría
              // y, sobre todo, duplicar no es decidir.
              es_base: false,
            }),
          );
        },
        seleccionarEsquema: (idEsquema) => set({ esquemaSeleccionado: idEsquema }),

        reset: () => set(structuredClone(estadoInicial)),
      };
    },
    {
      name: "sozu-precios-esquemas",
      version: 2,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
