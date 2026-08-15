import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EsquemaFinanciamiento } from "../types/dominio";
import { ESQUEMAS_SEMILLA } from "../mocks/esquemas";

interface EstadoEsquemas {
  esquemasPorProyecto: Record<string, EsquemaFinanciamiento[]>;
  esquemaSeleccionado: string | null;
}

const estadoInicial: EstadoEsquemas = {
  esquemasPorProyecto: structuredClone(ESQUEMAS_SEMILLA),
  esquemaSeleccionado: null,
};

export type DatosEsquema = Omit<
  EsquemaFinanciamiento,
  "id_esquema" | "id_proyecto" | "activo" | "creado_en"
>;

interface AccionesEsquemas {
  getEsquemas: (idProyecto: string) => EsquemaFinanciamiento[];
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
