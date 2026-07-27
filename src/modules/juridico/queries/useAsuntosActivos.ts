import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JURIDICO_QUERY_KEYS } from '../hooks/useRegistrarActuacion';
import type { AsuntoActivoRow, EstadoExpediente } from '../types/asunto.types';

// ── Shapes crudos de BD (solo las columnas que se seleccionan) ─────────────────

interface ExpedienteRow {
  id: number;
  id_propiedad: number;
  id_proyecto: number;
  folio_visible: string;
  estado: string;
}

interface AsuntoRow {
  id: number;
  id_expediente: number;
  folio_visible: string;
  id_tipo_asunto: number;
  id_etapa_actual: number | null;
  fecha_limite_contestacion: string | null;
}

interface CatalogRow {
  id: number;
  nombre: string;
}

interface EtapaRow extends CatalogRow {
  es_terminal: boolean;
}

interface ProyectoRow {
  id: number;
  nombre: string;
}

interface PropiedadRow {
  id: number;
  numero_propiedad: string | null;
}

// ── Ensamblado puro (testeable sin mockear supabase) ────────────────────────────

export function buildAsuntoActivoRows(
  asuntos: AsuntoRow[],
  expedientesMap: Map<number, ExpedienteRow>,
  tiposMap: Map<number, CatalogRow>,
  etapasMap: Map<number, EtapaRow>,
  proyectosMap: Map<number, ProyectoRow>,
  propiedadesMap: Map<number, PropiedadRow>,
): AsuntoActivoRow[] {
  return asuntos.map((a) => {
    const exp = expedientesMap.get(a.id_expediente);
    const proyecto = exp ? proyectosMap.get(exp.id_proyecto) : undefined;
    const propiedad = exp ? propiedadesMap.get(exp.id_propiedad) : undefined;
    const tipo = tiposMap.get(a.id_tipo_asunto);
    const etapa = a.id_etapa_actual != null ? etapasMap.get(a.id_etapa_actual) : undefined;

    return {
      idExpediente: String(a.id_expediente),
      idAsunto: String(a.id),
      idPropiedad: exp ? String(exp.id_propiedad) : '',
      idProyecto: exp?.id_proyecto ?? 0,
      proyectoNombre: proyecto?.nombre ?? '—',
      propiedadCodigo: propiedad?.numero_propiedad ?? '—',
      folioExpediente: exp?.folio_visible ?? '—',
      folioAsunto: a.folio_visible,
      estadoExpediente: (exp?.estado ?? 'ACTIVO') as EstadoExpediente,
      idTipoAsunto: String(a.id_tipo_asunto),
      tipoAsuntoNombre: tipo?.nombre ?? '—',
      idEtapaActual: a.id_etapa_actual != null ? String(a.id_etapa_actual) : null,
      etapaActualNombre: etapa?.nombre ?? null,
      etapaEsTerminal: etapa?.es_terminal ?? false,
      fechaLimiteContestacion: a.fecha_limite_contestacion ?? null,
      fechaApertura: null,
    };
  });
}

// ── Query — waterfall explícito, nunca PostgREST triple-join ───────────────────

async function fetchAsuntosActivos(): Promise<AsuntoActivoRow[]> {
  const { data: expedientesData, error: errExp } = await (supabase as any)
    .from('expedientes_juridicos')
    .select('id, id_propiedad, id_proyecto, folio_visible, estado')
    .eq('estado', 'ACTIVO')
    .eq('activo', true);
  if (errExp) throw errExp;

  const expedientes = (expedientesData ?? []) as ExpedienteRow[];
  if (expedientes.length === 0) return [];

  const expedienteIds = expedientes.map((e) => e.id);

  const { data: asuntosData, error: errAsu } = await (supabase as any)
    .from('asuntos_juridicos')
    .select('id, id_expediente, folio_visible, id_tipo_asunto, id_etapa_actual, fecha_limite_contestacion')
    .in('id_expediente', expedienteIds)
    .eq('activo', true);
  if (errAsu) throw errAsu;

  const asuntos = (asuntosData ?? []) as AsuntoRow[];
  if (asuntos.length === 0) return [];

  const tipoIds = [...new Set(asuntos.map((a) => a.id_tipo_asunto))];
  const etapaIds = [...new Set(asuntos.map((a) => a.id_etapa_actual).filter((id): id is number => id != null))];
  const proyectoIds = [...new Set(expedientes.map((e) => e.id_proyecto))];
  const propiedadIds = [...new Set(expedientes.map((e) => e.id_propiedad))];

  const [tiposRes, etapasRes, proyectosRes, propiedadesRes] = await Promise.all([
    (supabase as any).from('cat_tipos_asunto').select('id, nombre').in('id', tipoIds),
    etapaIds.length > 0
      ? (supabase as any).from('cat_etapas_procesales').select('id, nombre, es_terminal').in('id', etapaIds)
      : Promise.resolve({ data: [], error: null }),
    (supabase as any).from('proyectos').select('id, nombre').in('id', proyectoIds),
    (supabase as any).from('propiedades').select('id, numero_propiedad').in('id', propiedadIds),
  ]);

  if (tiposRes.error) throw tiposRes.error;
  if (etapasRes.error) throw etapasRes.error;
  if (proyectosRes.error) throw proyectosRes.error;
  if (propiedadesRes.error) throw propiedadesRes.error;

  const expedientesMap = new Map(expedientes.map((e) => [e.id, e]));
  const tiposMap = new Map((tiposRes.data ?? []).map((t: CatalogRow) => [t.id, t]));
  const etapasMap = new Map((etapasRes.data ?? []).map((e: EtapaRow) => [e.id, e]));
  const proyectosMap = new Map((proyectosRes.data ?? []).map((p: ProyectoRow) => [p.id, p]));
  const propiedadesMap = new Map((propiedadesRes.data ?? []).map((p: PropiedadRow) => [p.id, p]));

  return buildAsuntoActivoRows(asuntos, expedientesMap, tiposMap, etapasMap, proyectosMap, propiedadesMap);
}

export function useAsuntosActivos() {
  return useQuery<AsuntoActivoRow[]>({
    queryKey: JURIDICO_QUERY_KEYS.asuntosActivos(),
    queryFn: fetchAsuntosActivos,
    staleTime: 0,
  });
}
