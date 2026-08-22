import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormaAbsorcion } from "./escenariosProyectoStore";

/**
 * ESCENARIOS DE FLUJO
 *
 * Un escenario de precios congela cuánto vale el inventario. No dice cuánto va a
 * entrar ni cuándo: eso depende de con qué esquemas se venda y en cuántos meses
 * se coloque. Dos listas de precios idénticas producen ingresos muy distintos si
 * una se vende a contado y la otra a 48 meses.
 *
 * Este escenario guarda la otra mitad: los supuestos comerciales y el resultado
 * que producen sobre una base de precios concreta. Sirve para poner dos
 * configuraciones completas —precio más financiamiento más absorción— una al
 * lado de la otra y elegir.
 *
 * Guarda el resultado Y los supuestos. Solo el resultado dejaría un número sin
 * defensa: meses después nadie sabría si esos $1,800 M salieron de vender todo a
 * contado en seis meses o de un mix realista en tres años. Y solo los supuestos
 * obligaría a recalcular con un motor que ya cambió, que daría otra cifra.
 */

/** Un mes de la curva de ingreso proyectada. */
export interface MesFlujo {
  mes: number;
  unidades: number;
  nominal: number;
  vp: number;
}

/** Lo que aportó cada modelo, con la mezcla que tenía al guardar. */
export interface ModeloFlujo {
  id_modelo: string;
  nombre: string;
  unidades: number;
  valor: number;
  vp: number;
  /** El modelo tenía mezcla propia, distinta a la del proyecto. */
  propio: boolean;
}

export interface EscenarioFlujo {
  id_flujo: string;
  id_proyecto: string;
  nombre: string;
  notas: string;
  creado_en: string;

  // ---- Base de precios sobre la que se calculó ----
  /** Unidades vendibles consideradas. */
  unidades: number;
  /** Suma del precio de lista de esas unidades, con el motor de ese momento. */
  valor_lista: number;

  // ---- Supuestos comerciales ----
  tasa_anual: number;
  meses_absorcion: number;
  forma: FormaAbsorcion;
  mix: Record<string, number>;
  mixPorModelo: Record<string, Record<string, number>>;
  /**
   * Los esquemas tal como estaban al guardar.
   *
   * Se copian y no se referencian por id: un esquema se puede editar o dar de
   * baja después, y entonces el escenario dejaría de poder explicarse.
   */
  esquemas: Array<{
    id_esquema: string;
    nombre: string;
    pct_ajuste_manual: number;
    participacion: number;
  }>;

  // ---- Resultado ----
  vp_total: number;
  /** El mismo flujo sin la brecha de ajuste comercial, como referencia. */
  vp_sin_brecha: number;
  meses: MesFlujo[];
  modelos: ModeloFlujo[];
}

interface Estado {
  flujosPorProyecto: Record<string, EscenarioFlujo[]>;
}

interface Acciones {
  getFlujos: (idProyecto: string) => EscenarioFlujo[];
  guardarFlujo: (
    datos: Omit<EscenarioFlujo, "id_flujo" | "creado_en">,
  ) => EscenarioFlujo;
  eliminarFlujo: (idProyecto: string, idFlujo: string) => void;
  renombrarFlujo: (idProyecto: string, idFlujo: string, nombre: string) => void;
  reset: () => void;
}

const estadoInicial: Estado = { flujosPorProyecto: {} };

const nuevoId = () => `flu-${Math.random().toString(36).slice(2, 9)}`;

const SIN_FLUJOS: EscenarioFlujo[] = [];

/** SWAP POINT: los escenarios de flujo vivirán en Lovable Cloud. */
export const useEscenariosFlujoStore = create<Estado & Acciones>()(
  persist(
    (set, get) => ({
      ...structuredClone(estadoInicial),

      getFlujos: (idProyecto) => get().flujosPorProyecto[idProyecto] ?? SIN_FLUJOS,

      guardarFlujo: (datos) => {
        const nuevo: EscenarioFlujo = {
          ...datos,
          id_flujo: nuevoId(),
          creado_en: new Date().toISOString(),
        };
        set((s) => ({
          flujosPorProyecto: {
            ...s.flujosPorProyecto,
            [datos.id_proyecto]: [...(s.flujosPorProyecto[datos.id_proyecto] ?? []), nuevo],
          },
        }));
        return nuevo;
      },

      eliminarFlujo: (idProyecto, idFlujo) =>
        set((s) => ({
          flujosPorProyecto: {
            ...s.flujosPorProyecto,
            [idProyecto]: (s.flujosPorProyecto[idProyecto] ?? []).filter(
              (f) => f.id_flujo !== idFlujo,
            ),
          },
        })),

      renombrarFlujo: (idProyecto, idFlujo, nombre) =>
        set((s) => ({
          flujosPorProyecto: {
            ...s.flujosPorProyecto,
            [idProyecto]: (s.flujosPorProyecto[idProyecto] ?? []).map((f) =>
              f.id_flujo === idFlujo ? { ...f, nombre } : f,
            ),
          },
        })),

      reset: () => set(structuredClone(estadoInicial)),
    }),
    { name: "sozu-precios-flujos", version: 1 },
  ),
);
