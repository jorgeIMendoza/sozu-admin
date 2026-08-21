import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnclaProyecto, FactorPrecio, MotorPrecio, TipoFactor } from "../types/dominio";
import { esMotorAnclado, reanclarMotor } from "../engine/anclaje";
import { construirMotorSemilla } from "../engine/semilla";
import { useInventarioStore } from "./inventarioStore";

interface EstadoMotor {
  motoresPorProyecto: Record<string, MotorPrecio>;
  /**
   * `""` hasta que se resuelve la lista de proyectos de SOZU. Antes había un id
   * de mock cableado aquí; con inventario real no se puede saber de antemano
   * qué proyecto existe, así que el layout elige el primero al cargarlos.
   */
  idProyectoActivo: string;
  /** Mensaje de error si la migración al anclaje por modelo no pudo aplicarse. */
  errorMigracion: string | null;
  /** Resumen antes/después de la migración, pendiente de registrar en bitácora. */
  migracionPendiente: Record<string, { antes: unknown; despues: unknown }> | null;
}

const estadoInicial: EstadoMotor = {
  motoresPorProyecto: {},
  idProyectoActivo: "",
  errorMigracion: null,
  migracionPendiente: null,
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Completa un motor guardado antes de que el precio base fuera del proyecto.
 *
 * Aquellos motores solo tenían un `precio_base_m2` por modelo. El base del
 * desarrollo se reconstruye como el promedio de esas bases ponderado por nada
 * —no se guarda el número de unidades— y cada modelo conserva su precio
 * exacto a través de su factor. La operación es neutral: ningún precio cambia.
 */
function conPrecioBaseDeProyecto(m: MotorPrecio): MotorPrecio {
  if (typeof m.precio_base_m2_proyecto === "number" && m.precio_base_m2_proyecto > 0) {
    return m;
  }
  const bases = m.bases_modelo ?? [];
  const conPrecio = bases.filter((b) => b.precio_base_m2 > 0);
  const base = conPrecio.length
    ? r2(conPrecio.reduce((a, b) => a + b.precio_base_m2, 0) / conPrecio.length)
    : 0;

  return {
    ...m,
    precio_base_m2_proyecto: base,
    bases_modelo: bases.map((b) => ({
      ...b,
      factor_modelo:
        b.factor_modelo ?? (base > 0 ? +(b.precio_base_m2 / base).toFixed(6) : 1),
    })),
  };
}

/** Inventario del proyecto activo, para reanclar contra datos reales. */
function inventarioDe(idProyecto: string) {
  return useInventarioStore.getState().inventarioDe(idProyecto);
}

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
  /**
   * Crea el motor semilla del proyecto a partir de su inventario real si aún no
   * existe. Idempotente: un motor ya trabajado nunca se pisa.
   */
  asegurarMotor: (idProyecto: string, nombreProyecto: string) => void;
  /** `null` mientras no haya proyecto activo o su motor no se haya sembrado. */
  getMotorActivo: () => MotorPrecio | null;
  actualizarParametro: (campo: CampoNumerico, valor: number) => void;
  actualizarConfigNivel: (coef_a: number, coef_b: number) => void;
  actualizarConfigTamano: (theta: number) => void;
  /**
   * Precio por m² base del proyecto. Al moverlo, el precio efectivo de cada
   * modelo se recalcula con su factor: es el dato del que todo lo demás varía.
   */
  actualizarPrecioBaseProyecto: (valor: number) => void;
  actualizarBaseModelo: (
    idModelo: string,
    campo: "precio_base_m2" | "factor_modelo" | "m2_referencia",
    valor: number,
  ) => void;
  /**
   * Deja el motor plano: cada unidad pasa a valer el precio por m² base del
   * proyecto por su área interior, sin ninguna diferenciación.
   *
   * NO es neutral —los precios cambian, y bastante—: es el punto de partida
   * para mover una variable a la vez y ver qué mueve. El precio por m² base
   * del proyecto es lo único que se conserva, porque es la escala.
   */
  ponerEnPuntoBase: () => void;
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

/**
 * Normaliza lo persistido.
 *
 * Los motores del mock vivían bajo ids de texto (`pry-daiku`) y, en versiones
 * viejas, sin anclaje. Al pasar al inventario real los ids son el id del
 * proyecto, así que aquellos motores ya no corresponden a ningún desarrollo y
 * se descartan; los que no estén anclados también, porque migrarlos exige el
 * inventario y aquí todavía no está cargado. Perder un motor de mock no cuesta
 * nada: se vuelve a sembrar del inventario real en cuanto se abre el proyecto.
 */
function normalizar(estado: unknown): EstadoMotor {
  const s = (estado ?? {}) as Partial<EstadoMotor>;
  const motores: Record<string, MotorPrecio> = {};

  for (const [id, m] of Object.entries(s.motoresPorProyecto ?? {})) {
    // El id de proyecto real es numérico; lo demás es residuo del mock.
    if (!/^\d+$/.test(id) || !esMotorAnclado(m)) continue;
    motores[id] = conPrecioBaseDeProyecto({
      ...m,
      estado_calibracion: m.estado_calibracion ?? "sin_calibrar",
      fecha_calibracion: m.fecha_calibracion ?? null,
      meses_holgura_entrega: m.meses_holgura_entrega ?? 0,
      vpn_objetivo_factor: m.vpn_objetivo_factor ?? null,
      vigencia_oferta_dias: m.vigencia_oferta_dias ?? 15,
    });
  }

  const activo = s.idProyectoActivo ?? "";
  return {
    motoresPorProyecto: motores,
    idProyectoActivo: /^\d+$/.test(activo) ? activo : "",
    errorMigracion: null,
    migracionPendiente: null,
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

        asegurarMotor: (idProyecto, nombreProyecto) => {
          if (!idProyecto || get().motoresPorProyecto[idProyecto]) return;
          const inv = useInventarioStore.getState().inventarioDe(idProyecto);
          // Sin inventario cargado no hay de qué derivar la semilla; se
          // reintenta cuando el proyecto termine de cargar.
          if (inv.propiedades.length === 0 && inv.modelos.length === 0) return;

          const { motor } = construirMotorSemilla(
            idProyecto,
            nombreProyecto,
            inv.torres,
            inv.modelos,
            inv.propiedades,
          );
          set((s) => ({
            motoresPorProyecto: { ...s.motoresPorProyecto, [idProyecto]: motor },
          }));
        },

        getMotorActivo: () => {
          const s = get();
          return s.motoresPorProyecto[s.idProyectoActivo] ?? null;
        },

        actualizarParametro: (campo, valor) =>
          mutarMotor((m) => ({ ...m, [campo]: valor })),

        actualizarConfigNivel: (coef_a, coef_b) =>
          mutarMotor((m) => ({ ...m, nivel: { coef_a, coef_b } })),

        actualizarConfigTamano: (theta) =>
          mutarMotor((m) => ({ ...m, tamano: { ...m.tamano, theta } })),

        actualizarPrecioBaseProyecto: (valor) =>
          mutarMotor((m) => {
            const base = Math.max(0, valor);
            return {
              ...m,
              precio_base_m2_proyecto: base,
              // El precio efectivo del modelo es derivado: base × factor.
              bases_modelo: m.bases_modelo.map((b) => ({
                ...b,
                precio_base_m2: r2(base * (b.factor_modelo ?? 1)),
              })),
            };
          }),

        actualizarBaseModelo: (idModelo, campo, valor) =>
          mutarMotor((m) => ({
            ...m,
            bases_modelo: m.bases_modelo.map((b) => {
              if (b.id_modelo !== idModelo) return b;
              const base = m.precio_base_m2_proyecto;

              // Precio y factor son dos vistas del mismo dato: al capturar uno
              // se deriva el otro, para que la tabla nunca quede incoherente
              // con el precio base del proyecto.
              if (campo === "factor_modelo") {
                const factor = Math.max(0, valor);
                return { ...b, factor_modelo: factor, precio_base_m2: r2(base * factor) };
              }
              if (campo === "precio_base_m2") {
                const precio = Math.max(0, valor);
                return {
                  ...b,
                  precio_base_m2: precio,
                  factor_modelo: base > 0 ? +(precio / base).toFixed(6) : 1,
                };
              }
              return { ...b, [campo]: valor };
            }),
          })),

        ponerEnPuntoBase: () =>
          mutarMotor((m) => ({
            ...m,
            // El área ponderada queda en puro interior: sin supuestos sobre
            // cuánto vale un m² de balcón o de loft.
            k_ext: 0,
            k_loft: 0,
            tasa_descuento_anual: 0,
            nivel: { coef_a: 0, coef_b: 0 },
            tamano: { theta: 0 },
            precio_cajon: 0,
            factor_cajon_tandem: 0,
            precio_m2_bodega: 0,
            // Los extras SUMAN, no multiplican: su neutro es 0, no 1.
            factores: m.factores.map((f) => ({
              ...f,
              valor: f.tipo_factor === "extras" ? 0 : 1,
            })),
            // `precio_base_m2` es lo que lee el motor, así que no basta con
            // poner el factor en 1: hay que rehacer el precio efectivo.
            bases_modelo: m.bases_modelo.map((b) => ({
              ...b,
              factor_modelo: 1,
              precio_base_m2: r2(m.precio_base_m2_proyecto),
            })),
            // Un motor plano no está calibrado, diga lo que diga la etiqueta
            // anterior: sostenerla sería afirmar una estructura que ya no existe.
            estado_calibracion: "sin_calibrar" as const,
            fecha_calibracion: null,
          })),

        setAncla: (ancla) =>
          mutarMotor((m) => {
            // El modelo ancla necesita las áreas para poder volver al promedio
            // del desarrollo, así que se pasa el inventario completo.
            const inv = inventarioDe(m.id_proyecto);
            return reanclarMotor(m, ancla, inv.torres, inv.modelos, inv.propiedades);
          }, false),

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
      // v6: los motores pasan a llevar el id real del proyecto. Los del mock
      // (`pry-daiku`, `pry-monocolo`) se descartan en `normalizar`.
      version: 6,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
