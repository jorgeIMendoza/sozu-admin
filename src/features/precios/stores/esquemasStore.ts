import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EsquemaFinanciamiento } from "../types/dominio";
import { ESQUEMAS_SEMILLA } from "../mocks/esquemas";
import { obtenerEsquemasProyecto } from "../services/esquemasReales";

interface EstadoEsquemas {
  esquemasPorProyecto: Record<string, EsquemaFinanciamiento[]>;
  esquemaSeleccionado: string | null;
  /** Proyectos con una carga en vuelo, para no dispararla dos veces. */
  cargando: Record<string, boolean>;
  /** Proyectos ya traídos de la base, aunque hayan venido vacíos. */
  cargados: Record<string, boolean>;
  errorCarga: string | null;
}

const estadoInicial: EstadoEsquemas = {
  esquemasPorProyecto: structuredClone(ESQUEMAS_SEMILLA),
  esquemaSeleccionado: null,
  cargando: {},
  cargados: {},
  errorCarga: null,
};

export type DatosEsquema = Omit<
  EsquemaFinanciamiento,
  "id_esquema" | "id_proyecto" | "activo" | "creado_en"
>;

interface AccionesEsquemas {
  getEsquemas: (idProyecto: string) => EsquemaFinanciamiento[];
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
  crearEsquema: (idProyecto: string, datos: DatosEsquema) => string;
  actualizarEsquema: <C extends keyof EsquemaFinanciamiento>(
    idEsquema: string,
    campo: C,
    valor: EsquemaFinanciamiento[C],
  ) => void;
  reemplazarEsquema: (idEsquema: string, datos: DatosEsquema) => void;
  marcarComoBase: (idEsquema: string) => void;
  desactivarEsquema: (idEsquema: string) => void;
  reactivarEsquema: (idEsquema: string) => void;
  duplicarEsquema: (idEsquema: string) => void;
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

        crearEsquema: (idProyecto, datos) => {
          const id = `esq-${idProyecto}-${Date.now().toString(36)}`;
          set((s) => {
            const lista = s.esquemasPorProyecto[idProyecto] ?? [];
            const nuevo: EsquemaFinanciamiento = {
              ...datos,
              id_esquema: id,
              id_proyecto: idProyecto,
              activo: true,
              creado_en: new Date().toISOString(),
            };
            // El esquema base es uno por régimen, no uno por proyecto.
            const siguiente = datos.es_base
              ? [
                  ...lista.map((e) =>
                    e.tipo_esquema === datos.tipo_esquema ? { ...e, es_base: false } : e,
                  ),
                  nuevo,
                ]
              : [...lista, nuevo];
            return {
              ...s,
              esquemasPorProyecto: { ...s.esquemasPorProyecto, [idProyecto]: siguiente },
            };
          });
          return id;
        },

        actualizarEsquema: (idEsquema, campo, valor) =>
          mutar(idEsquema, (lista) =>
            lista.map((e) => (e.id_esquema === idEsquema ? { ...e, [campo]: valor } : e)),
          ),

        reemplazarEsquema: (idEsquema, datos) =>
          mutar(idEsquema, (lista) =>
            lista.map((e) =>
              e.id_esquema === idEsquema
                ? { ...e, ...datos }
                : datos.es_base && e.tipo_esquema === datos.tipo_esquema
                  ? { ...e, es_base: false }
                  : e,
            ),
          ),

        marcarComoBase: (idEsquema) =>
          mutar(idEsquema, (lista) => {
            const objetivo = lista.find((e) => e.id_esquema === idEsquema);
            if (!objetivo) return lista;
            return lista.map((e) =>
              e.id_esquema === idEsquema
                ? { ...e, es_base: true }
                : e.tipo_esquema === objetivo.tipo_esquema
                  ? { ...e, es_base: false }
                  : e,
            );
          }),

        desactivarEsquema: (idEsquema) =>
          mutar(idEsquema, (lista) =>
            lista.map((e) =>
              e.id_esquema === idEsquema ? { ...e, activo: false, es_base: false } : e,
            ),
          ),

        reactivarEsquema: (idEsquema) =>
          mutar(idEsquema, (lista) =>
            lista.map((e) => (e.id_esquema === idEsquema ? { ...e, activo: true } : e)),
          ),

        duplicarEsquema: (idEsquema) =>
          mutar(idEsquema, (lista, idProyecto) => {
            const original = lista.find((e) => e.id_esquema === idEsquema);
            if (!original) return lista;
            return [
              ...lista,
              {
                ...structuredClone(original),
                id_esquema: `esq-${idProyecto}-${Date.now().toString(36)}`,
                nombre: `${original.nombre} (copia)`,
                es_base: false,
                creado_en: new Date().toISOString(),
              },
            ];
          }),

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
