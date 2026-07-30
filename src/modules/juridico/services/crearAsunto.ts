import { supabase } from '@/integrations/supabase/client';
import {
  JuridicoErrorCode,
  JuridicoServiceError,
  normalizeJuridicoError,
} from './errors';
import type { OrigenExpediente, PosicionSozu } from './crearExpediente';

export type { JuridicoErrorCode };
export { JuridicoServiceError, normalizeJuridicoError };
export type { OrigenExpediente, PosicionSozu };

// ── Input / Output ─────────────────────────────────────────────────────────────

export interface CrearAsuntoInput {
  /** ID del expediente jurídico ACTIVO ya existente (BIGINT — string o number). */
  idExpediente: string | number;
  /** ID del tipo de asunto a agregar (BIGINT — string o number). */
  idTipoAsunto: string | number;
  origen: OrigenExpediente;
  posicionSozu: PosicionSozu;
}

export interface CrearAsuntoResult {
  /** ID del expediente (sin cambios respecto al input, devuelto como string). */
  idExpediente: string;
  /** ID del asunto nuevo creado. BIGINT devuelto como string. */
  idAsunto: string;
  /** Folio visible del expediente (no cambia — se devuelve para evitar refetch). */
  folioExpediente: string;
  /** Folio visible del asunto nuevo (ej. ASU-000123). */
  folioAsunto: string;
  /** ID del tipo de asunto creado. BIGINT devuelto como string. */
  idTipoAsunto: string;
}

// ── Validador de envelope ──────────────────────────────────────────────────────

function assertValidEnvelope(data: unknown): asserts data is {
  success: true;
  data: {
    id_expediente: string;
    id_asunto: string;
    folio_expediente: string;
    folio_asunto: string;
    id_tipo_asunto: string;
  };
} {
  const d = (data as any)?.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as any).success !== true ||
    typeof d?.id_expediente !== 'string' ||
    typeof d?.id_asunto !== 'string' ||
    typeof d?.folio_expediente !== 'string' ||
    typeof d?.folio_asunto !== 'string' ||
    typeof d?.id_tipo_asunto !== 'string'
  ) {
    throw new JuridicoServiceError(
      'JUR-CONTRACT_VIOLATION',
      `Envelope inválido o respuesta vacía del servidor: ${JSON.stringify(data)}`,
    );
  }
}

// ── Función principal ──────────────────────────────────────────────────────────

/**
 * T4 — agrega un asunto adicional a un expediente jurídico ACTIVO existente
 * (multiasunto por propiedad, ej. Queja Profeco + Demanda mercantil simultáneas).
 * No crea expediente ni bloquea cobranza — para eso ver crearExpediente.ts /
 * crearExpedienteYBloquearCobranza.ts.
 */
export async function crearAsunto(
  input: CrearAsuntoInput,
): Promise<CrearAsuntoResult> {
  const { data, error } = await (supabase as any).rpc('crear_asunto', {
    p_id_expediente:  input.idExpediente,
    p_id_tipo_asunto: input.idTipoAsunto,
    p_origen:         input.origen,
    p_posicion_sozu:  input.posicionSozu,
  });

  if (error) throw normalizeJuridicoError(error);

  assertValidEnvelope(data);

  return {
    idExpediente:    data.data.id_expediente,
    idAsunto:        data.data.id_asunto,
    folioExpediente: data.data.folio_expediente,
    folioAsunto:     data.data.folio_asunto,
    idTipoAsunto:    data.data.id_tipo_asunto,
  };
}
