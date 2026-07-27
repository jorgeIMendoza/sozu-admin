import { supabase } from '@/integrations/supabase/client';
import {
  JuridicoErrorCode,
  JuridicoServiceError,
  normalizeJuridicoError,
} from './errors';

export type { JuridicoErrorCode };
export { JuridicoServiceError, normalizeJuridicoError };

// ── Enums públicos ─────────────────────────────────────────────────────────────

export type OrigenExpediente = 'SOZU_ACTORA' | 'COMPRADOR_ACTOR' | 'PROFECO';

export type PosicionSozu = 'ACTOR' | 'DEMANDADO' | 'PROMOVENTE' | 'PROVEEDOR';

// ── Input / Output ─────────────────────────────────────────────────────────────

export interface CrearExpedienteInput {
  /** ID de la propiedad (BIGINT — string o number). */
  idPropiedad: string | number;
  /** ID del proyecto. Debe coincidir con la cadena propiedad→edificio. */
  idProyecto: number;
  /** ID del tipo de asunto inicial (BIGINT — string o number). */
  idTipoAsunto: string | number;
  origen: OrigenExpediente;
  posicionSozu: PosicionSozu;
}

export interface CrearExpedienteResult {
  /** ID del expediente creado. BIGINT devuelto como string. */
  idExpediente: string;
  /** ID del asunto inicial creado. BIGINT devuelto como string. */
  idAsunto: string;
  /** Folio visible del expediente (ej. EXP-000045). */
  folioExpediente: string;
  /** Folio visible del asunto (ej. ASU-000123). */
  folioAsunto: string;
  /** ID del tipo de asunto inicial. BIGINT devuelto como string. */
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

export async function crearExpediente(
  input: CrearExpedienteInput,
): Promise<CrearExpedienteResult> {
  const { data, error } = await (supabase as any).rpc('crear_expediente', {
    p_id_propiedad:   input.idPropiedad,
    p_id_proyecto:    input.idProyecto,
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
