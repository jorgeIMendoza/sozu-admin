import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Forma de la curva de absorción a lo largo del periodo de comercialización. */
export type FormaAbsorcion = "lineal" | "acelerada" | "lenta";

export interface EscenarioProyecto {
  id_escenario: string;
  id_proyecto: string;
  nombre: string;
  /** Participación de cada esquema en las ventas, 0 a 1. */
  mix: Record<string, number>;
  meses_absorcion: number;
  forma: FormaAbsorcion;
  creado_en: string;
}

interface Estado {
  escenariosPorProyecto: Record<string, EscenarioProyecto[]>;
  idActivoPorProyecto: Record<string, string | null>;
  crear: (idProyecto: string, nombre: string, mix: Record<string, number>) => string;
  duplicar: (idProyecto: string, id: string) => void;
  actualizar: (
    idProyecto: string,
    id: string,
    cambios: Partial<Omit<EscenarioProyecto, "id_escenario" | "id_proyecto">>,
  ) => void;
  eliminar: (idProyecto: string, id: string) => void;
  seleccionar: (idProyecto: string, id: string | null) => void;
  reiniciar: () => void;
}

const nuevoId = () => `esc-${Math.random().toString(36).slice(2, 9)}`;

/** SWAP POINT: los escenarios de proyecto vivirán en Lovable Cloud. */
export const useEscenariosProyectoStore = create<Estado>()(
  persist(
    (set) => ({
      escenariosPorProyecto: {},
      idActivoPorProyecto: {},

      crear: (idProyecto, nombre, mix) => {
        const id = nuevoId();
        set((s) => ({
          escenariosPorProyecto: {
            ...s.escenariosPorProyecto,
            [idProyecto]: [
              ...(s.escenariosPorProyecto[idProyecto] ?? []),
              {
                id_escenario: id,
                id_proyecto: idProyecto,
                nombre,
                mix,
                meses_absorcion: 12,
                forma: "lineal",
                creado_en: new Date().toISOString(),
              },
            ],
          },
          idActivoPorProyecto: { ...s.idActivoPorProyecto, [idProyecto]: id },
        }));
        return id;
      },

      duplicar: (idProyecto, id) =>
        set((s) => {
          const lista = s.escenariosPorProyecto[idProyecto] ?? [];
          const origen = lista.find((e) => e.id_escenario === id);
          if (!origen) return s;
          const nuevo: EscenarioProyecto = {
            ...origen,
            id_escenario: nuevoId(),
            nombre: `${origen.nombre} (copia)`,
            creado_en: new Date().toISOString(),
          };
          return {
            escenariosPorProyecto: {
              ...s.escenariosPorProyecto,
              [idProyecto]: [...lista, nuevo],
            },
            idActivoPorProyecto: {
              ...s.idActivoPorProyecto,
              [idProyecto]: nuevo.id_escenario,
            },
          };
        }),

      actualizar: (idProyecto, id, cambios) =>
        set((s) => ({
          escenariosPorProyecto: {
            ...s.escenariosPorProyecto,
            [idProyecto]: (s.escenariosPorProyecto[idProyecto] ?? []).map((e) =>
              e.id_escenario === id ? { ...e, ...cambios } : e,
            ),
          },
        })),

      eliminar: (idProyecto, id) =>
        set((s) => {
          const lista = (s.escenariosPorProyecto[idProyecto] ?? []).filter(
            (e) => e.id_escenario !== id,
          );
          return {
            escenariosPorProyecto: { ...s.escenariosPorProyecto, [idProyecto]: lista },
            idActivoPorProyecto: {
              ...s.idActivoPorProyecto,
              [idProyecto]:
                s.idActivoPorProyecto[idProyecto] === id
                  ? (lista[0]?.id_escenario ?? null)
                  : (s.idActivoPorProyecto[idProyecto] ?? null),
            },
          };
        }),

      seleccionar: (idProyecto, id) =>
        set((s) => ({
          idActivoPorProyecto: { ...s.idActivoPorProyecto, [idProyecto]: id },
        })),

      reiniciar: () => set({ escenariosPorProyecto: {}, idActivoPorProyecto: {} }),
    }),
    { name: "sozu-precios-escenarios-proyecto", version: 1 },
  ),
);

/** Unidades vendidas por mes según la forma de la curva de absorción. */
export function curvaAbsorcion(
  unidades: number,
  meses: number,
  forma: FormaAbsorcion,
): number[] {
  const n = Math.max(1, Math.round(meses));
  const pesos = Array.from({ length: n }, (_, i) => {
    const x = n === 1 ? 1 : (i + 1) / n;
    if (forma === "acelerada") return Math.pow(1 - x + 1 / n, 1.6);
    if (forma === "lenta") return Math.pow(x, 1.6);
    return 1;
  });
  const total = pesos.reduce((a, v) => a + v, 0) || 1;
  const crudos = pesos.map((p) => (p / total) * unidades);

  // Reparto entero conservando el total.
  const enteros = crudos.map((v) => Math.floor(v));
  let resto = unidades - enteros.reduce((a, v) => a + v, 0);
  const orden = crudos
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const o of orden) {
    if (resto <= 0) break;
    enteros[o.i] = enteros[o.i]! + 1;
    resto--;
  }
  return enteros;
}
