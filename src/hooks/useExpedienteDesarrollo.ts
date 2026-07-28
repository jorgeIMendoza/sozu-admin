/**
 * Hook de datos para "Expediente Desarrollo" del Portal Notaría.
 *
 * Documentos a nivel PROYECTO (no por unidad/cuenta) que el desarrollador carga
 * y la notaría consulta: Régimen de condominio, Certificado de habitabilidad,
 * Pagos de predial. Usa la tabla genérica `documentos` (columna `id_proyecto`,
 * ya usada por el mismo patrón para "Brochure" — ver
 * Ejecuciones_manuales/20260727_notaria_expediente_desarrollo_tipos_documento.md).
 *
 * Bucket `documentos` es PÚBLICO (ver aviso en notaria-download.service.ts) —
 * getPublicUrl basta, no requiere signed URL.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildExpedienteDesarrolloZip,
  type DesarrolloTipoGroup,
  type ExpedienteDesarrolloZipInput,
  type BuildZipResult,
} from '@/services/notaria-download.service';

// IDs de tipos_documento — requiere el catálogo de la migración citada arriba.
export const TIPOS_EXPEDIENTE_DESARROLLO = [
  { id: 61, label: 'Régimen de condominio' },
  { id: 62, label: 'Certificado de habitabilidad' },
  { id: 14, label: 'Pagos de predial' },
] as const;

export interface DesarrolloDocDisplay {
  id: number;
  url: string;
  fechaCreacion: string | null;
}

export interface DesarrolloGrupoDisplay {
  tipoId: number;
  label: string;
  docs: DesarrolloDocDisplay[];
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

export function useExpedienteDesarrollo({
  proyectoId,
  proyectoNombre,
  usuarioEmail,
  enabled = true,
}: {
  proyectoId: number | null;
  proyectoNombre: string;
  usuarioEmail: string | null;
  enabled?: boolean;
}) {
  const qc = useQueryClient();
  const [uploadingTipoId, setUploadingTipoId] = useState<number | null>(null);
  const [uploadProgressByTipo, setUploadProgressByTipo] = useState<Record<number, { current: number; total: number } | null>>({});
  const [uploadErrorByTipo, setUploadErrorByTipo] = useState<Record<number, string[] | null>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadResult, setDownloadResult] = useState<BuildZipResult | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const queryKey = ['expediente-desarrollo', proyectoId];

  const { data: grupos = [], isLoading, isError } = useQuery({
    queryKey,
    enabled: enabled && !!proyectoId,
    staleTime: 0,
    queryFn: async (): Promise<DesarrolloGrupoDisplay[]> => {
      const tipoIds = TIPOS_EXPEDIENTE_DESARROLLO.map(t => t.id);
      const { data, error } = await (supabase as any)
        .from('documentos')
        .select('id, id_tipo_documento, url, fecha_creacion')
        .eq('id_proyecto', proyectoId)
        .in('id_tipo_documento', tipoIds)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as { id: number; id_tipo_documento: number; url: string; fecha_creacion: string | null }[];
      return TIPOS_EXPEDIENTE_DESARROLLO.map(t => ({
        tipoId: t.id,
        label: t.label,
        docs: rows
          .filter(r => r.id_tipo_documento === t.id)
          .map(r => ({ id: r.id, url: r.url, fechaCreacion: r.fecha_creacion })),
      }));
    },
  });

  const totalDocs = grupos.reduce((s, g) => s + g.docs.length, 0);

  // ── Upload (uno o varios archivos a la vez) ────────────────────────────────

  const uploadSingleFile = async (tipoId: number, file: File): Promise<void> => {
    const safeName = sanitizeFilename(file.name);
    const path = `expediente_desarrollo/${proyectoId}/${tipoId}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file);
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

    const { error: insertError } = await (supabase as any).from('documentos').insert({
      id_proyecto: proyectoId,
      id_tipo_documento: tipoId,
      url: urlData.publicUrl,
      id_estatus_verificacion: 1, // Pendiente — mismo default que CancelCuentaDialog.tsx
      activo: true,
      es_draft: false,
    });
    if (insertError) {
      // FK violation típica cuando el catálogo tipos_documento aún no tiene la fila
      // (ver Ejecuciones_manuales/20260727_notaria_expediente_desarrollo_tipos_documento.md).
      const msg = insertError.code === '23503'
        ? 'El tipo de documento no existe en el catálogo. Ejecuta la migración pendiente de tipos_documento antes de subir.'
        : insertError.message;
      throw new Error(msg);
    }
  };

  const upload = async (tipoId: number, files: File[]) => {
    if (!proyectoId || files.length === 0) return;
    setUploadingTipoId(tipoId);
    setUploadErrorByTipo(prev => ({ ...prev, [tipoId]: null }));

    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgressByTipo(prev => ({ ...prev, [tipoId]: { current: i + 1, total: files.length } }));
      try {
        await uploadSingleFile(tipoId, files[i]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido al subir el documento.';
        errors.push(files.length > 1 ? `${files[i].name}: ${msg}` : msg);
      }
    }

    if (errors.length > 0) setUploadErrorByTipo(prev => ({ ...prev, [tipoId]: errors }));
    await qc.invalidateQueries({ queryKey });
    setUploadingTipoId(null);
    setUploadProgressByTipo(prev => ({ ...prev, [tipoId]: null }));
  };

  // ── Download all ────────────────────────────────────────────────────────────

  const downloadAll = async () => {
    if (isDownloading || totalDocs === 0) return;
    setIsDownloading(true);
    setDownloadProgress(null);
    setDownloadResult(null);
    setDownloadError(null);

    const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const input: ExpedienteDesarrolloZipInput = {
      proyecto: proyectoNombre,
      grupos: grupos.map((g): DesarrolloTipoGroup => ({
        tipoLabel: g.label,
        docs: g.docs.map(d => ({ id: d.id, url: d.url, fechaCreacion: d.fechaCreacion })),
      })),
      usuarioEmail,
      fechaGeneracion,
    };

    try {
      const result = await buildExpedienteDesarrolloZip(
        input,
        (current, total) => setDownloadProgress({ current, total }),
      );
      setDownloadResult(result);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Error desconocido al generar el ZIP');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  return {
    grupos,
    totalDocs,
    isLoading,
    isError,
    upload,
    uploadingTipoId,
    uploadProgressByTipo,
    uploadErrorByTipo,
    downloadAll,
    isDownloading,
    downloadProgress,
    downloadResult,
    downloadError,
  };
}
