import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Loader2, X, RefreshCw, ChevronDown,
  FileSignature, KeyRound, CalendarDays, Clock,
  CheckCircle2, XCircle, AlertTriangle, MapPin,
  User, Bell, RotateCcw, ChevronRight, ChevronLeft,
  Building2, Plus, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday,
  parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentType   = 'FIRMA_ESCRITURA' | 'ENTREGA' | 'OTRO';
type AppointmentStatus = 'PROGRAMADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA' | 'VENCIDA';
type CardFilter        = 'FIRMA_ESCRITURA' | 'ENTREGA' | null;

interface TipoCita { id: number; nombre: string; }

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

interface NuevaCitaForm {
  idTipoCita:    number | null;
  fecha:         Date;
  horaInicio:    string;
  horaFin:       string;
  // Unidad seleccionada (auto-rellena idPersona)
  unidadId:      number | null;   // propiedades.id
  unidadLabel:   string;          // '1001 · Torre'
  clienteNombre: string;          // nombre del comprador
  torreNombre:   string;          // nombre del edificio
  idPersona:     number | null;   // auto-llenado desde comprador
  ubicacion:     string;
  notas:         string;
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
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

const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<AppointmentStatus, { label: string; cls: string }> = {
  PROGRAMADA: { label: 'Programada', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  CONFIRMADA: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  REALIZADA:  { label: 'Realizada',  cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
  CANCELADA:  { label: 'Cancelada',  cls: 'bg-slate-100 text-slate-500' },
  VENCIDA:    { label: 'Vencida',    cls: 'bg-red-50 text-red-600 border border-red-200' },
};

// ─── Skeletons ────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <Shimmer className="h-3 w-32" /><Shimmer className="h-9 w-9 rounded-xl" />
      </div>
      <Shimmer className="h-8 w-12 mb-4" />
      <div className="grid grid-cols-3 gap-2">
        <Shimmer className="h-12 rounded-xl" /><Shimmer className="h-12 rounded-xl" /><Shimmer className="h-12 rounded-xl" />
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

interface KpiStats { total: number; hoy: number; proximos7: number; vencidas: number; }

function KpiCard({ tipo, stats, selected, onClick, loading }: {
  tipo: AppointmentType; stats: KpiStats; selected: boolean; onClick: () => void; loading?: boolean;
}) {
  if (loading) return <KpiSkeleton />;
  const isFirma = tipo === 'FIRMA_ESCRITURA';
  const Icon = isFirma ? FileSignature : KeyRound;
  const title = isFirma ? 'Firma de escritura' : 'Entrega de departamento';
  const col = isFirma
    ? { bg: 'bg-indigo-50', icon: 'text-indigo-600', accent: 'text-indigo-700', ring: 'border-indigo-500 ring-indigo-500/20' }
    : { bg: 'bg-amber-50',  icon: 'text-amber-600',  accent: 'text-amber-700',  ring: 'border-amber-500 ring-amber-500/20' };

  return (
    <button onClick={onClick} className={`text-left w-full bg-white border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${selected ? `${col.ring} ring-2` : 'border-slate-200 hover:border-slate-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">citas programadas</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-2 ${col.bg}`}>
          <Icon className={`w-4 h-4 ${col.icon}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold tabular-nums mb-4 ${col.accent}`}>{stats.total}</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Hoy',      value: stats.hoy,       cls: stats.hoy > 0 ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Próx. 7d', value: stats.proximos7, cls: 'text-slate-700' },
          { label: 'Vencidas', value: stats.vencidas,  cls: stats.vencidas > 0 ? 'text-red-600' : 'text-slate-400' },
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

// ─── Month Calendar ───────────────────────────────────────────────────────────

function MonthCalendar({
  currentMonth,
  onMonthChange,
  citasByDate,
  selectedDate,
  onSelectDate,
}: {
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  citasByDate: Record<string, CitaRow[]>;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const calStart    = startOfWeek(monthStart, { locale: es });
  const calEnd      = endOfWeek(monthEnd,     { locale: es });

  const days: Date[] = [];
  let cur = calStart;
  while (cur <= calEnd) { days.push(cur); cur = addDays(cur, 1); }

  const weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-slate-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </p>
        <button
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {weekDays.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-400 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key       = toISODate(day);
          const citas     = citasByDate[key] || [];
          const inMonth   = isSameMonth(day, currentMonth);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const today     = isToday(day);

          // Status dot colors
          const hasVencida    = citas.some(c => c.status === 'VENCIDA');
          const hasConfirmada = citas.some(c => c.status === 'CONFIRMADA');
          const hasProgramada = citas.some(c => c.status === 'PROGRAMADA');

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={`
                relative flex flex-col items-center pt-2 pb-3 min-h-[56px] text-xs transition-colors
                ${!inMonth ? 'opacity-30' : ''}
                ${isSelected ? 'bg-indigo-600 text-white rounded-lg' : today ? 'bg-indigo-50' : 'hover:bg-slate-50'}
              `}
            >
              <span className={`
                w-6 h-6 flex items-center justify-center rounded-full font-medium
                ${isSelected ? 'font-bold' : today && !isSelected ? 'text-indigo-600 font-semibold' : 'text-slate-700'}
              `}>
                {format(day, 'd')}
              </span>

              {/* Dots */}
              {citas.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {hasVencida    && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-500'}`} />}
                  {hasConfirmada && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />}
                  {hasProgramada && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-300' : 'bg-blue-400'}`} />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
        {[
          { color: 'bg-blue-400',    label: 'Programada' },
          { color: 'bg-emerald-500', label: 'Confirmada' },
          { color: 'bg-red-500',     label: 'Vencida' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Nueva Cita Dialog ────────────────────────────────────────────────────────

function NuevaCitaDialog({
  open,
  onClose,
  defaultDate,
  proyectoId,
  proyectoNombre,
  tiposCita,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  proyectoId: number | null;
  proyectoNombre: string;
  tiposCita: TipoCita[];
  onCreated: () => void;
}) {
  const qc = useQueryClient();

  const EMPTY_FORM: NuevaCitaForm = {
    idTipoCita:    tiposCita.length === 1 ? tiposCita[0].id : null,
    fecha:         defaultDate,
    horaInicio:    '10:00',
    horaFin:       '11:00',
    unidadId:      null,
    unidadLabel:   '',
    clienteNombre: '',
    torreNombre:   '',
    idPersona:     null,
    ubicacion:     '',
    notas:         '',
  };

  const [form, setForm] = useState<NuevaCitaForm>(EMPTY_FORM);
  // Búsqueda de unidad (local — no en form)
  const [unidadSearch, setUnidadSearch]     = useState('');
  const [unidadDropOpen, setUnidadDropOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        idTipoCita:    tiposCita.length === 1 ? tiposCita[0].id : null,
        fecha:         defaultDate,
        horaInicio:    '10:00',
        horaFin:       '11:00',
        unidadId:      null,
        unidadLabel:   '',
        clienteNombre: '',
        torreNombre:   '',
        idPersona:     null,
        ubicacion:     '',
        notas:         '',
      });
      setUnidadSearch('');
      setUnidadDropOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync date if defaultDate changes while dialog is open
  useEffect(() => {
    setForm(f => ({ ...f, fecha: defaultDate }));
  }, [defaultDate]);

  // ── Precargar unidades del proyecto ──────────────────────────────────────
  const { data: unidades = [], isLoading: loadingUnidades } = useQuery({
    queryKey: ['citas-unidades', proyectoId],
    queryFn: async (): Promise<{ propId: number; numero: string; label: string; torreNombre: string; clienteNombre: string; idPersona: number | null }[]> => {
      if (!proyectoId) return [];

      // 1. Edificios del proyecto
      const { data: edificios } = await supabase
        .from('edificios').select('id, nombre')
        .eq('id_proyecto', proyectoId).eq('activo', true);
      const edifMap: Record<number, string> = Object.fromEntries((edificios ?? []).map(e => [e.id, e.nombre]));
      const edifIds = Object.keys(edifMap).map(Number);
      if (!edifIds.length) return [];

      // 2. Modelos
      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id, id_edificio').in('id_edificio', edifIds);
      const modeloEdifMap: Record<number, number> = Object.fromEntries((modelos ?? []).map(m => [m.id, m.id_edificio]));
      const modeloIds = Object.keys(modeloEdifMap).map(Number);
      if (!modeloIds.length) return [];

      // 3. Propiedades activas
      const { data: props } = await supabase
        .from('propiedades').select('id, numero_propiedad, id_edificio_modelo')
        .in('id_edificio_modelo', modeloIds).eq('activo', true).order('numero_propiedad');
      if (!props?.length) return [];
      const propIds = props.map(p => p.id);

      // 4. Cuentas de cobranza
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza').select('id, id_propiedad').in('id_propiedad', propIds).eq('activo', true);
      const propToCuenta: Record<number, number> = Object.fromEntries((cuentas ?? []).map(c => [c.id_propiedad, c.id]));
      const cuentaIds = (cuentas ?? []).map(c => c.id);

      // 5. Compradores → persona
      const { data: compradores } = await supabase
        .from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const cuentaToPersonaId: Record<number, number> = {};
      (compradores ?? []).forEach(c => { if (!cuentaToPersonaId[c.id_cuenta_cobranza]) cuentaToPersonaId[c.id_cuenta_cobranza] = c.id_persona; });

      // 6. Nombres de personas
      const personaIds = [...new Set(Object.values(cuentaToPersonaId))];
      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas').select('id, nombre_legal').in('id', personaIds as number[]);
        personaMap = Object.fromEntries((personas ?? []).map(p => [p.id, p.nombre_legal ?? '—']));
      }

      return props
        .filter(p => propToCuenta[p.id])
        .map(p => {
          const edifId = modeloEdifMap[p.id_edificio_modelo];
          const torreNombre = edifMap[edifId] ?? '—';
          const cuentaId = propToCuenta[p.id];
          const personaId = cuentaToPersonaId[cuentaId] ?? null;
          return {
            propId:       p.id,
            numero:       p.numero_propiedad ?? '—',
            label:        `${p.numero_propiedad ?? '—'} · ${torreNombre}`,
            torreNombre,
            clienteNombre: personaId ? (personaMap[personaId] ?? '—') : '—',
            idPersona:    personaId,
          };
        });
    },
    enabled: open && !!proyectoId,
    staleTime: 60_000,
  });

  // Filtrado de unidades por búsqueda de texto
  const unidadesFiltradas = useMemo(() => {
    const q = unidadSearch.toLowerCase().trim();
    if (!q) return unidades.slice(0, 12);
    return unidades
      .filter(u => u.numero.toLowerCase().includes(q) || u.clienteNombre.toLowerCase().includes(q))
      .slice(0, 12);
  }, [unidades, unidadSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.idTipoCita) throw new Error('Selecciona el tipo de cita');
      if (!proyectoId)      throw new Error('Sin proyecto activo');

      const { error } = await supabase.from('reservas_citas').insert({
        id_tipo_cita:   form.idTipoCita,
        fecha:          toISODate(form.fecha),
        hora_inicio:    form.horaInicio + ':00',
        hora_fin:       form.horaFin   + ':00',
        id_proyecto:    proyectoId,
        id_persona:     form.idPersona || null,
        ubicacion:      form.ubicacion.trim()  || null,
        notas:          form.notas.trim()      || null,
        estatus:        'pendiente',
        id_estatus_cita: 2,  // Pendiente de confirmación
        activo:         true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita agendada correctamente');
      qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] });
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la cita'),
  });

  const noTypes = tiposCita.length === 0;
  const canSave = !noTypes && !!form.idTipoCita && !!form.fecha && !!form.horaInicio && !!form.horaFin;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            Nueva cita
          </DialogTitle>
        </DialogHeader>

        {/* Warning si no hay tipos */}
        {noTypes && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              No hay tipos de cita configurados. Ejecuta el SQL en{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">
                Ejecuciones_manuales/tipos_cita_escrituracion.md
              </code>{' '}
              para habilitar el agendamiento.
            </span>
          </div>
        )}

        <div className="space-y-4">
          {/* Tipo de cita */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de cita *</label>
            <div className="grid grid-cols-1 gap-2">
              {noTypes ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Firma de escritura',      Icon: FileSignature, type: 'FIRMA_ESCRITURA' },
                    { label: 'Entrega de departamento', Icon: KeyRound,      type: 'ENTREGA' },
                  ].map(({ label, Icon, type }) => (
                    <button key={type} disabled className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-400 text-xs opacity-50 cursor-not-allowed">
                      <Icon className="w-4 h-4 shrink-0" />{label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {tiposCita.map(t => {
                    const tipo = classifyTipo(t.nombre);
                    const Icon = tipo === 'FIRMA_ESCRITURA' ? FileSignature : tipo === 'ENTREGA' ? KeyRound : CalendarDays;
                    const selected = form.idTipoCita === t.id;
                    const col = tipo === 'FIRMA_ESCRITURA'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : tipo === 'ENTREGA'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-300 bg-slate-50 text-slate-700';
                    return (
                      <button
                        key={t.id}
                        onClick={() => setForm(f => ({ ...f, idTipoCita: t.id }))}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                          selected ? col : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {t.nombre}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fecha *</label>
            <input
              type="date"
              value={toISODate(form.fecha)}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value ? parseISO(e.target.value) : f.fecha }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
          </div>

          {/* Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Hora inicio *</label>
              <input
                type="time"
                value={form.horaInicio}
                onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Hora fin *</label>
              <input
                type="time"
                value={form.horaFin}
                onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
          </div>

          {/* Unidad */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Unidad *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={loadingUnidades ? 'Cargando unidades…' : 'Escribe el número de unidad o nombre del cliente…'}
                value={form.unidadId ? form.unidadLabel : unidadSearch}
                readOnly={!!form.unidadId}
                onChange={e => {
                  setUnidadSearch(e.target.value);
                  setUnidadDropOpen(true);
                  if (!e.target.value) setForm(f => ({ ...f, unidadId: null, unidadLabel: '', clienteNombre: '', torreNombre: '', idPersona: null }));
                }}
                onFocus={() => { if (!form.unidadId) setUnidadDropOpen(true); }}
                onBlur={() => setTimeout(() => {
                  // Auto-seleccionar si hay exactamente 1 resultado
                  if (!form.unidadId && unidadesFiltradas.length === 1) {
                    const u = unidadesFiltradas[0];
                    setForm(f => ({ ...f, unidadId: u.propId, unidadLabel: u.label, clienteNombre: u.clienteNombre, torreNombre: u.torreNombre, idPersona: u.idPersona }));
                    setUnidadSearch(u.label);
                  }
                  setUnidadDropOpen(false);
                }, 150)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && unidadesFiltradas.length > 0) {
                    const u = unidadesFiltradas[0];
                    setForm(f => ({ ...f, unidadId: u.propId, unidadLabel: u.label, clienteNombre: u.clienteNombre, torreNombre: u.torreNombre, idPersona: u.idPersona }));
                    setUnidadSearch(u.label);
                    setUnidadDropOpen(false);
                    e.preventDefault();
                  }
                  if (e.key === 'Escape') setUnidadDropOpen(false);
                }}
                className={`w-full pl-8 pr-8 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 ${
                  form.unidadId
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-default'
                    : 'bg-white border-slate-200'
                }`}
              />
              {form.unidadId && (
                <button
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, unidadId: null, unidadLabel: '', clienteNombre: '', torreNombre: '', idPersona: null })); setUnidadSearch(''); setUnidadDropOpen(false); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Resultados inline */}
            {unidadDropOpen && !form.unidadId && (
              <div className="mt-1 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                {unidadesFiltradas.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400 text-center">
                    {loadingUnidades ? 'Cargando…' : unidadSearch ? 'Sin resultados para esa búsqueda' : 'Escribe para buscar…'}
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                    {unidadesFiltradas.map(u => (
                      <button
                        key={u.propId}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          setForm(f => ({ ...f, unidadId: u.propId, unidadLabel: u.label, clienteNombre: u.clienteNombre, torreNombre: u.torreNombre, idPersona: u.idPersona }));
                          setUnidadSearch(u.label);
                          setUnidadDropOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800">{u.label}</p>
                          <p className="text-xs text-slate-400 truncate">{u.clienteNombre}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card de confirmación de unidad identificada */}
            {form.unidadId && (
              <div className="mt-2 border border-emerald-200 rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Unidad identificada
                </p>
                <p className="text-xs text-slate-600">Cliente: <span className="font-medium text-slate-800">{form.clienteNombre}</span></p>
                <p className="text-xs text-slate-500">Proyecto · Torre: <span className="font-medium">{proyectoNombre} · {form.torreNombre}</span></p>
              </div>
            )}
          </div>

          {/* Proyecto (read-only) */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Proyecto</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {proyectoNombre || '—'}
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ubicación</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={form.ubicacion}
                onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Dirección o lugar de la cita"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observaciones, documentos necesarios…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSave || createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</>
              : <><CalendarDays className="w-3.5 h-3.5" /> Agendar cita</>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function DetailPanel({ cita, onClose, onConfirm, onCancel, onComplete, updating }: {
  cita: CitaRow; onClose: () => void;
  onConfirm: (id: number) => void; onCancel: (id: number) => void; onComplete: (id: number) => void;
  updating: boolean;
}) {
  const isFirma = cita.tipo === 'FIRMA_ESCRITURA';
  const Icon = isFirma ? FileSignature : KeyRound;
  const canConfirm  = cita.status === 'PROGRAMADA';
  const canComplete = ['PROGRAMADA', 'CONFIRMADA', 'VENCIDA'].includes(cita.status);
  const canCancel   = !['CANCELADA', 'REALIZADA'].includes(cita.status);

  return (
    <div className="w-[340px] min-w-[340px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isFirma ? 'bg-indigo-100' : 'bg-amber-100'}`}>
            <Icon className={`w-4 h-4 ${isFirma ? 'text-indigo-600' : 'text-amber-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{cita.tipoNombre || (isFirma ? 'Firma de escritura' : 'Entrega')}</p>
            <p className="text-xs text-slate-500">Cita #{cita.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <StatusBadge status={cita.status} />
        {cita.googleMeetLink && (
          <a href={cita.googleMeetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Google Meet <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <DetailRow label="Cliente"><span>{cita.clienteNombre}</span></DetailRow>
        <DetailRow label="Proyecto"><span>{cita.proyectoNombre}</span></DetailRow>
        <DetailRow label="Fecha"><span>{fmtDate(cita.fecha)}</span></DetailRow>
        <DetailRow label="Hora"><span>{fmtTime(cita.horaInicio)} — {fmtTime(cita.horaFin)}</span></DetailRow>
        {cita.ubicacion && (
          <DetailRow label="Lugar">
            <span className="flex items-center gap-1 justify-end">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {cita.ubicacion}
            </span>
          </DetailRow>
        )}
        {cita.fechaConfirmacion && (
          <DetailRow label="Confirmada el">
            <span>{new Date(cita.fechaConfirmacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </DetailRow>
        )}
        {cita.notas && (
          <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{cita.notas}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones</p>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!canConfirm || updating} onClick={() => onConfirm(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            Confirmar
          </button>
          <button disabled={updating} onClick={() => toast.info('Funcionalidad de reprogramación pendiente')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />Reprogramar
          </button>
          <button disabled={!canComplete || updating} onClick={() => onComplete(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />Marcar realizada
          </button>
          <button disabled={!canCancel || updating} onClick={() => onCancel(cita.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <XCircle className="w-3.5 h-3.5 shrink-0" />Cancelar
          </button>
          <button className="col-span-2 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs hover:bg-slate-50 transition-colors"
            onClick={() => toast.info('Envío de recordatorio pendiente de conectar')}>
            <Bell className="w-3.5 h-3.5 shrink-0" />Enviar recordatorio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry }: { title: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <CalendarDays className="w-8 h-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 text-center max-w-xs">{sub}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [proyectoId, setProyectoId]           = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre]   = useState('');
  const [cardFilter, setCardFilter]           = useState<CardFilter>(null);
  const [search, setSearch]                   = useState('');
  const [filtroStatus, setFiltroStatus]       = useState<AppointmentStatus | 'TODOS'>('TODOS');
  const [page, setPage]                       = useState(0);
  const [selected, setSelected]               = useState<CitaRow | null>(null);
  const [proyDropOpen, setProyDropOpen]       = useState(false);
  const [updatingId, setUpdatingId]           = useState<number | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth]     = useState(new Date());
  const [calendarDate, setCalendarDate]       = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen]           = useState(false);

  useEffect(() => { setPage(0); }, [proyectoId, cardFilter, search, filtroStatus]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: proyectos = [], isLoading: loadingProys } = useQuery({
    queryKey: ['proyectos-citas-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase.from('entidades_relacionadas').select('id_proyecto').eq('id_tipo_entidad', 5).eq('activo', true);
      const ids = rels?.map(r => r.id_proyecto).filter(Boolean) ?? [];
      if (!ids.length) return [];
      const { data: proys } = await supabase.from('proyectos').select('id, nombre').in('id', ids).eq('publicar', true).eq('activo', true).order('nombre');
      return (proys || []) as { id: number; nombre: string }[];
    },
  });

  useEffect(() => {
    if (proyectos.length > 0 && !proyectoId) {
      setProyectoId(proyectos[0].id);
      setProyectoNombre(proyectos[0].nombre);
    }
  }, [proyectos, proyectoId]);

  const { data: tiposCita = [] } = useQuery({
    queryKey: ['tipos-cita'],
    queryFn: async () => {
      const { data } = await supabase.from('tipos_cita').select('id, nombre').eq('activo', true).order('id');
      return (data || []) as TipoCita[];
    },
  });

  const { data: rawCitas = [], isLoading: loadingCitas, refetch } = useQuery({
    queryKey: ['reservas-citas-escrituracion', proyectoId],
    queryFn: async () => {
      if (!proyectoId) return [];
      const { data, error } = await (supabase as any)
        .from('reservas_citas')
        .select('id, fecha, hora_inicio, hora_fin, estatus, id_estatus_cita, fecha_asistencia, fecha_confirmacion, notas, ubicacion, google_meet_link, id_tipo_cita, id_proyecto, activo, tipos_cita(nombre), personas!reservas_citas_id_persona_fkey(nombre_legal), proyectos(nombre)')
        .eq('activo', true)
        .eq('id_proyecto', proyectoId)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });
      if (error) { console.error(error); return []; }
      return (data || []) as any[];
    },
    enabled: !!proyectoId,
  });

  // ── Map raw → CitaRow ──────────────────────────────────────────────────────

  const rows: CitaRow[] = useMemo(() => rawCitas.map((r: any) => {
    const tipoNombre = r.tipos_cita?.nombre ?? null;
    return {
      id:               r.id,
      fecha:            r.fecha,
      horaInicio:       r.hora_inicio,
      horaFin:          r.hora_fin,
      tipo:             classifyTipo(tipoNombre),
      tipoNombre:       tipoNombre ?? 'Sin tipo',
      status:           deriveStatus({ estatus: r.estatus, fecha: r.fecha, fecha_asistencia: r.fecha_asistencia, id_estatus_cita: r.id_estatus_cita }),
      clienteNombre:    r.personas?.nombre_legal ?? '—',
      proyectoNombre:   r.proyectos?.nombre ?? proyectoNombre,
      proyectoId:       r.id_proyecto,
      ubicacion:        r.ubicacion,
      notas:            r.notas,
      idEstatusCita:    r.id_estatus_cita,
      estatusRaw:       r.estatus,
      fechaAsistencia:  r.fecha_asistencia,
      fechaConfirmacion:r.fecha_confirmacion,
      googleMeetLink:   r.google_meet_link,
    };
  }), [rawCitas, proyectoNombre]);

  // ── citasByDate (for calendar dots) ───────────────────────────────────────

  const citasByDate = useMemo(() => {
    const map: Record<string, CitaRow[]> = {};
    rows.forEach(r => {
      if (!map[r.fecha]) map[r.fecha] = [];
      map[r.fecha].push(r);
    });
    return map;
  }, [rows]);

  // ── KPI stats ─────────────────────────────────────────────────────────────

  const kpiStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().split('T')[0];

    function calc(tipo: AppointmentType): KpiStats {
      const subset = tiposCita.length > 0 ? rows.filter(r => r.tipo === tipo) : rows;
      const active  = subset.filter(r => !['CANCELADA', 'REALIZADA'].includes(r.status));
      return {
        total:     active.length,
        hoy:       active.filter(r => r.fecha === todayStr).length,
        proximos7: active.filter(r => r.fecha > todayStr && r.fecha <= in7Str).length,
        vencidas:  active.filter(r => r.status === 'VENCIDA').length,
      };
    }
    return { firma: calc('FIRMA_ESCRITURA'), entrega: calc('ENTREGA') };
  }, [rows, tiposCita]);

  // ── Filtered rows for table ────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let list = rows;
    if (cardFilter === 'FIRMA_ESCRITURA') list = list.filter(r => r.tipo === 'FIRMA_ESCRITURA');
    else if (cardFilter === 'ENTREGA')    list = list.filter(r => r.tipo === 'ENTREGA');
    if (filtroStatus !== 'TODOS') list = list.filter(r => r.status === filtroStatus);
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

  const pageRows    = useMemo(() => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredRows, page]);
  const totalPages  = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  // ── Mutations ──────────────────────────────────────────────────────────────

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('reservas_citas').update({ id_estatus_cita: 3, fecha_confirmacion: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onMutate: id => setUpdatingId(id),
    onSuccess: () => { toast.success('Cita confirmada'); qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] }); },
    onError: () => toast.error('Error al confirmar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('reservas_citas').update({ estatus: 'asistio', fecha_asistencia: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onMutate: id => setUpdatingId(id),
    onSuccess: () => { toast.success('Cita marcada como realizada'); qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] }); },
    onError: () => toast.error('Error al actualizar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('reservas_citas').update({ estatus: 'cancelada', activo: false }).eq('id', id);
      if (error) throw error;
    },
    onMutate: id => setUpdatingId(id),
    onSuccess: () => { toast.success('Cita cancelada'); setSelected(null); qc.invalidateQueries({ queryKey: ['reservas-citas-escrituracion', proyectoId] }); },
    onError: () => toast.error('Error al cancelar la cita'),
    onSettled: () => setUpdatingId(null),
  });

  // ── Calendar handlers ──────────────────────────────────────────────────────

  const handleCalendarDayClick = (day: Date) => {
    setCalendarDate(day);
    setDialogOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const noProject = !proyectoId && !loadingProys;

  return (
    <div className="flex flex-col h-full min-h-0 gap-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Programar Citas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Firma de escritura y entrega de departamento</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Nueva cita button */}
          <button
            onClick={() => { setCalendarDate(new Date()); setDialogOpen(true); }}
            disabled={!proyectoId}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nueva cita
          </button>
          {/* Selector de proyecto */}
          <div className="relative">
            <button
              onClick={() => setProyDropOpen(o => !o)}
              disabled={loadingProys}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-w-[180px]"
            >
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="flex-1 text-left truncate">{loadingProys ? 'Cargando…' : (proyectoNombre || 'Seleccionar proyecto')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            {proyDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-64 py-1">
                {proyectos.map(p => (
                  <button key={p.id} onClick={() => { setProyectoId(p.id); setProyectoNombre(p.nombre); setProyDropOpen(false); setSelected(null); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${p.id === proyectoId ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {noProject ? (
        <EmptyState title="Sin proyectos disponibles" sub="No hay proyectos SOZU activos configurados." />
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard tipo="FIRMA_ESCRITURA" stats={kpiStats.firma}  selected={cardFilter === 'FIRMA_ESCRITURA'} onClick={() => setCardFilter(f => f === 'FIRMA_ESCRITURA' ? null : 'FIRMA_ESCRITURA')} loading={loadingCitas} />
            <KpiCard tipo="ENTREGA"         stats={kpiStats.entrega} selected={cardFilter === 'ENTREGA'}         onClick={() => setCardFilter(f => f === 'ENTREGA' ? null : 'ENTREGA')}                 loading={loadingCitas} />
          </div>

          {/* ── Table + Detail + Calendar ── */}
          <div className="flex flex-col xl:flex-row gap-4 min-h-0">

            {/* Table panel */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, proyecto…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-slate-300" />
                </div>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as AppointmentStatus | 'TODOS')}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
                  <option value="TODOS">Todos los estatus</option>
                  {(Object.keys(STATUS_META) as AppointmentStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
                {(cardFilter || filtroStatus !== 'TODOS' || search) && (
                  <button onClick={() => { setCardFilter(null); setFiltroStatus('TODOS'); setSearch(''); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
                <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">{filteredRows.length} cita{filteredRows.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Table */}
              {loadingCitas ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : filteredRows.length === 0 ? (
                <EmptyState
                  title="Sin citas"
                  sub={search || cardFilter || filtroStatus !== 'TODOS' ? 'No hay citas con los filtros actuales.' : 'No hay citas programadas para este proyecto.'}
                  onRetry={(!search && !cardFilter && filtroStatus === 'TODOS') ? () => refetch() : undefined}
                />
              ) : (
                <>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          {['Cliente', 'Tipo', 'Fecha', 'Hora', 'Lugar', 'Estatus'].map(h => (
                            <th key={h} className={`text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Cliente' ? 'pl-4' : ''} ${['Hora'].includes(h) ? 'hidden sm:table-cell' : ''} ${['Lugar'].includes(h) ? 'hidden md:table-cell' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map(cita => (
                          <tr key={cita.id} onClick={() => setSelected(cita)}
                            className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50/70 ${selected?.id === cita.id ? 'bg-slate-50' : ''}`}>
                            <td className="pl-4 pr-3 py-3">
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
                            <td className="px-3 py-3 text-slate-600">{cita.tipoNombre}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-700 whitespace-nowrap">{fmtDate(cita.fecha)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-500 hidden sm:table-cell whitespace-nowrap">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3 shrink-0" />{fmtTime(cita.horaInicio)}</span>
                            </td>
                            <td className="px-3 py-3 text-slate-500 hidden md:table-cell max-w-[140px]">
                              {cita.ubicacion ? (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                  <span className="truncate">{cita.ubicacion}</span>
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-3"><StatusBadge status={cita.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                      <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                        className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                        ← Anterior
                      </button>
                      <span className="text-xs text-slate-500 tabular-nums">Pág. {page + 1} / {totalPages}</span>
                      <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                        Siguiente →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail panel (replaces calendar on selection) */}
            {selected && (
              <DetailPanel
                cita={selected}
                onClose={() => setSelected(null)}
                onConfirm={id => confirmMutation.mutate(id)}
                onCancel={id => cancelMutation.mutate(id)}
                onComplete={id => completeMutation.mutate(id)}
                updating={updatingId === selected.id}
              />
            )}

            {/* Calendar (always visible when no detail open) */}
            {!selected && (
              <div className="xl:w-[320px] shrink-0 flex flex-col gap-3">
                <MonthCalendar
                  currentMonth={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  citasByDate={citasByDate}
                  selectedDate={calendarDate}
                  onSelectDate={handleCalendarDayClick}
                />
                {/* Day preview */}
                {calendarDate && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-slate-800 capitalize">
                        {format(calendarDate, "d 'de' MMMM", { locale: es })}
                      </p>
                      <button
                        onClick={() => { setDialogOpen(true); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Agendar
                      </button>
                    </div>
                    {(citasByDate[toISODate(calendarDate)] || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Sin citas este día</p>
                    ) : (
                      <div className="space-y-2">
                        {(citasByDate[toISODate(calendarDate)] || []).map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelected(c)}
                            className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
                          >
                            <div className={`w-1.5 h-8 rounded-full shrink-0 ${c.status === 'VENCIDA' ? 'bg-red-400' : c.status === 'CONFIRMADA' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">{c.clienteNombre}</p>
                              <p className="text-[10px] text-slate-400">{fmtTime(c.horaInicio)} · {c.tipoNombre}</p>
                            </div>
                            <StatusBadge status={c.status} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Dialog: Nueva cita ── */}
      <NuevaCitaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultDate={calendarDate ?? new Date()}
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        tiposCita={tiposCita}
        onCreated={() => {
          setCalendarDate(calendarDate);
        }}
      />
    </div>
  );
}
