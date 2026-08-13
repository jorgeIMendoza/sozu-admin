/**
 * Fuente única para decidir a qué bucket de Storage se sube la evidencia de un pago.
 *
 *   ceps_stp             → STP (6) y STP-manual (7) siempre; Transferencia (5) cuando la
 *                          evidencia es un CEP.
 *   evidencias_efectivo  → Efectivo (1), Cheque (2), tarjetas (3, 4), Cesión (8) y cualquier
 *                          otro método; Transferencia (5) cuando la evidencia es un
 *                          comprobante y no un CEP.
 *
 * Transferencia bancaria es el único método que puede caer en los dos buckets, así que es el
 * único donde el check "Es CEP" decide. Para STP y STP-manual la evidencia ES un CEP por
 * definición y el check no puede mandarla al bucket de efectivo.
 *
 * El bucket viejo `ceps` queda deprecado: los ~167 archivos que ya viven ahí siguen
 * sirviéndose (el bucket es público) pero no se escribe nada nuevo.
 */

export const BUCKET_CEPS_STP = 'ceps_stp';
export const BUCKET_EVIDENCIAS_EFECTIVO = 'evidencias_efectivo';

export type BucketEvidencia = typeof BUCKET_CEPS_STP | typeof BUCKET_EVIDENCIAS_EFECTIVO;

/** metodos_pago.id — STP y STP-manual: su evidencia siempre es un CEP. */
export const METODOS_CEP_FORZADO = [6, 7] as const;
/** metodos_pago.id — Transferencia bancaria: puede ser CEP o comprobante. */
export const METODO_TRANSFERENCIA = 5;

const NOMBRES_CEP_FORZADO = ['stp', 'stp-manual', 'stp manual'];
const NOMBRES_TRANSFERENCIA = ['transferencia bancaria', 'transferencia'];

function normaliza(nombre?: string | null): string {
  return (nombre ?? '').trim().toLowerCase();
}

/** El método sube su evidencia siempre a `ceps_stp` (STP / STP-manual). */
export function metodoEsCepForzado(idMetodoPago?: number | null, nombreMetodo?: string | null): boolean {
  if (idMetodoPago != null) return (METODOS_CEP_FORZADO as readonly number[]).includes(idMetodoPago);
  return NOMBRES_CEP_FORZADO.includes(normaliza(nombreMetodo));
}

/** El método admite CEP pero no lo garantiza (Transferencia bancaria). */
export function metodoAdmiteCep(idMetodoPago?: number | null, nombreMetodo?: string | null): boolean {
  if (metodoEsCepForzado(idMetodoPago, nombreMetodo)) return true;
  if (idMetodoPago != null) return idMetodoPago === METODO_TRANSFERENCIA;
  return NOMBRES_TRANSFERENCIA.includes(normaliza(nombreMetodo));
}

/**
 * Bucket destino de la evidencia.
 *
 * @param idMetodoPago  metodos_pago.id. Si no se conoce se usa `nombreMetodo`.
 * @param nombreMetodo  nombre del método (RP solo trae el nombre, no el id).
 * @param esCep         check "Es CEP" del modal. Solo decide en Transferencia bancaria.
 */
export function resolveBucketEvidencia({
  idMetodoPago,
  nombreMetodo,
  esCep = false,
}: {
  idMetodoPago?: number | null;
  nombreMetodo?: string | null;
  esCep?: boolean;
}): BucketEvidencia {
  if (metodoEsCepForzado(idMetodoPago, nombreMetodo)) return BUCKET_CEPS_STP;
  if (esCep && metodoAdmiteCep(idMetodoPago, nombreMetodo)) return BUCKET_CEPS_STP;
  return BUCKET_EVIDENCIAS_EFECTIVO;
}

/**
 * Ruta canónica dentro del bucket: `{cuentaId}/{pagoId}/{timestamp}.{ext}`.
 * Los flujos viejos escribían en la raíz del bucket `documentos` con nombres tipo
 * `evidencia_{ts}_{nombre}`, imposibles de rastrear por cuenta.
 */
export function pathEvidencia(cuentaId: number | string, pagoId: number | string, fileName: string): string {
  const ext = fileName.split('.').pop() ?? 'bin';
  return `${cuentaId}/${pagoId}/${Date.now()}.${ext}`;
}
