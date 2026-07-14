/**
 * Auditoría de actividad del Portal Notaría.
 *
 * ESQUEMA REAL de app_notaria_actividad (auditado 2026-07-10):
 *   - Tabla creada directamente en BD de desarrollo sin migración registrada.
 *   - No aparece en src/integrations/supabase/types.ts (sin tipos generados).
 *   - Columnas CONFIRMADAS por código existente en AppNotariaDashboard.tsx:
 *       id_cuenta_cobranza  INTEGER   — FK a cuentas_cobranza
 *       evento              TEXT      — Nombre del evento
 *       usuario_email       TEXT      — Email del usuario que ejecutó la acción
 *   - Columna PROBABLE pero NO confirmada por DDL o tipos:
 *       detalle             JSONB     — Metadata estructurada adicional
 *
 * COMPORTAMIENTO DETERMINISTA:
 *   1. Intenta INSERT con detalle si se provee meta (columna podría existir).
 *   2. Si falla y había meta, reintenta con solo las 3 columnas confirmadas.
 *   3. Si el segundo intento también falla, registra console.warn — no silencioso.
 *   4. Fire-and-forget: no bloquea la descarga (sin await en el caller).
 *
 * DATOS QUE SE PERSISTEN HOY (garantizados):
 *   id_cuenta_cobranza, evento, usuario_email
 *
 * DATOS PENDIENTES HASTA QUE SE CONFIRME COLUMNA detalle:
 *   id_notario, unidad, proyecto, documentos_incluidos,
 *   documentos_faltantes, comprobantes_incluidos, archivos_fallidos
 */

import { supabase } from '@/integrations/supabase/client';

export type NotariaEvento =
  | 'EXPEDIENTE_VIEWED'
  | 'EXPEDIENTE_DOWNLOAD_COMPLETO'
  | 'EXPEDIENTE_DOWNLOAD_PARCIAL'
  | 'PAGOS_DOWNLOAD'
  | 'ESCRITURACION_UPDATED';

interface RegistrarActividadParams {
  idCuentaCobranza: number;
  evento: NotariaEvento;
  usuarioEmail: string | null;
  meta?: {
    // Shared
    id_notario?: number | null;
    unidad?: string | null;
    proyecto?: string | null;
    // EXPEDIENTE_DOWNLOAD_*
    documentos_incluidos?: number;
    documentos_faltantes?: number;
    documentos_no_validados?: number;
    comprobantes_incluidos?: number;
    archivos_fallidos?: number;
    compradores_completos?: number;
    compradores_incompletos?: number;
    // ESCRITURACION_UPDATED
    campos_actualizados?: string[];
    // PAGOS_DOWNLOAD
    pagos_sin_comprobante?: number;
    archivos_duplicados?: number;
    archivos_invalidos?: number;
    cuentas_incluidas?: number;
    descarga_parcial?: boolean;
  };
}

export function registrarActividadNotaria(params: RegistrarActividadParams): void {
  const base = {
    id_cuenta_cobranza: params.idCuentaCobranza,
    evento: params.evento,
    usuario_email: params.usuarioEmail,
  };

  // Fire-and-forget: no bloquea la descarga
  (async () => {
    const payload = params.meta ? { ...base, detalle: params.meta } : base;
    const { error } = await (supabase as any).from('app_notaria_actividad').insert(payload);

    if (!error) return;

    if (params.meta) {
      // Columna detalle probablemente no existe — reintentar con columnas confirmadas
      const { error: error2 } = await (supabase as any).from('app_notaria_actividad').insert(base);
      if (error2) {
        console.warn(`[notaria-actividad] ${params.evento} failed:`, error2.message);
      }
    } else {
      console.warn(`[notaria-actividad] ${params.evento} failed:`, error.message);
    }
  })();
}
