import { Clock, CheckCircle2, XCircle, CircleDollarSign, type LucideIcon } from "lucide-react";

/**
 * Estatus de seguimiento de una comisión en la vista "Pagar Comisiones".
 *
 * Lógica compartida entre la página, la pestaña "por Pagar" y la de "Pagadas"
 * para que el badge que se muestra y el filtro por estatus usen exactamente
 * las mismas etiquetas (evita drift entre lo que se ve y lo que se filtra).
 */

export type EstatusTone = "emerald" | "amber" | "red" | "blue" | "gray";

export type EstatusSeguimiento = {
  label: string;
  tone: EstatusTone;
  icon: LucideIcon;
};

// Etiquetas canónicas — usadas tanto en el badge como en el filtro.
export const ESTATUS_PENDIENTE = "Pendiente validación AD";
export const ESTATUS_AUTORIZADO = "Autorizado · listo para pago";
export const ESTATUS_RECHAZADO = "Rechazado";
export const ESTATUS_PAGADA = "Pagada";

/**
 * Deriva el estatus de seguimiento en base a:
 *  - `pagada` del comisionista → "Pagada".
 *  - `estatus_autorizacion_comision_*` de la cuenta (según interno/externo) →
 *      Autorizado / Rechazado / En espera.
 *  - `aprobada=false` (fallback legacy pre-DDL) → Rechazado.
 */
export function deriveEstatus(item: {
  pagada?: boolean;
  aprobada?: boolean;
  esExterno?: boolean;
  esPagadaComisionVenta?: boolean;
  estatusAutorizacionExterna?: string;
  estatusAutorizacionInterna?: string;
}): EstatusSeguimiento {
  if (item.pagada) return { label: ESTATUS_PAGADA, tone: "blue", icon: CircleDollarSign };
  const estatus = item.esExterno
    ? item.estatusAutorizacionExterna
    : item.estatusAutorizacionInterna;
  if (estatus === "Autorizado") {
    return { label: ESTATUS_AUTORIZADO, tone: "emerald", icon: CheckCircle2 };
  }
  if (estatus === "Rechazado" || item.aprobada === false) {
    return { label: ESTATUS_RECHAZADO, tone: "red", icon: XCircle };
  }
  return { label: ESTATUS_PENDIENTE, tone: "amber", icon: Clock };
}

/**
 * Opciones del filtro por estatus. Excluye el "Mixto (…)" — ese es solo un
 * artefacto de display a nivel de grupo; el filtro trabaja sobre las filas hoja.
 */
export const ESTATUS_FILTRO_OPCIONES: readonly string[] = [
  ESTATUS_PENDIENTE,
  ESTATUS_AUTORIZADO,
  ESTATUS_RECHAZADO,
  ESTATUS_PAGADA,
];

/** Valor sentinela para "sin filtro" (Radix Select no admite value=""). */
export const FILTRO_TODOS = "todos";
