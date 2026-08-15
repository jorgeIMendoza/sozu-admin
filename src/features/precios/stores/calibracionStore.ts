import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MotorPrecio } from "../types/dominio";
import type {
  ConfigCalibracion,
  EstadisticosCalibracion,
  ResidualCalibracion,
} from "../engine/calibracion";

export const CLASIFICACIONES_ATIPICO = [
  "Sin clasificar",
  "Unidad muestra",
  "Acuerdo comercial previo",
  "Error de captura",
  "Condición particular de la unidad",
  "Precio legado sin criterio",
] as const;

export interface CoeficienteGuardado {
  parametro: string;
  actual: number;
  propuesto: number;
  impacto: number;
}

export interface CorridaCalibracion {
  ejecutada_en: string;
  config: ConfigCalibracion;
  estadisticos: EstadisticosCalibracion;
  coeficientes: CoeficienteGuardado[];
  referenciasOmitidas: Record<string, string>;
  residuales: ResidualCalibracion[];
  excluidas: string[];
}

export interface BaselineCongelado {
  nombre: string;
  congelado_en: string;
  parametros: MotorPrecio;
  valor_total: number;
  precios: Record<string, number>;
}

interface EstadoCalibracion {
  corridas: Record<string, CorridaCalibracion>;
  clasificacionAtipicos: Record<string, string>;
  baselines: Record<string, BaselineCongelado>;
}

const estadoInicial: EstadoCalibracion = {
  corridas: {},
  clasificacionAtipicos: {},
  baselines: {},
};

interface AccionesCalibracion {
  guardarCorrida: (idProyecto: string, corrida: CorridaCalibracion) => void;
  descartarCorrida: (idProyecto: string) => void;
  clasificarAtipico: (idPropiedad: string, clasificacion: string) => void;
  toggleExclusion: (idProyecto: string, idPropiedad: string) => void;
  congelarBaseline: (idProyecto: string, baseline: BaselineCongelado) => void;
  reemplazarBaseline: (idProyecto: string, baseline: BaselineCongelado) => void;
  reset: () => void;
}

/** Normaliza estados persistidos anteriores a la existencia de este store. */
function normalizar(estado: unknown): EstadoCalibracion {
  const base = structuredClone(estadoInicial);
  const s = (estado ?? {}) as Partial<EstadoCalibracion>;
  return {
    corridas: s.corridas ?? base.corridas,
    clasificacionAtipicos: s.clasificacionAtipicos ?? base.clasificacionAtipicos,
    baselines: s.baselines ?? base.baselines,
  };
}

export const useCalibracionStore = create<EstadoCalibracion & AccionesCalibracion>()(
  persist(
    (set) => ({
      ...structuredClone(estadoInicial),

      guardarCorrida: (idProyecto, corrida) =>
        set((s) => ({
          ...s,
          corridas: { ...s.corridas, [idProyecto]: corrida },
        })),

      descartarCorrida: (idProyecto) =>
        set((s) => {
          const { [idProyecto]: _fuera, ...resto } = s.corridas;
          return { ...s, corridas: resto };
        }),

      clasificarAtipico: (idPropiedad, clasificacion) =>
        set((s) => ({
          ...s,
          clasificacionAtipicos: {
            ...s.clasificacionAtipicos,
            [idPropiedad]: clasificacion,
          },
        })),

      toggleExclusion: (idProyecto, idPropiedad) =>
        set((s) => {
          const corrida = s.corridas[idProyecto];
          if (!corrida) return s;
          const excluidas = corrida.excluidas.includes(idPropiedad)
            ? corrida.excluidas.filter((x) => x !== idPropiedad)
            : [...corrida.excluidas, idPropiedad];
          return {
            ...s,
            corridas: { ...s.corridas, [idProyecto]: { ...corrida, excluidas } },
          };
        }),

      congelarBaseline: (idProyecto, baseline) =>
        set((s) => ({ ...s, baselines: { ...s.baselines, [idProyecto]: baseline } })),

      reemplazarBaseline: (idProyecto, baseline) =>
        set((s) => ({ ...s, baselines: { ...s.baselines, [idProyecto]: baseline } })),

      reset: () => set(structuredClone(estadoInicial)),
    }),
    {
      name: "sozu-precios-calibracion",
      version: 1,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
