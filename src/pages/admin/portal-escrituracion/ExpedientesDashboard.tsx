import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/components/admin/PersonForm';
import {
  Search, Plus, Download, Loader2, X, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  User, Users, Globe, Building2, Home,
  ChevronDown, FileText, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoComprador = 'PERSONA_FISICA' | 'PERSONA_MORAL' | 'COPROPIEDAD' | 'EXTRANJERO';
type EstatusExpediente = 'LISTO' | 'PENDIENTE' | 'EN_REVISION' | 'CON_OBSERVACIONES' | 'VENCIDO';

interface CompradoresData {
  id_persona: number;
  nombre: string;
  rfc: string | null;
  porcentaje: number;
  tipo_persona: string;
  id_pais_nacimiento: string | null;
}

interface ExpedienteRow {
  cuentaId: number;
  cuentaLabel: string;
  proyectoId: number;
  proyectoNombre: string;
  tipoComprador: TipoComprador;
  unidad: string;
  clienteNombre: string;
  personaId: number | null;
  estatusExpediente: EstatusExpediente;
  docsCompletos: number;
  docsTotal: number;
  precioFinal: number;
  estatusDisponibilidadId: number;
  fechaActualizacion: string;
  compradores: CompradoresData[];
}

interface DocItem {
  id: number;
  idTipoDocumento: number;
  tipoNombre: string;
  estatusNombre: string;
  url: string;
  fecha: string | null;
  isLatest: boolean;        // es el más reciente cargado de su tipo
  hasOlderValidado: boolean; // hay versión anterior Validada pero la vigente no lo está
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTATUS_META: Record<EstatusExpediente, { label: string; cls: string }> = {
  LISTO:              { label: 'Listo',              cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDIENTE:          { label: 'Pendiente',          cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  EN_REVISION:        { label: 'En revisión',        cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  CON_OBSERVACIONES:  { label: 'Con observaciones',  cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  VENCIDO:            { label: 'Vencido',            cls: 'bg-red-50 text-red-700 border border-red-200' },
};

const TIPO_META: Record<TipoComprador, { label: string; cls: string }> = {
  PERSONA_FISICA: { label: 'Persona física', cls: 'bg-slate-100 text-slate-700' },
  PERSONA_MORAL:  { label: 'Persona moral',  cls: 'bg-violet-50 text-violet-700' },
  COPROPIEDAD:    { label: 'Copropiedad',    cls: 'bg-blue-50 text-blue-700' },
  EXTRANJERO:     { label: 'Extranjero',     cls: 'bg-amber-50 text-amber-700' },
};

// ─── Documentos obligatorios persona física ───────────────────────────────────

// Grupos de documentos obligatorios.
// Cada grupo lista todos los id_tipo_documento equivalentes en BD:
//   6 = Constancia de situación fiscal
//   8 = Comprobante de domicilio
//   2 = Frente INE  |  59 = Identificación oficial  (mismo grupo)
//   5 = CURP
//   1 = Acta de nacimiento
const OBLIGATORIO_GRUPOS = [
  { key: 'csf',       label: 'Constancia de Situación Fiscal', ids: [6] },
  { key: 'domicilio', label: 'Comprobante de domicilio',       ids: [8] },
  { key: 'ine',       label: 'INE / Identificación oficial',   ids: [2, 59] },
  { key: 'curp',      label: 'CURP',                           ids: [5] },
  { key: 'acta',      label: 'Acta de nacimiento',             ids: [1] },
] as const;

const ALL_OBLIGATORIO_IDS: number[] = OBLIGATORIO_GRUPOS.flatMap(g => [...g.ids]);

// id_tipo_documento → group key
const ID_TO_GROUP_KEY: Record<number, string> = {};
OBLIGATORIO_GRUPOS.forEach(g => g.ids.forEach(id => { ID_TO_GROUP_KEY[id] = g.key; }));

// Normalización de nombres para display (panel de detalle)
function normTipoDoc(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// Regla: LISTO cuando el ÚLTIMO documento cargado de cada tipo obligatorio
// está en estatus VALIDADO. Si el último es Expirado/Rechazado/Pendiente,
// el tipo no se considera cumplido, aunque exista una versión anterior Validada.
function deriveEstatusExpediente(
  estatusDisponibilidadId: number,
  docsCompletos: number,
): EstatusExpediente {
  if (estatusDisponibilidadId === 11) return 'CON_OBSERVACIONES'; // En demanda
  // Escriturado (7) o Entregado (8) → LISTO siempre
  if (estatusDisponibilidadId === 7 || estatusDisponibilidadId === 8) return 'LISTO';
  // Para el resto: LISTO solo si todos los obligatorios tienen su último doc Validado
  if (docsCompletos >= OBLIGATORIO_GRUPOS.length) return 'LISTO';
  return 'PENDIENTE';
}

function deriveTipo(compradores: CompradoresData[]): TipoComprador {
  if (compradores.length > 1) return 'COPROPIEDAD';
  const p = compradores[0];
  if (!p) return 'PERSONA_FISICA';
  if (p.id_pais_nacimiento && p.id_pais_nacimiento !== 'MX') return 'EXTRANJERO';
  if (p.tipo_persona?.toLowerCase().includes('moral')) return 'PERSONA_MORAL';
  return 'PERSONA_FISICA';
}

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-8 w-8 rounded-xl" />
      </div>
      <Shimmer className="h-9 w-14 mb-2" />
      <Shimmer className="h-3 w-36" />
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EstatusExpediente }) {
  const m = ESTATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: TipoComprador }) {
  const m = TIPO_META[tipo];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  total: number;
  listos?: number;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}

function KpiCard({ label, total, listos, icon, iconBg, loading }: KpiCardProps) {
  if (loading) return <KpiSkeleton />;
  const pct = total > 0 && listos !== undefined ? Math.round((listos / total) * 100) : null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums">{total.toLocaleString('es-MX')}</p>
      {listos !== undefined && (
        <p className="text-xs text-slate-500 mt-1.5">
          <span className="text-emerald-600 font-semibold">{listos} listos</span>
          {pct !== null && ` · ${pct}%`}
        </p>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <div className="text-xs font-medium text-slate-900 text-right ml-3">{children}</div>
    </div>
  );
}

function DetailPanel({ row, onClose, onEditComprador }: {
  row: ExpedienteRow;
  onClose: () => void;
  onEditComprador: (personaId: number) => void;
}) {
  const { data: checklist = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['exp-docs-persona', row.personaId ?? row.cuentaId],
    queryFn: async (): Promise<DocItem[]> => {
      // Los documentos en BD están vinculados por id_persona, no id_cuenta_cobranza
      if (!row.personaId) return [];
      const { data } = await supabase
        .from('documentos')
        .select(`
          id, id_tipo_documento, url, fecha_creacion, fecha_actualizacion, es_draft,
          tipos_documento:documentos_id_tipo_documento_fkey(nombre),
          estatus_verificacion:documentos_id_estatus_verificacion_fkey(nombre)
        `)
        .eq('id_persona', row.personaId)
        .eq('activo', true)
        .eq('es_draft', false)
        .order('fecha_creacion', { ascending: false })
        .order('id', { ascending: false });

      const items: DocItem[] = (data || []).map((d: any) => ({
        id: d.id,
        idTipoDocumento: d.id_tipo_documento,
        tipoNombre: d.tipos_documento?.nombre ?? 'Documento',
        estatusNombre: d.estatus_verificacion?.nombre ?? 'Pendiente',
        url: d.url,
        fecha: d.fecha_creacion ?? d.fecha_actualizacion,
        isLatest: false,
        hasOlderValidado: false,
      }));

      // isLatest: el más reciente por id_tipo_documento (ya ordenados desc por fecha_creacion/id)
      const latestIdByTipoId: Record<number, number> = {};
      const tipoIdGroups: Record<number, DocItem[]> = {};
      items.forEach(d => {
        if (!tipoIdGroups[d.idTipoDocumento]) tipoIdGroups[d.idTipoDocumento] = [];
        tipoIdGroups[d.idTipoDocumento].push(d);
      });
      Object.values(tipoIdGroups).forEach(group => {
        latestIdByTipoId[group[0].idTipoDocumento] = group[0].id;
      });

      const isValidado = (s: string) =>
        s.toLowerCase().includes('validado') || s.toLowerCase().includes('aprobado');

      return items.map(d => {
        const isLatest = latestIdByTipoId[d.idTipoDocumento] === d.id;
        const latestId = latestIdByTipoId[d.idTipoDocumento];
        const hasOlderValidado = isLatest && !isValidado(d.estatusNombre) &&
          (tipoIdGroups[d.idTipoDocumento] ?? []).some(x => x.id !== latestId && isValidado(x.estatusNombre));
        return { ...d, isLatest, hasOlderValidado };
      });
    },
    staleTime: 30_000,
  });

  // Contar obligatorios cumplidos: último doc de cada grupo obligatorio en estatus Validado
  // Grupos: items ya vienen ordenados desc por fecha_creacion → el primero de cada grupo es el vigente
  const isValidadoNombre = (s: string) =>
    s.toLowerCase().includes('validado') || s.toLowerCase().includes('aprobado');

  const obligatoriosCumplidos = OBLIGATORIO_GRUPOS.filter(grupo => {
    const grupoItems = checklist.filter(d => (grupo.ids as readonly number[]).includes(d.idTipoDocumento));
    if (!grupoItems.length) return false;
    return isValidadoNombre(grupoItems[0].estatusNombre); // [0] = más reciente (desc)
  }).length;

  return (
    <div className="w-[360px] min-w-[360px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div>
          <p className="text-sm font-bold text-slate-900">{row.cuentaLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.proyectoNombre} · Unidad {row.unidad}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Ficha */}
        <div className="bg-slate-50 rounded-2xl p-3">
          <DetailRow label="Cliente">{row.clienteNombre}</DetailRow>
          <DetailRow label="Tipo"><TipoBadge tipo={row.tipoComprador} /></DetailRow>
          <DetailRow label="Estatus"><StatusBadge status={row.estatusExpediente} /></DetailRow>
          <DetailRow label="Precio final">{fmtMxn(row.precioFinal)}</DetailRow>
          <DetailRow label="Actualizado">{fmtDate(row.fechaActualizacion)}</DetailRow>
        </div>

        {/* Compradores */}
        {row.compradores.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Compradores</p>
            <div className="space-y-1.5">
              {row.compradores.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onEditComprador(c.id_persona)}
                  className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2.5 cursor-pointer transition-colors group text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.nombre}</p>
                    {c.rfc && <p className="text-xs text-slate-500 font-mono">{c.rfc}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {c.porcentaje < 100 && (
                      <span className="text-xs text-slate-500 font-semibold">{c.porcentaje}%</span>
                    )}
                    <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Documentos / Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documentos adjuntos</p>
            {checklist.length > 0 && (
              <span className="text-xs text-slate-500">
                <span className={obligatoriosCumplidos >= OBLIGATORIO_GRUPOS.length ? 'text-emerald-600 font-semibold' : ''}>
                  {obligatoriosCumplidos}/{OBLIGATORIO_GRUPOS.length}
                </span>
                {' '}obligatorios
              </span>
            )}
          </div>

          {loadingDocs ? (
            <div className="space-y-1.5">{[1, 2, 3].map(i => <Shimmer key={i} className="h-10 w-full" />)}</div>
          ) : checklist.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl py-6 flex flex-col items-center gap-1.5">
              <FileText className="w-5 h-5 text-slate-300" />
              <p className="text-xs text-slate-400">Sin documentos registrados</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {checklist.map(doc => {
                const validated =
                  doc.estatusNombre.toLowerCase().includes('validado') ||
                  doc.estatusNombre.toLowerCase().includes('aprobado');
                return (
                  <div key={doc.id} className={`rounded-xl px-3 py-2 border ${doc.isLatest ? 'bg-white border-slate-200' : 'bg-slate-50/50 border-transparent opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <p className="text-xs text-slate-700 truncate">{doc.tipoNombre}</p>
                        {doc.isLatest && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0 font-medium">
                            Vigente
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${validated ? 'text-emerald-600' : doc.isLatest ? 'text-amber-600' : 'text-slate-400'}`}>
                        {doc.estatusNombre}
                      </span>
                    </div>
                    {doc.fecha && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(doc.fecha)}</p>
                    )}
                    {doc.hasOlderValidado && (
                      <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        El último documento cargado no está validado
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones rápidas</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Subir documento', Icon: Plus },
              { label: 'Marcar listo',    Icon: CheckCircle2 },
              { label: 'Observación',     Icon: AlertTriangle },
              { label: 'Descargar',       Icon: Download },
            ] as const).map(({ label, Icon }) => (
              <button
                key={label}
                onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty / Error States ─────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry }: { title: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <FileText className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function ExpedientesDashboard() {
  const [proyectoId, setProyectoId]       = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [search, setSearch]               = useState('');
  const [filtroTipo, setFiltroTipo]       = useState<TipoComprador | 'TODOS'>('TODOS');
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusExpediente | 'TODOS'>('TODOS');
  const [page, setPage]                   = useState(0);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);
  const [isEditPersonaOpen, setIsEditPersonaOpen] = useState(false);
  const qc = useQueryClient();

  // ── Proyectos ──────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['proyectos-exp-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);

      const ids = (rels || []).map(r => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];

      const { data: proys } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', ids)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');

      return (proys || []) as { id: number; nombre: string }[];
    },
    staleTime: 60_000,
  });

  // Autoselect primer proyecto
  useEffect(() => {
    if (proyectos.length > 0 && !proyectoId) {
      setProyectoId(proyectos[0].id);
      setProyectoNombre(proyectos[0].nombre);
    }
  }, [proyectos, proyectoId]);

  // Reset page on filters change
  useEffect(() => { setPage(0); }, [proyectoId, search, filtroTipo, filtroEstatus]);

  // ── Datos del proyecto ─────────────────────────────────────────────────────
  const {
    data: rows = [],
    isLoading: loadingRows,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['expedientes-dashboard', proyectoId],
    queryFn: async (): Promise<ExpedienteRow[]> => {
      if (!proyectoId) return [];

      // Paso 1: Edificios → modelos → propiedades
      const { data: edificios } = await supabase
        .from('edificios').select('id').eq('id_proyecto', proyectoId).eq('activo', true);
      if (!edificios?.length) return [];

      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id').in('id_edificio', edificios.map(e => e.id));
      if (!modelos?.length) return [];

      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_estatus_disponibilidad, fecha_actualizacion')
        .eq('activo', true)
        .in('id_edificio_modelo', modelos.map(m => m.id))
        .order('numero_propiedad');
      if (!props?.length) return [];

      const propIds = props.map(p => p.id);

      // Paso 2: Cuentas de cobranza (más reciente por propiedad)
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, precio_final, fecha_actualizacion')
        .eq('activo', true)
        .in('id_propiedad', propIds);

      const cuentaByProp: Record<number, { id: number; precio_final: number; fecha_actualizacion: string }> = {};
      (cuentas || []).forEach(c => {
        const ex = cuentaByProp[c.id_propiedad];
        if (!ex || c.fecha_actualizacion > ex.fecha_actualizacion) cuentaByProp[c.id_propiedad] = c;
      });

      const cuentaIds = Object.values(cuentaByProp).map(c => c.id);
      if (!cuentaIds.length) return [];

      // Paso 3: Compradores + Personas
      const { data: comprsList } = await supabase
        .from('compradores')
        .select('id_cuenta_cobranza, id_persona, porcentaje_copropiedad')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true)
        .order('porcentaje_copropiedad', { ascending: false })
        .order('id_persona', { ascending: true });

      const personaIds = [...new Set((comprsList || []).map(c => c.id_persona))];
      const personaMap: Record<number, { nombre_legal: string; rfc: string | null; tipo_persona: string; id_pais_nacimiento: string | null }> = {};

      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal, rfc, tipo_persona, id_pais_nacimiento')
          .in('id', personaIds);
        (personas || []).forEach(p => {
          personaMap[p.id] = {
            nombre_legal: p.nombre_legal,
            rfc: p.rfc,
            tipo_persona: p.tipo_persona,
            id_pais_nacimiento: p.id_pais_nacimiento,
          };
        });
      }

      // Compradores agrupados por cuenta + primer personaId por cuenta
      const comprsByCuenta: Record<number, CompradoresData[]> = {};
      const primerPersonaIdByCuenta: Record<number, number> = {};
      (comprsList || []).forEach(c => {
        const p = personaMap[c.id_persona];
        if (!comprsByCuenta[c.id_cuenta_cobranza]) {
          comprsByCuenta[c.id_cuenta_cobranza] = [];
          primerPersonaIdByCuenta[c.id_cuenta_cobranza] = c.id_persona; // primer comprador
        }
        comprsByCuenta[c.id_cuenta_cobranza].push({
          id_persona: c.id_persona,
          nombre: p?.nombre_legal ?? '—',
          rfc: p?.rfc ?? null,
          porcentaje: c.porcentaje_copropiedad,
          tipo_persona: p?.tipo_persona ?? 'fisica',
          id_pais_nacimiento: p?.id_pais_nacimiento ?? null,
        });
      });

      // Paso 4: Documentos — query por id_persona (relación real en BD)
      // Verificado: id_cuenta_cobranza es NULL en ~99.9% de documentos obligatorios.
      // El campo de vinculación real es id_persona → compradores → cuentas_cobranza.
      // Campo de fecha real para "último cargado": fecha_creacion (fecha_carga no existe en BD).
      const personaIdsForDocs = [...new Set(Object.values(primerPersonaIdByCuenta))];

      const { data: docs } = await (supabase as any)
        .from('documentos')
        .select('id, id_persona, id_tipo_documento, id_estatus_verificacion, fecha_creacion')
        .in('id_persona', personaIdsForDocs)
        .in('id_tipo_documento', ALL_OBLIGATORIO_IDS)
        .eq('activo', true)
        .eq('es_draft', false);

      // latestDocByKey: "personaId__grupoKey" → doc más reciente de ese grupo obligatorio
      const latestDocByKey: Record<string, { id: number; estatusId: number; fecha: string }> = {};
      (docs || []).forEach((d: any) => {
        if (!d.id_persona) return;
        const groupKey = ID_TO_GROUP_KEY[d.id_tipo_documento];
        if (!groupKey) return;
        const key = `${d.id_persona}__${groupKey}`;
        const fecha = d.fecha_creacion ?? '';
        const ex = latestDocByKey[key];
        if (!ex || fecha > ex.fecha || (fecha === ex.fecha && d.id > ex.id)) {
          latestDocByKey[key] = { id: d.id, estatusId: d.id_estatus_verificacion, fecha };
        }
      });

      const docsByCuenta: Record<number, { total: number; completos: number }> = {};
      cuentaIds.forEach(cuentaId => {
        const personaId = primerPersonaIdByCuenta[cuentaId];
        let cumplidos = 0;
        if (personaId) {
          for (const grupo of OBLIGATORIO_GRUPOS) {
            const latest = latestDocByKey[`${personaId}__${grupo.key}`];
            if (latest && latest.estatusId === 2) cumplidos++; // 2 = Validado
          }
        }
        docsByCuenta[cuentaId] = { total: OBLIGATORIO_GRUPOS.length, completos: cumplidos };

        if (process.env.NODE_ENV !== 'production') {
          const latestRequiredDocs = OBLIGATORIO_GRUPOS.map(g => ({
            grupo: g.key,
            doc: personaId ? (latestDocByKey[`${personaId}__${g.key}`] ?? null) : null,
          }));
          console.debug('[Expedientes] documentos por cuenta', {
            cuentaId,
            personaId: personaId ?? null,
            latestRequiredDocs,
            completed: cumplidos,
            status: cumplidos >= OBLIGATORIO_GRUPOS.length ? 'LISTO' : 'PENDIENTE',
          });
        }
      });

      // Paso 5: Construir filas
      return props
        .filter(p => cuentaByProp[p.id])
        .map(p => {
          const cuenta = cuentaByProp[p.id];
          const compradores = comprsByCuenta[cuenta.id] || [];
          const tipoComprador = deriveTipo(compradores);
          const docStats = docsByCuenta[cuenta.id] || { total: OBLIGATORIO_GRUPOS.length, completos: 0 };
          const estatusExpediente = deriveEstatusExpediente(p.id_estatus_disponibilidad, docStats.completos);
          const clienteNombre = compradores[0]?.nombre ?? '—';
          return {
            cuentaId: cuenta.id,
            cuentaLabel: `CC-${String(cuenta.id).padStart(6, '0')}`,
            proyectoId: proyectoId!,
            proyectoNombre,
            tipoComprador,
            unidad: p.numero_propiedad,
            clienteNombre,
            personaId: primerPersonaIdByCuenta[cuenta.id] ?? null,
            estatusExpediente,
            docsCompletos: docStats.completos,
            docsTotal: docStats.total,
            precioFinal: cuenta.precio_final ?? 0,
            estatusDisponibilidadId: p.id_estatus_disponibilidad,
            fechaActualizacion: cuenta.fecha_actualizacion || p.fecha_actualizacion,
            compradores,
          } satisfies ExpedienteRow;
        });
    },
    enabled: !!proyectoId,
    staleTime: 30_000,
  });

  // selectedRow siempre refleja el estado actual de rows (nunca stale)
  const selectedRow = useMemo(
    () => rows.find(r => r.cuentaId === selectedId) ?? null,
    [rows, selectedId],
  );

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const fisicas   = rows.filter(r => r.tipoComprador === 'PERSONA_FISICA');
    const morales   = rows.filter(r => r.tipoComprador === 'PERSONA_MORAL');
    const coprops   = rows.filter(r => r.tipoComprador === 'COPROPIEDAD');
    const extranjeros = rows.filter(r => r.tipoComprador === 'EXTRANJERO');
    const isListo = (r: ExpedienteRow) => r.estatusExpediente === 'LISTO';
    return {
      total:      rows.length,
      fisicas:    { total: fisicas.length,    listos: fisicas.filter(isListo).length },
      morales:    { total: morales.length,    listos: morales.filter(isListo).length },
      coprops:    { total: coprops.length,    listos: coprops.filter(isListo).length },
      extranjeros:{ total: extranjeros.length, listos: extranjeros.filter(isListo).length },
      listos:     rows.filter(isListo).length,
      pendientes: rows.filter(r => r.estatusExpediente === 'PENDIENTE').length,
      conObs:     rows.filter(r => r.estatusExpediente === 'CON_OBSERVACIONES').length,
    };
  }, [rows]);

  // ── Filtrado + Paginación ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (filtroTipo !== 'TODOS' && r.tipoComprador !== filtroTipo) return false;
      if (filtroEstatus !== 'TODOS' && r.estatusExpediente !== filtroEstatus) return false;
      if (q && !`${r.cuentaLabel} ${r.unidad} ${r.clienteNombre}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filtroTipo, filtroEstatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Editar comprador ────────────────────────────────────────────────────────
  const { data: editingPersonaData } = useQuery({
    queryKey: ['expedientes-persona-edit', editingPersonaId],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('*').eq('id', editingPersonaId).single();
      return data;
    },
    enabled: !!editingPersonaId,
  });

  const updatePersonaMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { entityType, representativeId, commercialRepresentativeId, inmobiliariaId,
              tempBankAccounts, tempBeneficiaries, pendingDocuments, porcentaje_comision,
              ...cleanData } = personData;
      const { error } = await supabase.from('personas').update(cleanData).eq('id', editingPersonaId);
      if (error) throw error;
      if (representativeId !== undefined) {
        await supabase.from('personas')
          .update({ id_entidad_relacionada_rep_leg: representativeId || null })
          .eq('id', editingPersonaId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expedientes-real', proyectoId] });
      if (editingPersonaId) {
        qc.invalidateQueries({ queryKey: ['expedientes-persona-edit', editingPersonaId] });
        qc.invalidateQueries({ queryKey: ['exp-docs-persona', editingPersonaId] });
      }
      setIsEditPersonaOpen(false);
      setEditingPersonaId(null);
      toast.success('Comprador actualizado correctamente.');
    },
    onError: () => toast.error('Error al actualizar el comprador.'),
  });

  // ── Proyecto selector ─────────────────────────────────────────────────────
  const handleProyecto = (id: number) => {
    const p = proyectos.find(x => x.id === id);
    if (p) { setProyectoId(p.id); setProyectoNombre(p.nombre); setSelectedId(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard de Expedientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Seguimiento documental por tipo de comprador</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de proyecto */}
          <div className="relative">
            <select
              value={proyectoId ?? ''}
              onChange={e => handleProyecto(Number(e.target.value))}
              disabled={loadingProyectos}
              className="appearance-none bg-white border border-slate-200 text-slate-800 text-sm font-medium rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer shadow-sm disabled:opacity-60"
            >
              {loadingProyectos
                ? <option>Cargando...</option>
                : proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)
              }
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-xl font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo expediente
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Total unidades"
          total={loadingRows ? 0 : kpis.total}
          icon={<Home className="w-4 h-4" />}
          iconBg="bg-slate-100 text-slate-600"
          loading={loadingRows}
        />
        <KpiCard
          label="Persona física"
          total={kpis.fisicas.total}
          listos={kpis.fisicas.listos}
          icon={<User className="w-4 h-4" />}
          iconBg="bg-slate-100 text-slate-600"
          loading={loadingRows}
        />
        <KpiCard
          label="Persona moral"
          total={kpis.morales.total}
          listos={kpis.morales.listos}
          icon={<Building2 className="w-4 h-4" />}
          iconBg="bg-violet-100 text-violet-600"
          loading={loadingRows}
        />
        <KpiCard
          label="Copropiedad"
          total={kpis.coprops.total}
          listos={kpis.coprops.listos}
          icon={<Users className="w-4 h-4" />}
          iconBg="bg-blue-100 text-blue-600"
          loading={loadingRows}
        />
        <KpiCard
          label="Extranjero"
          total={kpis.extranjeros.total}
          listos={kpis.extranjeros.listos}
          icon={<Globe className="w-4 h-4" />}
          iconBg="bg-amber-100 text-amber-600"
          loading={loadingRows}
        />
      </div>

      {/* ── Summary chips ──────────────────────────────────────────────── */}
      {!loadingRows && rows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: `${kpis.listos} listos`,     cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', Icon: CheckCircle2 },
            { label: `${kpis.pendientes} pendientes`, cls: 'bg-amber-50 text-amber-700 border border-amber-200', Icon: Clock },
            { label: `${kpis.conObs} con observaciones`, cls: 'bg-orange-50 text-orange-700 border border-orange-200', Icon: AlertTriangle },
          ].map(({ label, cls, Icon }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${cls}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </span>
          ))}
        </div>
      )}

      {/* ── Table + Detail Panel ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por ID, unidad o cliente…"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none"
            >
              <option value="TODOS">Tipo: Todos</option>
              <option value="PERSONA_FISICA">Persona física</option>
              <option value="PERSONA_MORAL">Persona moral</option>
              <option value="COPROPIEDAD">Copropiedad</option>
              <option value="EXTRANJERO">Extranjero</option>
            </select>
            <select
              value={filtroEstatus}
              onChange={e => setFiltroEstatus(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer appearance-none"
            >
              <option value="TODOS">Estatus: Todos</option>
              <option value="LISTO">Listo</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="CON_OBSERVACIONES">Con observaciones</option>
            </select>
            <button
              onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors ml-auto"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto">
            {loadingRows ? (
              <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando expedientes...</span>
              </div>
            ) : isError ? (
              <EmptyState title="Error al cargar los expedientes" sub="Verifica tu conexión e intenta de nuevo" onRetry={refetch} />
            ) : !proyectoId ? (
              <EmptyState title="Selecciona un proyecto" sub="Elige un proyecto del selector para ver los expedientes" />
            ) : rows.length === 0 ? (
              <EmptyState title="Sin expedientes" sub="Este proyecto no tiene cuentas de cobranza registradas" />
            ) : filtered.length === 0 ? (
              <EmptyState title="Sin resultados" sub="Ajusta los filtros de búsqueda" />
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    {['ID Cuenta', 'Tipo', 'Unidad / Cliente', 'Estatus', 'Docs obligatorios', 'Actualizado'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(row => {
                    const isSelected = selectedId === row.cuentaId;
                    return (
                      <tr
                        key={row.cuentaId}
                        onClick={() => setSelectedId(isSelected ? null : row.cuentaId)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600">{row.cuentaLabel}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{row.proyectoNombre}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <TipoBadge tipo={row.tipoComprador} />
                        </td>
                        <td
                          className="px-5 py-4 cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            if (row.personaId) {
                              setEditingPersonaId(row.personaId);
                              setIsEditPersonaOpen(true);
                            }
                          }}
                        >
                          <p className={`text-sm font-semibold ${row.personaId ? 'text-emerald-700 hover:underline underline-offset-2' : 'text-slate-900'}`}>
                            {row.unidad}
                          </p>
                          <p className={`text-xs mt-0.5 truncate max-w-[200px] ${row.personaId ? 'text-emerald-600 hover:underline underline-offset-2 decoration-dotted' : 'text-slate-500'}`}>
                            {row.clienteNombre}
                          </p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={row.estatusExpediente} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {row.docsTotal > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.round((row.docsCompletos / row.docsTotal) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 tabular-nums">{row.docsCompletos}/{row.docsTotal}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-xs text-slate-500">{fmtDate(row.fechaActualizacion)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer / Paginación */}
          {filtered.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500 rounded-b-2xl">
              <span>
                {filtered.length > 0
                  ? `Mostrando ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} expedientes`
                  : 'Sin resultados'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >{'<'}</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${p === page ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >{p + 1}</button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >{'>'}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────── */}
        {selectedRow && (
          <DetailPanel
            row={selectedRow}
            onClose={() => setSelectedId(null)}
            onEditComprador={personaId => {
              setEditingPersonaId(personaId);
              setIsEditPersonaOpen(true);
            }}
          />
        )}
      </div>

      {/* ── Dialog Editar Comprador ──────────────────────────────────────── */}
      <Dialog
        open={isEditPersonaOpen}
        onOpenChange={open => { setIsEditPersonaOpen(open); if (!open) setEditingPersonaId(null); }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Comprador</DialogTitle>
          </DialogHeader>
          {editingPersonaData && (
            <PersonForm
              initialData={{
                ...editingPersonaData,
                representativeId: editingPersonaData.id_entidad_relacionada_rep_leg,
              }}
              onSubmit={data => updatePersonaMutation.mutate(data)}
              isLoading={updatePersonaMutation.isPending}
              onCancel={() => { setIsEditPersonaOpen(false); setEditingPersonaId(null); }}
              entityType="comprador"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
