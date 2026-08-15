/**
 * CAMBIO DE MODELO — REQUIERE FIRMA DE JORGE ANTES DE MIGRAR A SUPABASE
 *
 * El precio base por m² dejó de ser un escalar del proyecto y pasó a ser
 * uno por modelo. Tablas afectadas (plural, snake_case, consistente con
 * proyectos, propiedades, personas, cuentas_cobranza):
 *
 *   motores_precio     pierde precio_base_m2 y m2_referencia
 *                      gana ancla_id_torre, ancla_nivel,
 *                           ancla_clave_vista, ancla_clave_orientacion
 *   bases_modelo       NUEVA. PK compuesta (id_motor, id_modelo)
 *                      columnas: precio_base_m2, m2_referencia, activo
 *   factores_precio    se elimina tipo_factor = 'plano'
 *
 * La migración de datos existentes debe correr como script transaccional
 * con verificación: recalcular todos los precios antes y después, y abortar
 * si alguno difiere. No confiar en la migración del cliente.
 *
 * Las versiones ya publicadas guardan snapshot_motor con el formato viejo.
 * NO las migres: son inmutables por diseño. El lector de versiones debe
 * soportar ambos formatos.
 */
import type {
  AlertaCalidad,
  ConfiguracionNivel,
  DesglosePrecio,
  Modelo,
  MotorPrecio,
  Propiedad,
  TipoFactor,
  Torre,
} from "../types/dominio";

/** Tope duro del factor de extras. */
export const TOPE_EXTRAS = 1.05;

/** Redondeo de medio hacia arriba a n decimales (consistente y determinista). */
function redondear(valor: number, decimales = 2): number {
  const f = Math.pow(10, decimales);
  return Math.round((valor + Number.EPSILON) * f) / f;
}

/**
 * Área ponderada = m2_interiores + k_ext × m2_exteriores + k_loft × m2_loft.
 */
export function calcularAreaPonderada(prop: Propiedad, motor: MotorPrecio): number {
  return prop.m2_interiores + motor.k_ext * prop.m2_exteriores + motor.k_loft * prop.m2_loft;
}

/**
 * Busca un factor activo por tipo y clave. Si no existe devuelve 1.0 y encontrado = false.
 */
export function resolverFactor(
  motor: MotorPrecio,
  tipo: TipoFactor,
  clave: string,
): { valor: number; encontrado: boolean } {
  const f = motor.factores.find(
    (x) => x.activo && x.tipo_factor === tipo && x.clave === clave,
  );
  return f ? { valor: f.valor, encontrado: true } : { valor: 1, encontrado: false };
}

/**
 * f_nivel = 1 + a × (nivel − nivel_ancla) − b × (nivel − nivel_ancla)².
 */
export function calcularFactorNivel(
  nivel: number,
  cfg: ConfiguracionNivel,
  nivelAncla = 1,
): number {
  const n = nivel - nivelAncla;
  return 1 + cfg.coef_a * n - cfg.coef_b * n * n;
}

/**
 * f_tamano = (m2_referencia / area_ponderada) ^ theta.
 * El m² de referencia es el del Modelo de la unidad.
 */
export function calcularFactorTamano(
  areaPonderada: number,
  m2Referencia: number,
  theta: number,
): number {
  if (areaPonderada <= 0 || m2Referencia <= 0) return 1;
  return Math.pow(m2Referencia / areaPonderada, theta);
}

export interface BaseResuelta {
  precio_base_m2: number;
  m2_referencia: number;
  encontrado: boolean;
}

/**
 * Resuelve el precio base por m² y el m² de referencia del Modelo de la unidad.
 *
 * Compatibilidad: los snapshot_motor de versiones publicadas antes del cambio
 * de modelo no tienen bases_modelo. En ese caso se reconstruye la base a partir
 * del escalar del proyecto y del factor de plano, y se leen ambos formatos.
 */
export function resolverBaseModelo(
  motor: MotorPrecio,
  idModelo: string,
  nombreModelo: string,
): BaseResuelta {
  const b = (motor.bases_modelo ?? []).find((x) => x.activo && x.id_modelo === idModelo);
  if (b) {
    return {
      precio_base_m2: b.precio_base_m2,
      m2_referencia: b.m2_referencia,
      encontrado: true,
    };
  }
  const legado = motor.precio_base_m2;
  if (legado !== undefined) {
    const fPlano = resolverFactor(motor, "plano", nombreModelo).valor;
    return {
      precio_base_m2: legado * fPlano,
      m2_referencia: motor.tamano.m2_referencia ?? 0,
      encontrado: true,
    };
  }
  return { precio_base_m2: 0, m2_referencia: 0, encontrado: false };
}

/**
 * f_extras = 1 + Σ incrementos de las características extra presentes, topado en 1.05.
 */
export function calcularFactorExtras(prop: Propiedad, motor: MotorPrecio): number {
  let suma = 0;
  for (const c of prop.caracteristicas_extra) {
    const f = motor.factores.find(
      (x) => x.activo && x.tipo_factor === "extras" && x.clave === c,
    );
    if (f) suma += f.valor;
  }
  return Math.min(1 + suma, TOPE_EXTRAS);
}

/** Estatus de inventario que impiden modificar el precio de lista. */
const ESTATUS_BLOQUEADOS = ["Apartada", "Vendida"];

/**
 * Una propiedad está bloqueada para reprecio cuando ya existe una oferta o una
 * operación en firme sobre ella (estatus Apartada o Vendida).
 */
export function estaBloqueadaParaReprecio(
  prop: Propiedad,
  conOfertaVigente = false,
  conConversionPendiente = false,
): boolean {
  return (
    ESTATUS_BLOQUEADOS.includes(prop.estatus) ||
    conOfertaVigente ||
    conConversionPendiente
  );
}

/** Devuelve el motivo del bloqueo de reprecio, o null si la unidad es repreciable. */
export function motivoBloqueoReprecio(
  prop: Propiedad,
  conOfertaVigente = false,
  conConversionPendiente = false,
): "apartada" | "vendida" | "oferta_vigente" | "conversion_pendiente" | null {
  if (prop.estatus === "Apartada") return "apartada";
  if (prop.estatus === "Vendida") return "vendida";
  if (conOfertaVigente) return "oferta_vigente";
  if (conConversionPendiente) return "conversion_pendiente";
  return null;
}

export interface OverrideEntrada {
  precio: number;
  causa?: string;
  descripcion?: string;
  motivo?: string;
  precio_motor_al_aplicar?: number;
}

/**
 * Calcula el desglose completo de precio de una propiedad:
 * componente exento (casa habitación) + componente gravado (cajones y bodega).
 */
export function calcularPrecio(
  prop: Propiedad,
  modelo: Modelo | undefined,
  torre: Torre | undefined,
  motor: MotorPrecio,
  override?: OverrideEntrada | null,
  conOfertaVigente = false,
  conConversionPendiente = false,
): DesglosePrecio {
  const alertas: AlertaCalidad[] = [];
  const area_ponderada = calcularAreaPonderada(prop, motor);

  const claveTorre = torre?.nombre ?? prop.id_torre;
  const clavePlano = modelo?.nombre ?? prop.id_modelo;

  const rTorre = resolverFactor(motor, "torre", claveTorre);
  const rVista = resolverFactor(motor, "vista", prop.vista);
  const rOrient = resolverFactor(motor, "orientacion", prop.orientacion);
  const base = resolverBaseModelo(motor, prop.id_modelo, clavePlano);

  const faltantes: Array<[string, string, boolean]> = [
    ["torre", claveTorre, rTorre.encontrado],
    ["vista", prop.vista, rVista.encontrado],
    ["orientacion", prop.orientacion, rOrient.encontrado],
  ];
  for (const [tipo, clave, encontrado] of faltantes) {
    if (!encontrado) {
      alertas.push({
        codigo: "FACTOR_FALTANTE",
        severidad: "advertencia",
        mensaje: `No hay factor configurado para ${tipo}: ${clave}. Se aplicó 1.0000.`,
      });
    }
  }

  if (!base.encontrado) {
    alertas.push({
      codigo: "BASE_MODELO_FALTANTE",
      severidad: "critica",
      mensaje: `No hay precio base configurado para el modelo ${clavePlano}. Captúralo en la Configuración del Motor.`,
    });
  }

  const f_nivel = calcularFactorNivel(prop.nivel, motor.nivel, motor.ancla?.nivel ?? 1);
  const f_tamano = calcularFactorTamano(area_ponderada, base.m2_referencia, motor.tamano.theta);
  const f_extras = calcularFactorExtras(prop, motor);

  const componente_exento_raw =
    base.precio_base_m2 *
    area_ponderada *
    rTorre.valor *
    f_nivel *
    rVista.valor *
    rOrient.valor *
    f_extras *
    f_tamano;

  const factorCajon = prop.tipo_cajon === "tandem" ? motor.factor_cajon_tandem : 1;
  const componente_gravado_raw =
    prop.num_cajones * motor.precio_cajon * factorCajon +
    prop.m2_bodega * motor.precio_m2_bodega;

  const componente_exento = redondear(componente_exento_raw);
  const componente_gravado = redondear(componente_gravado_raw);
  const precio_calculado = redondear(componente_exento_raw + componente_gravado_raw);

  const precio_override = override ? redondear(override.precio) : null;
  const motivo_override = override
    ? (override.descripcion ?? override.motivo ?? "")
    : null;
  const precio_lista = precio_override ?? precio_calculado;

  const delta_vs_actual = redondear(precio_lista - prop.precio_lista_actual);
  const delta_pct =
    prop.precio_lista_actual > 0
      ? redondear(((precio_lista - prop.precio_lista_actual) / prop.precio_lista_actual) * 100, 4)
      : 0;

  const motivo_bloqueo = motivoBloqueoReprecio(
    prop,
    conOfertaVigente,
    conConversionPendiente,
  );
  const bloqueada_para_reprecio = motivo_bloqueo !== null;

  const declaraExterior =
    !!modelo &&
    modelo.caracteristicas.some((c) => c === "Balcón" || c === "Terraza");
  if (declaraExterior && prop.m2_exteriores === 0) {
    alertas.push({
      codigo: "BALCON_SIN_AREA",
      severidad: "advertencia",
      mensaje:
        "El modelo declara balcón o terraza pero la propiedad tiene 0 m² exteriores. El área exterior no está entrando al precio.",
    });
  }

  if (prop.num_cajones === 0) {
    alertas.push({
      codigo: "SIN_CAJON",
      severidad: "informativa",
      mensaje: "La propiedad no tiene cajones asignados. El componente gravado es cero.",
    });
  }

  if (prop.precio_lista_actual === 0) {
    alertas.push({
      codigo: "SIN_PRECIO_ACTUAL",
      severidad: "informativa",
      mensaje:
        "La unidad no tiene precio de lista capturado. No hay base de comparación.",
    });
  }

  // El ancla es, por construcción, la combinación de menor valor del proyecto.
  // Una unidad cuyo precio por m² queda debajo del ancla de su modelo delata
  // un factor mal capturado o un precio de lista incorrecto.
  if (base.precio_base_m2 > 0 && area_ponderada > 0) {
    const porM2 = precio_lista / area_ponderada;
    if (porM2 < base.precio_base_m2 * 0.99) {
      alertas.push({
        codigo: "PRECIO_BAJO_ANCLA",
        severidad: "advertencia",
        mensaje: `El precio por m² (${porM2.toFixed(2)}) queda por debajo del precio base del modelo en la unidad ancla (${base.precio_base_m2.toFixed(2)}). Ninguna unidad debería valer menos que el ancla.`,
      });
    }
  }

  // Compuerta: antes de calibrar, toda desviación es esperada por construcción.
  const estado = motor.estado_calibracion ?? "sin_calibrar";
  if (
    (estado === "calibrado" || estado === "calibrado_manualmente") &&
    prop.precio_lista_actual > 0 &&
    Math.abs(delta_pct) > 5
  ) {
    alertas.push({
      codigo: "DELTA_ALTO",
      severidad: "advertencia",
      mensaje: `El precio calculado se desvía ${delta_pct.toFixed(1)}% del precio de lista actual. Revisa la calibración antes de publicar.`,
    });
  }

  if (
    motivo_bloqueo !== null &&
    motivo_bloqueo !== "oferta_vigente" &&
    motivo_bloqueo !== "conversion_pendiente" &&
    prop.precio_lista_actual > 0 &&
    Math.abs((precio_calculado - prop.precio_lista_actual) / prop.precio_lista_actual) >
      0.001
  ) {
    alertas.push({
      codigo: "PRECIO_BLOQUEADO",
      severidad: "critica",
      mensaje: `Esta unidad está ${prop.estatus}. Su precio no puede modificarse: existe una oferta o una operación en firme. Cualquier cambio sobre un precio ya ofrecido es una infracción a la Ley Federal de Protección al Consumidor.`,
    });
  }

  if (precio_override !== null) {
    alertas.push({
      codigo: "OVERRIDE_ACTIVO",
      severidad: "informativa",
      mensaje: `Precio con override manual. Motivo: ${motivo_override}.`,
    });

    const base = override?.precio_motor_al_aplicar;
    if (base && base > 0 && Math.abs((precio_calculado - base) / base) > 0.01) {
      alertas.push({
        codigo: "OVERRIDE_DESACTUALIZADO",
        severidad: "advertencia",
        mensaje: `Este override se fijó cuando el motor calculaba ${formatoMonto(base)}. El motor ahora calcula ${formatoMonto(precio_calculado)}. Revisa si el override sigue siendo válido.`,
      });
    }
  }

  return {
    id_propiedad: prop.id_propiedad,
    area_ponderada,
    f_torre: rTorre.valor,
    f_nivel,
    f_vista: rVista.valor,
    f_orientacion: rOrient.valor,
    f_extras,
    f_tamano,
    componente_exento,
    componente_gravado,
    precio_calculado,
    precio_override,
    motivo_override,
    precio_lista,
    delta_vs_actual,
    delta_pct,
    bloqueada_para_reprecio,
    motivo_bloqueo,
    alertas,
  };
}

function formatoMonto(v: number): string {
  return `$${v.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calcula el desglose de un lote de propiedades usando catálogos indexados por id.
 */
export function calcularLote(
  props: Propiedad[],
  catalogos: {
    modelos: Record<string, Modelo>;
    torres: Record<string, Torre>;
    overrides?: Record<string, OverrideEntrada>;
    /** Ids de propiedades con una oferta vigente que bloquea el reprecio. */
    conOfertaVigente?: Set<string>;
    /** Ids con oferta convertida cuyo estatus de inventario sigue sin actualizarse. */
    conConversionPendiente?: Set<string>;
  },
  motor: MotorPrecio,
): DesglosePrecio[] {
  return props.map((p) =>
    calcularPrecio(
      p,
      catalogos.modelos[p.id_modelo],
      catalogos.torres[p.id_torre],
      motor,
      catalogos.overrides?.[p.id_propiedad] ?? null,
      catalogos.conOfertaVigente?.has(p.id_propiedad) ?? false,
      catalogos.conConversionPendiente?.has(p.id_propiedad) ?? false,
    ),
  );
}

/** Umbral de consolidación: por encima de este porcentaje la alerta es del proyecto. */
export const UMBRAL_AGREGACION = 0.3;

/** Alertas que nunca se consolidan, por su naturaleza legal. */
const NUNCA_AGREGA = new Set(["PRECIO_BLOQUEADO"]);
/** Alertas que siempre se consolidan a nivel proyecto cuando existen. */
const SIEMPRE_AGREGA = new Set(["SIN_PRECIO_ACTUAL"]);

export interface AlertaAgregada {
  codigo: string;
  severidad: string;
  conteo: number;
  porcentaje: number;
  mensaje: string;
}

function mensajeAgregado(
  codigo: string,
  conteo: number,
  pct: number,
  ejemplo: AlertaCalidad,
): string {
  if (codigo === "BALCON_SIN_AREA") {
    return `${conteo} unidades (${pct.toFixed(0)}%) declaran balcón o terraza en su modelo pero tienen 0 m² exteriores registrados. El área exterior no está entrando al precio en ningún caso. Esto sugiere que la medición de áreas exteriores no se está capturando en el inventario, no que estas unidades carezcan de balcón. Corrígelo en el inventario antes de calibrar.`;
  }
  if (codigo === "SIN_PRECIO_ACTUAL") {
    return `${conteo} unidades (${pct.toFixed(0)}%) no tienen precio de lista capturado. No hay base de comparación para estas unidades.`;
  }
  return `${conteo} unidades (${pct.toFixed(0)}%): ${ejemplo.mensaje}`;
}

/**
 * Separa las alertas del lote en avisos agregados a nivel proyecto (cuando una
 * misma alerta afecta a más del 30% del inventario) y alertas específicas de unidad.
 */
export function agregarAlertas(desgloses: DesglosePrecio[]): {
  agregadas: AlertaAgregada[];
  porUnidad: Record<string, AlertaCalidad[]>;
} {
  const total = desgloses.length;
  const conteos = new Map<string, { conteo: number; ejemplo: AlertaCalidad }>();

  for (const d of desgloses) {
    const vistos = new Set<string>();
    for (const a of d.alertas) {
      if (vistos.has(a.codigo)) continue;
      vistos.add(a.codigo);
      const prev = conteos.get(a.codigo);
      if (prev) prev.conteo += 1;
      else conteos.set(a.codigo, { conteo: 1, ejemplo: a });
    }
  }

  const consolidados = new Set<string>();
  const agregadas: AlertaAgregada[] = [];

  for (const [codigo, { conteo, ejemplo }] of conteos) {
    if (NUNCA_AGREGA.has(codigo)) continue;
    const porcentaje = total > 0 ? (conteo / total) * 100 : 0;
    const consolidar =
      SIEMPRE_AGREGA.has(codigo) || (total > 0 && conteo / total > UMBRAL_AGREGACION);
    if (!consolidar) continue;
    consolidados.add(codigo);
    agregadas.push({
      codigo,
      severidad: ejemplo.severidad,
      conteo,
      porcentaje,
      mensaje: mensajeAgregado(codigo, conteo, porcentaje, ejemplo),
    });
  }

  agregadas.sort((a, b) => b.conteo - a.conteo);

  const porUnidad: Record<string, AlertaCalidad[]> = {};
  for (const d of desgloses) {
    porUnidad[d.id_propiedad] = d.alertas.filter((a) => !consolidados.has(a.codigo));
  }

  return { agregadas, porUnidad };
}
