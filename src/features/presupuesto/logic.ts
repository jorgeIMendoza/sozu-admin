// =============================================================
// Portal Condominio · Presupuesto — cálculo de derivados y formatos.
// Nada se almacena: presupuesto anual, erogado, disponible, %, variación se
// calculan a partir del catálogo + erogaciones (fuente Tesorería) + mes actual.
// Denominadores protegidos contra división por cero.
// =============================================================
import type {
  Concepto,
  CentroCosto,
  AreaGasto,
  EgresoTesoreria,
  Erogacion,
  Presupuesto,
  DerivadoPartida,
} from "./types";

/** Deriva las erogaciones (fuente única = Tesorería) desde los egresos
 *  CLASIFICADOS. Un egreso sin clasificar no produce erogación. */
export function erogacionesDesdeEgresos(egresos: EgresoTesoreria[]): Erogacion[] {
  return egresos
    .filter((e) => e.conceptoPresupuestalId)
    .map((e) => ({
      id: `ero-${e.id}`,
      conceptoId: e.conceptoPresupuestalId as string,
      egresoTesoreriaId: e.id,
      fecha: e.fecha,
      monto: e.monto,
      proveedor: e.proveedor,
      concepto: e.concepto,
    }));
}

export const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

const ceros12 = (): number[] => Array(12).fill(0);

/** Presupuesto por mes del concepto: override (12 valores) o mensual repetido. */
export function presupuestoPorMesConcepto(c: Concepto): number[] {
  if (c.presupuestoPorMes && c.presupuestoPorMes.length === 12) {
    return c.presupuestoPorMes.slice();
  }
  return Array(12).fill(c.presupuestoMensual);
}

export function presupuestoAnualConcepto(c: Concepto): number {
  return presupuestoPorMesConcepto(c).reduce((a, b) => a + b, 0);
}

/** Índice de mes 0..11 del ejercicio para la fecha dada (ms). Fuera del año se
 *  acota: ejercicios pasados → 11 (todo el año transcurrió), futuros → 0. */
export function mesActualDelEjercicio(ahoraMs: number, ejercicio: number): number {
  const d = new Date(ahoraMs);
  const y = d.getFullYear();
  if (y < ejercicio) return 0;
  if (y > ejercicio) return 11;
  return d.getMonth();
}

/** Erogado por mes (12) de un conjunto de erogaciones, acotado al ejercicio. */
export function erogadoPorMesDe(erogaciones: Erogacion[], ejercicio: number): number[] {
  const out = ceros12();
  for (const e of erogaciones) {
    const d = new Date(e.fecha + (e.fecha.length === 10 ? "T00:00:00" : ""));
    if (d.getFullYear() !== ejercicio) continue;
    const m = d.getMonth();
    if (m >= 0 && m < 12) out[m] += e.monto;
  }
  return out;
}

function derivarDe(
  presupuestoPorMes: number[],
  erogadoPorMes: number[],
  mesActual: number,
): DerivadoPartida {
  const presupuestoAnual = presupuestoPorMes.reduce((a, b) => a + b, 0);
  const erogadoAcumulado = erogadoPorMes.reduce((a, b) => a + b, 0);
  const disponible = presupuestoAnual - erogadoAcumulado;
  const porcentajeEjercido =
    presupuestoAnual > 0 ? (erogadoAcumulado / presupuestoAnual) * 100 : 0;
  // Presupuesto proporcional hasta el mes actual (inclusive).
  const presupuestoALaFecha = presupuestoPorMes
    .slice(0, mesActual + 1)
    .reduce((a, b) => a + b, 0);
  const variacion = erogadoAcumulado - presupuestoALaFecha;
  return {
    presupuestoAnual,
    presupuestoPorMes,
    erogadoAcumulado,
    erogadoPorMes,
    disponible,
    porcentajeEjercido,
    presupuestoALaFecha,
    variacion,
    sobreEjercido: variacion > 0.005,
  };
}

/** Erogaciones de un concepto. */
export function erogacionesDeConcepto(erogaciones: Erogacion[], conceptoId: string): Erogacion[] {
  return erogaciones.filter((e) => e.conceptoId === conceptoId);
}

export function derivarConcepto(
  c: Concepto,
  erogaciones: Erogacion[],
  ejercicio: number,
  mesActual: number,
): DerivadoPartida {
  const presMes = presupuestoPorMesConcepto(c);
  const erogMes = erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), ejercicio);
  return derivarDe(presMes, erogMes, mesActual);
}

function sumar12(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

export function derivarCentro(
  centro: CentroCosto,
  conceptos: Concepto[],
  erogaciones: Erogacion[],
  ejercicio: number,
  mesActual: number,
): DerivadoPartida {
  // Presupuesto: solo conceptos activos. Erogado: TODOS (un concepto desactivado
  // con erogado histórico sigue contando en el ejercicio).
  let pres = ceros12();
  let erog = ceros12();
  for (const c of conceptos) {
    if (c.centroCostoId !== centro.id) continue;
    if (c.activo) pres = sumar12(pres, presupuestoPorMesConcepto(c));
    erog = sumar12(erog, erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), ejercicio));
  }
  return derivarDe(pres, erog, mesActual);
}

export function derivarArea(
  area: AreaGasto,
  centros: CentroCosto[],
  conceptos: Concepto[],
  erogaciones: Erogacion[],
  ejercicio: number,
  mesActual: number,
): DerivadoPartida {
  const centrosArea = centros.filter((cc) => cc.areaId === area.id);
  const idsCentros = new Set(centrosArea.map((cc) => cc.id));
  let pres = ceros12();
  let erog = ceros12();
  for (const c of conceptos) {
    if (!idsCentros.has(c.centroCostoId)) continue;
    if (c.activo) pres = sumar12(pres, presupuestoPorMesConcepto(c));
    erog = sumar12(erog, erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), ejercicio));
  }
  return derivarDe(pres, erog, mesActual);
}

export function derivarTotal(
  p: Presupuesto,
  erogaciones: Erogacion[],
  mesActual: number,
): DerivadoPartida {
  let pres = ceros12();
  let erog = ceros12();
  for (const c of p.conceptos) {
    if (c.activo) pres = sumar12(pres, presupuestoPorMesConcepto(c));
    erog = sumar12(erog, erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), p.ejercicio));
  }
  return derivarDe(pres, erog, mesActual);
}

// ── Semáforo de variación ──────────────────────────────────
export type Semaforo = "dentro" | "cerca" | "excedido";

/** Semáforo por % ejercido vs % del año transcurrido (proporcionalidad):
 *  excedido si erogado > presupuesto a la fecha; cerca si está dentro del 5%. */
export function semaforoDe(d: DerivadoPartida): Semaforo {
  if (d.presupuestoALaFecha <= 0) {
    return d.erogadoAcumulado > 0 ? "excedido" : "dentro";
  }
  const ratio = d.erogadoAcumulado / d.presupuestoALaFecha;
  if (ratio > 1.0001) return "excedido";
  if (ratio >= 0.95) return "cerca";
  return "dentro";
}

// ── Formatos ────────────────────────────────────────────────
export function fmtMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function fmtPct(n: number, dec = 0): string {
  return `${n.toFixed(dec)}%`;
}

export function fmtFecha(iso: string): string {
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
