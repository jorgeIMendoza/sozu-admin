/**
 * Hook de datos para el modal de expediente del Portal Notaría.
 *
 * Responsabilidades de ESTE hook (toda la lógica de negocio):
 *   - Waterfall de queries: cuentas_cobranza → compradores → personas → documentos
 *   - Construcción de buildLatestDocByKey (selección del doc más reciente por grupo)
 *   - Determinación de completitud del expediente (5/5 grupos validados × todos los compradores)
 *   - Construcción de ExpedienteZipInput para buildExpedienteZip (URLs en bruto — NO resueltas)
 *   - Invocación de buildExpedienteZip y seguimiento de progreso
 *   - Emisión de eventos de auditoría (EXPEDIENTE_VIEWED, EXPEDIENTE_DOWNLOAD_*)
 *
 * El modal es exclusivamente presentación. No contiene lógica de negocio.
 *
 * Filtro de seguridad MVP:
 *   La query filtra por `.eq('id_notario', notarioId)` en cuentas_cobranza.
 *   ESTE FILTRO NO ES UN MECANISMO DE SEGURIDAD — ver notaria-download.service.ts.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  OBLIGATORIO_GRUPOS,
  ALL_OBLIGATORIO_IDS,
  buildLatestDocByKey,
} from '@/utils/expediente-grupos';
import {
  buildExpedienteZip,
  type ExpedienteZipInput,
  type CompradorExpediente,
  type GrupoDocStatus,
  type BuildZipResult,
} from '@/services/notaria-download.service';
import { registrarActividadNotaria } from '@/services/notaria-actividad.service';

// ─── Display types (solo para presentación — sin URLs) ────────────────────────

export interface GrupoStatusDisplay {
  grupoKey: string;
  grupoLabel: string;
  estatusId: number | null;  // null = sin documento
  hasDoc: boolean;
}

export interface CompradorExpedienteDisplay {
  idPersona: number;
  nombre: string;
  folderIndex: number;
  grupos: GrupoStatusDisplay[];
}

export interface UseNotariaExpedienteResult {
  compradores: CompradorExpedienteDisplay[];
  isLoading: boolean;
  isError: boolean;
  isCompleto: boolean;
  docsCompletos: number;      // mínimo entre compradores
  docsTotal: number;          // siempre OBLIGATORIO_GRUPOS.length
  downloadableCount: number;  // grupos con estatusId===2 y hasDoc, traíbles como ZIP
  download: () => Promise<void>;
  isDownloading: boolean;
  downloadProgress: { current: number; total: number } | null;
  downloadResult: BuildZipResult | null;
  downloadError: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotariaExpediente({
  idCuentaCobranza,
  notarioId,
  proyecto,
  unidad,
  usuarioEmail,
  fechaGeneracion,
  enabled = true,
}: {
  idCuentaCobranza: number | null;
  notarioId: number | null;
  proyecto: string;
  unidad: string;
  usuarioEmail: string | null;
  fechaGeneracion: string;
  enabled?: boolean;
}): UseNotariaExpedienteResult {
  const [isDownloading, setIsDownloading]         = useState(false);
  const [downloadProgress, setDownloadProgress]   = useState<{ current: number; total: number } | null>(null);
  const [downloadResult, setDownloadResult]       = useState<BuildZipResult | null>(null);
  const [downloadError, setDownloadError]         = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notaria-expediente', idCuentaCobranza, notarioId],
    enabled: enabled && !!idCuentaCobranza && !!notarioId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // MVP: filtro de compatibilidad — NO mecanismo de seguridad
      const { data: cuentaCheck, error: cuentaErr } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id')
        .eq('id', idCuentaCobranza)
        .eq('id_notario', notarioId)
        .eq('activo', true)
        .single();

      if (cuentaErr || !cuentaCheck) return null;

      // Compradores activos de esta cuenta
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_persona, activo')
        .eq('id_cuenta_cobranza' as any, idCuentaCobranza)
        .eq('activo', true);

      if (!compradores?.length) return { compradores: [], docsByPersona: {}, urlByDocId: {} };

      const personaIds = compradores.map(c => (c as any).id_persona as number).filter(Boolean);

      // Personas — nombres
      const { data: personas } = await supabase
        .from('personas')
        .select('id, nombre_legal, nombre_comercial')
        .in('id', personaIds as any);
      const personaMap: Record<number, { nombre_legal: string | null; nombre_comercial: string | null }> = {};
      for (const p of personas ?? []) personaMap[(p as any).id] = p as any;

      // Documentos obligatorios con URL — única query para el modal
      const { data: docs } = await (supabase as any)
        .from('documentos')
        .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion, url')
        .in('id_persona', personaIds)
        .in('id_tipo_documento', ALL_OBLIGATORIO_IDS)
        .eq('activo', true)
        .eq('es_draft', false)
        .limit(500);

      const latestByKey = buildLatestDocByKey(docs ?? []);
      const urlByDocId: Record<number, string | null> = {};
      for (const d of docs ?? []) urlByDocId[d.id] = d.url;

      return { compradores: compradores as any[], personaMap, latestByKey, urlByDocId, personaIds };
    },
  });

  // Emit EXPEDIENTE_VIEWED once when data first loads
  useEffect(() => {
    if (data && idCuentaCobranza && notarioId) {
      registrarActividadNotaria({
        idCuentaCobranza,
        evento: 'EXPEDIENTE_VIEWED',
        usuarioEmail,
        meta: { id_notario: notarioId, proyecto, unidad },
      });
    }
    // Only on first successful load — data identity is stable once the query resolves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  // ── Derived display data ───────────────────────────────────────────────────

  const compradoresDisplay: CompradorExpedienteDisplay[] = [];
  const compradoresForZip: CompradorExpediente[] = [];

  if (data?.personaIds && data.latestByKey && data.urlByDocId) {
    data.personaIds.forEach((personaId: number, index: number) => {
      const persona = data.personaMap?.[personaId];
      const nombre = (persona?.nombre_legal || persona?.nombre_comercial || `Comprador ${index + 1}`) as string;

      const gruposDisplay: GrupoStatusDisplay[] = [];
      const gruposForZip: GrupoDocStatus[] = [];

      for (const grupo of OBLIGATORIO_GRUPOS) {
        const entry = data.latestByKey[`${personaId}__${grupo.key}`];
        const estatusId = entry?.estatusId ?? null;
        const docId = entry?.id ?? null;
        const url = docId !== null ? (data.urlByDocId[docId] ?? null) : null;

        gruposDisplay.push({
          grupoKey: grupo.key,
          grupoLabel: grupo.label,
          estatusId,
          hasDoc: docId !== null,
        });

        gruposForZip.push({
          grupoKey: grupo.key,
          grupoLabel: grupo.label,
          estatusId,
          docId,
          url,
        });
      }

      compradoresDisplay.push({ idPersona: personaId, nombre, folderIndex: index + 1, grupos: gruposDisplay });
      compradoresForZip.push({ idPersona: personaId, nombre, folderIndex: index + 1, grupos: gruposForZip });
    });
  }

  const validatedPerComprador = compradoresDisplay.map(c =>
    c.grupos.filter(g => g.estatusId === 2).length
  );
  const docsCompletos = validatedPerComprador.length > 0 ? Math.min(...validatedPerComprador) : 0;
  const docsTotal = OBLIGATORIO_GRUPOS.length;
  const isCompleto = docsCompletos === docsTotal && compradoresDisplay.length > 0;
  const downloadableCount = compradoresDisplay.reduce(
    (sum, c) => sum + c.grupos.filter(g => g.estatusId === 2 && g.hasDoc).length, 0
  );

  // ── Download action ────────────────────────────────────────────────────────

  const expedienteInput: ExpedienteZipInput = {
    proyecto,
    unidad,
    cuentaId: idCuentaCobranza ?? 0,
    compradores: compradoresForZip,
    usuarioEmail,
    fechaGeneracion,
  };

  const download = async () => {
    if (isDownloading || !idCuentaCobranza) return;
    setIsDownloading(true);
    setDownloadProgress(null);
    setDownloadResult(null);
    setDownloadError(null);

    try {
      const result = await buildExpedienteZip(
        expedienteInput,
        (current, total) => setDownloadProgress({ current, total }),
      );
      setDownloadResult(result);

      // COMPLETO solo si todos los grupos de todos los compradores están validados
      // Y no hubo saltos ni fallos en el ZIP.
      const evento = (isCompleto && result.skippedCount === 0 && result.failedFiles.length === 0)
        ? 'EXPEDIENTE_DOWNLOAD_COMPLETO'
        : 'EXPEDIENTE_DOWNLOAD_PARCIAL';

      const compradoresCompletosCount = compradoresDisplay.filter(c =>
        c.grupos.every(g => g.estatusId === 2 && g.hasDoc)
      ).length;
      const documentosNoValidados = compradoresDisplay.reduce(
        (sum, c) => sum + c.grupos.filter(g => g.hasDoc && g.estatusId !== 2).length, 0
      );

      registrarActividadNotaria({
        idCuentaCobranza,
        evento,
        usuarioEmail,
        meta: {
          id_notario: notarioId,
          proyecto,
          unidad,
          documentos_incluidos: result.includedCount,
          documentos_faltantes: result.skippedCount,
          documentos_no_validados: documentosNoValidados,
          archivos_fallidos: result.failedFiles.length,
          compradores_completos: compradoresCompletosCount,
          compradores_incompletos: compradoresDisplay.length - compradoresCompletosCount,
        },
      });
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Error desconocido al generar el ZIP');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  return {
    compradores: compradoresDisplay,
    isLoading,
    isError,
    isCompleto,
    docsCompletos,
    docsTotal,
    downloadableCount,
    download,
    isDownloading,
    downloadProgress,
    downloadResult,
    downloadError,
  };
}
