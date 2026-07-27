import { supabase } from '@/integrations/supabase/client';
import {
  JuridicoErrorCode,
  JuridicoServiceError,
  normalizeJuridicoError,
} from './errors';

export type { JuridicoErrorCode };
export { JuridicoServiceError, normalizeJuridicoError };

// ── Enums públicos ─────────────────────────────────────────────────────────────
// CAMBIO_ETAPA excluido: reservado para T2 cambiar_etapa_asunto
// IA excluido: reservado Fase 4/5

export type TipoActuacion =
  | 'NOTIFICACION'
  | 'CONTESTACION'
  | 'AUDIENCIA'
  | 'PRUEBA'
  | 'RECURSO'
  | 'RESOLUCION'
  | 'CORRECCION'
  | 'APERTURA'
  | 'OTRO';

export type TipoOrigen = 'INTERNO' | 'EXTERNO' | 'JUZGADO' | 'PROFECO' | 'CLIENTE';

export type TipoFuente = 'MANUAL' | 'IMPORTADA';

// ── Input / Output ─────────────────────────────────────────────────────────────

export interface RegistrarActuacionInput {
  /** ID del asunto jurídico (BIGINT — string o number). */
  idAsunto: string | number;
  tipoActuacion: TipoActuacion;
  origen: TipoOrigen;
  /** Fecha ISO 'YYYY-MM-DD'. No puede ser futura ni vacía. */
  fechaActuacion: string;
  /** Descripción. 1–5 000 caracteres. */
  descripcion: string;
  resultado?: string | null;
  tipoFuente?: TipoFuente;
  /** ID del documento vinculado al asunto (opcional). BIGINT como string o number. */
  idDocumento?: string | number | null;
}

export interface RegistrarActuacionResult {
  /** ID de la actuacion_procesal creada. BIGINT devuelto como string. */
  id: string;
  /** ID del asunto. BIGINT devuelto como string. */
  idAsunto: string;
}

// ── Validador de envelope ──────────────────────────────────────────────────────

function assertValidEnvelope(
  data: unknown,
): asserts data is { success: true; data: { id: string; id_asunto: string } } {
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as any).success !== true ||
    typeof (data as any).data?.id !== 'string' ||
    typeof (data as any).data?.id_asunto !== 'string'
  ) {
    throw new JuridicoServiceError(
      'JUR-CONTRACT_VIOLATION',
      `Envelope inválido o respuesta vacía del servidor: ${JSON.stringify(data)}`,
    );
  }
}

// ── Función principal ──────────────────────────────────────────────────────────

export async function registrarActuacion(
  input: RegistrarActuacionInput,
): Promise<RegistrarActuacionResult> {
  const { data, error } = await (supabase as any).rpc('registrar_actuacion', {
    p_id_asunto:       input.idAsunto,
    p_tipo_actuacion:  input.tipoActuacion,
    p_origen:          input.origen,
    p_fecha_actuacion: input.fechaActuacion,
    p_descripcion:     input.descripcion,
    p_resultado:       input.resultado   ?? null,
    p_tipo_fuente:     input.tipoFuente  ?? 'MANUAL',
    p_id_documento:    input.idDocumento ?? null,
  });

  if (error) throw normalizeJuridicoError(error);

  assertValidEnvelope(data);

  return {
    id:       data.data.id,
    idAsunto: data.data.id_asunto,
  };
}
