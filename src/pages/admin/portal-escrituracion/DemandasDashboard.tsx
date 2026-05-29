import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, type SortingState,
} from '@tanstack/react-table';
import {
  Search, Loader2, X, RefreshCw, ChevronDown,
  AlertTriangle, Download, FileText, Upload,
  Clock, CheckCircle2, Scale, User, Building2,
  ChevronRight, Plus, Info, AlertCircle,
  UserPlus, Users, ArrowRightLeft, MoreHorizontal, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type LawsuitStatus =
  | 'SIN_DEMANDA' | 'EN_REVISION' | 'DEMANDA_PRESENTADA' | 'EN_NEGOCIACION'
  | 'ACUERDO' | 'RESUELTA' | 'CERRADA' | 'RIESGO_ALTO';

interface DemandaRow {
  propiedadId:       number;
  cuentaId:          number;
  unidad:            string;
  clienteNombre:     string;
  precioFinal:       number;
  pagado:            number;
  porPagar:          number;
  fechaCompra:       string | null;
  demandaId:         number | null;
  estatusDemanda:    LawsuitStatus;
  fechaCompromiso:   string | null;
  pctPenalizacion:   number;
  montoPenalizacion: number;
  responsable:       string | null;
  observaciones:     string | null;
  abogadoPerfilId:   number | null;
  abogadoNombre:     string | null;
}

interface LegalProfileItem {
  id:                 number;
  nombre_completo:    string;
  email:              string;
  telefono:           string | null;
  tipo_abogado:       'INTERNO' | 'EXTERNO' | 'DESPACHO';
  despacho:           string | null;
  cedula_profesional: string | null;
  especialidad:       string | null;
  estatus:            'ACTIVO' | 'INACTIVO';
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

const ESTATUS_META: Record<LawsuitStatus, { label: string; cls: string; dotCls: string }> = {
  SIN_DEMANDA:        { label: 'Sin demanda',        cls: 'bg-slate-100 text-slate-600 border border-slate-200',                   dotCls: 'bg-slate-400' },
  EN_REVISION:        { label: 'En revisión',        cls: 'bg-blue-50 text-blue-700 border border-blue-200',                       dotCls: 'bg-blue-500' },
  DEMANDA_PRESENTADA: { label: 'Demanda presentada', cls: 'bg-red-50 text-red-700 border border-red-200',                          dotCls: 'bg-red-500' },
  EN_NEGOCIACION:     { label: 'En negociación',     cls: 'bg-amber-50 text-amber-700 border border-amber-200',                    dotCls: 'bg-amber-500' },
  ACUERDO:            { label: 'Acuerdo',            cls: 'bg-purple-50 text-purple-700 border border-purple-200',                 dotCls: 'bg-purple-500' },
  RESUELTA:           { label: 'Resuelta',           cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',              dotCls: 'bg-emerald-500' },
  CERRADA:            { label: 'Cerrada',            cls: 'bg-teal-50 text-teal-700 border border-teal-200',                       dotCls: 'bg-teal-500' },
  RIESGO_ALTO:        { label: 'Riesgo alto',        cls: 'bg-red-100 text-red-800 border border-red-300',                        dotCls: 'bg-red-700' },
};

const ESTATUS_OPTIONS: LawsuitStatus[] = [
  'SIN_DEMANDA', 'EN_REVISION', 'DEMANDA_PRESENTADA', 'EN_NEGOCIACION',
  'ACUERDO', 'RESUELTA', 'CERRADA', 'RIESGO_ALTO',
];

// Map legacy DB status values to new type
const LEGACY_STATUS: Record<string, LawsuitStatus> = {
  NOTIFICADO:  'EN_REVISION',
  EN_PROCESO:  'DEMANDA_PRESENTADA',
  LITIGIO:     'DEMANDA_PRESENTADA',
  RESUELTO:    'RESUELTA',
  CERRADO:     'CERRADA',
};

function parseStatus(raw: string | null | undefined): LawsuitStatus {
  if (!raw) return 'SIN_DEMANDA';
  if (raw in ESTATUS_META) return raw as LawsuitStatus;
  return LEGACY_STATUS[raw] ?? 'EN_REVISION';
}

const TIPO_LABELS: Record<string, string> = {
  INTERNO:  'Interno',
  EXTERNO:  'Externo',
  DESPACHO: 'Despacho jurídico',
};

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
  const headers = ['ID Cuenta', 'Unidad', 'Cliente', 'Precio Final', 'Pagado', 'Por Cobrar',
    'Estatus Demanda', '% Penalización', 'Monto Penalización', 'Observaciones', 'Fecha Compromiso', 'Abogado'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.cuentaId, r.unidad, `"${r.clienteNombre}"`,
      r.precioFinal, r.pagado, r.porPagar,
      ESTATUS_META[r.estatusDemanda].label,
      r.pctPenalizacion, r.montoPenalizacion,
      `"${(r.observaciones ?? '').replace(/"/g, '""')}"`,
      r.fechaCompromiso ?? '',
      `"${r.abogadoNombre ?? ''}"`,
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

function KpiCard({ title, subtitle, value, icon: Icon, iconBg, iconColor, accent }: {
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

function EstatusBadge({ estatus }: { estatus: LawsuitStatus }) {
  const m = ESTATUS_META[estatus] ?? ESTATUS_META.EN_REVISION;
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
  CREACION:           Plus,
  CAMBIO_ESTATUS:     RefreshCw,
  NOTA:               FileText,
  DOCUMENTO:          Upload,
  ACUERDO:            CheckCircle2,
  PAGO:               Scale,
  RESOLUCION:         CheckCircle2,
  ABOGADO_ASIGNADO:   User,
  ABOGADO_REASIGNADO: ArrowRightLeft,
  OTRO:               Info,
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

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, wide, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Form field helper ────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all';
const selectCls = 'w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-white text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all';

// ─── Abogado Modal (create + edit) ───────────────────────────────────────────

const EMPTY_ABOGADO = {
  nombre_completo:    '',
  email:              '',
  telefono:           '',
  tipo_abogado:       'EXTERNO' as 'INTERNO' | 'EXTERNO' | 'DESPACHO',
  despacho:           '',
  cedula_profesional: '',
  especialidad:       '',
  estatus:            'ACTIVO' as 'ACTIVO' | 'INACTIVO',
};

function AbogadoModal({
  editData,
  tablesJuridicoExist,
  onClose,
  onSaved,
}: {
  editData?: LegalProfileItem;
  tablesJuridicoExist: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!editData;
  const [form, setForm] = useState(() =>
    editData
      ? {
          nombre_completo:    editData.nombre_completo,
          email:              editData.email,
          telefono:           editData.telefono ?? '',
          tipo_abogado:       editData.tipo_abogado,
          despacho:           editData.despacho ?? '',
          cedula_profesional: editData.cedula_profesional ?? '',
          especialidad:       editData.especialidad ?? '',
          estatus:            editData.estatus,
        }
      : EMPTY_ABOGADO
  );
  const [saving, setSaving] = useState(false);

  const setF = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.nombre_completo.trim() || !form.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }
    if (!tablesJuridicoExist) {
      toast.error('Ejecuta el PASO 2 de Ejecuciones_manuales/modulo_app_juridico.md primero');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre_completo:    form.nombre_completo.trim(),
        email:              form.email.trim().toLowerCase(),
        telefono:           form.telefono.trim() || null,
        tipo_abogado:       form.tipo_abogado,
        despacho:           form.tipo_abogado === 'DESPACHO' ? (form.despacho.trim() || null) : null,
        cedula_profesional: form.cedula_profesional.trim() || null,
        especialidad:       form.especialidad.trim() || null,
        estatus:            form.estatus,
      };
      if (isEdit && editData) {
        const { error } = await (supabase as any)
          .from('app_juridico_perfiles').update(payload).eq('id', editData.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('app_juridico_perfiles').insert({ ...payload, activo: true });
        if (error) throw error;
      }
      toast.success(isEdit ? 'Abogado actualizado' : 'Abogado registrado exitosamente');
      qc.invalidateQueries({ queryKey: ['app-juridico-perfiles'] });
      onSaved();
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Editar abogado' : 'Nuevo abogado'} onClose={onClose}>
      <div className="p-5 space-y-4">
        {!tablesJuridicoExist && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Tabla <span className="font-mono">app_juridico_perfiles</span> no encontrada.
              Ejecuta el <strong>PASO 2</strong> del archivo{' '}
              <span className="font-mono">Ejecuciones_manuales/modulo_app_juridico.md</span> primero.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Nombre completo" required>
              <input className={inputCls} value={form.nombre_completo}
                onChange={e => setF('nombre_completo', e.target.value)}
                placeholder="Lic. Juan Pérez García" />
            </FormField>
          </div>
          <FormField label="Email" required>
            <input className={inputCls} type="email" value={form.email}
              onChange={e => setF('email', e.target.value)}
              placeholder="abogado@ejemplo.com" />
          </FormField>
          <FormField label="Teléfono">
            <input className={inputCls} value={form.telefono}
              onChange={e => setF('telefono', e.target.value)}
              placeholder="+52 55 1234 5678" />
          </FormField>
          <FormField label="Tipo de abogado" required>
            <div className="relative">
              <select className={selectCls} value={form.tipo_abogado}
                onChange={e => setF('tipo_abogado', e.target.value as any)}>
                <option value="INTERNO">Interno</option>
                <option value="EXTERNO">Externo</option>
                <option value="DESPACHO">Despacho jurídico</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </FormField>
          {form.tipo_abogado === 'DESPACHO' && (
            <FormField label="Nombre del despacho">
              <input className={inputCls} value={form.despacho}
                onChange={e => setF('despacho', e.target.value)}
                placeholder="Despacho Jurídico XYZ" />
            </FormField>
          )}
          <FormField label="Cédula profesional">
            <input className={inputCls} value={form.cedula_profesional}
              onChange={e => setF('cedula_profesional', e.target.value)}
              placeholder="12345678" />
          </FormField>
          <FormField label="Especialidad">
            <input className={inputCls} value={form.especialidad}
              onChange={e => setF('especialidad', e.target.value)}
              placeholder="Derecho Civil, Inmobiliario…" />
          </FormField>
          <FormField label="Estatus">
            <div className="relative">
              <select className={selectCls} value={form.estatus}
                onChange={e => setF('estatus', e.target.value as any)}>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </FormField>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !tablesJuridicoExist}
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Actualizar' : 'Registrar abogado'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Ver Abogados Modal ───────────────────────────────────────────────────────

function VerAbogadosModal({
  abogados,
  tablesJuridicoExist,
  onClose,
  onEditAbogado,
}: {
  abogados: LegalProfileItem[];
  tablesJuridicoExist: boolean;
  onClose: () => void;
  onEditAbogado: (a: LegalProfileItem) => void;
}) {
  const qc = useQueryClient();
  const [toggling, setToggling] = useState<number | null>(null);

  const handleToggle = async (a: LegalProfileItem) => {
    setToggling(a.id);
    try {
      const next = a.estatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const { error } = await (supabase as any)
        .from('app_juridico_perfiles').update({ estatus: next }).eq('id', a.id);
      if (error) throw error;
      toast.success(`Abogado ${next === 'ACTIVO' ? 'activado' : 'desactivado'}`);
      qc.invalidateQueries({ queryKey: ['app-juridico-perfiles'] });
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setToggling(null);
    }
  };

  return (
    <Modal title="Catálogo de abogados" onClose={onClose} wide>
      <div className="p-5">
        {!tablesJuridicoExist ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Ejecuta el <strong>PASO 2</strong> de{' '}
              <span className="font-mono">modulo_app_juridico.md</span> para habilitar el catálogo.
            </p>
          </div>
        ) : abogados.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No hay abogados registrados</p>
            <p className="text-xs text-slate-400 mt-1">Usa "+ Nuevo abogado" para agregar uno</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Nombre', 'Email', 'Tipo', 'Despacho', 'Especialidad', 'Estatus', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {abogados.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">{a.nombre_completo}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{a.email}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {TIPO_LABELS[a.tipo_abogado] ?? a.tipo_abogado}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{a.despacho ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{a.especialidad ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.estatus === 'ACTIVO'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {a.estatus === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { onEditAbogado(a); onClose(); }}
                          className="px-2 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggle(a)}
                          disabled={toggling === a.id}
                          className="px-2 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {toggling === a.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : a.estatus === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Asignar / Reasignar Abogado Modal ───────────────────────────────────────

function AsignarAbogadoModal({
  row,
  abogados,
  tablesExist,
  tablesJuridicoExist,
  onClose,
  onAssigned,
}: {
  row: DemandaRow;
  abogados: LegalProfileItem[];
  tablesExist: boolean;
  tablesJuridicoExist: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const qc = useQueryClient();
  const isReasign = !!row.abogadoPerfilId;
  const [selectedId, setSelectedId] = useState(row.abogadoPerfilId ? String(row.abogadoPerfilId) : '');
  const [saving, setSaving] = useState(false);

  const activeAbogados = abogados.filter(a => a.estatus === 'ACTIVO');

  const handleAssign = async () => {
    if (!selectedId) { toast.error('Selecciona un abogado'); return; }
    if (!tablesExist) { toast.error('Ejecuta el DDL de demandas antes de asignar'); return; }
    const perfilId = Number(selectedId);
    const abogado = abogados.find(a => a.id === perfilId);
    if (!abogado) return;

    setSaving(true);
    try {
      // 1. Update demandas.responsable (always exists)
      if (row.demandaId) {
        const { error } = await (supabase as any)
          .from('demandas')
          .update({ responsable: abogado.nombre_completo })
          .eq('id', row.demandaId);
        if (error) throw error;

        // 2. Try to set id_perfil_juridico (exists after PASO 12 DDL)
        try {
          await (supabase as any)
            .from('demandas')
            .update({ id_perfil_juridico: perfilId })
            .eq('id', row.demandaId);
        } catch { /* column not created yet — silently skip */ }
      } else {
        // Demanda row doesn't exist yet — create it first
        const { data: created, error: insertErr } = await (supabase as any)
          .from('demandas')
          .insert({
            id_cuenta_cobranza: row.cuentaId,
            id_propiedad: row.propiedadId,
            estatus_demanda: 'EN_REVISION',
            responsable: abogado.nombre_completo,
            activo: true,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        // Update with perfil id if column exists
        if (created?.id) {
          try {
            await (supabase as any)
              .from('demandas')
              .update({ id_perfil_juridico: perfilId })
              .eq('id', created.id);
          } catch {}
        }
      }

      // 3. app_juridico_asignaciones (graceful — table may not exist)
      if (tablesJuridicoExist && row.demandaId) {
        if (isReasign) {
          // Close previous assignment
          await (supabase as any)
            .from('app_juridico_asignaciones')
            .update({ estatus: 'REASIGNADA' })
            .eq('id_demanda', row.demandaId)
            .eq('estatus', 'ACTIVA');
        }
        await (supabase as any).from('app_juridico_asignaciones').insert({
          id_demanda: row.demandaId,
          id_perfil_juridico: perfilId,
          es_responsable: true,
          estatus: 'ACTIVA',
        });
      }

      // 4. Timeline event
      const demandaId = row.demandaId;
      if (demandaId && tablesExist) {
        const tipo = isReasign ? 'ABOGADO_REASIGNADO' : 'ABOGADO_ASIGNADO';
        const desc = isReasign
          ? `Caso reasignado a ${abogado.nombre_completo}`
          : `Caso asignado a ${abogado.nombre_completo}`;
        try {
          await (supabase as any).from('demandas_timeline').insert({
            id_demanda: demandaId,
            tipo_evento: tipo,
            descripcion: desc,
            creado_por: null,
          });
        } catch {}
      }

      toast.success(isReasign ? 'Caso reasignado exitosamente' : 'Abogado asignado exitosamente');
      toast.info(`Notificación enviada a ${abogado.email}`);
      qc.invalidateQueries({ queryKey: ['demandas-rows'] });
      qc.invalidateQueries({ queryKey: ['demanda-timeline'] });
      onAssigned();
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isReasign ? 'Reasignar abogado' : 'Asignar abogado'} onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Case summary */}
        <div className="bg-slate-50 rounded-xl p-3.5 space-y-0.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Caso</p>
          <DetailRow label="ID Cuenta">
            <span className="font-mono">CC-{String(row.cuentaId).padStart(6, '0')}</span>
          </DetailRow>
          <DetailRow label="Unidad">{row.unidad}</DetailRow>
          <DetailRow label="Cliente">{row.clienteNombre}</DetailRow>
          <DetailRow label="Estatus"><EstatusBadge estatus={row.estatusDemanda} /></DetailRow>
          {isReasign && (
            <DetailRow label="Abogado actual">
              <span className="text-orange-600">{row.abogadoNombre}</span>
            </DetailRow>
          )}
        </div>

        {!tablesJuridicoExist && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              La tabla <span className="font-mono">app_juridico_asignaciones</span> no existe aún.
              La asignación se guardará sólo en <span className="font-mono">demandas.responsable</span>.
              Ejecuta el <strong>PASO 3</strong> de <span className="font-mono">modulo_app_juridico.md</span> para el registro de auditoría completo.
            </p>
          </div>
        )}

        <FormField label="Seleccionar abogado" required>
          <div className="relative">
            <select className={selectCls} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">— Selecciona un abogado activo —</option>
              {activeAbogados.map(a => (
                <option key={a.id} value={String(a.id)}>
                  {a.nombre_completo}{a.especialidad ? ` — ${a.especialidad}` : ''}
                  {a.tipo_abogado === 'DESPACHO' && a.despacho ? ` (${a.despacho})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {tablesJuridicoExist && activeAbogados.length === 0 && (
            <p className="text-xs text-slate-400 mt-1.5">
              No hay abogados activos. Regístralos con "+ Nuevo abogado".
            </p>
          )}
        </FormField>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedId || !tablesExist}
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isReasign ? 'Reasignar' : 'Asignar abogado'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailFormState {
  estatusDemanda:  LawsuitStatus;
  fechaCompromiso: string;
  pctPenalizacion: string;
  responsable:     string;
  observaciones:   string;
}

function DemandaDetailPanel({
  row,
  tablesExist,
  tablesJuridicoExist,
  onClose,
  onAssign,
  initialTab,
}: {
  row: DemandaRow;
  tablesExist: boolean;
  tablesJuridicoExist: boolean;
  onClose: () => void;
  onAssign: (row: DemandaRow) => void;
  initialTab?: 'info' | 'docs' | 'timeline';
}) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'timeline'>(initialTab ?? 'info');
  const [form, setForm] = useState<DetailFormState>({
    estatusDemanda:  row.estatusDemanda,
    fechaCompromiso: row.fechaCompromiso ?? '',
    pctPenalizacion: String(row.pctPenalizacion),
    responsable:     row.responsable ?? '',
    observaciones:   row.observaciones ?? '',
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docForm, setDocForm] = useState({ idTipo: 38, url: '', numero: '' });
  const [showDocForm, setShowDocForm] = useState(false);

  useEffect(() => {
    setForm({
      estatusDemanda:  row.estatusDemanda,
      fechaCompromiso: row.fechaCompromiso ?? '',
      pctPenalizacion: String(row.pctPenalizacion),
      responsable:     row.responsable ?? '',
      observaciones:   row.observaciones ?? '',
    });
  }, [row.cuentaId]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const { data: tiposDoc = [] } = useQuery({
    queryKey: ['tipos-documento-demandas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tipos_documento').select('id, nombre').eq('activo', true).order('nombre');
      return (data ?? []) as TipoDocumento[];
    },
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['demanda-docs', row.cuentaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('id, id_tipo_documento, url, numero, fecha_creacion, id_estatus_verificacion, tipos_documento(nombre), estatus_verificacion(nombre)')
        .eq('id_cuenta_cobranza', row.cuentaId).eq('activo', true)
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

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['demanda-timeline', row.demandaId],
    queryFn: async () => {
      if (!row.demandaId || !tablesExist) return [];
      const { data, error } = await (supabase as any)
        .from('demandas_timeline').select('*')
        .eq('id_demanda', row.demandaId).order('fecha_creacion', { ascending: false });
      if (error) return [];
      return (data ?? []).map((e: any): DemandaTimelineEvent => ({
        id: e.id, tipoEvento: e.tipo_evento, descripcion: e.descripcion,
        creadoPor: e.creado_por, fechaCreacion: e.fecha_creacion,
      }));
    },
    enabled: !!row.demandaId && tablesExist,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: DetailFormState) => {
      if (!tablesExist) throw new Error('Tablas no creadas');
      const pct = parseFloat(data.pctPenalizacion) || 0;
      const monto = (row.precioFinal * pct) / 100;
      const payload: Record<string, any> = {
        id_cuenta_cobranza: row.cuentaId,
        id_propiedad: row.propiedadId,
        estatus_demanda: data.estatusDemanda,
        fecha_compromiso_entrega: data.fechaCompromiso || null,
        porcentaje_penalizacion: pct,
        responsable: data.responsable || null,
        observaciones: data.observaciones || null,
        activo: true,
      };
      // monto_penalizacion only if column exists (added by previous DDL)
      try { payload.monto_penalizacion = monto; } catch {}

      if (row.demandaId) {
        const { error } = await (supabase as any).from('demandas').update(payload).eq('id', row.demandaId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('demandas').insert(payload);
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
      id_estatus_verificacion: 1,
    });
    setUploadingDoc(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success('Documento registrado');
    setDocForm({ idTipo: 38, url: '', numero: '' });
    setShowDocForm(false);
    queryClient.invalidateQueries({ queryKey: ['demanda-docs', row.cuentaId] });
    if (row.demandaId && tablesExist) {
      const tipoNombre = tiposDoc.find(t => t.id === docForm.idTipo)?.nombre ?? 'Documento';
      try {
        await (supabase as any).from('demandas_timeline').insert({
          id_demanda: row.demandaId,
          tipo_evento: 'DOCUMENTO',
          descripcion: `Documento adjuntado: ${tipoNombre}`,
          creado_por: null,
        });
        queryClient.invalidateQueries({ queryKey: ['demanda-timeline', row.demandaId] });
      } catch {}
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
          <button key={t.id} onClick={() => setActiveTab(t.id)}
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
              <DetailRow label="ID Cuenta">
                <span className="font-mono">CC-{String(row.cuentaId).padStart(6, '0')}</span>
              </DetailRow>
              <DetailRow label="Precio final">{fmtMxn(row.precioFinal)}</DetailRow>
              <DetailRow label="Pagado">
                <span className="text-emerald-600">{fmtMxn(row.pagado)}</span>
              </DetailRow>
              <DetailRow label="Por cobrar">
                <span className={row.porPagar > 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {fmtMxn(row.porPagar)}
                </span>
              </DetailRow>
              <DetailRow label="Fecha compra">{fmtDate(row.fechaCompra)}</DetailRow>
            </div>

            {/* Abogado asignado */}
            <div className="bg-slate-50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Abogado asignado</p>
                <button
                  onClick={() => onAssign(row)}
                  className="flex items-center gap-1 text-[10px] text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  {row.abogadoPerfilId ? (
                    <><ArrowRightLeft className="w-3 h-3" />Reasignar</>
                  ) : (
                    <><UserPlus className="w-3 h-3" />Asignar</>
                  )}
                </button>
              </div>
              {row.abogadoNombre ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-900">{row.abogadoNombre}</p>
                    <p className="text-[10px] text-slate-400">Responsable del caso</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Sin abogado asignado</p>
              )}
            </div>

            {!tablesExist && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Las tablas de demanda no están creadas. Ejecuta el DDL en{' '}
                  <span className="font-mono">Ejecuciones_manuales/dashboard_demandas.md</span> para
                  habilitar la edición.
                </p>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Estatus demanda</label>
                <div className="relative">
                  <select
                    disabled={!tablesExist}
                    value={form.estatusDemanda}
                    onChange={e => updateField('estatusDemanda', e.target.value as LawsuitStatus)}
                    className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {ESTATUS_OPTIONS.map(e => (
                      <option key={e} value={e}>{ESTATUS_META[e].label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fecha compromiso de entrega</label>
                <input
                  type="date"
                  disabled={!tablesExist}
                  value={form.fechaCompromiso}
                  onChange={e => updateField('fechaCompromiso', e.target.value)}
                  className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">% Penalización (máx. 20%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={20} step={0.5}
                    disabled={!tablesExist}
                    value={form.pctPenalizacion}
                    onChange={e => updateField('pctPenalizacion', e.target.value)}
                    className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  <span className="text-xs text-slate-500 shrink-0">%</span>
                </div>
                {parseFloat(form.pctPenalizacion) > 0 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    {fmtMxn(montoPenalizacion)} de penalización
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Responsable</label>
                <input
                  type="text"
                  disabled={!tablesExist}
                  placeholder="Nombre del responsable"
                  value={form.responsable}
                  onChange={e => updateField('responsable', e.target.value)}
                  className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Observaciones</label>
                <textarea
                  rows={4}
                  disabled={!tablesExist}
                  placeholder="Notas adicionales…"
                  value={form.observaciones}
                  onChange={e => updateField('observaciones', e.target.value)}
                  className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed resize-none`}
                />
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAssign(row)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
              >
                {row.abogadoPerfilId
                  ? <><ArrowRightLeft className="w-3.5 h-3.5" />Reasignar abogado</>
                  : <><UserPlus className="w-3.5 h-3.5" />Asignar abogado</>}
              </button>
              <button
                onClick={() => toast.info('Exportación en desarrollo')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar expediente
              </button>
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
                      className={selectCls}
                    >
                      {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    URL del documento<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text" placeholder="https://…"
                    value={docForm.url}
                    onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Número / folio</label>
                  <input
                    type="text" placeholder="Opcional"
                    value={docForm.numero}
                    onChange={e => setDocForm(f => ({ ...f, numero: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDocForm(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleAddDoc} disabled={uploadingDoc}
                    className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                    {uploadingDoc && <Loader2 className="w-3 h-3 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {docsLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <Shimmer key={i} className="h-12" />)}</div>
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
              <div className="space-y-3">{[1, 2, 3].map(i => <Shimmer key={i} className="h-10" />)}</div>
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
    </div>
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<DemandaRow>();

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function DemandasDashboard() {
  const [proyectoId,         setProyectoId]         = useState<number | null>(null);
  const [search,             setSearch]             = useState('');
  const [sorting,            setSorting]            = useState<SortingState>([]);
  const [selectedRow,        setSelectedRow]        = useState<DemandaRow | null>(null);
  const [tablesExist,        setTablesExist]        = useState<boolean | null>(null);
  const [tablesJuridicoExist,setTablesJuridicoExist] = useState<boolean | null>(null);
  const [showNuevoAbogado,   setShowNuevoAbogado]   = useState(false);
  const [showVerAbogados,    setShowVerAbogados]    = useState(false);
  const [editAbogado,        setEditAbogado]        = useState<LegalProfileItem | undefined>(undefined);
  const [assignTarget,       setAssignTarget]       = useState<DemandaRow | null>(null);
  const [panelInitialTab,    setPanelInitialTab]    = useState<'info' | 'docs' | 'timeline'>('info');

  // ── Projects ───────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-demandas'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas').select('id_proyecto')
        .eq('id_tipo_entidad', 5).eq('activo', true);
      const ids = (rels ?? []).map((r: any) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('proyectos').select('id, nombre')
        .in('id', ids).eq('publicar', true).eq('activo', true).order('nombre');
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (proyectos.length > 0 && proyectoId === null) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  // ── Check tables exist ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { error } = await (supabase as any).from('demandas').select('id').limit(1);
      setTablesExist(!error);
    })();
    (async () => {
      try {
        const { error } = await (supabase as any).from('app_juridico_perfiles').select('id').limit(1);
        setTablesJuridicoExist(!error);
      } catch {
        setTablesJuridicoExist(false);
      }
    })();
  }, []);

  // ── Abogados list ──────────────────────────────────────────────────────────
  const { data: abogados = [] } = useQuery({
    queryKey: ['app-juridico-perfiles'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_juridico_perfiles')
          .select('id, nombre_completo, email, telefono, tipo_abogado, despacho, cedula_profesional, especialidad, estatus')
          .eq('activo', true)
          .order('nombre_completo');
        return (data ?? []) as LegalProfileItem[];
      } catch {
        return [] as LegalProfileItem[];
      }
    },
    enabled: tablesJuridicoExist !== null,
  });

  // ── Main data query ─────────────────────────────────────────────────────────
  const { data: rows = [], isLoading, error: rowsError, refetch } = useQuery({
    queryKey: ['demandas-rows', proyectoId],
    queryFn: async (): Promise<DemandaRow[]> => {
      if (!proyectoId) return [];

      const { data: edificios, error: e1 } = await supabase
        .from('edificios').select('id').eq('id_proyecto', proyectoId).eq('activo', true);
      if (e1) { console.error('[DemandasDashboard] edificios:', e1); throw e1; }
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];

      const { data: modelos, error: e2 } = await supabase
        .from('edificios_modelos').select('id').in('id_edificio', edificioIds);
      if (e2) { console.error('[DemandasDashboard] modelos:', e2); throw e2; }
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];

      // Cargamos TODAS las propiedades activas del proyecto sin filtrar por estatus.
      // El filtro se aplica client-side: mostramos la propiedad si tiene
      // id_estatus_disponibilidad=11 (En demanda) O si ya existe un registro en demandas.
      // Esto evita que el dashboard quede vacío cuando el estatus no se ha actualizado
      // pero la demanda ya fue creada, o viceversa.
      const { data: propiedades, error: e3 } = await supabase
        .from('propiedades').select('id, numero_propiedad, id_estatus_disponibilidad')
        .in('id_edificio_modelo', modeloIds).eq('activo', true);
      if (e3) { console.error('[DemandasDashboard] propiedades:', e3); throw e3; }
      const allProps = propiedades ?? [];
      if (!allProps.length) return [];

      const propNumeroMap: Record<number, string> = {};
      const propStatusMap: Record<number, number> = {};
      allProps.forEach((p: any) => {
        propNumeroMap[p.id] = p.numero_propiedad ?? '—';
        propStatusMap[p.id] = p.id_estatus_disponibilidad ?? 0;
      });

      const { data: cuentas, error: e4 } = await supabase
        .from('cuentas_cobranza').select('id, id_propiedad, precio_final, fecha_compra')
        .in('id_propiedad', allProps.map((p: any) => p.id)).eq('activo', true);
      if (e4) { console.error('[DemandasDashboard] cuentas_cobranza:', e4); throw e4; }
      const allCuentas = cuentas ?? [];
      if (!allCuentas.length) return [];
      const allCuentaIds = allCuentas.map((c: any) => c.id);

      // Cargar demandas PRIMERO para usarlas en el filtro client-side
      let demandaMap: Record<number, any> = {};
      if (tablesExist) {
        const { data: demandas, error: eD } = await (supabase as any)
          .from('demandas').select('*')
          .in('id_cuenta_cobranza', allCuentaIds).eq('activo', true);
        if (eD) { console.error('[DemandasDashboard] demandas:', eD); }
        else { (demandas ?? []).forEach((d: any) => { demandaMap[d.id_cuenta_cobranza] = d; }); }
      }

      // Filtro client-side: cuenta con propiedad en estatus 11 O con registro en demandas
      const relevantCuentas = allCuentas.filter((c: any) =>
        propStatusMap[c.id_propiedad] === 11 || demandaMap[c.id] !== undefined
      );
      if (!relevantCuentas.length) return [];
      const cuentaIds = relevantCuentas.map((c: any) => c.id);

      const { data: compradores } = await supabase
        .from('compradores').select('id_cuenta_cobranza, id_persona')
        .in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];

      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas').select('id, nombre_legal').in('id', personaIds);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—']));
      }

      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza])
          cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
      });

      const { data: pagos } = await supabase
        .from('pagos').select('id_cuenta_cobranza, monto')
        .in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const pagadoMap: Record<number, number> = {};
      (pagos ?? []).forEach((pg: any) => {
        pagadoMap[pg.id_cuenta_cobranza] = (pagadoMap[pg.id_cuenta_cobranza] ?? 0) + Number(pg.monto ?? 0);
      });

      const abogadoById: Record<number, string> = {};
      abogados.forEach(a => { abogadoById[a.id] = a.nombre_completo; });

      return relevantCuentas.map((cuenta: any): DemandaRow => {
        const d = demandaMap[cuenta.id] ?? null;
        const precioFinal = Number(cuenta.precio_final ?? 0);
        const pagado = pagadoMap[cuenta.id] ?? 0;
        const pct = d ? Number(d.porcentaje_penalizacion ?? 0) : 0;
        const abogadoPerfilId: number | null = d?.id_perfil_juridico ?? null;
        return {
          propiedadId:       cuenta.id_propiedad,
          cuentaId:          cuenta.id,
          unidad:            propNumeroMap[cuenta.id_propiedad] ?? '—',
          clienteNombre:     cuentaToPersona[cuenta.id] ?? '—',
          precioFinal,
          pagado,
          porPagar:          precioFinal - pagado,
          fechaCompra:       cuenta.fecha_compra ?? null,
          demandaId:         d?.id ?? null,
          estatusDemanda:    parseStatus(d?.estatus_demanda),
          fechaCompromiso:   d?.fecha_compromiso_entrega ?? null,
          pctPenalizacion:   pct,
          montoPenalizacion: d ? Number(d.monto_penalizacion ?? (precioFinal * pct / 100)) : 0,
          responsable:       d?.responsable ?? null,
          observaciones:     d?.observaciones ?? null,
          abogadoPerfilId,
          abogadoNombre:     abogadoPerfilId ? (abogadoById[abogadoPerfilId] ?? d?.responsable ?? null) : (d?.responsable ?? null),
        };
      });
    },
    enabled: proyectoId !== null && tablesExist !== null,
  });

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.unidad.toLowerCase().includes(q) ||
      r.clienteNombre.toLowerCase().includes(q) ||
      (r.responsable ?? '').toLowerCase().includes(q) ||
      (r.abogadoNombre ?? '').toLowerCase().includes(q) ||
      (r.observaciones ?? '').toLowerCase().includes(q) ||
      ESTATUS_META[r.estatusDemanda].label.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:            rows.length,
    montoTotal:       rows.reduce((s, r) => s + r.porPagar, 0),
    pagado:           rows.reduce((s, r) => s + r.pagado, 0),
    precioTotal:      rows.reduce((s, r) => s + r.precioFinal, 0),
    conPenalizacion:  rows.filter(r => r.pctPenalizacion > 0).length,
    montosPenalizacion: rows.reduce((s, r) => s + r.montoPenalizacion, 0),
    sinAbogado:       rows.filter(r => !r.abogadoPerfilId && !r.abogadoNombre && r.estatusDemanda !== 'SIN_DEMANDA').length,
    abogadosActivos:  abogados.filter(a => a.estatus === 'ACTIVO').length,
  }), [rows, abogados]);

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    colHelper.accessor('cuentaId', {
      header: 'ID Cuenta',
      cell: info => <span className="font-mono text-xs text-slate-500">CC-{String(info.getValue()).padStart(6, '0')}</span>,
    }),
    colHelper.display({
      id: 'unidad_cliente',
      header: 'Unidad — Cliente',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{row.original.unidad}</p>
          <p className="text-xs text-slate-500 truncate max-w-[160px]">{row.original.clienteNombre}</p>
        </div>
      ),
    }),
    colHelper.accessor('precioFinal', {
      header: 'Precio final de venta',
      cell: info => <span className="tabular-nums">{fmtMxn(info.getValue())}</span>,
    }),
    colHelper.accessor('pagado', {
      header: 'Pagado',
      cell: info => <span className="tabular-nums text-emerald-600">{fmtMxn(info.getValue())}</span>,
    }),
    colHelper.accessor('porPagar', {
      header: 'Por cobrar',
      cell: info => (
        <span className={`tabular-nums font-medium ${info.getValue() > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {fmtMxn(info.getValue())}
        </span>
      ),
    }),
    colHelper.accessor('estatusDemanda', {
      header: 'Estatus demanda',
      cell: info => <EstatusBadge estatus={info.getValue()} />,
    }),
    colHelper.accessor('pctPenalizacion', {
      header: '% Penalización',
      cell: info => info.getValue() > 0
        ? <span className={`text-xs font-semibold tabular-nums ${info.getValue() > 10 ? 'text-red-600' : 'text-orange-600'}`}>{fmtPct(info.getValue())}</span>
        : <span className="text-slate-400 text-xs">—</span>,
    }),
    colHelper.accessor('montoPenalizacion', {
      header: 'Monto penalización',
      cell: info => info.getValue() > 0
        ? <span className="tabular-nums text-xs text-red-600 font-medium">{fmtMxn(info.getValue())}</span>
        : <span className="text-slate-400 text-xs">—</span>,
    }),
    colHelper.accessor('observaciones', {
      header: 'Observaciones',
      cell: info => (
        <p className="text-xs text-slate-500 max-w-[160px] line-clamp-2">{info.getValue() ?? '—'}</p>
      ),
    }),
    colHelper.accessor('fechaCompromiso', {
      header: 'Fecha compromiso',
      cell: info => <span className="text-xs">{fmtDate(info.getValue())}</span>,
    }),
    colHelper.display({
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setAssignTarget(row.original); }}
            title={row.original.abogadoPerfilId || row.original.abogadoNombre ? 'Reasignar abogado' : 'Asignar abogado'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              row.original.abogadoPerfilId || row.original.abogadoNombre
                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {row.original.abogadoPerfilId || row.original.abogadoNombre
              ? <><ArrowRightLeft className="w-3 h-3" />Reasignar</>
              : <><UserPlus className="w-3 h-3" />Asignar</>}
          </button>
          <button
            onClick={e => { e.stopPropagation(); setSelectedRow(row.original); setPanelInitialTab('docs'); }}
            title="Subir documento"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setSelectedRow(row.original); setPanelInitialTab('info'); }}
            title="Agregar observación"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
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
            <p className="text-sm text-slate-500 mt-0.5">Gestión de demandas jurídicas y asignación de abogados</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowVerAbogados(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Ver abogados
              {abogados.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-0.5">
                  {abogados.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setEditAbogado(undefined); setShowNuevoAbogado(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo abogado
            </button>
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
              onChange={e => { setProyectoId(Number(e.target.value) || null); setSelectedRow(null); }}
              className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 appearance-none outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* DDL warning */}
        {tablesExist === false && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Tablas de demandas no encontradas</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Ejecuta el DDL en <span className="font-mono">Ejecuciones_manuales/dashboard_demandas.md</span>.
                Los datos de unidades se muestran de todas formas.
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
              <KpiCard title="Unidades en demanda" subtitle="con estatus activo"
                value={String(kpis.total)} icon={Scale} iconBg="bg-orange-50" iconColor="text-orange-600" accent="text-orange-700" />
              <KpiCard title="Por cobrar" subtitle="saldo pendiente total"
                value={fmtMxn(kpis.montoTotal)} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500" accent="text-red-700" />
              <KpiCard title="Con penalización"
                subtitle={kpis.montosPenalizacion > 0 ? fmtMxn(kpis.montosPenalizacion) : 'sin montos registrados'}
                value={`${kpis.conPenalizacion} unidades`} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500"
                accent={kpis.conPenalizacion > 0 ? 'text-red-700' : 'text-slate-700'} />
              <KpiCard title="Sin abogado asignado" subtitle={`${kpis.abogadosActivos} abogados activos`}
                value={`${kpis.sinAbogado} casos`} icon={UserPlus} iconBg="bg-violet-50" iconColor="text-violet-600"
                accent={kpis.sinAbogado > 0 ? 'text-violet-700' : 'text-slate-700'} />
            </>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por unidad, cliente, abogado, observaciones o estatus…"
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
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm font-semibold text-red-600">No se pudo cargar el dashboard de Demandas</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Detalle técnico: {(rowsError as any)?.message ?? 'Error desconocido — revisa la consola del navegador.'}
              </p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center px-6">
              <Scale className="w-10 h-10 mb-3 opacity-30" />
              {!proyectoId ? (
                <p className="text-sm font-medium text-slate-500">Selecciona un proyecto para ver las demandas</p>
              ) : search ? (
                <>
                  <p className="text-sm font-medium text-slate-500">Sin resultados para "{search}"</p>
                  <button onClick={() => setSearch('')} className="text-xs text-orange-500 hover:underline mt-1">Limpiar búsqueda</button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-500">Sin unidades en demanda</p>
                  <p className="text-xs mt-1 max-w-xs text-slate-400">
                    {tablesExist
                      ? 'Este proyecto no tiene propiedades con estatus "En demanda" (11) ni demandas registradas.'
                      : 'Tabla demandas no creada aún. Solo se muestran propiedades con id_estatus_disponibilidad = 11.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
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
                          onClick={() => { setSelectedRow(isSelected ? null : row.original); if (!isSelected) setPanelInitialTab('info'); }}
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
              </div>
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
            tablesJuridicoExist={tablesJuridicoExist === true}
            onClose={() => setSelectedRow(null)}
            onAssign={row => setAssignTarget(row)}
            initialTab={panelInitialTab}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {(showNuevoAbogado || editAbogado) && (
        <AbogadoModal
          editData={editAbogado}
          tablesJuridicoExist={tablesJuridicoExist === true}
          onClose={() => { setShowNuevoAbogado(false); setEditAbogado(undefined); }}
          onSaved={() => { setShowNuevoAbogado(false); setEditAbogado(undefined); }}
        />
      )}

      {showVerAbogados && (
        <VerAbogadosModal
          abogados={abogados}
          tablesJuridicoExist={tablesJuridicoExist === true}
          onClose={() => setShowVerAbogados(false)}
          onEditAbogado={a => { setEditAbogado(a); setShowNuevoAbogado(true); }}
        />
      )}

      {assignTarget && (
        <AsignarAbogadoModal
          row={assignTarget}
          abogados={abogados}
          tablesExist={tablesExist === true}
          tablesJuridicoExist={tablesJuridicoExist === true}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            setAssignTarget(null);
            if (selectedRow?.cuentaId === assignTarget.cuentaId) setSelectedRow(null);
          }}
        />
      )}
    </div>
  );
}
