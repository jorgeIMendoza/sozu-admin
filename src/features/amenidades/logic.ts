// =============================================================
// Portal Condominio · Amenidades — lógica pura (estado de slot, caducidades)
// =============================================================
import type { BloqueoMantenimiento, EstadoSlot, Reserva } from "./types";

// Estados de reserva que OCUPAN el slot (bloquean el calendario).
const ESTADOS_ACTIVOS: EstadoSlot[] = ["apartado", "por_pagar", "reservada"];

/** Reserva activa (ocupa el slot) para un espacio/fecha/franja, si existe. */
export function reservaActivaDe(
  reservas: Reserva[],
  espacioId: string,
  fecha: string,
  franja: string,
): Reserva | undefined {
  return reservas.find(
    (r) =>
      r.espacioId === espacioId &&
      r.fecha === fecha &&
      r.franja === franja &&
      ESTADOS_ACTIVOS.includes(r.estado),
  );
}

/** ¿Hay bloqueo de mantenimiento cubriendo esa fecha para el espacio? */
export function bloqueoDe(
  bloqueos: BloqueoMantenimiento[],
  espacioId: string,
  fecha: string,
): BloqueoMantenimiento | undefined {
  return bloqueos.find(
    (b) => b.espacioId === espacioId && fecha >= b.fechaInicio && fecha <= b.fechaFin,
  );
}

/** Estado efectivo del slot: reserva activa > mantenimiento > disponible. */
export function estadoDeSlot(
  reservas: Reserva[],
  bloqueos: BloqueoMantenimiento[],
  espacioId: string,
  fecha: string,
  franja: string,
): { estado: EstadoSlot; reserva?: Reserva } {
  const r = reservaActivaDe(reservas, espacioId, fecha, franja);
  if (r) return { estado: r.estado, reserva: r };
  if (bloqueoDe(bloqueos, espacioId, fecha)) return { estado: "mantenimiento" };
  return { estado: "disponible" };
}

/** Fecha límite (ms) de un hold de apartado, dado el parámetro de horas. */
export function limiteHold(r: Reserva, holdHoras: number): number | null {
  if (!r.holdCreadoEn) return null;
  return new Date(r.holdCreadoEn).getTime() + holdHoras * 3600_000;
}

/** Fecha límite (ms) de la ventana de pago, dado el parámetro de horas. */
export function limitePago(r: Reserva, pagoHoras: number): number | null {
  if (!r.pagoHabilitadoEn) return null;
  return new Date(r.pagoHabilitadoEn).getTime() + pagoHoras * 3600_000;
}

/** Milisegundos restantes hasta una fecha límite (negativo = vencido). */
export function restanteMs(limiteMs: number | null, ahora: number): number | null {
  if (limiteMs == null) return null;
  return limiteMs - ahora;
}
