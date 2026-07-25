import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Expediente de documentos de una persona (`documentos` ligados a `id_persona`).
 * Fuente única para los portales que validan documentación (agente, embajador…):
 * misma prioridad de estatus, misma subida y mismo reemplazo.
 *
 * id_estatus_verificacion: 1 Pendiente · 2 Validado · 3 Rechazado · 4 Expirado
 */

export type ExpDocEstado = 'pendiente' | 'validado' | 'revision' | 'rechazado' | 'expirado';

export interface ExpedienteDocRow {
  id: number;
  id_tipo_documento: number;
  id_estatus_verificacion: number | null;
  url: string | null;
  fecha_creacion?: string | null;
}

export const EXP_ESTADO_LABEL: Record<ExpDocEstado, string> = {
  pendiente: 'Pendiente',
  validado: 'Validado',
  revision: 'En revisión',
  rechazado: 'Rechazado',
  expirado: 'Expirado',
};

/** Traduce el id de `estatus_verificacion` al estado que se pinta en la UI. */
export function estadoFromEstatusId(ev: number | null | undefined): ExpDocEstado {
  if (ev === 2) return 'validado';
  if (ev === 3) return 'rechazado';
  if (ev === 4) return 'expirado';
  return 'revision';
}

// Prioridad para elegir la fila vigente de un tipo cuando hay varias activas:
// validado > en revisión > rechazado > expirado (una recaptura marca la anterior
// como expirada y no debe ganar).
const rank = (ev: number | null | undefined) => (ev === 2 ? 4 : ev == null || ev === 1 ? 3 : ev === 3 ? 2 : 1);

interface Params {
  personaId?: number | null;
  /** Tipos de `tipos_documento` que componen el expediente. */
  tipos: number[];
  /** Permite compartir caché/invalidación con la página que ya consulta estos docs. */
  queryKey?: unknown[];
}

export function useExpedienteDocs({ personaId, tipos, queryKey }: Params) {
  const queryClient = useQueryClient();
  const key = queryKey ?? ['expediente-docs', personaId ?? null, tipos.join('-')];
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: key,
    enabled: !!personaId && tipos.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<ExpedienteDocRow[]> => {
      if (!personaId) return [];
      const { data } = await (supabase as any)
        .from('documentos')
        .select('id, id_tipo_documento, id_estatus_verificacion, url, fecha_creacion')
        .eq('id_persona', personaId)
        .eq('activo', true)
        .in('id_tipo_documento', tipos);
      return (data || []) as ExpedienteDocRow[];
    },
  });

  const docs = query.data ?? [];

  /** Fila vigente de un tipo (la de mayor prioridad de estatus). */
  const tipoRow = useCallback(
    (tipo: number): ExpedienteDocRow | null => {
      const rws = docs.filter((d) => d.id_tipo_documento === tipo);
      if (!rws.length) return null;
      return rws.slice().sort((a, b) => rank(b.id_estatus_verificacion) - rank(a.id_estatus_verificacion))[0];
    },
    [docs],
  );

  const tipoEstado = useCallback(
    (tipo: number): ExpDocEstado => {
      const r = tipoRow(tipo);
      if (!r) return 'pendiente';
      return estadoFromEstatusId(r.id_estatus_verificacion);
    },
    [tipoRow],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: key });
  }, [queryClient, key]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Sube un archivo al bucket `documentos`, desactiva la versión anterior del mismo
   * tipo e inserta la nueva fila. `personaUpdates` permite guardar en `personas` los
   * datos confirmados del documento (p. ej. los fiscales de la Constancia).
   */
  const uploadDocFile = useCallback(
    async (
      file: File,
      tipo: number,
      opts?: { estatus?: number; personaUpdates?: Record<string, string | null>; silent?: boolean },
    ): Promise<boolean> => {
      if (!personaId) {
        toast.error('Tu usuario no tiene un perfil de persona asociado.');
        return false;
      }
      const estatus = opts?.estatus ?? 1;
      setUploading(true);
      try {
        const path = `expediente/${personaId}/${tipo}_${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from('documentos').getPublicUrl(path);
        await (supabase as any)
          .from('documentos')
          .update({ activo: false })
          .eq('id_persona', personaId)
          .eq('id_tipo_documento', tipo)
          .eq('activo', true);
        const { error: insErr } = await (supabase as any).from('documentos').insert({
          url: publicUrl,
          id_tipo_documento: tipo,
          id_persona: personaId,
          activo: true,
          id_estatus_verificacion: estatus,
        });
        if (insErr) throw insErr;
        if (opts?.personaUpdates && Object.keys(opts.personaUpdates).length > 0) {
          const { error: pErr } = await (supabase as any).from('personas').update(opts.personaUpdates).eq('id', personaId);
          if (pErr) console.error('[useExpedienteDocs] persona update:', pErr);
        }
        invalidate();
        if (!opts?.silent) {
          toast.success(
            estatus === 2 ? 'Documento validado y datos guardados en tu perfil.' : 'Documento subido. Queda pendiente de validación.',
          );
        }
        return true;
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo subir el documento.');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [personaId, invalidate],
  );

  /** Cambio de estatus del documento (uso administrativo: validar / rechazar). */
  const setDocEstatus = useCallback(
    async (docId: number, estatusId: number) => {
      const { error } = await (supabase as any)
        .from('documentos')
        .update({ id_estatus_verificacion: estatusId, fecha_actualizacion: new Date().toISOString() })
        .eq('id', docId);
      if (error) throw error;
      invalidate();
    },
    [invalidate],
  );

  return {
    docs,
    isLoading: query.isLoading,
    refetch: query.refetch,
    invalidate,
    tipoRow,
    tipoEstado,
    uploading,
    uploadDocFile,
    setDocEstatus,
  };
}
