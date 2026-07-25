import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  EXP_ESTADO_LABEL,
  estadoFromEstatusId,
  useExpedienteDocs,
  type ExpDocEstado,
} from '@/hooks/useExpedienteDocs';

/**
 * Documentación de pago del embajador. Vive de la misma fuente que el expediente
 * del agente (`documentos` por `id_persona` + estatus de verificación), con dos
 * documentos que no son un archivo subido:
 *  - Convenio: se firma digitalmente con Mifiel (igual que la Carta de
 *    comercialización del agente) → estado en `firmas_digitales`. El webhook de
 *    Mifiel deja además el PDF firmado como `documentos` (tipo 48 hoy; ver
 *    Ejecuciones_manuales para el mapeo pendiente al tipo 58).
 *  - Carátula bancaria: evidencia de la cuenta en `cuentas_bancarias` (mismo
 *    mecanismo que usa el agente para dar de alta su cuenta).
 *
 * Tipos de `documentos`: 58 Convenio · 2/3 INE (frente+reverso) o 4 Pasaporte ·
 * 6 Constancia de situación fiscal.
 */

export type EmbajadorDocKey = 'convenio' | 'id' | 'rfc' | 'bancarios';

export const CONVENIO_TIPO = 58;
/** Plantilla de `cartas_acuerdo` que se firma como Convenio de Embajador. */
export const CONVENIO_CARTA_NOMBRE_LIKE = '%convenio%embajador%';
export const CSF_TIPO = 6;
export const INE_TIPOS = [2, 3];
export const PASAPORTE_TIPO = 4;

/** Tipos de `documentos` que componen el expediente del embajador. */
export const EMBAJADOR_DOC_TIPOS = [CONVENIO_TIPO, ...INE_TIPOS, PASAPORTE_TIPO, CSF_TIPO];

export interface EmbajadorDocType {
  key: EmbajadorDocKey;
  nombre: string;
  requiresApproval: boolean;
}

export const EMBAJADOR_DOC_TYPES: EmbajadorDocType[] = [
  { key: 'convenio', nombre: 'Convenio de Embajador firmado', requiresApproval: true },
  { key: 'id', nombre: 'Identificación oficial', requiresApproval: true },
  { key: 'rfc', nombre: 'Constancia de situación fiscal', requiresApproval: true },
  { key: 'bancarios', nombre: 'Carátula Estado de Cuenta Bancario', requiresApproval: true },
];

/** Estado mostrado (mismo vocabulario que el expediente del agente). */
export type EmbajadorDocEstatus = ExpDocEstado;
export const EMB_DOC_STATUS_LABEL = EXP_ESTADO_LABEL;

export interface EmbajadorDoc {
  key: EmbajadorDocKey;
  label: string;
  requiresApproval: boolean;
  /** Filas de `documentos` que respaldan el documento (el INE son dos). */
  docIds: number[];
  /** Compat: primera fila. La carátula bancaria no tiene fila en `documentos`. */
  docId: number | null;
  url: string | null;
  estatusId: number | null;
  status: EmbajadorDocEstatus;
  uploadedAt: string | null;
  /** Aprobado → no se puede reemplazar. */
  locked: boolean;
}

export function useEmbajadorDocumentos(idPersona?: number | null) {
  const queryClient = useQueryClient();
  const docsQueryKey = ['embajador-documentos', idPersona ?? null];

  const { docs: rows, tipoRow, tipoEstado, isLoading, refetch, invalidate, setDocEstatus } = useExpedienteDocs({
    personaId: idPersona,
    tipos: EMBAJADOR_DOC_TIPOS,
    queryKey: docsQueryKey,
  });

  // Convenio firmado: el estado real vive en `firmas_digitales` (Mifiel).
  const firmaQueryKey = ['embajador-convenio-firma', idPersona ?? null];
  const { data: firmaConvenio = null } = useQuery({
    queryKey: firmaQueryKey,
    enabled: !!idPersona,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: carta } = await (supabase as any)
        .from('cartas_acuerdo')
        .select('id')
        .eq('activo', true)
        .ilike('nombre', CONVENIO_CARTA_NOMBRE_LIKE)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!carta?.id) return null;
      const { data } = await (supabase as any)
        .from('firmas_digitales')
        .select('id, estado, pdf_firmado_url, created_at, updated_at')
        .eq('tipo_documento', 'carta_acuerdos')
        .eq('referencia_id', idPersona)
        .eq('carta_acuerdo_id', carta.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Carátula bancaria = evidencia de la cuenta bancaria de la persona.
  const bankQueryKey = ['embajador-cuenta-bancaria', idPersona ?? null];
  const { data: cuentaBancaria = null } = useQuery({
    queryKey: bankQueryKey,
    enabled: !!idPersona,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('cuentas_bancarias')
        .select('id, url_evidencia, id_estatus_verificacion, fecha_creacion, fecha_actualizacion')
        .eq('id_persona', idPersona)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Identidad: INE (frente+reverso) o pasaporte; nunca se exigen ambos.
  const ineRows = INE_TIPOS.map(tipoRow);
  const pasRow = tipoRow(PASAPORTE_TIPO);
  const usaPasaporte = !!pasRow && !ineRows.every(Boolean);
  const identidadRows = usaPasaporte ? [pasRow] : ineRows;
  const identidadEstados = (usaPasaporte ? [PASAPORTE_TIPO] : INE_TIPOS).map(tipoEstado);
  const identidadStatus: ExpDocEstado = identidadRows.every(Boolean)
    ? identidadEstados.every((e) => e === 'validado')
      ? 'validado'
      : identidadEstados.some((e) => e === 'expirado')
      ? 'expirado'
      : identidadEstados.some((e) => e === 'rechazado')
      ? 'rechazado'
      : 'revision'
    : 'pendiente';

  const docFor = (key: EmbajadorDocKey): EmbajadorDoc => {
    const def = EMBAJADOR_DOC_TYPES.find((t) => t.key === key)!;
    const base = { key, label: def.nombre, requiresApproval: def.requiresApproval };

    if (key === 'bancarios') {
      const url = cuentaBancaria?.url_evidencia || null;
      const estatusId = cuentaBancaria?.id_estatus_verificacion ?? null;
      const status: ExpDocEstado = url ? estadoFromEstatusId(estatusId) : 'pendiente';
      return {
        ...base,
        docIds: [],
        docId: null,
        url,
        estatusId,
        status,
        uploadedAt: cuentaBancaria?.fecha_actualizacion || cuentaBancaria?.fecha_creacion || null,
        locked: status === 'validado',
      };
    }

    if (key === 'id') {
      const present = identidadRows.filter(Boolean) as NonNullable<typeof pasRow>[];
      return {
        ...base,
        docIds: present.map((r) => r.id),
        docId: present[0]?.id ?? null,
        url: present[0]?.url ?? null,
        estatusId: present[0]?.id_estatus_verificacion ?? null,
        status: identidadStatus,
        uploadedAt: present[0]?.fecha_creacion ?? null,
        locked: identidadStatus === 'validado',
      };
    }

    if (key === 'convenio') {
      // Firmado (completado) → validado; enviado / firma parcial → en revisión.
      const estadoFirma = firmaConvenio?.estado as string | undefined;
      const status: ExpDocEstado =
        estadoFirma === 'completado' ? 'validado'
        : estadoFirma === 'enviado' || estadoFirma === 'firmado_parcial' ? 'revision'
        : 'pendiente';
      const rowConvenio = tipoRow(CONVENIO_TIPO);
      return {
        ...base,
        docIds: rowConvenio ? [rowConvenio.id] : [],
        docId: rowConvenio?.id ?? null,
        url: firmaConvenio?.pdf_firmado_url ?? rowConvenio?.url ?? null,
        estatusId: status === 'validado' ? 2 : status === 'revision' ? 1 : null,
        status,
        uploadedAt: firmaConvenio?.updated_at ?? firmaConvenio?.created_at ?? rowConvenio?.fecha_creacion ?? null,
        locked: status === 'validado',
      };
    }

    const tipo = CSF_TIPO;
    const row = tipoRow(tipo);
    const status: ExpDocEstado = row ? tipoEstado(tipo) : 'pendiente';
    return {
      ...base,
      docIds: row ? [row.id] : [],
      docId: row?.id ?? null,
      url: row?.url ?? null,
      estatusId: row?.id_estatus_verificacion ?? null,
      status,
      uploadedAt: row?.fecha_creacion ?? null,
      locked: status === 'validado',
    };
  };

  const docs = EMBAJADOR_DOC_TYPES.map((t) => docFor(t.key));

  /** Cambia el estatus de verificación de un documento completo (uso administrativo). */
  const setDocStatusByKey = useCallback(
    async (key: EmbajadorDocKey, estatusId: number) => {
      if (key === 'bancarios') {
        if (!cuentaBancaria?.id) throw new Error('El embajador no tiene cuenta bancaria registrada.');
        const { error } = await (supabase as any)
          .from('cuentas_bancarias')
          .update({ id_estatus_verificacion: estatusId, fecha_actualizacion: new Date().toISOString() })
          .eq('id', cuentaBancaria.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: bankQueryKey });
        return;
      }
      if (key === 'convenio') {
        throw new Error('El convenio se valida con la firma digital; no se revisa manualmente.');
      }
      const target = docs.find((d) => d.key === key);
      if (!target?.docIds.length) throw new Error('El documento aún no está cargado.');
      // El INE son dos filas (frente y reverso): se validan/rechazan juntas.
      for (const id of target.docIds) await setDocEstatus(id, estatusId);
    },
    [cuentaBancaria?.id, docs, setDocEstatus, queryClient], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Compat: cambio de estatus por id de fila de `documentos`. */
  const setDocStatus = useCallback(
    async (docId: number, estatusId: number) => setDocEstatus(docId, estatusId),
    [setDocEstatus],
  );

  // Pendiente para la card "Documentación": los que requieren aprobación y no están
  // validados, más los que no requieren aprobación pero aún no tienen archivo.
  const pendingCount = docs.filter((d) => (d.requiresApproval ? d.status !== 'validado' : !d.url)).length;

  return {
    docs,
    rows,
    cuentaBancaria,
    isLoading,
    refetch,
    invalidate,
    setDocStatus,
    setDocStatusByKey,
    pendingCount,
    docsQueryKey,
    bankQueryKey,
    firmaConvenio,
  };
}
