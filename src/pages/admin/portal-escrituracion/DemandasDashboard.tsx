import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  flexRender, createColumnHelper, type SortingState,
} from '@tanstack/react-table';
import {
  Search, Loader2, X, RefreshCw, ChevronDown,
  AlertTriangle, Download, FileText, Upload,
  Clock, CheckCircle2, Scale, Calendar,
  User, Building2, ChevronRight, Plus,
  Info, AlertCircle, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstatusDemanada =
  | 'SIN_DEMANDA' | 'NOTIFICADO' | 'EN_PROCESO'
  | 'ACUERDO' | 'LITIGIO' | 'RESUELTO' | 'CERRADO';

interface DemandaRow {
  propiedadId: number;
  cuentaId: number;
  unidad: string;
  clienteNombre: string;
  precioFinal: number;
  pagado: number;
  porPagar: number;
  fechaCompra: string | null;
  demandaId: number | null;
  estatusDemanada: EstatusDemanada;
  fechaCompromiso: string | null;
  pctPenalizacion: number;
  montoPenalizacion: number;
  responsable: string | null;
  observaciones: string | null;
}

interface DemandaDoc {
  id: number;
  idTipoDocumento: number;
  tipoNombre: string;
  url: string;
  numero: string | null;
  estatusVerificacion: string;
  fechaCreacion: string;
}

interface TipoDocumento {
  id: number;
  nombre: string;
}

interface DemandaTimelineEvent {
  id: number;
  tipoEvento: string;
  descripcion: string;
  creadoPor: string | null;
  fechaCreacion: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTATUS_META: Record<EstatusDemanada, { label: string; cls: string; dotCls: string }> = {
  SIN_DEMANDA: { label: 'Sin demanda',  cls: 'bg-slate-100 text-slate-600',                        dotCls: 'bg-slate-400' },
  NOTIFICADO:  { label: 'Notificado',   cls: 'bg-amber-50 text-amber-700 border border-amber-200',  dotCls: 'bg-amber-500' },
  EN_PROCESO:  { label: 'En proceso',   cls: 'bg-orange-50 text-orange-700 border border-orange-200', dotCls: 'bg-orange-500' },
  ACUERDO:     { label: 'Acuerdo',      cls: 'bg-blue-50 text-blue-700 border border-blue-200',     dotCls: 'bg-blue-500' },
  LITIGIO:     { label: 'Litigio',      cls: 'bg-red-50 text-red-700 border border-red-200',        dotCls: 'bg-red-500' },
  RESUELTO:    { label: 'Resuelto',     cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dotCls: 'bg-emerald-500' },
  CERRADO:     { label: 'Cerrado',      cls: 'bg-teal-50 text-teal-700 border border-teal-200',     dotCls: 'bg-teal-500' },
};

const ESTATUS_OPTIONS: EstatusDemanada[] = [
  'SIN_DEMANDA', 'NOTIFICADO', 'EN_PROCESO', 'ACUERDO', 'LITIGIO', 'RESUELTO', 'CERRADO',
];

// IDs de tipos_documento relevantes para demandas (precargados para el selector)
const TIPOS_DOC_DEMANDA_IDS = [38, 39, 18, 31, 43, 7, 9, 23, 34, 1, 2, 3, 5, 8];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDatetime = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function exportCsv(rows: DemandaRow[], proyectoNombre: string) {
  const headers = ['Unidad', 'Cliente', 'Precio Final', 'Pagado', 'Por Pagar', 'Fecha Compra', 'Estatus Demanda', '% Penalización', 'Monto Penalización', 'Responsable'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.unidad, `"${r.clienteNombre}"`,
      r.precioFinal, r.pagado, r.porPagar,
      r.fechaCompra ?? '',
      ESTATUS_META[r.estatusDemanada].label,
      r.pctPenalizacion, r.montoPenalizacion,
      `"${r.responsable ?? ''}"`,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demandas_${proyectoNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-9 w-9 rounded-xl" />
      </div>
      <Shimmer className="h-8 w-20" />
      <Shimmer className="h-3 w-24" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, subtitle, value, icon: Icon, iconBg, iconColor, accent,
}: {
  title: string; subtitle?: string; value: string;
  icon: React.ElementType; iconBg: string; iconColor: string; accent?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-2 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function EstatusBadge({ estatus }: { estatus: EstatusDemanada }) {
  const m = ESTATUS_META[estatus];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dotCls}`} />
      {m.label}
    </span>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
      <span className="text-xs text-slate-500 shrink-0 mt-0.5">{label}</span>
      <div className="text-xs font-medium text-slate-900 text-right">{children}</div>
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

const TIMELINE_ICON: Record<string, React.ElementType> = {
  CREACION:       Plus,
  CAMBIO_ESTATUS: RefreshCw,
  NOTA:           FileText,
  DOCUMENTO:      Upload,
  ACUERDO:        CheckCircle2,
  PAGO:           Scale,
  RESOLUCION:     CheckCircle2,
  OTRO:           Info,
};

function TimelineItem({ event }: { event: DemandaTimelineEvent }) {
  const Icon = TIMELINE_ICON[event.tipoEvento] ?? Info;
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800">{event.descripcion}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {event.creadoPor && <span className="mr-1">{event.creadoPor} ·</span>}
          {fmtDatetime(event.fechaCreacion)}
        </p>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailFormState {
  estatusDemanada: EstatusDemanada;
  fechaCompromiso: string;
  pctPenalizacion: string;
  responsable: string;
  observaciones: string;
}

function DemandaDetailPanel({
  row,
  tablesExist,
  onClose,
}: {
  row: DemandaRow;
  tablesExist: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'timeline'>('info');
  const [form, setForm] = useState<DetailFormState>({
    estatusDemanada: row.estatusDemanada,
    fechaCompromiso: row.fechaCompromiso ?? '',
    pctPenalizacion: String(row.pctPenalizacion),
    responsable: row.responsable ?? '',
    observaciones: row.observaciones ?? '',
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docForm, setDocForm] = useState({ idTipo: 38, url: '', numero: '' });
  const [showDocForm, setShowDocForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form when row changes
  useEffect(() => {
    setForm({
      estatusDemanada: row.estatusDemanada,
      fechaCompromiso: row.fechaCompromiso ?? '',
      pctPenalizacion: String(row.pctPenalizacion),
      responsable: row.responsable ?? '',
      observaciones: row.observaciones ?? '',
    });
  }, [row.cuentaId]);

  // Tipos de documento (catálogo real)
  const { data: tiposDoc = [] } = useQuery({
    queryKey: ['tipos-documento-demandas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tipos_documento')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as TipoDocumento[];
    },
  });

  // Documents query — usa tabla documentos filtrada por id_cuenta_cobranza
  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['demanda-docs', row.cuentaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('id, id_tipo_documento, url, numero, fecha_creacion, id_estatus_verificacion, tipos_documento(nombre), estatus_verificacion(nombre)')
        .eq('id_cuenta_cobranza', row.cuentaId)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });
      if (error) return [];
      return (data ?? []).map((d: any): DemandaDoc => ({
        id: d.id,
        idTipoDocumento: d.id_tipo_documento,
        tipoNombre: d.tipos_documento?.nombre ?? '—',
        url: d.url,
        numero: d.numero ?? null,
        estatusVerificacion: d.estatus_verificacion?.nombre ?? 'Pendiente',
        fechaCreacion: d.fecha_creacion,
      }));
    },
    enabled: !!row.cuentaId,
  });

  // Timeline query
  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['demanda-timeline', row.demandaId],
    queryFn: async () => {
      if (!row.demandaId || !tablesExist) return [];
      const { data, error } = await (supabase as any)
        .from('demandas_timeline')
        .select('*')
        .eq('id_demanda', row.demandaId)
        .order('fecha_creacion', { ascending: false });
      if (error) return [];
      return (data ?? []).map((e: any): DemandaTimelineEvent => ({
        id: e.id,
        tipoEvento: e.tipo_evento,
        descripcion: e.descripcion,
        creadoPor: e.creado_por,
        fechaCreacion: e.fecha_creacion,
      }));
    },
    enabled: !!row.demandaId && tablesExist,
  });

  // Save mutation (upsert demanda record)
  const saveMutation = useMutation({
    mutationFn: async (data: DetailFormState) => {
      if (!tablesExist) throw new Error('Tablas no creadas');
      const pct = parseFloat(data.pctPenalizacion) || 0;
      const monto = (row.precioFinal * pct) / 100;
      const payload = {
        id_cuenta_cobranza: row.cuentaId,
        id_propiedad: row.propiedadId,
        id_proyecto: null, // will be filled on create via trigger or default
        estatus_demanda: data.estatusDemanada,
        fecha_compromiso_entrega: data.fechaCompromiso || null,
        porcentaje_penalizacion: pct,
        monto_penalizacion: monto,
        responsable: data.responsable || null,
        observaciones: data.observaciones || null,
        activo: true,
      };
      if (row.demandaId) {
        const { error } = await (supabase as any)
          .from('demandas')
          .update(payload)
          .eq('id', row.demandaId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('demandas')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ['demandas-rows'] });
      queryClient.invalidateQueries({ queryKey: ['demanda-timeline', row.demandaId] });
    },
    onError: (err: any) => {
      setSaving(false);
      toast.error(`Error al guardar: ${err.message ?? 'Error desconocido'}`);
    },
  });

  // Debounced auto-save
  const scheduleAutoSave = useCallback((nextForm: DetailFormState) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaving(true);
      saveMutation.mutate(nextForm);
    }, 600);
  }, [saveMutation]);

  const updateField = <K extends keyof DetailFormState>(key: K, value: DetailFormState[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    scheduleAutoSave(next);
  };

  // Add document — inserta en public.documentos (tabla existente)
  const handleAddDoc = async () => {
    if (!docForm.url.trim()) { toast.error('Ingresa la URL del documento'); return; }
    setUploadingDoc(true);
    const { error } = await supabase.from('documentos').insert({
      id_cuenta_cobranza: row.cuentaId,
      id_propiedad: row.propiedadId,
      id_tipo_documento: docForm.idTipo,
      url: docForm.url.trim(),
      numero: docForm.numero.trim() || null,
      activo: true,
      es_draft: false,
      id_estatus_verificacion: 1, // Pendiente
    });
    setUploadingDoc(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success('Documento registrado');
    setDocForm({ idTipo: 38, url: '', numero: '' });
    setShowDocForm(false);
    queryClient.invalidateQueries({ queryKey: ['demanda-docs', row.cuentaId] });
    // Timeline event si la demanda ya está guardada
    if (row.demandaId && tablesExist) {
      const tipoNombre = tiposDoc.find(t => t.id === docForm.idTipo)?.nombre ?? 'Documento';
      await (supabase as any).from('demandas_timeline').insert({
        id_demanda: row.demandaId,
        tipo_evento: 'DOCUMENTO',
        descripcion: `Documento adjuntado: ${tipoNombre}`,
        creado_por: null,
      });
      queryClient.invalidateQueries({ queryKey: ['demanda-timeline', row.demandaId] });
    }
  };

  const TABS = [
    { id: 'info',     label: 'Info' },
    { id: 'docs',     label: !docsLoading && docs.length > 0 ? `Docs (${docs.length})` : 'Docs' },
    { id: 'timeline', label: 'Bitácora' },
  ] as const;

  const montoPenalizacion = (row.precioFinal * (parseFloat(form.pctPenalizacion) || 0)) / 100;

  return (
    <div className="w-[360px] min-w-[360px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">Unidad {row.unidad}</p>
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate ml-9">{row.clienteNombre}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-save indicator */}
      <div className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] transition-all ${saving ? 'bg-amber-50 text-amber-700' : 'bg-transparent text-transparent'}`}>
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Guardando cambios…
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Info Tab ── */}
        {activeTab === 'info' && (
          <div className="p-4 space-y-5">
            {/* Financial summary */}
            <div className="bg-slate-50 rounded-2xl p-3 space-y-0">
              <DetailRow label="Precio final">{fmtMxn(row.precioFinal)}</DetailRow>
              <DetailRow label="Pagado">
                <span className="text-emerald-600">{fmtMxn(row.pagado)}</span>
              </DetailRow>
              <DetailRow label="Por pagar">
                <span className={row.porPagar > 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {fmtMxn(row.porPagar)}
                </span>
              </DetailRow>
              <DetailRow label="Fecha compra">{fmtDate(row.fechaCompra)}</DetailRow>
            </div>

            {!tablesExist && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Las tablas de demanda no están creadas. Ejecuta el DDL en
                  <span className="font-mono"> Ejecuciones_manuales/dashboard_demandas.md</span> para
                  habilitar la edición.
                </p>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-3">
              {/* Estatus demanda */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Estatus demanda</label>
                <div className="relative">
                  <select
                    disabled={!tablesExist}
                    value={form.estatusDemanada}
                    onChange={e => updateField('estatusDemanada', e.target.value as EstatusDemanada)}
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-white text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {ESTATUS_OPTIONS.map(e => (
                      <option key={e} value={e}>{ESTATUS_META[e].label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Fecha compromiso entrega */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fecha compromiso de entrega</label>
                <input
                  type="date"
                  disabled={!tablesExist}
                  value={form.fechaCompromiso}
                  onChange={e => updateField('fechaCompromiso', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {/* Penalización */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">% Penalización (máx. 20%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0} max={20} step={0.5}
                    disabled={!tablesExist}
                    value={form.pctPenalizacion}
                    onChange={e => updateField('pctPenalizacion', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                  <span className="text-xs text-slate-500 shrink-0">%</span>
                </div>
                {parseFloat(form.pctPenalizacion) > 0 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{fmtMxn(montoPenalizacion)} de penalización</p>
                )}
              </div>

              {/* Responsable */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Responsable</label>
                <input
                  type="text"
                  disabled={!tablesExist}
                  placeholder="Nombre del responsable"
                  value={form.responsable}
                  onChange={e => updateField('responsable', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Observaciones</label>
                <textarea
                  rows={4}
                  disabled={!tablesExist}
                  placeholder="Notas adicionales…"
                  value={form.observaciones}
                  onChange={e => updateField('observaciones', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Docs Tab ── */}
        {activeTab === 'docs' && (
          <div className="p-4 space-y-4">
            <button
              onClick={() => setShowDocForm(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-dashed border-slate-300 text-slate-600 text-xs hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar documento
            </button>

            {showDocForm && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Tipo de documento</label>
                  <div className="relative">
                    <select
                      value={docForm.idTipo}
                      onChange={e => setDocForm(f => ({ ...f, idTipo: Number(e.target.value) }))}
                      className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-white text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">URL del documento<span className="text-red-500 ml-0.5">*</span></label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={docForm.url}
                    onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Número / folio</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={docForm.numero}
                    onChange={e => setDocForm(f => ({ ...f, numero: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDocForm(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddDoc}
                    disabled={uploadingDoc}
                    className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {uploadingDoc && <Loader2 className="w-3 h-3 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {docsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Shimmer key={i} className="h-12" />)}
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Sin documentos adjuntos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{doc.tipoNombre}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {doc.estatusVerificacion}
                        {doc.numero && <span> · Folio {doc.numero}</span>}
                        <span> · {fmtDate(doc.fechaCreacion)}</span>
                      </p>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 shrink-0 p-1">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Timeline Tab ── */}
        {activeTab === 'timeline' && (
          <div className="p-4">
            {!tablesExist ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">Ejecuta el DDL para habilitar la bitácora.</p>
              </div>
            ) : timelineLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Shimmer key={i} className="h-10" />)}
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Sin eventos registrados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {timeline.map(event => <TimelineItem key={event.id} event={event} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" className="hidden" />
    </div>
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<DemandaRow>();

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function DemandasDashboard() {
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRow, setSelectedRow] = useState<DemandaRow | null>(null);
  const [tablesExist, setTablesExist] = useState<boolean | null>(null);

  // ── Projects query ──────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-demandas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-select first project
  useEffect(() => {
    if (proyectos.length > 0 && proyectoId === null) {
      setProyectoId(proyectos[0].id);
    }
  }, [proyectos, proyectoId]);

  // ── Check if demandas tables exist ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { error } = await (supabase as any)
        .from('demandas')
        .select('id')
        .limit(1);
      setTablesExist(!error);
    })();
  }, []);

  // ── Main data query ─────────────────────────────────────────────────────────
  const { data: rows = [], isLoading, error: rowsError, refetch } = useQuery({
    queryKey: ['demandas-rows', proyectoId],
    queryFn: async (): Promise<DemandaRow[]> => {
      if (!proyectoId) return [];

      // Step 1: edificios for project
      const { data: edificios, error: e1 } = await supabase
        .from('edificios')
        .select('id')
        .eq('id_proyecto', proyectoId);
      if (e1) throw e1;
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];

      // Step 2: modelos for edificios
      const { data: modelos, error: e2 } = await supabase
        .from('edificios_modelos')
        .select('id')
        .in('id_edificio', edificioIds);
      if (e2) throw e2;
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];

      // Step 3: propiedades en demanda
      const { data: propiedades, error: e3 } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad')
        .eq('id_estatus_disponibilidad', 11)
        .in('id_edificio_modelo', modeloIds);
      if (e3) throw e3;
      const props = propiedades ?? [];
      if (!props.length) return [];
      const propIds = props.map((p: any) => p.id);

      // Step 4: cuentas_cobranza
      const { data: cuentas, error: e4 } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, precio_final, fecha_compra')
        .in('id_propiedad', propIds)
        .eq('activo', true);
      if (e4) throw e4;
      const cuentaList = cuentas ?? [];
      if (!cuentaList.length) return [];
      const cuentaIds = cuentaList.map((c: any) => c.id);

      // Step 5: compradores + personas
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_cuenta_cobranza, id_persona')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];

      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal')
          .in('id', personaIds);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—']));
      }

      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza]) {
          cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
        }
      });

      // Step 6: pagos (sum per cuenta)
      const { data: pagos } = await supabase
        .from('pagos')
        .select('id_cuenta_cobranza, monto')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);
      const pagadoMap: Record<number, number> = {};
      (pagos ?? []).forEach((pg: any) => {
        pagadoMap[pg.id_cuenta_cobranza] = (pagadoMap[pg.id_cuenta_cobranza] ?? 0) + Number(pg.monto ?? 0);
      });

      // Step 7: demandas (optional — table may not exist)
      let demandaMap: Record<number, any> = {};
      if (tablesExist) {
        const { data: demandas } = await (supabase as any)
          .from('demandas')
          .select('*')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('activo', true);
        (demandas ?? []).forEach((d: any) => {
          demandaMap[d.id_cuenta_cobranza] = d;
        });
      }

      // Step 8: Build property lookup
      const propMap = Object.fromEntries(props.map((p: any) => [p.id, p.numero_propiedad]));

      // Step 9: Assemble rows
      return cuentaList.map((cuenta: any): DemandaRow => {
        const d = demandaMap[cuenta.id] ?? null;
        const precioFinal = Number(cuenta.precio_final ?? 0);
        const pagado = pagadoMap[cuenta.id] ?? 0;
        const pct = d ? Number(d.porcentaje_penalizacion ?? 0) : 0;
        return {
          propiedadId: cuenta.id_propiedad,
          cuentaId: cuenta.id,
          unidad: propMap[cuenta.id_propiedad] ?? '—',
          clienteNombre: cuentaToPersona[cuenta.id] ?? '—',
          precioFinal,
          pagado,
          porPagar: precioFinal - pagado,
          fechaCompra: cuenta.fecha_compra ?? null,
          demandaId: d?.id ?? null,
          estatusDemanada: (d?.estatus_demanda as EstatusDemanada) ?? 'SIN_DEMANDA',
          fechaCompromiso: d?.fecha_compromiso_entrega ?? null,
          pctPenalizacion: pct,
          montoPenalizacion: d ? Number(d.monto_penalizacion ?? (precioFinal * pct / 100)) : 0,
          responsable: d?.responsable ?? null,
          observaciones: d?.observaciones ?? null,
        };
      });
    },
    enabled: proyectoId !== null && tablesExist !== null,
  });

  // ── Filtered rows (TanStack global filter) ──────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.unidad.toLowerCase().includes(q) ||
      r.clienteNombre.toLowerCase().includes(q) ||
      (r.responsable ?? '').toLowerCase().includes(q) ||
      ESTATUS_META[r.estatusDemanada].label.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ── KPI values ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = rows.length;
    const montoTotal = rows.reduce((s, r) => s + r.porPagar, 0);
    const pagado = rows.reduce((s, r) => s + r.pagado, 0);
    const precioTotal = rows.reduce((s, r) => s + r.precioFinal, 0);
    const conPenalizacion = rows.filter(r => r.pctPenalizacion > 0).length;
    const montosPenalizacion = rows.reduce((s, r) => s + r.montoPenalizacion, 0);
    return { total, montoTotal, pagado, precioTotal, conPenalizacion, montosPenalizacion };
  }, [rows]);

  // ── TanStack Table ──────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    colHelper.accessor('unidad', {
      header: 'Unidad',
      cell: info => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    colHelper.accessor('clienteNombre', {
      header: 'Cliente',
      cell: info => <span className="text-slate-700">{info.getValue()}</span>,
    }),
    colHelper.accessor('precioFinal', {
      header: 'Precio final',
      cell: info => <span className="tabular-nums">{fmtMxn(info.getValue())}</span>,
    }),
    colHelper.accessor('pagado', {
      header: 'Pagado',
      cell: info => <span className="tabular-nums text-emerald-600">{fmtMxn(info.getValue())}</span>,
    }),
    colHelper.accessor('porPagar', {
      header: 'Por cobrar',
      cell: info => <span className={`tabular-nums font-medium ${info.getValue() > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtMxn(info.getValue())}</span>,
    }),
    colHelper.accessor('estatusDemanada', {
      header: 'Estatus demanda',
      cell: info => <EstatusBadge estatus={info.getValue()} />,
    }),
    colHelper.accessor('pctPenalizacion', {
      header: '% Penal.',
      cell: info => info.getValue() > 0
        ? <span className="text-red-600 font-medium">{fmtPct(info.getValue())}</span>
        : <span className="text-slate-400">—</span>,
    }),
    colHelper.accessor('fechaCompromiso', {
      header: 'Fecha compromiso',
      cell: info => fmtDate(info.getValue()),
    }),
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const proyectoNombre = proyectos.find((p: any) => p.id === proyectoId)?.nombre ?? 'demandas';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard de Demandas</h1>
            <p className="text-sm text-slate-500 mt-0.5">Unidades con estatus "En demanda" y gestión de demandas jurídicas</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => refetch()}
              className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportCsv(filtered, proyectoNombre)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="relative">
            <select
              value={proyectoId ?? ''}
              onChange={e => {
                setProyectoId(Number(e.target.value) || null);
                setSelectedRow(null);
              }}
              className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 appearance-none outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* DDL warning banner */}
        {tablesExist === false && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Tablas de demandas no encontradas</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Ejecuta el DDL en <span className="font-mono">Ejecuciones_manuales/dashboard_demandas.md</span> para
                habilitar la edición, documentos y bitácora de demandas. Los datos base de unidades se muestran de todas formas.
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {isLoading ? (
            [1, 2, 3, 4].map(i => <KpiSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                title="Unidades en demanda"
                subtitle="con estatus activo"
                value={String(kpis.total)}
                icon={Scale}
                iconBg="bg-orange-50"
                iconColor="text-orange-600"
                accent="text-orange-700"
              />
              <KpiCard
                title="Monto total"
                subtitle="precio final combinado"
                value={fmtMxn(kpis.precioTotal)}
                icon={Building2}
                iconBg="bg-slate-100"
                iconColor="text-slate-600"
              />
              <KpiCard
                title="Por cobrar"
                subtitle="saldo pendiente"
                value={fmtMxn(kpis.montoTotal)}
                icon={AlertTriangle}
                iconBg="bg-red-50"
                iconColor="text-red-500"
                accent="text-red-700"
              />
              <KpiCard
                title="Con penalización"
                subtitle={kpis.montosPenalizacion > 0 ? fmtMxn(kpis.montosPenalizacion) : 'sin montos registrados'}
                value={`${kpis.conPenalizacion} unidades`}
                icon={AlertTriangle}
                iconBg="bg-red-50"
                iconColor="text-red-500"
                accent={kpis.conPenalizacion > 0 ? 'text-red-700' : 'text-slate-700'}
              />
            </>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por unidad, cliente, responsable o estatus…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando unidades…</span>
            </div>
          ) : rowsError ? (
            <div className="flex items-center justify-center py-20 gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">Error al cargar datos</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Scale className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay unidades en demanda</p>
              {proyectoId && <p className="text-xs mt-1">para el proyecto seleccionado</p>}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id} className="border-b border-slate-100 bg-slate-50/80">
                      {hg.headers.map(header => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-700' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' && <ChevronRight className="w-3 h-3 -rotate-90" />}
                            {header.column.getIsSorted() === 'desc' && <ChevronRight className="w-3 h-3 rotate-90" />}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {table.getRowModel().rows.map(row => {
                    const isSelected = selectedRow?.cuentaId === row.original.cuentaId;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRow(isSelected ? null : row.original)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-orange-50 border-l-2 border-orange-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  {filtered.length} {filtered.length === 1 ? 'unidad' : 'unidades'}
                  {filtered.length !== rows.length && ` (de ${rows.length} total)`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRow && (
          <DemandaDetailPanel
            key={selectedRow.cuentaId}
            row={selectedRow}
            tablesExist={tablesExist === true}
            onClose={() => setSelectedRow(null)}
          />
        )}
      </div>
    </div>
  );
}
