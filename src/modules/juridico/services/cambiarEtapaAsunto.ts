import { supabase } from '@/integrations/supabase/client';
import {
  JuridicoErrorCode,
  JuridicoServiceError,
  normalizeJuridicoError,
} from './errors';

export type { JuridicoErrorCode };
export { JuridicoServiceError, normalizeJuridicoError };

// ── Input / Output ─────────────────────────────────────────────────────────────

export interface CambiarEtapaAsuntoInput {
  /** ID del asunto jurídico (BIGINT — string o number). */
  idAsunto: string | number;
  /** ID de la etapa destino (BIGINT — string o number). Debe ser del mismo tipo_asunto. */
  idEtapaNueva: string | number;
  /** Descripción del cambio. 1–5 000 caracteres. */
  descripcion: string;
}

export interface CambiarEtapaAsuntoResult {
  /** ID de la actuación CAMBIO_ETAPA creada. BIGINT devuelto como string. */
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

export async function cambiarEtapaAsunto(
  input: CambiarEtapaAsuntoInput,
): Promise<CambiarEtapaAsuntoResult> {
  const { data, error } = await (supabase as any).rpc('cambiar_etapa_asunto', {
    p_id_asunto:      input.idAsunto,
    p_id_etapa_nueva: input.idEtapaNueva,
    p_descripcion:    input.descripcion,
  });

  if (error) throw normalizeJuridicoError(error);

  assertValidEnvelope(data);

  return {
    id:       data.data.id,
    idAsunto: data.data.id_asunto,
  };
}
