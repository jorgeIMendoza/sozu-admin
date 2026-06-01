import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Documentos del embajador (Portal Embajadores). Se almacenan en la tabla `documentos`
// ligados al id_persona del embajador. La "Constancia de situación fiscal" ya existía
// (tipo 6); los demás tipos se crean en la migración 20260601000000_tipos_documento_embajador.
// El tipo se resuelve por NOMBRE para no depender de ids fijos.

export type EmbajadorDocKey = 'convenio' | 'id' | 'rfc' | 'bancarios';

export interface EmbajadorDocType {
  key: EmbajadorDocKey;
  nombre: string;
  requiresApproval: boolean;
}

export const EMBAJADOR_DOC_TYPES: EmbajadorDocType[] = [
  { key: 'convenio', nombre: 'Convenio de Embajador firmado', requiresApproval: true },
  { key: 'id', nombre: 'Identificación oficial', requiresApproval: true },
  { key: 'rfc', nombre: 'Constancia de situación fiscal', requiresApproval: true },
  { key: 'bancarios', nombre: 'Datos bancarios', requiresApproval: false },
];

// id_estatus_verificacion: 1 Pendiente, 2 Validado, 3 Rechazado, 4 Expirado
export type EmbajadorDocEstatus = 'pendiente' | 'aprobado' | 'rechazado';

export const EMB_DOC_STATUS_LABEL: Record<EmbajadorDocEstatus, string> = {
  pendiente: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export interface EmbajadorDoc {
  key: EmbajadorDocKey;
  label: string;
  requiresApproval: boolean;
  tipoId: number | null;
  docId: number | null;
  url: string | null;
  estatusId: number | null;
  status: EmbajadorDocEstatus;
  uploadedAt: string | null;
  locked: boolean; // aprobado -> no se puede reemplazar
}

function mapEstatus(id: number | null | undefined): EmbajadorDocEstatus {
  if (id === 2) return 'aprobado';
  if (id === 3 || id === 4) return 'rechazado';
  return 'pendiente';
}

export function useEmbajadorDocumentos(idPersona?: number | null) {
  const qc = useQueryClient();
  const queryKey = ['embajador-documentos', idPersona ?? null] as const;

  const query = useQuery({
    queryKey,
    enabled: !!idPersona,
    queryFn: async (): Promise<EmbajadorDoc[]> => {
      const nombres = EMBAJADOR_DOC_TYPES.map((t) => t.nombre);
      const { data: tipos, error: tErr } = await (supabase as any)
        .from('tipos_documento')
        .select('id, nombre')
        .in('nombre', nombres);
      if (tErr) throw tErr;
      const tipoIdByNombre = new Map<string, number>((tipos ?? []).map((t: any) => [t.nombre, t.id]));
      const tipoIds = (tipos ?? []).map((t: any) => t.id);

      let docsRows: any[] = [];
      if (idPersona && tipoIds.length) {
        const { data: docs, error: dErr } = await (supabase as any)
          .from('documentos')
          .select('id, id_tipo_documento, url, id_estatus_verificacion, fecha_creacion')
          .eq('id_persona', idPersona)
          .eq('activo', true)
          .in('id_tipo_documento', tipoIds)
          .order('fecha_creacion', { ascending: false });
        if (dErr) throw dErr;
        docsRows = docs ?? [];
      }

      const latestByTipo = new Map<number, any>();
      for (const row of docsRows) {
        if (!latestByTipo.has(row.id_tipo_documento)) latestByTipo.set(row.id_tipo_documento, row);
      }

      return EMBAJADOR_DOC_TYPES.map((t) => {
        const tipoId = tipoIdByNombre.get(t.nombre) ?? null;
        const row = tipoId != null ? latestByTipo.get(tipoId) : undefined;
        const estatusId = row?.id_estatus_verificacion ?? null;
        const status = mapEstatus(estatusId);
        return {
          key: t.key,
          label: t.nombre,
          requiresApproval: t.requiresApproval,
          tipoId,
          docId: row?.id ?? null,
          url: row?.url ?? null,
          estatusId,
          status,
          uploadedAt: row?.fecha_creacion ?? null,
          locked: status === 'aprobado',
        };
      });
    },
  });

  const uploadDoc = useCallback(
    async (key: EmbajadorDocKey, file: File) => {
      if (!idPersona) throw new Error('El embajador no tiene persona asociada.');
      const target = (query.data ?? []).find((d) => d.key === key);
      if (!target?.tipoId) throw new Error('Tipo de documento no configurado (aplica la migración).');
      if (target.locked) throw new Error('El documento ya fue aprobado y no se puede reemplazar.');

      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const filePath = `embajadores/${idPersona}/${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(filePath, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);

      // Desactivar versión anterior del mismo tipo
      await (supabase as any)
        .from('documentos')
        .update({ activo: false })
        .eq('id_persona', idPersona)
        .eq('id_tipo_documento', target.tipoId)
        .eq('activo', true);

      const { error: insErr } = await (supabase as any).from('documentos').insert({
        id_persona: idPersona,
        id_tipo_documento: target.tipoId,
        url: urlData.publicUrl,
        id_estatus_verificacion: 1,
        activo: true,
        es_draft: false,
      });
      if (insErr) throw insErr;
      await qc.invalidateQueries({ queryKey });
    },
    [idPersona, query.data, qc], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setDocStatus = useCallback(
    async (docId: number, estatusId: number) => {
      const { error } = await (supabase as any)
        .from('documentos')
        .update({ id_estatus_verificacion: estatusId, fecha_actualizacion: new Date().toISOString() })
        .eq('id', docId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey });
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const docs = query.data ?? [];
  // Pendiente para la card "Documentación": los que requieren aprobación y no están aprobados,
  // más los que no requieren aprobación pero aún no tienen archivo.
  const pendingCount = docs.filter((d) =>
    d.requiresApproval ? d.status !== 'aprobado' : !d.url,
  ).length;

  return {
    docs,
    isLoading: query.isLoading,
    refetch: query.refetch,
    uploadDoc,
    setDocStatus,
    pendingCount,
  };
}
