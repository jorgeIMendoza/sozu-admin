import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnclaProyecto, FactorPrecio, MotorPrecio, TipoFactor } from "../types/dominio";
import { MODELOS, MOTORES_SEMILLA, PROPIEDADES, TORRES } from "../mocks/inventario";
import { esMotorAnclado, migrarMotorAAnclaje, reanclarMotor } from "../engine/anclaje";

interface EstadoMotor {
  motoresPorProyecto: Record<string, MotorPrecio>;
  idProyectoActivo: string;
  /** Mensaje de error si la migración al anclaje por modelo no pudo aplicarse. */
  errorMigracion: string | null;
  /** Resumen antes/después de la migración, pendiente de registrar en bitácora. */
  migracionPendiente: Record<string, { antes: unknown; despues: unknown }> | null;
}

const estadoInicial: EstadoMotor = {
  motoresPorProyecto: structuredClone(MOTORES_SEMILLA),
  idProyectoActivo: "pry-daiku",
  errorMigracion: null,
  migracionPendiente: null,
};

type CampoNumerico =
  | "k_ext"
  | "k_loft"
  | "precio_cajon"
  | "factor_cajon_tandem"
  | "precio_m2_bodega"
  | "vigencia_oferta_dias"
  | "tasa_descuento_anual";

interface AccionesMotor {
  setProyectoActivo: (idProyecto: string) => void;
  getMotorActivo: () => MotorPrecio;
  actualizarParametro: (campo: CampoNumerico, valor: number) => void;
  actualizarConfigNivel: (coef_a: number, coef_b: number) => void;
  actualizarConfigTamano: (theta: number) => void;
  actualizarBaseModelo: (
    idModelo: string,
    campo: "precio_base_m2" | "m2_referencia",
    valor: number,
  ) => void;
  /** Reexpresa la escala contra un ancla nueva. Neutral: ningún precio cambia. */
  setAncla: (ancla: Omit<AnclaProyecto, "descripcion">) => void;
  actualizarFactor: (idFactor: string, valor: number) => void;
  agregarFactor: (
    tipo: TipoFactor,
    clave: string,
    etiqueta: string,
    valor: number,
  ) => void;
  desactivarFactor: (idFactor: string) => void;
  reactivarFactor: (idFactor: string) => void;
  marcarCalibrado: (fecha?: string) => void;
  /** Camino declarado y auditable: calibración afirmada sin regresión. */
  declararCalibradoManualmente: (justificacion: string) => void;
  /** Sustituye por completo el motor del proyecto activo y lo marca calibrado. */
  aplicarMotorCalibrado: (motor: MotorPrecio) => void;
  /** Copia curvas y factores de mercado desde otro proyecto (sin precio base). */
  copiarCoeficientesDesde: (idOrigen: string) => boolean;
  limpiarMigracionPendiente: () => void;

  reset: () => void;
}

/** Normaliza motores persistidos anteriores y los migra al anclaje por modelo. */
function normalizar(estado: unknown): EstadoMotor {
  const base = structuredClone(estadoInicial);
  const s = (estado ?? {}) as Partial<EstadoMotor>;
  const motores: Record<string, MotorPrecio> = { ...base.motoresPorProyecto };
  let error: string | null = null;
  const pendiente: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const [id, m] of Object.entries(s.motoresPorProyecto ?? {})) {
    let motor: MotorPrecio = {
      ...(base.motoresPorProyecto[id] ?? m),
      ...m,
      estado_calibracion: m.estado_calibracion ?? "sin_calibrar",
      fecha_calibracion: m.fecha_calibracion ?? null,
      meses_holgura_entrega: m.meses_holgura_entrega ?? 0,
      vpn_objetivo_factor: m.vpn_objetivo_factor ?? null,
      vigencia_oferta_dias: m.vigencia_oferta_dias ?? 15,
    };

    if (!esMotorAnclado(m)) {
      const r = migrarMotorAAnclaje(motor, PROPIEDADES, MODELOS, TORRES);
      if (r.ok) {
        motor = r.motor;
        pendiente[id] = { antes: r.antes, despues: r.despues };
      } else {
        error = r.error;
        motor = base.motoresPorProyecto[id] ?? motor;
      }
    }
    motores[id] = motor;
  }

  return {
    motoresPorProyecto: motores,
    idProyectoActivo: s.idProyectoActivo ?? base.idProyectoActivo,
    errorMigracion: error,
    migracionPendiente: Object.keys(pendiente).length ? pendiente : null,
  };
}

export const useMotorStore = create<EstadoMotor & AccionesMotor>()(
  persist(
    (set, get) => {
      /** Actualiza inmutablemente el motor del proyecto activo. */
      const mutarMotor = (fn: (m: MotorPrecio) => MotorPrecio, invalida = true) =>
        set((s) => {
          const actual = s.motoresPorProyecto[s.idProyectoActivo];
          if (!actual) return s;
          const siguiente = fn(actual);
          return {
            ...s,
            motoresPorProyecto: {
              ...s.motoresPorProyecto,
              [s.idProyectoActivo]: {
                ...siguiente,
                estado_calibracion:
                  invalida &&
                  (siguiente.estado_calibracion === "calibrado" ||
                    siguiente.estado_calibracion === "calibrado_manualmente")
                    ? "desactualizado"
                    : siguiente.estado_calibracion,
                actualizado_en: new Date().toISOString(),
              },
            },
          };
        });

      const mutarFactores = (fn: (f: FactorPrecio[]) => FactorPrecio[]) =>
        mutarMotor((m) => ({ ...m, factores: fn(m.factores) }));

      return {
        ...structuredClone(estadoInicial),

        setProyectoActivo: (idProyecto) => set({ idProyectoActivo: idProyecto }),

        getMotorActivo: () => {
          const s = get();
          return (
            s.motoresPorProyecto[s.idProyectoActivo] ??
            structuredClone(MOTORES_SEMILLA[s.idProyectoActivo]!)
          );
        },

        actualizarParametro: (campo, valor) =>
          mutarMotor((m) => ({ ...m, [campo]: valor })),

        actualizarConfigNivel: (coef_a, coef_b) =>
          mutarMotor((m) => ({ ...m, nivel: { coef_a, coef_b } })),

        actualizarConfigTamano: (theta) =>
          mutarMotor((m) => ({ ...m, tamano: { ...m.tamano, theta } })),

        actualizarBaseModelo: (idModelo, campo, valor) =>
          mutarMotor((m) => ({
            ...m,
            bases_modelo: m.bases_modelo.map((b) =>
              b.id_modelo === idModelo ? { ...b, [campo]: valor } : b,
            ),
          })),

        setAncla: (ancla) =>
          mutarMotor((m) => reanclarMotor(m, ancla, TORRES), false),

        actualizarFactor: (idFactor, valor) =>
          mutarFactores((fs) =>
            fs.map((f) => (f.id_factor === idFactor ? { ...f, valor } : f)),
          ),

        agregarFactor: (tipo, clave, etiqueta, valor) =>
          mutarFactores((fs) => [
            ...fs,
            {
              id_factor: `usr-${tipo}-${clave.toLowerCase().replace(/\s+/g, "-")}-${fs.length}`,
              tipo_factor: tipo,
              clave,
              etiqueta,
              valor,
              activo: true,
            },
          ]),

        desactivarFactor: (idFactor) =>
          mutarFactores((fs) =>
            fs.map((f) => (f.id_factor === idFactor ? { ...f, activo: false } : f)),
          ),

        reactivarFactor: (idFactor) =>
          mutarFactores((fs) =>
            fs.map((f) => (f.id_factor === idFactor ? { ...f, activo: true } : f)),
          ),

        marcarCalibrado: (fecha) =>
          mutarMotor(
            (m) => ({
              ...m,
              estado_calibracion: "calibrado",
              fecha_calibracion: fecha ?? new Date().toISOString(),
            }),
            false,
          ),

        declararCalibradoManualmente: () =>
          mutarMotor(
            (m) => ({
              ...m,
              estado_calibracion: "calibrado_manualmente",
              fecha_calibracion: new Date().toISOString(),
            }),
            false,
          ),

        aplicarMotorCalibrado: (motor) =>
          mutarMotor(
            () => ({
              ...motor,
              estado_calibracion: "calibrado",
              fecha_calibracion: new Date().toISOString(),
            }),
            false,
          ),

        copiarCoeficientesDesde: (idOrigen) => {
          const s = get();
          const origen = s.motoresPorProyecto[idOrigen];
          const destino = s.motoresPorProyecto[s.idProyectoActivo];
          if (!origen || !destino) return false;
          const copiables = origen.factores.filter(
            (f) => f.tipo_factor === "vista" || f.tipo_factor === "orientacion",
          );
          const factores = [...destino.factores];
          for (const f of copiables) {
            const i = factores.findIndex(
              (x) => x.tipo_factor === f.tipo_factor && x.clave === f.clave,
            );
            if (i >= 0) factores[i] = { ...factores[i]!, valor: f.valor, activo: true };
            else factores.push({ ...f, id_factor: `cp-${f.id_factor}` });
          }
          set((st) => ({
            ...st,
            motoresPorProyecto: {
              ...st.motoresPorProyecto,
              [st.idProyectoActivo]: {
                ...destino,
                nivel: { ...origen.nivel },
                tamano: { ...origen.tamano },
                factores,
                estado_calibracion: "sin_calibrar",
                fecha_calibracion: null,
                actualizado_en: new Date().toISOString(),
              },
            },
          }));
          return true;
        },

        limpiarMigracionPendiente: () => set({ migracionPendiente: null }),

        reset: () => set(structuredClone(estadoInicial)),
      };
    },
    {
      name: "sozu-precios-motor",
      version: 5,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
