import type {
  AlertaCalidad,
  DesglosePrecio,
  MotorPrecio,
  OfertaVigente,
  Propiedad,
  VersionLista,
} from "../types/dominio";
import type { DatosVersion } from "../stores/versionesStore";
import type { OverridePrecio } from "../stores/listaStore";
import { ACTOR_ACTUAL } from "../services/auditoria";

export interface Bloqueo {
  codigo: string;
  titulo: string;
  detalle: string;
  filas: string[];
}

export interface Advertencia {
  codigo: string;
  titulo: string;
  detalle: string;
}

export interface EntradaVersion {
  propiedad: Propiedad;
  desglose: DesglosePrecio;
}

/** Arma el snapshot completo de una versión a partir del estado actual. */
export function construirDatosVersion(opciones: {
  idProyecto: string;
  nombre: string;
  motor: MotorPrecio;
  entradas: EntradaVersion[];
  excluidas?: { id_propiedad: string; motivo: string }[];
  notas?: string;
}): DatosVersion {
  const excluidas = opciones.excluidas ?? [];
  const fuera = new Set(excluidas.map((e) => e.id_propiedad));
  const incluidas = opciones.entradas.filter((e) => !fuera.has(e.propiedad.id_propiedad));

  const precios: DatosVersion["precios"] = {};
  let valor_total = 0;
  for (const { propiedad, desglose } of incluidas) {
    precios[propiedad.id_propiedad] = {
      precio_calculado: desglose.precio_calculado,
      precio_override: desglose.precio_override,
      precio_lista: desglose.precio_lista,
      componente_exento: desglose.componente_exento,
      componente_gravado: desglose.componente_gravado,
    };
    valor_total += desglose.precio_lista;
  }

  return {
    id_proyecto: opciones.idProyecto,
    nombre: opciones.nombre,
    creada_por: ACTOR_ACTUAL,
    snapshot_motor: structuredClone(opciones.motor),
    precios,
    unidades_incluidas: incluidas.map((e) => e.propiedad.id_propiedad),
    unidades_excluidas: excluidas,
    valor_total,
    notas: opciones.notas ?? "",
  };
}

export interface ConflictoOferta {
  id_propiedad: string;
  numero: string;
  precio_ofertado: number;
  precio_nuevo: number;
  diferencia: number;
  vence_en: string;
}

export interface EvaluacionPublicacion {
  bloqueos: Bloqueo[];
  advertencias: Advertencia[];
  conflictosOferta: ConflictoOferta[];
}

const CENTAVO = 0.01;

/** Evalúa compuertas duras y advertencias antes de publicar. */
export function evaluarPublicacion(opciones: {
  motor: MotorPrecio;
  entradas: EntradaVersion[];
  alertasPorUnidad: Record<string, AlertaCalidad[]>;
  overrides: Record<string, OverridePrecio>;
  ofertasVigentes: OfertaVigente[];
  versionPublicada: VersionLista | null;
}): EvaluacionPublicacion {
  const { motor, entradas, alertasPorUnidad, overrides, ofertasVigentes } = opciones;
  const bloqueos: Bloqueo[] = [];
  const advertencias: Advertencia[] = [];

  if (motor.estado_calibracion === "sin_calibrar") {
    bloqueos.push({
      codigo: "MOTOR_SIN_CALIBRAR",
      titulo: "El motor no está calibrado",
      detalle:
        "El motor no está calibrado. Publicar una lista con parámetros sin calibrar significa publicar precios que no reproducen ninguna lógica verificable.",
      filas: [],
    });
  }

  const criticas: string[] = [];
  for (const { propiedad } of entradas) {
    const alertas = alertasPorUnidad[propiedad.id_propiedad] ?? [];
    for (const a of alertas) {
      if (a.severidad === "critica") {
        criticas.push(`Unidad ${propiedad.numero} · ${a.codigo}`);
      }
    }
  }
  if (criticas.length > 0) {
    bloqueos.push({
      codigo: "ALERTAS_CRITICAS",
      titulo: `${criticas.length} alerta${criticas.length === 1 ? "" : "s"} crítica${criticas.length === 1 ? "" : "s"} activa${criticas.length === 1 ? "" : "s"}`,
      detalle: "Resuelve las alertas críticas antes de publicar la lista.",
      filas: criticas,
    });
  }

  const porId = new Map(entradas.map((e) => [e.propiedad.id_propiedad, e]));
  const conflictosOferta: ConflictoOferta[] = [];
  for (const o of ofertasVigentes) {
    const e = porId.get(o.id_propiedad);
    if (!e) continue;
    const diferencia = e.desglose.precio_lista - o.precio_ofertado;
    if (Math.abs(diferencia) > CENTAVO) {
      conflictosOferta.push({
        id_propiedad: o.id_propiedad,
        numero: e.propiedad.numero,
        precio_ofertado: o.precio_ofertado,
        precio_nuevo: e.desglose.precio_lista,
        diferencia,
        vence_en: o.vence_en,
      });
    }
  }
  if (conflictosOferta.length > 0) {
    bloqueos.push({
      codigo: "OFERTAS_VIGENTES",
      titulo: `${conflictosOferta.length} unidad${conflictosOferta.length === 1 ? "" : "es"} con oferta vigente cuyo precio cambia`,
      detalle:
        "Publicar estos precios contraviene el artículo 7 de la Ley Federal de Protección al Consumidor.",
      filas: conflictosOferta.map(
        (c) =>
          `Unidad ${c.numero} · ofertado ${c.precio_ofertado.toFixed(2)} · nuevo ${c.precio_nuevo.toFixed(2)} · diferencia ${c.diferencia.toFixed(2)} · vence ${new Date(c.vence_en).toLocaleDateString("es-MX")}`,
      ),
    });
  }

  const overridesIncompletos = Object.entries(overrides)
    .filter(([id]) => porId.has(id))
    .filter(([, o]) => !o.causa || o.descripcion.trim().length < 20)
    .map(([id]) => `Unidad ${porId.get(id)?.propiedad.numero ?? id}`);
  if (overridesIncompletos.length > 0) {
    bloqueos.push({
      codigo: "OVERRIDE_SIN_CAUSA",
      titulo: "Overrides sin causa o sin descripción",
      detalle:
        "Todo override debe tener causa tipificada y descripción documentada antes de publicarse.",
      filas: overridesIncompletos,
    });
  }

  if (motor.estado_calibracion === "calibrado_manualmente") {
    advertencias.push({
      codigo: "MOTOR_CALIBRADO_MANUALMENTE",
      titulo: "Calibración declarada, no medida",
      detalle:
        "El motor se marcó como calibrado manualmente, sin corrida de regresión. No hay R², RMSE ni MAPE que respalden los precios de esta lista.",
    });
  }

  if (motor.estado_calibracion === "desactualizado") {
    advertencias.push({
      codigo: "MOTOR_DESACTUALIZADO",
      titulo: "Motor desactualizado",
      detalle:
        "Se modificaron parámetros del motor después de la última calibración. Los precios ya no reproducen la corrida calibrada.",
    });
  }

  const sinPrecioPrevio = entradas.filter((e) => e.propiedad.precio_lista_actual === 0);
  if (sinPrecioPrevio.length > 0) {
    advertencias.push({
      codigo: "SIN_PRECIO_PREVIO",
      titulo: `${sinPrecioPrevio.length} unidades sin precio de lista previo`,
      detalle: "Se publicará su primer precio de lista.",
    });
  }

  const anterior = opciones.versionPublicada;
  if (anterior) {
    const desviadas = entradas.filter((e) => {
      const prev = anterior.precios[e.propiedad.id_propiedad];
      if (!prev || prev.precio_lista <= 0) return false;
      return (
        Math.abs((e.desglose.precio_lista - prev.precio_lista) / prev.precio_lista) > 0.1
      );
    });
    if (desviadas.length > 0) {
      advertencias.push({
        codigo: "DESVIACION_10",
        titulo: `${desviadas.length} unidades se desvían más de 10% de la versión v${anterior.numero}`,
        detalle: desviadas
          .slice(0, 12)
          .map((e) => `Unidad ${e.propiedad.numero}`)
          .join(", "),
      });
    }
  }

  return { bloqueos, advertencias, conflictosOferta };
}

// ---------- Comparación entre versiones ----------

export interface DifParametro {
  parametro: string;
  a: string;
  b: string;
}

export interface DifFactor {
  tipo: string;
  clave: string;
  a: string;
  b: string;
}

export interface DifUnidad {
  id_propiedad: string;
  precioA: number | null;
  precioB: number | null;
  delta: number;
  deltaPct: number;
}

export interface Comparacion {
  parametros: DifParametro[];
  factores: DifFactor[];
  unidades: DifUnidad[];
  conCambio: number;
  impacto: number;
  impactoPct: number;
}

/** Promedio de las bases por modelo, para comparar contra snapshots viejos. */
function promedioBase(m: MotorPrecio): number {
  const b = m.bases_modelo ?? [];
  if (!b.length) return 0;
  return b.reduce((a, x) => a + x.precio_base_m2, 0) / b.length;
}

function promedioM2Ref(m: MotorPrecio): number {
  const b = m.bases_modelo ?? [];
  if (!b.length) return 0;
  return b.reduce((a, x) => a + x.m2_referencia, 0) / b.length;
}

const PARAMETROS: Array<[string, (m: MotorPrecio) => number]> = [
  ["Precio base por m²", (m) => m.precio_base_m2 ?? promedioBase(m)],
  ["k_ext", (m) => m.k_ext],
  ["k_loft", (m) => m.k_loft],
  ["Curva de nivel · a", (m) => m.nivel.coef_a],
  ["Curva de nivel · b", (m) => m.nivel.coef_b],
  ["Tamaño · m² de referencia", (m) => m.tamano.m2_referencia ?? promedioM2Ref(m)],
  ["Tamaño · theta", (m) => m.tamano.theta],
  ["Precio por cajón", (m) => m.precio_cajon],
  ["Factor cajón tándem", (m) => m.factor_cajon_tandem],
  ["Precio por m² de bodega", (m) => m.precio_m2_bodega],
  ["Tasa de descuento anual", (m) => m.tasa_descuento_anual],
  ["Vigencia de oferta (días)", (m) => m.vigencia_oferta_dias],
];

export function compararVersiones(a: VersionLista, b: VersionLista): Comparacion {
  const parametros: DifParametro[] = [];
  for (const [nombre, leer] of PARAMETROS) {
    const va = leer(a.snapshot_motor);
    const vb = leer(b.snapshot_motor);
    if (va !== vb) {
      parametros.push({ parametro: nombre, a: String(va), b: String(vb) });
    }
  }

  const claves = new Set([
    ...a.snapshot_motor.factores.map((f) => `${f.tipo_factor}|${f.clave}`),
    ...b.snapshot_motor.factores.map((f) => `${f.tipo_factor}|${f.clave}`),
  ]);
  const factores: DifFactor[] = [];
  for (const k of claves) {
    const [tipo, clave] = k.split("|") as [string, string];
    const fa = a.snapshot_motor.factores.find(
      (f) => f.tipo_factor === tipo && f.clave === clave,
    );
    const fb = b.snapshot_motor.factores.find(
      (f) => f.tipo_factor === tipo && f.clave === clave,
    );
    const va = fa ? (fa.activo ? fa.valor.toFixed(4) : "inactivo") : "—";
    const vb = fb ? (fb.activo ? fb.valor.toFixed(4) : "inactivo") : "—";
    if (va !== vb) factores.push({ tipo, clave, a: va, b: vb });
  }

  const ids = new Set([...Object.keys(a.precios), ...Object.keys(b.precios)]);
  const unidades: DifUnidad[] = [];
  let impacto = 0;
  let conCambio = 0;
  for (const id of ids) {
    const pa = a.precios[id]?.precio_lista ?? null;
    const pb = b.precios[id]?.precio_lista ?? null;
    const delta = (pb ?? 0) - (pa ?? 0);
    if (pa !== null && pb !== null && Math.abs(delta) > CENTAVO) conCambio += 1;
    impacto += delta;
    unidades.push({
      id_propiedad: id,
      precioA: pa,
      precioB: pb,
      delta,
      deltaPct: pa && pa > 0 ? (delta / pa) * 100 : 0,
    });
  }

  return {
    parametros,
    factores,
    unidades,
    conCambio,
    impacto,
    impactoPct: a.valor_total > 0 ? (impacto / a.valor_total) * 100 : 0,
  };
}

// ---------- Reutilización de borradores y restauración ----------

const CENTAVO_V2 = 0.01;

/** Compara si un borrador existente ya refleja exactamente el estado actual. */
export function borradorSinCambios(borrador: VersionLista, datos: DatosVersion): boolean {
  if (Math.abs(borrador.valor_total - datos.valor_total) > CENTAVO_V2) return false;
  if (borrador.unidades_incluidas.length !== datos.unidades_incluidas.length) return false;
  if (borrador.unidades_excluidas.length !== datos.unidades_excluidas.length) return false;
  const idsA = new Set(borrador.unidades_incluidas);
  if (!datos.unidades_incluidas.every((id) => idsA.has(id))) return false;
  for (const id of datos.unidades_incluidas) {
    const pa = borrador.precios[id];
    const pb = datos.precios[id];
    if (!pa || !pb) return false;
    if (Math.abs(pa.precio_lista - pb.precio_lista) > CENTAVO_V2) return false;
  }
  return true;
}

/** Encuentra, dentro de las versiones del proyecto, un borrador reutilizable. */
export function encontrarBorradorReutilizable(
  versiones: VersionLista[],
  datos: DatosVersion,
): VersionLista | null {
  const borradores = versiones.filter((v) => v.estado === "borrador");
  return borradores.find((b) => borradorSinCambios(b, datos)) ?? null;
}

export interface RestauracionBorrador {
  /** Overrides a aplicar en listaStore para reproducir los precios de la versión. */
  overrides: Array<{
    id_propiedad: string;
    precio: number;
    causa: string;
    descripcion: string;
    precio_motor_al_aplicar: number;
  }>;
  /** Snapshot del motor a restaurar vía motorStore.aplicarMotorCalibrado. */
  motor: MotorPrecio;
}

/**
 * Calcula qué hay que aplicar sobre el borrador de trabajo para reproducir los
 * precios y parámetros del motor de una versión, sin tocar versiones publicadas.
 */
export function calcularRestauracionBorrador(version: VersionLista): RestauracionBorrador {
  const overrides: RestauracionBorrador["overrides"] = [];
  for (const [id, p] of Object.entries(version.precios)) {
    if (p.precio_override !== null && Math.abs(p.precio_override - p.precio_calculado) > CENTAVO_V2) {
      overrides.push({
        id_propiedad: id,
        precio: p.precio_lista,
        causa: "Precio heredado de lista anterior",
        descripcion: `Restaurado desde la versión v${version.numero} · ${version.nombre}.`,
        precio_motor_al_aplicar: p.precio_calculado,
      });
    }
  }
  return { overrides, motor: structuredClone(version.snapshot_motor) };
}
