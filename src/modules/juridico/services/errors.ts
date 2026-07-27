// Catálogo de errores compartido — módulo jurídico Fase 2
// Importado por: registrarActuacion.ts, cambiarEtapaAsunto.ts, crearExpediente.ts,
// crearExpedienteYBloquearCobranza.ts, y futuros T4–T6.

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type JuridicoErrorCode =
  // ── T1 registrar_actuacion ─────────────────────────────────────────────────
  | 'JUR-0000'               // No autenticado o usuario inactivo          P0090
  | 'JUR-0009'               // Descripción vacía                          P0009
  | 'JUR-0010'               // CAMBIO_ETAPA es uso interno                P0010
  | 'JUR-0011'               // Asunto no encontrado o sin acceso          P0011
  | 'JUR-0012'               // Asunto inactivo                            P0012
  | 'JUR-0013'               // Fecha de actuación futura                  P0013
  | 'JUR-0014'               // Documento no pertenece al asunto           P0014
  | 'JUR-0015'               // tipo_fuente=IA reservado Fase 4/5          P0015
  | 'JUR-0016'               // Descripción supera 5 000 caracteres        P0016
  // ── T2 cambiar_etapa_asunto ────────────────────────────────────────────────
  | 'JUR-0017'               // Etapa no encontrada o inactiva             P0017
  | 'JUR-0018'               // Etapa pertenece a tipo_asunto incorrecto   P0018
  | 'JUR-0019'               // Asunto ya está en la etapa solicitada      P0019
  | 'JUR-0020'               // Etapa actual es terminal — no transicionar P0020
  // ── T3 crear_expediente ────────────────────────────────────────────────────
  | 'JUR-0021'               // Propiedad/proyecto inválido (wrap P0001)   P0021
  | 'JUR-0022'               // Origen inválido                           P0022
  | 'JUR-0023'               // Posición SOZU inválida                    P0023
  | 'JUR-0024'               // Tipo de asunto no encontrado o inactivo    P0024
  | 'JUR-0025'               // Expediente ACTIVO ya existe para propiedad P0025
  | 'JUR-0026'               // Usuario no encontrado o inactivo (T3)      P0026
  | 'JUR-0027'               // Rol sin permisos para crear expedientes    P0027
  // ── Orquestador crear_expediente_y_bloquear_cobranza ───────────────────────
  | 'JUR-0028'               // Cuenta de cobranza inválida/inactiva/no principal P0028
  // ── Genéricos ─────────────────────────────────────────────────────────────
  | 'JUR-CONTRACT_VIOLATION' // Envelope inválido o respuesta vacía
  | 'JUR-UNKNOWN';           // Error no catalogado

// ── Clase de error ────────────────────────────────────────────────────────────

export class JuridicoServiceError extends Error {
  readonly code: JuridicoErrorCode;
  readonly pgCode: string | undefined;
  readonly originalError: unknown;

  constructor(
    code: JuridicoErrorCode,
    message: string,
    pgCode?: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'JuridicoServiceError';
    this.code = code;
    this.pgCode = pgCode;
    this.originalError = originalError;
  }
}

// ── Mapa SQLSTATE → JuridicoErrorCode (todos los RPCs) ────────────────────────

export const SQLSTATE_MAP: Record<string, JuridicoErrorCode> = {
  // T1
  P0090: 'JUR-0000',
  P0009: 'JUR-0009',
  P0010: 'JUR-0010',
  P0011: 'JUR-0011',
  P0012: 'JUR-0012',
  P0013: 'JUR-0013',
  P0014: 'JUR-0014',
  P0015: 'JUR-0015',
  P0016: 'JUR-0016',
  // T2
  P0017: 'JUR-0017',
  P0018: 'JUR-0018',
  P0019: 'JUR-0019',
  P0020: 'JUR-0020',
  // T3
  P0021: 'JUR-0021',
  P0022: 'JUR-0022',
  P0023: 'JUR-0023',
  P0024: 'JUR-0024',
  P0025: 'JUR-0025',
  P0026: 'JUR-0026',
  P0027: 'JUR-0027',
  // Orquestador
  P0028: 'JUR-0028',
};

// ── Normalizador ──────────────────────────────────────────────────────────────

export function normalizeJuridicoError(error: unknown): JuridicoServiceError {
  const pgError = error as { code?: string; message?: string };
  const pgCode  = pgError?.code    ?? '';
  const message = pgError?.message ?? String(error);

  const mapped = SQLSTATE_MAP[pgCode];
  if (mapped) {
    return new JuridicoServiceError(mapped, message, pgCode, error);
  }

  const match = message.match(/\[JUR-(\d{4})\]/);
  if (match) {
    const code = `JUR-${match[1]}` as JuridicoErrorCode;
    return new JuridicoServiceError(code, message, pgCode || undefined, error);
  }

  return new JuridicoServiceError('JUR-UNKNOWN', message, pgCode || undefined, error);
}
