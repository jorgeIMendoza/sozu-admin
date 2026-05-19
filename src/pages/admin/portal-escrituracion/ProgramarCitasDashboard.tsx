import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Loader2, X, RefreshCw, ChevronDown,
  FileSignature, KeyRound, CalendarDays, Clock,
  CheckCircle2, XCircle, AlertTriangle, MapPin,
  User, FileText, Bell, RotateCcw, ChevronRight,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentType = 'FIRMA_ESCRITURA' | 'ENTREGA' | 'OTRO';
type AppointmentStatus = 'PROGRAMADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA' | 'VENCIDA';
type CardFilter = 'FIRMA_ESCRITURA' | 'ENTREGA' | null;

interface CitaRow {
  id: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: AppointmentType;
  tipoNombre: string;
  status: AppointmentStatus;
  clienteNombre: string;
  proyectoNombre: string;
  proyectoId: number | null;
  ubicacion: string | null;
  notas: string | null;
  idEstatusCita: number | null;
  estatusRaw: string;
  fechaAsistencia: string | null;
  fechaConfirmacion: string | null;
  googleMeetLink: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyTipo(nombre: string | null | undefined): AppointmentType {
  if (!nombre) return 'OTRO';
  const l = nombre.toLowerCase();
  if (l.includes('escritur') || l.includes('firm') || l.includes('notari')) return 'FIRMA_ESCRITURA';
  if (l.includes('entrega') || l.includes('llaves') || l.includes('departamento')) return 'ENTREGA';
  return 'OTRO';
}

function deriveStatus(row: {
  estatus: string;
  fecha: string;
  fecha_asistencia: string | null;
  id_estatus_cita: number | null;
}): AppointmentStatus {
  const s = (row.estatus || '').toLowerCase();
  if (s === 'cancelada' || s === 'no_asistio') return 'CANCELADA';
  if (s === 'asistio' || row.fecha_asistencia) return 'REALIZADA';
  if (row.id_estatus_cita === 3) return 'CONFIRMADA';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const citaDate = new Date(row.fecha + 'T00:00:00');
  if (citaDate < today) return 'VENCIDA';
  return 'PROGRAMADA';
}

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (t: string | null) => {
  if (!t) return '—';
  return t.substring(0, 5);
};

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<AppointmentStatus, { label: string; cls: string }> = {
  PROGRAMADA:  { label: 'Programada',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  CONFIRMADA:  { label: 'Confirmada',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  REALIZADA:   { label: 'Realizada',   cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
  CANCELADA:   { label: 'Cancelada',   cls: 'bg-slate-100 text-slate-500' },
  VENCIDA:     { label: 'Vencida',     cls: 'bg-red-50 text-red-600 border border-red-200' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <Shimmer className="h-3 w-32" />
        <Shimmer className="h-9 w-9 rounded-xl" />
      </div>
      <Shimmer className="h-8 w-12 mb-4" />
      <div className="grid grid-cols-3 gap-2">
        <Shimmer className="h-12 rounded-xl" />
        <Shimmer className="h-12 rounded-xl" />
        <Shimmer className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiStats {
  total: number;
  hoy: number;
  proximos7: number;
  vencidas: number;
}

function KpiCard({
  tipo,
  stats,
  selected,
  onClick,
  loading,
}: {
  tipo: AppointmentType;
  stats: KpiStats;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  if (loading) return <KpiSkeleton />;

  const isFirma = tipo === 'FIRMA_ESCRITURA';
  const Icon = isFirma ? FileSignature : KeyRound;
  const title = isFirma ? 'Firma de escritura' : 'Entrega de departamento';
  const colorSet = isFirma
    ? { bg: 'bg-indigo-50', icon: 'text-indigo-600', accent: 'text-indigo-700', ring: 'border-indigo-500 ring-indigo-500/20' }
    : { bg: 'bg-amber-50', icon: 'text-amber-600', accent: 'text-amber-700', ring: 'border-amber-500 ring-amber-500/20' };

  return (
    <button
      onClick={onClick}
      className={`text-left w-full bg-white border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
        selected ? `${colorSet.ring} ring-2` : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">citas programadas</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-2 ${colorSet.bg}`}>
          <Icon className={`w-4 h-4 ${colorSet.icon}`} />
        </div>
      </div>

      <p className={`text-3xl font-bold tabular-nums mb-4 ${colorSet.accent}`}>{stats.total}</p>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Hoy',        value: stats.hoy,       cls: stats.hoy > 0 ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Próx. 7d',   value: stats.proximos7, cls: 'text-slate-700' },
          { label: 'Vencidas',   value: stats.vencidas,  cls: stats.vencidas > 0 ? 'text-red-600' : 'text-slate-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="text-center bg-slate-50 rounded-xl py-2 px-1">
            <p className={`text-base font-bold tabular-nums ${cls}`}>{value}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {stats.vencidas > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-red-600 bg-red-50 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium">{stats.vencidas} vencida{stats.vencidas !== 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
      <span className="text-xs text-slate-500 shrink-0 mt-0.5">{label}</span>
      <div className="text-xs font-medium text-slate-900 text-right">{children}</div>
    </div>
  );
}

function DetailPanel({
  cita,
  onClose,
  onConfirm,
  onCancel,
  onComplete,
  updating,
}: {
  cita: CitaRow;
  onClose: () => void;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  onComplete: (id: number) => void;
  updating: boolean;
}) {
  const isFirma = cita.tipo === 'FIRMA_ESCRITURA';
  const Icon = isFirma ? FileSignature : KeyRound;
  const canConfirm = cita.status === 'PROGRAMADA';
  const canComplete = cita.status === 'PROGRAMADA' || cita.status === 'CONFIRMADA' || cita.status === 'VENCIDA';
  const canCancel = cita.status !== 'CANCELADA' && cita.status !== 'REALIZADA';

  return (
    <div className="w-[340px] min-w-[340px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isFirma ? 'bg-indigo-100' : 'bg-amber-100'}`}>
            <Icon className={`w-4 h-4 ${isFirma ? 'text-indigo-600' : 'text-amber-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {cita.tipoNombre || (isFirma ? 'Firma de escritura' : 'Entrega')}
            </p>
            <p className="text-xs text-slate-500">Cita #{cita.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <StatusBadge status={cita.status} />
        {cita.googleMeetLink && (
          <a
            href={cita.googleMeetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Google Meet <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
        <DetailRow label="Cliente"><span>{cita.clienteNombre}</span></DetailRow>
        <DetailRow label="Proyecto"><span>{cita.proyectoNombre}</span></DetailRow>
        <DetailRow label="Fecha">
          <span>{fmtDate(cita.fecha)}</span>
        </DetailRow>
        <DetailRow label="Hora">
          <span>{fmtTime(cita.horaInicio)} — {fmtTime(cita.horaFin)}</span>
        </DetailRow>
        {cita.ubicacion && (
          <DetailRow label="Lugar">
            <span className="flex items-center gap-1 justify-end">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-right">{cita.ubicacion}</span>
            </span>
          </DetailRow>
        )}
        {cita.fechaConfirmacion && (
          <DetailRow label="Confirmada el"><span>{new Date(cita.fechaConfirmacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span></DetailRow>
        )}
        {cita.fechaAsistencia && (
          <DetailRow label="Asistió el"><span>{new Date(cita.fechaAsistencia).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span></DetailRow>
        )}
        {cita.notas && (
          <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{cita.notas}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!canConfirm || updating}
            onClick={() => onConfirm(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            Confirmar
          </button>
          <button
            disabled={updating}
            onClick={() => toast.info('Funcionalidad de reprogramación pendiente')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            Reprogramar
          </button>
          <button
            disabled={!canComplete || updating}
            onClick={() => onComplete(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            Marcar realizada
          </button>
          <button
            disabled={!canCancel || updating}
            onClick={() => onCancel(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            Cancelar
          </button>
          <button
            className="col-span-2 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
            onClick={() => toast.info('Envío de recordatorio pendiente de conectar')}
          >
            <Bell className="w-3.5 h-3.5 shrink-0" />
            Enviar recordatorio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry }: { title: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <CalendarDays className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 text-center max-w-xs">{sub}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export function ProgramarCitasDashboard() {
  const qc = useQueryClient();

  const [proyectoId, setProyectoId]       = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [cardFilter, setCardFilter]       = useState<CardFilter>(null);
  const [search, setSearch]               = useState('');
  const [filtroStatus, setFiltroStatus]   = useState<AppointmentStatus | 'TODOS'>('TODOS');
  const [page, setPage]                   = useState(0);
  const [selected, setSelected]           = useState<CitaRow | null>(null);
  const [proyDropOpen, setProyDropOpen]   = useState(false);

  useEffect(() => { setPage(0); }, [proyectoId, cardFilter, search, filtroStatus]);
  useEffect(() => {
    if (selected) setSelected(rows.find(r => r.id === selected.id) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Proyectos ──────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProys } = useQuery({
    queryKey: ['proyectos-citas-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = rels?.map(r => r.id_proyecto).filter(Boolean) ?? [];
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
  });

  useEffect(() => {
    if (proyectos.length > 0 && !proyectoId) {
      setProyectoId(proyectos[0].id);
      setProyectoNombre(proyectos[0].nombre);
    }
  }, [proyectos, proyectoId]);

  // ── tipos_cita ─────────────────────────────────────────────────────────────
  const { data: tiposCita = [] } = useQuery({
    queryKey: ['tipos-cita'],
    queryFn: async () => {
      const { data } = await supabase.from('tipos_cita').select('id, nombre');
      return (data || []) as { id: number; nombre: string }[];
    },
  });

  // ── reservas_citas ─────────────────────────────────────────────────────────
  const { data: rawCitas = [], isLoading: loadingCitas, refetch } = useQuery({
    queryKey: ['reservas-citas-escrituracion', proyectoId],
    queryFn: async () => {
      if (!proyectoId) return [];
      const { data, error } = await supabase
        .from('reservas_citas')
        .select([
          'id, fecha, hora_inicio, hora_fin, estatus, id_estatus_cita,',
          'fecha_asistencia, fecha_confirmacion, notas, ubicacion,',
          'google_meet_link, id_tipo_cita, id_proyecto, activo,',
          'tipos_cita(nombre),',
          'estatus_cita(nombre),',
          'personas!reservas_citas_id_persona_fkey(nombre_legal),',
          'proyectos(nombre)',
        ].join(' '))
        .eq('activo', true)
        .eq('id_proyecto', proyectoId)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error fetching reservas_citas:', error);
        return [];
      }
      return (data || []) as any[];
    },
    enabled: !!proyectoId,
  });

  // ── Map raw → CitaRow ──────────────────────────────────────────────────────
  const rows: CitaRow[] = useMemo(() => {
    return rawCitas.map((r: any) => {
      const tipoNombre = (r.tipos_cita as any)?.nombre ?? null;
      const status = deriveStatus({
        estatus: r.estatus,
        fecha: r.fecha,
        fecha_asistencia: r.fecha_asistencia,
        id_estatus_cita: r.id_estatus_cita,
      });
      const clienteNombre = (r.personas as any)?.nombre_legal ?? '—';
      const proyectoNombreRow = (r.proyectos as any)?.nombre ?? proyectoNombre;
      return {
        id: r.id,
        fecha: r.fecha,
        horaInicio: r.hora_inicio,
        horaFin: r.hora_fin,
        tipo: classifyTipo(tipoNombre),
        tipoNombre: tipoNombre ?? 'Sin tipo',
        status,
        clienteNombre,
        proyectoNombre: proyectoNombreRow,
        proyectoId: r.id_proyecto,
        ubicacion: r.ubicacion,
        notas: r.notas,
        idEstatusCita: r.id_estatus_cita,
        estatusRaw: r.estatus,
        fechaAsistencia: r.fecha_asistencia,
        fechaConfirmacion: r.fecha_confirmacion,
        googleMeetLink: r.google_meet_link,
      } satisfies CitaRow;
    });
  }, [rawCitas, proyectoNombre]);

  // ── KPI stats per type ─────────────────────────────────────────────────────
  const kpiStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().split('T')[0];

    function calc(tipo: AppointmentType): KpiStats {
      const subset = tiposCita.length > 0
        ? rows.filter(r => r.tipo === tipo)
        : rows;
      const active = subset.filter(r => r.status !== 'CANCELADA' && r.status !== 'REALIZADA');
      return {
        total: active.length,
        hoy: active.filter(r => r.fecha === todayStr).length,
        proximos7: active.filter(r => r.fecha > todayStr && r.fecha <= in7Str).length,
        vencidas: active.filter(r => r.status === 'VENCIDA').length,
      };
    }

    return {
      firma: calc('FIRMA_ESCRITURA'),
      entrega: calc('ENTREGA'),
    };
  }, [rows, tiposCita]);

  // ── Filtered rows for table ────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = rows;

    if (cardFilter === 'FIRMA_ESCRITURA') {
      list = list.filter(r => r.tipo === 'FIRMA_ESCRITURA');
    } else if (cardFilter === 'ENTREGA') {
      list = list.filter(r => r.tipo === 'ENTREGA');
    }

    if (filtroStatus !== 'TODOS') {
      list = list.filter(r => r.status === filtroStatus);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.clienteNombre.toLowerCase().includes(s) ||
        r.proyectoNombre.toLowerCase().includes(s) ||
        r.tipoNombre.toLowerCase().includes(s) ||
        (r.ubicacion ?? '').toLowerCase().includes(s)
      );
    }

    return list;
  }, [rows, cardFilter, filtroStatus, search]);

  const pageRows = useMemo(() =>
    filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  // ── Mutations ──────────────────────────────────────────────────────────────
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('reservas_citas')
        .update({ id_estatus_cita: 3, fecha_confirmacion: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => setUpdatingId(id),
    onSuccess: () => {
      toast.success('Cita confirmada');
      qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] });
    },
    onError: () => toast.error('Error al confirmar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('reservas_citas')
        .update({ estatus: 'asistio', fecha_asistencia: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => setUpdatingId(id),
    onSuccess: () => {
      toast.success('Cita marcada como realizada');
      qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] });
    },
    onError: () => toast.error('Error al actualizar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('reservas_citas')
        .update({ estatus: 'cancelada', activo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => setUpdatingId(id),
    onSuccess: () => {
      toast.success('Cita cancelada');
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] });
    },
    onError: () => toast.error('Error al cancelar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  const isUpdating = updatingId !== null;

  // ── Render ─────────────────────────────────────────────────────────────────

  const noProject = !proyectoId && !loadingProys;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Programar Citas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Firma de escritura y entrega de departamento</p>
        </div>

        {/* Selector de proyecto */}
        <div className="relative">
          <button
            onClick={() => setProyDropOpen(o => !o)}
            disabled={loadingProys}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-w-[180px]"
          >
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-left truncate">
              {loadingProys ? 'Cargando…' : (proyectoNombre || 'Seleccionar proyecto')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
          {proyDropOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-64 py-1">
              {proyectos.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProyectoId(p.id);
                    setProyectoNombre(p.nombre);
                    setProyDropOpen(false);
                    setSelected(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    p.id === proyectoId ? 'font-semibold text-slate-900' : 'text-slate-600'
                  }`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {noProject ? (
        <EmptyState title="Sin proyectos disponibles" sub="No hay proyectos SOZU activos configurados." />
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <KpiCard
              tipo="FIRMA_ESCRITURA"
              stats={kpiStats.firma}
              selected={cardFilter === 'FIRMA_ESCRITURA'}
              onClick={() => setCardFilter(f => f === 'FIRMA_ESCRITURA' ? null : 'FIRMA_ESCRITURA')}
              loading={loadingCitas}
            />
            <KpiCard
              tipo="ENTREGA"
              stats={kpiStats.entrega}
              selected={cardFilter === 'ENTREGA'}
              onClick={() => setCardFilter(f => f === 'ENTREGA' ? null : 'ENTREGA')}
              loading={loadingCitas}
            />
          </div>

          {/* ── Table + Detail ── */}
          <div className="flex flex-1 gap-4 min-h-0">
            {/* Table panel */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar cliente, proyecto…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>

                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value as AppointmentStatus | 'TODOS')}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                >
                  <option value="TODOS">Todos los estatus</option>
                  {(Object.keys(STATUS_META) as AppointmentStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>

                {(cardFilter || filtroStatus !== 'TODOS' || search) && (
                  <button
                    onClick={() => { setCardFilter(null); setFiltroStatus('TODOS'); setSearch(''); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}

                <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
                  {filteredRows.length} cita{filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              {loadingCitas ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : filteredRows.length === 0 ? (
                <EmptyState
                  title="Sin citas"
                  sub={search || cardFilter || filtroStatus !== 'TODOS'
                    ? 'No hay citas con los filtros actuales.'
                    : 'No hay citas programadas para este proyecto.'}
                  onRetry={search || cardFilter || filtroStatus !== 'TODOS' ? undefined : () => refetch()}
                />
              ) : (
                <>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Hora</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Lugar</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Estatus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map(cita => (
                          <tr
                            key={cita.id}
                            onClick={() => setSelected(cita)}
                            className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50/70 ${
                              selected?.id === cita.id ? 'bg-slate-50' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                  <User className="w-3 h-3 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate max-w-[140px]">{cita.clienteNombre}</p>
                                  <p className="text-slate-400 truncate max-w-[140px]">{cita.proyectoNombre}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-slate-600">{cita.tipoNombre}</span>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-700 whitespace-nowrap">
                              {fmtDate(cita.fecha)}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-500 hidden sm:table-cell whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                {fmtTime(cita.horaInicio)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-500 hidden md:table-cell max-w-[140px]">
                              {cita.ubicacion ? (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                  <span className="truncate">{cita.ubicacion}</span>
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={cita.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                      <button
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                        className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        ← Anterior
                      </button>
                      <span className="text-xs text-slate-500 tabular-nums">
                        Pág. {page + 1} / {totalPages}
                      </span>
                      <button
                        disabled={page + 1 >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        Siguiente →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <DetailPanel
                cita={selected}
                onClose={() => setSelected(null)}
                onConfirm={(id) => confirmMutation.mutate(id)}
                onCancel={(id) => cancelMutation.mutate(id)}
                onComplete={(id) => completeMutation.mutate(id)}
                updating={isUpdating && updatingId === selected.id}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
