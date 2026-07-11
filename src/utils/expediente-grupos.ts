import { supabase } from '@/integrations/supabase/client';

export const OBLIGATORIO_GRUPOS = [
  { key: 'csf',       label: 'Constancia de Situación Fiscal', ids: [6] },
  { key: 'domicilio', label: 'Comprobante de domicilio',       ids: [8] },
  { key: 'ine',       label: 'INE / Identificación oficial',   ids: [2, 59] },
  { key: 'curp',      label: 'CURP',                           ids: [5] },
  { key: 'acta',      label: 'Acta de nacimiento',             ids: [1] },
] as const;

export const ALL_OBLIGATORIO_IDS: number[] = OBLIGATORIO_GRUPOS.flatMap(g => [...g.ids]);

export const ID_TO_GROUP_KEY: Record<number, string> = {};
OBLIGATORIO_GRUPOS.forEach(g => g.ids.forEach(id => { ID_TO_GROUP_KEY[id] = g.key; }));

export type ObligatorioDoc = {
  id: number;
  id_persona: number;
  id_tipo_documento: number;
  id_estatus_verificacion: number;
  fecha_creacion: string | null;
};

// NULL fecha_creacion → sentinel '9999' (NULLS FIRST, igual que PostgreSQL DESC)
export function buildLatestDocByKey(
  docs: ObligatorioDoc[]
): Record<string, { id: number; estatusId: number; fecha: string }> {
  const map: Record<string, { id: number; estatusId: number; fecha: string }> = {};
  docs.forEach(d => {
    if (!d.id_persona) return;
    const groupKey = ID_TO_GROUP_KEY[d.id_tipo_documento];
    if (!groupKey) return;
    const key = `${d.id_persona}__${groupKey}`;
    const fecha = d.fecha_creacion ?? '9999-12-31T23:59:59Z';
    const ex = map[key];
    if (!ex || fecha > ex.fecha || (fecha === ex.fecha && d.id > ex.id)) {
      map[key] = { id: d.id, estatusId: d.id_estatus_verificacion, fecha };
    }
  });
  return map;
}

export function countValidatedGroups(
  personaId: number,
  latestDocByKey: Record<string, { id: number; estatusId: number; fecha: string }>
): number {
  let count = 0;
  for (const grupo of OBLIGATORIO_GRUPOS) {
    const latest = latestDocByKey[`${personaId}__${grupo.key}`];
    if (latest && latest.estatusId === 2) count++;
  }
  return count;
}

// Conservador para copropiedad: usa el mínimo entre todos los compradores
export function calcCuentaDocStats(
  compradorPersonaIds: number[],
  latestDocByKey: Record<string, { id: number; estatusId: number; fecha: string }>
): { completos: number; total: number } {
  const total = OBLIGATORIO_GRUPOS.length;
  if (!compradorPersonaIds.length) return { completos: 0, total };
  const counts = compradorPersonaIds.map(pid => countValidatedGroups(pid, latestDocByKey));
  return { completos: Math.min(...counts), total };
}

// Chunks de 100 para evitar truncación silenciosa de PostgREST
export async function fetchObligatoriosDocs(personaIds: number[]): Promise<ObligatorioDoc[]> {
  if (!personaIds.length) return [];
  const CHUNK = 100;
  const results: ObligatorioDoc[] = [];
  for (let i = 0; i < personaIds.length; i += CHUNK) {
    const chunk = personaIds.slice(i, i + CHUNK);
    const { data } = await (supabase as any)
      .from('documentos')
      .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion')
      .in('id_persona', chunk)
      .in('id_tipo_documento', ALL_OBLIGATORIO_IDS)
      .eq('activo', true)
      .eq('es_draft', false)
      .limit(5000);
    if (data) results.push(...data);
  }
  return results;
}
