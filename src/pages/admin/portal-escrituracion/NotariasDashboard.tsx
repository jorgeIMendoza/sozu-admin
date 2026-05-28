import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, Loader2, X, ChevronDown, Edit2, Power,
  Building2, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  Download, FileText, User, Users,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notario {
  id: number;
  notaria: string;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface CuentaRow {
  cuentaId: number;
  cuentaLabel: string;
  proyectoNombre: string;
  unidad: string;
  clienteNombre: string;
  notarioId: number | null;
  estatusId: number;
  precioFinal: number;
  fechaActualizacion: string;
}

interface NotariaStats {
  notarioId: number;
  total: number;
  escriturados: number;
  entregados: number;
  enDemanda: number;
  pendientes: number;
}

type EstatusVisual = 'Escriturado' | 'Entregado' | 'En demanda' | 'Pendiente';

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

function estatusFromId(id: number): EstatusVisual {
  if (id === 7) return 'Escriturado';
  if (id === 8) return 'Entregado';
  if (id === 11) return 'En demanda';
  return 'Pendiente';
}

const ESTATUS_CLS: Record<EstatusVisual, string> = {
  Escriturado:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Entregado:    'bg-teal-50 text-teal-700 border border-teal-200',
  'En demanda': 'bg-orange-50 text-orange-700 border border-orange-200',
  Pendiente:    'bg-amber-50 text-amber-700 border border-amber-200',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <Shimmer className="h-4 w-28" />
        <Shimmer className="h-6 w-6 rounded-lg" />
      </div>
      <Shimmer className="h-8 w-12 mb-3" />
      <div className="space-y-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function EstatusBadge({ id }: { id: number }) {
  const label = estatusFromId(id);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ESTATUS_CLS[label]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ─── Notaría Card ─────────────────────────────────────────────────────────────

function NotariaCard({ notario, stats }: { notario: Notario; stats: NotariaStats }) {
  const pct = stats.total > 0 ? Math.round(((stats.escriturados + stats.entregados) / stats.total) * 100) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{notario.notaria}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{notario.nombre}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 ml-2">
          <Building2 className="w-4 h-4 text-emerald-600" />
        </div>
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{stats.total}</p>
        <p className="text-xs text-slate-500 mt-0.5">escrituras asignadas</p>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Avance</span>
          <span className="font-semibold text-emerald-600">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Mini stats */}
      <div className="space-y-1.5">
        {[
          { label: 'Escrituradas', value: stats.escriturados, color: 'text-emerald-600' },
          { label: 'Entregadas',   value: stats.entregados,   color: 'text-teal-600' },
          { label: 'En demanda',   value: stats.enDemanda,    color: 'text-orange-600' },
          { label: 'Pendientes',   value: stats.pendientes,   color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {stats.enDemanda > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-orange-600 bg-orange-50 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium">{stats.enDemanda} en demanda</span>
        </div>
      )}
    </div>
  );
}

// ─── Notaría Form Modal ───────────────────────────────────────────────────────

interface NotariaFormData {
  notaria: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
}

function NotariaFormModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Notario;
  onClose: () => void;
  onSave: (data: NotariaFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<NotariaFormData>({
    notaria:   initial?.notaria   ?? '',
    nombre:    initial?.nombre    ?? '',
    email:     initial?.email     ?? '',
    telefono:  initial?.telefono  ?? '',
    direccion: initial?.direccion ?? '',
  });
  const [errors, setErrors] = useState<Partial<NotariaFormData>>({});

  const validate = () => {
    const e: Partial<NotariaFormData> = {};
    if (!form.notaria.trim()) e.notaria = 'Requerido';
    if (!form.nombre.trim())  e.nombre  = 'Requerido';
    if (!form.email.trim())   e.email   = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSave(form);
  };

  const field = (
    key: keyof NotariaFormData,
    label: string,
    required = false,
    type = 'text',
  ) => (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className={`w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${errors[key] ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            {initial ? 'Editar notaría' : 'Nueva notaría'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {field('notaria',   'Número / nombre de notaría', true)}
          {field('nombre',    'Titular / notario',          true)}
          {field('email',     'Email de contacto',          true, 'email')}
          {field('telefono',  'Teléfono')}
          {field('direccion', 'Dirección')}
        </div>
        <div className="flex items-center justify-end gap-2 p-5 pt-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {initial ? 'Guardar cambios' : 'Crear notaría'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title, body, confirmLabel, confirmCls, onCancel, onConfirm, loading,
}: {
  title: string; body: string; confirmLabel: string; confirmCls?: string;
  onCancel: () => void; onConfirm: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-5">{body}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors flex items-center gap-2 ${confirmCls ?? 'bg-red-500 hover:bg-red-600'}`}>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  row, notarios, onClose, onAssign,
}: {
  row: CuentaRow;
  notarios: Notario[];
  onClose: () => void;
  onAssign: (cuentaId: number, notarioId: number | null) => void;
}) {
  const notario = notarios.find(n => n.id === row.notarioId);

  return (
    <div className="w-[340px] min-w-[340px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div>
          <p className="text-sm font-bold text-slate-900">{row.cuentaLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.proyectoNombre} · Unidad {row.unidad}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Ficha */}
        <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
          {[
            ['Cliente',      row.clienteNombre],
            ['Precio final', fmtMxn(row.precioFinal)],
            ['Actualizado',  fmtDate(row.fechaActualizacion)],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500">{l}</span>
              <span className="text-xs font-medium text-slate-900 text-right">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500">Estatus</span>
            <EstatusBadge id={row.estatusId} />
          </div>
        </div>

        {/* Asignación de notaría */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notaría asignada</p>
          <div className="relative">
            <select
              value={row.notarioId ?? ''}
              onChange={e => onAssign(row.cuentaId, e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none bg-white border border-slate-200 text-sm text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-8"
            >
              <option value="">Sin asignar</option>
              {notarios.filter(n => n.activo).map(n => (
                <option key={n.id} value={n.id}>{n.notaria} — {n.nombre}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {notario && (
            <div className="mt-2 bg-emerald-50 rounded-xl px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-emerald-800">{notario.notaria}</p>
              <p className="text-xs text-emerald-700">{notario.nombre}</p>
              {notario.email && <p className="text-xs text-emerald-600">{notario.email}</p>}
              {notario.telefono && <p className="text-xs text-emerald-600">{notario.telefono}</p>}
            </div>
          )}
        </div>

        {/* Etapas pendientes (stubbed) */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Proceso notarial</p>
          <div className="space-y-1.5">
            {[
              { label: 'VoBo Desarrollador', icon: CheckCircle2 },
              { label: 'VoBo Banco',         icon: CheckCircle2 },
              { label: 'Cita de Firma',      icon: Clock },
              { label: 'Registro Público',   icon: FileText },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
              >
                <span>{label}</span>
                <Icon className="w-3.5 h-3.5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Programar cita',   Icon: Clock },
              { label: 'Agregar nota',     Icon: FileText },
              { label: 'Descargar',        Icon: Download },
              { label: 'Ver documentos',   Icon: Users },
            ].map(({ label, Icon }) => (
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry }: { title: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Building2 className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function NotariasDashboard() {
  const qc = useQueryClient();

  // UI state
  const [proyectoId, setProyectoId]     = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [search, setSearch]             = useState('');
  const [filtroNotaria, setFiltroNotaria] = useState<number | 'todos'>('todos');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('todos');
  const [page, setPage]                 = useState(0);
  const [selected, setSelected]         = useState<CuentaRow | null>(null);
  const [showCatalog, setShowCatalog]   = useState(false);
  const [formModal, setFormModal]       = useState<'create' | Notario | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Notario | null>(null);

  useEffect(() => { setPage(0); }, [proyectoId, search, filtroNotaria, filtroEstatus]);

  // ── Proyectos ──────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['proyectos-notarias-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = (rels || []).map(r => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('proyectos').select('id, nombre').in('id', ids).eq('publicar', true).eq('activo', true).order('nombre');
      return (data || []) as { id: number; nombre: string }[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (proyectos.length > 0 && !proyectoId) {
      setProyectoId(proyectos[0].id);
      setProyectoNombre(proyectos[0].nombre);
    }
  }, [proyectos, proyectoId]);

  // ── Catálogo de notarías ───────────────────────────────────────────────────
  const { data: notarios = [], isLoading: loadingNotarios } = useQuery({
    queryKey: ['notarios-catalogo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notarios')
        .select('id, notaria, nombre, email, telefono, direccion, activo, fecha_creacion, fecha_actualizacion')
        .order('notaria');
      return (data || []) as Notario[];
    },
    staleTime: 30_000,
  });

  // ── Cuentas del proyecto ───────────────────────────────────────────────────
  const {
    data: cuentas = [],
    isLoading: loadingCuentas,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['notarias-cuentas', proyectoId],
    queryFn: async (): Promise<CuentaRow[]> => {
      if (!proyectoId) return [];

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
      const { data: cuentasList } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, id_notario, precio_final, fecha_actualizacion')
        .eq('activo', true)
        .in('id_propiedad', propIds);

      const cuentaByProp: Record<number, typeof cuentasList extends (infer T)[] | null ? T : never> = {};
      (cuentasList || []).forEach(c => {
        const ex = cuentaByProp[c.id_propiedad!];
        if (!ex || c.fecha_actualizacion > ex.fecha_actualizacion) cuentaByProp[c.id_propiedad!] = c;
      });

      const cuentaIds = Object.values(cuentaByProp).map(c => c.id);
      if (!cuentaIds.length) return [];

      // Compradores + personas
      const { data: comprsList } = await supabase
        .from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const personaIds = [...new Set((comprsList || []).map(c => c.id_persona))];
      const personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase.from('personas').select('id, nombre_legal').in('id', personaIds);
        (personas || []).forEach(p => { personaMap[p.id] = p.nombre_legal; });
      }
      const clienteByCuenta: Record<number, string> = {};
      const seen = new Set<number>();
      (comprsList || []).forEach(c => {
        if (!seen.has(c.id_cuenta_cobranza)) {
          seen.add(c.id_cuenta_cobranza);
          clienteByCuenta[c.id_cuenta_cobranza] = personaMap[c.id_persona] || '—';
        }
      });

      return props
        .filter(p => cuentaByProp[p.id])
        .map(p => {
          const c = cuentaByProp[p.id];
          return {
            cuentaId: c.id,
            cuentaLabel: `CC-${String(c.id).padStart(6, '0')}`,
            proyectoNombre,
            unidad: p.numero_propiedad,
            clienteNombre: clienteByCuenta[c.id] || '—',
            notarioId: c.id_notario,
            estatusId: p.id_estatus_disponibilidad,
            precioFinal: c.precio_final ?? 0,
            fechaActualizacion: c.fecha_actualizacion || p.fecha_actualizacion,
          } satisfies CuentaRow;
        });
    },
    enabled: !!proyectoId,
    staleTime: 30_000,
  });

  // ── Stats por notaría ──────────────────────────────────────────────────────
  const statsByNotario = useMemo((): Record<number, NotariaStats> => {
    const map: Record<number, NotariaStats> = {};
    cuentas.forEach(c => {
      if (!c.notarioId) return;
      if (!map[c.notarioId]) map[c.notarioId] = { notarioId: c.notarioId, total: 0, escriturados: 0, entregados: 0, enDemanda: 0, pendientes: 0 };
      map[c.notarioId].total++;
      if (c.estatusId === 7)      map[c.notarioId].escriturados++;
      else if (c.estatusId === 8) map[c.notarioId].entregados++;
      else if (c.estatusId === 11)map[c.notarioId].enDemanda++;
      else                        map[c.notarioId].pendientes++;
    });
    return map;
  }, [cuentas]);

  const notariosConAsignaciones = useMemo(
    () => notarios.filter(n => n.activo && statsByNotario[n.id]),
    [notarios, statsByNotario]
  );
  const sinAsignar = cuentas.filter(c => !c.notarioId).length;

  // ── Filtrado + Paginación ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cuentas.filter(c => {
      if (filtroNotaria !== 'todos' && c.notarioId !== filtroNotaria) return false;
      if (filtroEstatus !== 'todos') {
        if (filtroEstatus === 'sin_asignar' && c.notarioId !== null) return false;
        else if (filtroEstatus !== 'sin_asignar') {
          const est = estatusFromId(c.estatusId);
          if (est.toLowerCase().replace(/ /g, '_') !== filtroEstatus) return false;
        }
      }
      if (q && !`${c.cuentaLabel} ${c.unidad} ${c.clienteNombre}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cuentas, search, filtroNotaria, filtroEstatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async ({ cuentaId, notarioId }: { cuentaId: number; notarioId: number | null }) => {
      const { error } = await supabase
        .from('cuentas_cobranza')
        .update({ id_notario: notarioId })
        .eq('id', cuentaId);
      if (error) throw error;
    },
    onSuccess: (_, { cuentaId, notarioId }) => {
      qc.invalidateQueries({ queryKey: ['notarias-cuentas', proyectoId] });
      // Sync App Notaría — invalidate all variants so the dashboard reflects the new assignment
      qc.invalidateQueries({ queryKey: ['app-notaria-cuentas'] });
      const notName = notarioId ? (notarios.find(n => n.id === notarioId)?.notaria ?? '') : 'Sin asignar';
      toast.success(`Notaría actualizada: ${notName}`);
      // Update selected panel if open
      if (selected?.cuentaId === cuentaId) {
        setSelected(prev => prev ? { ...prev, notarioId } : null);
      }
    },
    onError: () => toast.error('Error al asignar notaría'),
  });

  const createMutation = useMutation({
    mutationFn: async (data: NotariaFormData) => {
      const { error } = await supabase.from('notarios').insert({
        notaria: data.notaria,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono || null,
        direccion: data.direccion || null,
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notarios-catalogo'] });
      toast.success('Notaría creada correctamente');
      setFormModal(null);
    },
    onError: () => toast.error('Error al crear la notaría'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: NotariaFormData }) => {
      const { error } = await supabase.from('notarios').update({
        notaria: data.notaria,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono || null,
        direccion: data.direccion || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notarios-catalogo'] });
      toast.success('Notaría actualizada correctamente');
      setFormModal(null);
    },
    onError: () => toast.error('Error al actualizar la notaría'),
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await supabase.from('notarios').update({ activo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { activo }) => {
      qc.invalidateQueries({ queryKey: ['notarios-catalogo'] });
      toast.success(activo ? 'Notaría reactivada' : 'Notaría desactivada');
      setConfirmToggle(null);
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveForm = (data: NotariaFormData) => {
    if (formModal === 'create') {
      createMutation.mutate(data);
    } else if (formModal && typeof formModal === 'object') {
      updateMutation.mutate({ id: formModal.id, data });
    }
  };

  const handleProyecto = (id: number) => {
    const p = proyectos.find(x => x.id === id);
    if (p) { setProyectoId(p.id); setProyectoNombre(p.nombre); setSelected(null); }
  };

  const activeNotarios = notarios.filter(n => n.activo);
  const inactiveNotarios = notarios.filter(n => !n.activo);
  const savingForm = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard de Notarías</h1>
          <p className="text-sm text-slate-500 mt-0.5">Asignación y seguimiento del proceso notarial</p>
        </div>
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* ── Summary chips ────────────────────────────────────────────────── */}
      {!loadingCuentas && cuentas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700">
            <Building2 className="w-3.5 h-3.5" />
            {notariosConAsignaciones.length} notarías activas en este proyecto
          </span>
          {sinAsignar > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {sinAsignar} sin notaría asignada
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {cuentas.filter(c => c.estatusId === 7 || c.estatusId === 8).length} escrituradas / entregadas
          </span>
        </div>
      )}

      {/* ── Cards por Notaría ─────────────────────────────────────────────── */}
      {(loadingCuentas || notariosConAsignaciones.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Carga por notaría</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loadingCuentas
              ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
              : notariosConAsignaciones.map(n => (
                  <NotariaCard key={n.id} notario={n} stats={statsByNotario[n.id]} />
                ))
            }
          </div>
        </div>
      )}

      {/* ── Catálogo de Notarías ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <button
          onClick={() => setShowCatalog(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Catálogo de notarías</p>
              <p className="text-xs text-slate-500">{activeNotarios.length} activas · {inactiveNotarios.length} inactivas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setFormModal('create'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva notaría
            </button>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCatalog ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showCatalog && (
          <div className="border-t border-slate-200 p-4">
            {loadingNotarios ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Shimmer key={i} className="h-14 w-full" />)}</div>
            ) : notarios.length === 0 ? (
              <EmptyState title="Sin notarías registradas" sub='Usa "Nueva notaría" para agregar la primera' />
            ) : (
              <div className="space-y-2">
                {notarios.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${n.activo ? 'border-slate-200 bg-slate-50/50' : 'border-slate-100 bg-slate-50 opacity-60'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${n.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{n.notaria}</p>
                        <p className="text-xs text-slate-500">{n.nombre} · {n.email}</p>
                        {n.telefono && <p className="text-xs text-slate-400">{n.telefono}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {statsByNotario[n.id] && (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          {statsByNotario[n.id].total} asignadas
                        </span>
                      )}
                      <button
                        onClick={() => setFormModal(n)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmToggle(n)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${n.activo ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title={n.activo ? 'Desactivar' : 'Reactivar'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tabla de Asignación ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cuenta, unidad o cliente…"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="relative">
              <select
                value={filtroNotaria}
                onChange={e => setFiltroNotaria(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                className="appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer"
              >
                <option value="todos">Notaría: Todas</option>
                <option value={0}>Sin asignar</option>
                {activeNotarios.map(n => <option key={n.id} value={n.id}>{n.notaria}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filtroEstatus}
                onChange={e => setFiltroEstatus(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer"
              >
                <option value="todos">Estatus: Todos</option>
                <option value="sin_asignar">Sin asignar notaría</option>
                <option value="escriturado">Escriturado</option>
                <option value="entregado">Entregado</option>
                <option value="en_demanda">En demanda</option>
                <option value="pendiente">Pendiente</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-xl font-medium text-sm transition-colors shadow-sm ml-auto"
            >
              <Plus className="w-4 h-4" /> Nuevo proceso
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loadingCuentas ? (
              <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando asignaciones...</span>
              </div>
            ) : isError ? (
              <EmptyState title="Error al cargar" sub="Verifica tu conexión" onRetry={refetch} />
            ) : !proyectoId ? (
              <EmptyState title="Selecciona un proyecto" />
            ) : cuentas.length === 0 ? (
              <EmptyState title="Sin cuentas de cobranza" sub="Este proyecto no tiene unidades vendidas" />
            ) : filtered.length === 0 ? (
              <EmptyState title="Sin resultados" sub="Ajusta los filtros" />
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    {['ID Cuenta', 'Unidad / Cliente', 'Notaría asignada', 'Estatus', 'Precio final', 'Actualizado'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(row => {
                    const isSelected = selected?.cuentaId === row.cuentaId;
                    const notarioActual = notarios.find(n => n.id === row.notarioId);
                    return (
                      <tr
                        key={row.cuentaId}
                        onClick={() => setSelected(isSelected ? null : row)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600">{row.cuentaLabel}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{row.proyectoNombre}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{row.unidad}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{row.clienteNombre}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="relative w-52">
                            <select
                              value={row.notarioId ?? ''}
                              onChange={e => assignMutation.mutate({
                                cuentaId: row.cuentaId,
                                notarioId: e.target.value ? Number(e.target.value) : null,
                              })}
                              className="w-full appearance-none bg-white border border-slate-200 text-xs text-slate-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-6 cursor-pointer"
                            >
                              <option value="">Sin asignar</option>
                              {activeNotarios.map(n => (
                                <option key={n.id} value={n.id}>{n.notaria}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                          {notarioActual && (
                            <p className="text-xs text-slate-400 mt-1 truncate max-w-[208px]">{notarioActual.nombre}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <EstatusBadge id={row.estatusId} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700 tabular-nums">{fmtMxn(row.precioFinal)}</span>
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

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500 rounded-b-2xl">
              <span>
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} unidades
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                  {'<'}
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${p === page ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                  {'>'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <DetailPanel
            row={selected}
            notarios={notarios}
            onClose={() => setSelected(null)}
            onAssign={(cuentaId, notarioId) => assignMutation.mutate({ cuentaId, notarioId })}
          />
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {formModal && (
        <NotariaFormModal
          initial={formModal === 'create' ? undefined : formModal}
          onClose={() => setFormModal(null)}
          onSave={handleSaveForm}
          saving={savingForm}
        />
      )}

      {confirmToggle && (
        <ConfirmModal
          title={confirmToggle.activo ? 'Desactivar notaría' : 'Reactivar notaría'}
          body={confirmToggle.activo
            ? `¿Deseas desactivar "${confirmToggle.notaria}"? No aparecerá como opción de asignación.`
            : `¿Deseas reactivar "${confirmToggle.notaria}"?`
          }
          confirmLabel={confirmToggle.activo ? 'Desactivar' : 'Reactivar'}
          confirmCls={confirmToggle.activo ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}
          onCancel={() => setConfirmToggle(null)}
          onConfirm={() => toggleActivoMutation.mutate({ id: confirmToggle.id, activo: !confirmToggle.activo })}
          loading={toggleActivoMutation.isPending}
        />
      )}
    </div>
  );
}
