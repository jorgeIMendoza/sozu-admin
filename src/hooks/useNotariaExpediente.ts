/**
 * Hook de datos para el modal de expediente del Portal Notaría.
 *
 * Responsabilidades de ESTE hook (toda la lógica de negocio):
 *   - Personas del expediente vía fetchPersonasExpediente (compradores + rep legal + cónyuge)
 *   - Doc vigente por grupo vía resolverGrupo (fuente única: expediente-obligatorios.ts)
 *   - Completitud: todos los grupos exigidos por 'notaria' validados en todas las personas
 *     (el total varía: PF=5, PM=9, cónyuge suma su propio juego)
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
  ALL_TIPO_IDS_OBLIGATORIOS,
  buildLatestPorPersonaTipo,
  fetchPersonasExpediente,
  gruposObligatorios,
  resolverGrupo,
  ESTATUS_VALIDADO,
  type PersonaExpedienteResuelta,
} from '@/utils/expediente-obligatorios';
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
  docsCompletos: number;      // Σ grupos cumplidos de todas las personas del expediente
  docsTotal: number;          // Σ grupos exigidos (varía: PF=5, PM=9, cónyuge suma su juego)
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

      // Personas del expediente: compradores activos + rep legal (PM) + cónyuge
      // (personas.id_conyuge) — fuente única de esa lista.
      const personas = await fetchPersonasExpediente({ cuentaId: idCuentaCobranza }, supabase as never);
      if (!personas.length) return { personas: [], latestByKey: {}, urlByDocId: {} };

      const docOwnerIds = [...new Set([
        ...personas.map(p => p.personaId),
        ...personas.map(p => p.repPersonaId).filter((v): v is number => v != null),
      ])];

      // Documentos obligatorios con URL — única query para el modal
      const { data: docs } = await (supabase as any)
        .from('documentos')
        .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion, url')
        .in('id_persona', docOwnerIds)
        .in('id_tipo_documento', ALL_TIPO_IDS_OBLIGATORIOS)
        .eq('activo', true)
        .eq('es_draft', false)
        .limit(1000);

      const latestByKey = buildLatestPorPersonaTipo(docs ?? []);
      const urlByDocId: Record<number, string | null> = {};
      for (const d of docs ?? []) urlByDocId[d.id] = d.url;

      return { personas, latestByKey, urlByDocId };
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

  if (data?.personas && data.latestByKey && data.urlByDocId) {
    (data.personas as PersonaExpedienteResuelta[]).forEach((persona, index) => {
      const gruposDisplay: GrupoStatusDisplay[] = [];
      const gruposForZip: GrupoDocStatus[] = [];

      // Grupos según tipo de persona (PF/PM); los de owner 'rep' se evalúan
      // contra la persona del representante legal.
      for (const grupo of gruposObligatorios(persona.tipoPersona, 'notaria')) {
        const ownerId = grupo.owner === 'rep' ? persona.repPersonaId : persona.personaId;
        const { doc, cumplido } = resolverGrupo(ownerId, grupo, data.latestByKey);
        const estatusId = cumplido ? ESTATUS_VALIDADO : doc?.estatusId ?? null;
        const docId = doc?.id ?? null;
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

      compradoresDisplay.push({ idPersona: persona.personaId, nombre: persona.nombre, folderIndex: index + 1, grupos: gruposDisplay });
      compradoresForZip.push({ idPersona: persona.personaId, nombre: persona.nombre, folderIndex: index + 1, grupos: gruposForZip });
    });
  }

  // El total ya no es fijo: PF exige 5, PM 9, y el cónyuge suma su propio juego.
  const docsCompletos = compradoresDisplay.reduce(
    (sum, c) => sum + c.grupos.filter(g => g.estatusId === ESTATUS_VALIDADO).length, 0
  );
  const docsTotal = compradoresDisplay.reduce((sum, c) => sum + c.grupos.length, 0);
  const isCompleto = compradoresDisplay.length > 0 && docsCompletos === docsTotal;
  const downloadableCount = compradoresDisplay.reduce(
    (sum, c) => sum + c.grupos.filter(g => g.estatusId === ESTATUS_VALIDADO && g.hasDoc).length, 0
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
