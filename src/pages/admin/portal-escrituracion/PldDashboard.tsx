import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  FolderKanban, ShieldCheck, FileWarning, ShieldAlert,
  Search, Download, Loader2, X, ChevronDown, RefreshCw,
  AlertTriangle, CheckCircle2, Clock, ExternalLink, Plus,
  Eye, Unlock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type PldStatus = 'APROBADO' | 'PENDIENTE' | 'INCOMPLETO' | 'EN_REVISION' | 'OBSERVADO' | 'BLOQUEADO';
type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';
type PldFilter  = 'TODOS' | 'APROBADOS' | 'INCOMPLETOS' | 'RIESGO';

interface PagoInfo {
  id: number;
  monto: number;
  fecha_pago: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
}

interface PldRow {
  cuentaId: number;
  cuentaLabel: string;
  proyectoNombre: string;
  unidad: string;
  clienteNombre: string;
  pldStatus: PldStatus;
  riesgo: RiskLevel;
  totalPagado: number;
  precioFinal: number;
  hasSinCR: boolean;        // clave_rastreo null → pago no trazable
  hasSinCep: boolean;       // url_cep null (con CR) → sin confirmación CECOBAN
  escrituraBloqueada: boolean;
  numPagos: number;
  pagos: PagoInfo[];
  fechaActualizacion: string;
}

interface PldAlert {
  id: string;
  cuentaId: number;
  cuentaLabel: string;
  unidad: string;
  cliente: string;
  tipo: 'PAGO_NO_TRAZABLE' | 'SIN_CEP' | 'SOBREPAGO' | 'SIN_PAGOS';
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  titulo: string;
  descripcion: string;
  fecha: string;
}

// ─── PLD Engine ───────────────────────────────────────────────────────────────

function derivePld(pagos: PagoInfo[], precioFinal: number): {
  pldStatus: PldStatus;
  riesgo: RiskLevel;
  hasSinCR: boolean;
  hasSinCep: boolean;
  escrituraBloqueada: boolean;
  totalPagado: number;
} {
  if (!pagos.length) {
    return { pldStatus: 'PENDIENTE', riesgo: 'BAJO', hasSinCR: false, hasSinCep: false, escrituraBloqueada: false, totalPagado: 0 };
  }

  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);

  // Pagos sin clave de rastreo = no trazables → ALTO RIESGO
  const hasSinCR = pagos.some(p => !p.clave_rastreo);
  // Pagos con clave de rastreo pero sin CEP = sin confirmación CECOBAN → MEDIO RIESGO
  const hasSinCep = pagos.some(p => p.clave_rastreo && !p.url_cep);
  // Sobrepago
  const sobrepago = precioFinal > 0 && totalPagado > precioFinal * 1.01;

  const riesgo: RiskLevel = hasSinCR ? 'ALTO' : hasSinCep ? 'MEDIO' : 'BAJO';
  const escrituraBloqueada = hasSinCR || sobrepago;

  let pldStatus: PldStatus;
  if (hasSinCR) {
    pldStatus = 'BLOQUEADO';
  } else if (sobrepago) {
    pldStatus = 'OBSERVADO';
  } else if (hasSinCep) {
    pldStatus = 'EN_REVISION';
  } else if (pagos.some(p => !p.clave_rastreo && !p.url_cep)) {
    pldStatus = 'INCOMPLETO';
  } else if (precioFinal > 0 && totalPagado >= precioFinal * 0.99) {
    pldStatus = 'APROBADO';
  } else {
    pldStatus = 'PENDIENTE';
  }

  return { pldStatus, riesgo, hasSinCR, hasSinCep, escrituraBloqueada, totalPagado };
}

function buildAlerts(rows: PldRow[]): PldAlert[] {
  const alerts: PldAlert[] = [];
  rows.forEach(r => {
    if (r.hasSinCR) {
      alerts.push({
        id: `sinCR-${r.cuentaId}`,
        cuentaId: r.cuentaId,
        cuentaLabel: r.cuentaLabel,
        unidad: r.unidad,
        cliente: r.clienteNombre,
        tipo: 'PAGO_NO_TRAZABLE',
        severidad: 'CRITICA',
        titulo: 'Pago sin clave de rastreo',
        descripcion: `La cuenta ${r.cuentaLabel} tiene pagos sin clave de rastreo STP. No es posible verificar el origen de los fondos.`,
        fecha: r.fechaActualizacion,
      });
    }
    if (r.hasSinCep && !r.hasSinCR) {
      alerts.push({
        id: `sinCEP-${r.cuentaId}`,
        cuentaId: r.cuentaId,
        cuentaLabel: r.cuentaLabel,
        unidad: r.unidad,
        cliente: r.clienteNombre,
        tipo: 'SIN_CEP',
        severidad: 'ALTA',
        titulo: 'Pago sin confirmación CEP',
        descripcion: `La cuenta ${r.cuentaLabel} tiene transferencias STP sin Comprobante Electrónico de Pago (CECOBAN).`,
        fecha: r.fechaActualizacion,
      });
    }
    if (r.pldStatus === 'OBSERVADO') {
      alerts.push({
        id: `sobrepago-${r.cuentaId}`,
        cuentaId: r.cuentaId,
        cuentaLabel: r.cuentaLabel,
        unidad: r.unidad,
        cliente: r.clienteNombre,
        tipo: 'SOBREPAGO',
        severidad: 'MEDIA',
        titulo: 'Sobrepago detectado',
        descripcion: `La cuenta ${r.cuentaLabel} tiene pagos que superan el precio final. Requiere revisión.`,
        fecha: r.fechaActualizacion,
      });
    }
  });
  const ORDER: PldAlert['severidad'][] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];
  return alerts.sort((a, b) => ORDER.indexOf(a.severidad) - ORDER.indexOf(b.severidad));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLD_STATUS_META: Record<PldStatus, { label: string; cls: string }> = {
  APROBADO:    { label: 'Aprobado',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  INCOMPLETO:  { label: 'Incompleto',  cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  OBSERVADO:   { label: 'Observado',   cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  BLOQUEADO:   { label: 'Bloqueado',   cls: 'bg-red-50 text-red-700 border border-red-200' },
};

const RISK_META: Record<RiskLevel, { label: string; cls: string }> = {
  BAJO:  { label: 'Bajo',  cls: 'bg-emerald-50 text-emerald-700' },
  MEDIO: { label: 'Medio', cls: 'bg-amber-50 text-amber-700' },
  ALTO:  { label: 'Alto',  cls: 'bg-red-50 text-red-700 font-semibold' },
};

const SEV_META: Record<PldAlert['severidad'], { label: string; cls: string; dot: string }> = {
  CRITICA: { label: 'Crítica', cls: 'bg-red-100 text-red-800 border border-red-300',    dot: 'bg-red-500' },
  ALTA:    { label: 'Alta',    cls: 'bg-red-50 text-red-700 border border-red-200',     dot: 'bg-red-400' },
  MEDIA:   { label: 'Media',   cls: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-400' },
  BAJA:    { label: 'Baja',    cls: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
};

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiSkel() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <Shimmer className="h-3 w-32" />
        <Shimmer className="h-9 w-9 rounded-xl" />
      </div>
      <Shimmer className="h-9 w-14 mb-2" />
      <Shimmer className="h-3 w-40" />
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function PldBadge({ status }: { status: PldStatus }) {
  const m = PLD_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const m = RISK_META[level];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: string;
  badgeCls?: string;
  active?: boolean;
  onClick: () => void;
  loading?: boolean;
}

function KpiCard({ label, value, sub, icon, iconBg, badge, badgeCls, active, onClick, loading }: KpiCardProps) {
  if (loading) return <KpiSkel />;
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all w-full ${active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString('es-MX')}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
      {badge && (
        <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${badgeCls}`}>{badge}</span>
      )}
    </button>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: PldAlert }) {
  const m = SEV_META[alert.severidad];
  return (
    <div className={`rounded-2xl border p-4 ${m.cls}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${m.dot}`} />
          <p className="text-sm font-semibold">{alert.titulo}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${m.cls} shrink-0`}>
          {m.label}
        </span>
      </div>
      <p className="text-xs ml-4 opacity-80 mb-2">{alert.descripcion}</p>
      <div className="flex items-center gap-3 ml-4 text-xs opacity-70">
        <span className="font-mono font-semibold">{alert.cuentaLabel}</span>
        <span>Unidad {alert.unidad}</span>
        <span>{alert.cliente}</span>
        <span className="ml-auto">{fmtDate(alert.fecha)}</span>
      </div>
    </div>
  );
}

// ─── Block Banner ─────────────────────────────────────────────────────────────

function BlockBanner({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5">
      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-800">
          {count} {count === 1 ? 'escritura bloqueada' : 'escrituras bloqueadas'} por PLD
        </p>
        <p className="text-xs text-red-600 mt-0.5">
          Pagos sin clave de rastreo detectados. No es posible avanzar el proceso notarial hasta resolver.
        </p>
      </div>
      <button
        onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
        className="text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition-colors shrink-0"
      >
        Ver detalles
      </button>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ row, onClose }: { row: PldRow; onClose: () => void }) {
  return (
    <div className="w-[360px] min-w-[360px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${row.escrituraBloqueada ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
        <div>
          <p className="text-sm font-bold text-slate-900">{row.cuentaLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.proyectoNombre} · Unidad {row.unidad}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Block banner */}
        {row.escrituraBloqueada && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-xs font-semibold text-red-700">Escritura bloqueada por riesgo PLD</p>
          </div>
        )}

        {/* Ficha */}
        <div className="bg-slate-50 rounded-2xl p-3 space-y-0">
          {[
            ['Cliente',        row.clienteNombre],
            ['Total pagado',   fmtMxn(row.totalPagado)],
            ['Precio final',   fmtMxn(row.precioFinal)],
            ['Actualizado',    fmtDate(row.fechaActualizacion)],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500">{l}</span>
              <span className="text-xs font-medium text-slate-900">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">Estatus PLD</span>
            <PldBadge status={row.pldStatus} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-500">Nivel de riesgo</span>
            <RiskBadge level={row.riesgo} />
          </div>
        </div>

        {/* Señales PLD */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Señales PLD detectadas</p>
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${row.hasSinCR ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700'}`}>
              {row.hasSinCR ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              Clave de rastreo STP {row.hasSinCR ? '⚠ faltante' : '✓ presente'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${row.hasSinCep ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700'}`}>
              {row.hasSinCep ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              CEP CECOBAN {row.hasSinCep ? '⚠ sin confirmar' : '✓ confirmado'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${row.pldStatus === 'OBSERVADO' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-emerald-50 text-emerald-700'}`}>
              {row.pldStatus === 'OBSERVADO' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              Monto {row.pldStatus === 'OBSERVADO' ? '⚠ sobrepago detectado' : '✓ dentro de rango'}
            </div>
          </div>
        </div>

        {/* Pagos */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Pagos registrados ({row.pagos.length})
          </p>
          {row.pagos.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Sin pagos registrados</p>
          ) : (
            <div className="space-y-2">
              {row.pagos.map(p => {
                const hasRisk = !p.clave_rastreo;
                const hasCepRisk = p.clave_rastreo && !p.url_cep;
                return (
                  <div key={p.id} className={`rounded-xl border p-3 ${hasRisk ? 'border-red-200 bg-red-50/50' : hasCepRisk ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMxn(p.monto)}</span>
                      <span className="text-xs text-slate-500">{fmtDate(p.fecha_pago)}</span>
                    </div>
                    <div className="space-y-1">
                      {p.clave_rastreo ? (
                        <p className="text-xs font-mono text-slate-600 truncate">CR: {p.clave_rastreo}</p>
                      ) : (
                        <p className="text-xs text-red-600 font-medium">⚠ Sin clave de rastreo</p>
                      )}
                      <div className="flex items-center gap-2">
                        {p.url_cep ? (
                          <a href={p.url_cep} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3" /> Ver CEP
                          </a>
                        ) : (
                          <span className="text-xs text-amber-600">Sin CEP</span>
                        )}
                        {p.url_recibo && (
                          <a href={p.url_recibo} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
                            onClick={e => e.stopPropagation()}>
                            <FileText className="w-3 h-3" /> Recibo
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acciones PLD</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Revisar expediente', Icon: Eye },
              { label: 'Aprobar PLD',        Icon: ShieldCheck },
              { label: 'Solicitar docs',     Icon: FileText },
              { label: 'Desbloquear',        Icon: Unlock },
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, sub, onRetry }: { title: string; sub?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <ShieldCheck className="w-8 h-8 text-slate-300" />
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

export function PldDashboard() {
  const [proyectoId, setProyectoId]     = useState<number | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState('');
  const [activeFilter, setActiveFilter] = useState<PldFilter>('TODOS');
  const [search, setSearch]             = useState('');
  const [filtroStatus, setFiltroStatus] = useState<PldStatus | 'TODOS'>('TODOS');
  const [filtroRiesgo, setFiltroRiesgo] = useState<RiskLevel | 'TODOS'>('TODOS');
  const [page, setPage]                 = useState(0);
  const [selected, setSelected]         = useState<PldRow | null>(null);
  const [showAlerts, setShowAlerts]     = useState(true);

  useEffect(() => { setPage(0); setSelected(null); }, [proyectoId, activeFilter, search, filtroStatus, filtroRiesgo]);

  // ── Proyectos ──────────────────────────────────────────────────────────────
  const { data: proyectos = [], isLoading: loadingProyectos } = useQuery({
    queryKey: ['proyectos-pld-dashboard'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas').select('id_proyecto').eq('id_tipo_entidad', 5).eq('activo', true);
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

  // ── Datos PLD ──────────────────────────────────────────────────────────────
  const {
    data: rows = [],
    isLoading: loadingRows,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['pld-dashboard', proyectoId],
    queryFn: async (): Promise<PldRow[]> => {
      if (!proyectoId) return [];

      // Propiedades del proyecto (via edificios → modelos)
      const { data: edificios } = await supabase
        .from('edificios').select('id').eq('id_proyecto', proyectoId).eq('activo', true);
      if (!edificios?.length) return [];

      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id').in('id_edificio', edificios.map(e => e.id));
      if (!modelos?.length) return [];

      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, fecha_actualizacion')
        .eq('activo', true)
        .in('id_edificio_modelo', modelos.map(m => m.id))
        .order('numero_propiedad');
      if (!props?.length) return [];

      const propIds = props.map(p => p.id);

      // Cuentas de cobranza
      const { data: cuentasList } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, precio_final, fecha_actualizacion')
        .eq('activo', true)
        .in('id_propiedad', propIds);

      const cuentaByProp: Record<number, { id: number; precio_final: number; fecha_actualizacion: string }> = {};
      (cuentasList || []).forEach(c => {
        const ex = cuentaByProp[c.id_propiedad!];
        if (!ex || c.fecha_actualizacion > ex.fecha_actualizacion) cuentaByProp[c.id_propiedad!] = c;
      });

      const cuentaIds = Object.values(cuentaByProp).map(c => c.id);
      if (!cuentaIds.length) return [];

      // Pagos
      const { data: pagosList } = await supabase
        .from('pagos')
        .select('id, id_cuenta_cobranza, monto, fecha_pago, clave_rastreo, url_cep, url_recibo, descripcion')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true)
        .order('fecha_pago', { ascending: false });

      const pagosByCuenta: Record<number, PagoInfo[]> = {};
      (pagosList || []).forEach(p => {
        if (!pagosByCuenta[p.id_cuenta_cobranza]) pagosByCuenta[p.id_cuenta_cobranza] = [];
        pagosByCuenta[p.id_cuenta_cobranza].push({
          id: p.id,
          monto: p.monto,
          fecha_pago: p.fecha_pago,
          clave_rastreo: p.clave_rastreo,
          url_cep: p.url_cep,
          url_recibo: p.url_recibo,
          descripcion: p.descripcion,
        });
      });

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
      const seenC = new Set<number>();
      (comprsList || []).forEach(c => {
        if (!seenC.has(c.id_cuenta_cobranza)) {
          seenC.add(c.id_cuenta_cobranza);
          clienteByCuenta[c.id_cuenta_cobranza] = personaMap[c.id_persona] || '—';
        }
      });

      // Build rows
      return props
        .filter(p => cuentaByProp[p.id])
        .map(p => {
          const cuenta = cuentaByProp[p.id];
          const pagos = pagosByCuenta[cuenta.id] || [];
          const { pldStatus, riesgo, hasSinCR, hasSinCep, escrituraBloqueada, totalPagado } = derivePld(pagos, cuenta.precio_final);
          return {
            cuentaId: cuenta.id,
            cuentaLabel: `CC-${String(cuenta.id).padStart(6, '0')}`,
            proyectoNombre,
            unidad: p.numero_propiedad,
            clienteNombre: clienteByCuenta[cuenta.id] || '—',
            pldStatus,
            riesgo,
            totalPagado,
            precioFinal: cuenta.precio_final ?? 0,
            hasSinCR,
            hasSinCep,
            escrituraBloqueada,
            numPagos: pagos.length,
            pagos,
            fechaActualizacion: cuenta.fecha_actualizacion || p.fecha_actualizacion,
          } satisfies PldRow;
        });
    },
    enabled: !!proyectoId,
    staleTime: 30_000,
    refetchInterval: 60_000, // polling 60s for near-realtime
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const aprobados = rows.filter(r => r.pldStatus === 'APROBADO').length;
    const incompletos = rows.filter(r => ['PENDIENTE', 'INCOMPLETO', 'EN_REVISION'].includes(r.pldStatus)).length;
    const riesgo = rows.filter(r => r.riesgo === 'ALTO' || r.hasSinCR || r.hasSinCep).length;
    const bloqueados = rows.filter(r => r.escrituraBloqueada).length;
    return { total: rows.length, aprobados, incompletos, riesgo, bloqueados };
  }, [rows]);

  const alerts = useMemo(() => buildAlerts(rows), [rows]);

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let base = rows;
    if (activeFilter === 'APROBADOS')   base = base.filter(r => r.pldStatus === 'APROBADO');
    if (activeFilter === 'INCOMPLETOS') base = base.filter(r => ['PENDIENTE', 'INCOMPLETO', 'EN_REVISION'].includes(r.pldStatus));
    if (activeFilter === 'RIESGO')      base = base.filter(r => r.riesgo === 'ALTO' || r.hasSinCR || r.hasSinCep);
    if (filtroStatus !== 'TODOS') base = base.filter(r => r.pldStatus === filtroStatus);
    if (filtroRiesgo !== 'TODOS') base = base.filter(r => r.riesgo === filtroRiesgo);
    const q = search.toLowerCase();
    if (q) base = base.filter(r => `${r.cuentaLabel} ${r.unidad} ${r.clienteNombre}`.toLowerCase().includes(q));
    return base;
  }, [rows, activeFilter, filtroStatus, filtroRiesgo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const TABLE_TITLE: Record<PldFilter, string> = {
    TODOS: 'Expedientes de pago',
    APROBADOS: 'Revisados — listos para escriturar',
    INCOMPLETOS: 'Pendientes de completar',
    RIESGO: 'Casos de riesgo PLD',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard de PLD</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Prevención de Lavado de Dinero · Monitoreo en tiempo real
            {!loadingRows && rows.length > 0 && (
              <span className="ml-2 text-xs text-emerald-600 font-medium">● Actualización automática activa</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={proyectoId ?? ''}
              onChange={e => {
                const id = Number(e.target.value);
                const p = proyectos.find(x => x.id === id);
                if (p) { setProyectoId(p.id); setProyectoNombre(p.nombre); setSelected(null); }
              }}
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
            onClick={() => { refetch(); toast.success('Evaluación PLD iniciada'); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Evaluar riesgos
          </button>
          <button
            onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* ── Aviso: bloqueo PLD es visual únicamente ──────────────────────── */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-800">
            Advertencia: el bloqueo PLD es informativo, no técnico
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            El estatus <span className="font-semibold">BLOQUEADO</span> mostrado aquí es calculado en el frontend a partir de los pagos registrados.
            <strong className="font-semibold"> No impide a nivel de base de datos</strong> que se registre un número de escritura o se avance el proceso notarial.
            Para un bloqueo real se requiere ejecutar el trigger <code className="font-mono bg-amber-100 rounded px-1">trg_pld_check_before_escritura</code> en la BD
            (ver <span className="font-mono">Ejecuciones_manuales/pld_enforcement_real.md</span>).
          </p>
        </div>
      </div>

      {/* ── Block Banner ─────────────────────────────────────────────────── */}
      {!loadingRows && kpis.bloqueados > 0 && <BlockBanner count={kpis.bloqueados} />}

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Expedientes de pagos"
          value={loadingRows ? 0 : kpis.total}
          sub={`${proyectoNombre || 'proyecto seleccionado'}`}
          icon={<FolderKanban className="w-4 h-4" />}
          iconBg="bg-slate-100 text-slate-600"
          active={activeFilter === 'TODOS'}
          onClick={() => setActiveFilter('TODOS')}
          loading={loadingRows}
        />
        <KpiCard
          label="Listos para escriturar"
          value={loadingRows ? 0 : kpis.aprobados}
          sub={kpis.total > 0 ? `${Math.round((kpis.aprobados / kpis.total) * 100)}% del total` : '—'}
          icon={<ShieldCheck className="w-4 h-4" />}
          iconBg="bg-emerald-100 text-emerald-600"
          badge="Aprobados"
          badgeCls="bg-emerald-100 text-emerald-700"
          active={activeFilter === 'APROBADOS'}
          onClick={() => setActiveFilter('APROBADOS')}
          loading={loadingRows}
        />
        <KpiCard
          label="Faltan por completar"
          value={loadingRows ? 0 : kpis.incompletos}
          sub={kpis.total > 0 ? `${Math.round((kpis.incompletos / kpis.total) * 100)}% del total` : '—'}
          icon={<FileWarning className="w-4 h-4" />}
          iconBg="bg-amber-100 text-amber-600"
          badge="Requiere seguimiento"
          badgeCls="bg-amber-100 text-amber-700"
          active={activeFilter === 'INCOMPLETOS'}
          onClick={() => setActiveFilter('INCOMPLETOS')}
          loading={loadingRows}
        />
        <KpiCard
          label="Casos de riesgo"
          value={loadingRows ? 0 : kpis.riesgo}
          sub={`${kpis.bloqueados} escrituras bloqueadas`}
          icon={<ShieldAlert className="w-4 h-4" />}
          iconBg="bg-red-100 text-red-600"
          badge={kpis.bloqueados > 0 ? 'Bloqueo automático' : undefined}
          badgeCls="bg-red-100 text-red-700"
          active={activeFilter === 'RIESGO'}
          onClick={() => setActiveFilter('RIESGO')}
          loading={loadingRows}
        />
      </div>

      {/* ── Alertas ────────────────────────────────────────────────────── */}
      {!loadingRows && alerts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <button
            onClick={() => setShowAlerts(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors rounded-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">Alertas automáticas PLD</p>
                <p className="text-xs text-slate-500">
                  {alerts.filter(a => a.severidad === 'CRITICA').length} críticas ·{' '}
                  {alerts.filter(a => a.severidad === 'ALTA').length} altas ·{' '}
                  {alerts.filter(a => a.severidad === 'MEDIA').length} medias
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg">{alerts.length}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAlerts ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {showAlerts && (
            <div className="border-t border-slate-200 p-4 space-y-2">
              {alerts.map(a => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{TABLE_TITLE[activeFilter]}</p>
              {!loadingRows && <p className="text-xs text-slate-500">{filtered.length} expedientes</p>}
            </div>
            <div className="relative flex-1 min-w-[200px] ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por ID, unidad o cliente…"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="relative">
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value as any)}
                className="appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer"
              >
                <option value="TODOS">Estatus: Todos</option>
                {(Object.keys(PLD_STATUS_META) as PldStatus[]).map(s => (
                  <option key={s} value={s}>{PLD_STATUS_META[s].label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filtroRiesgo}
                onChange={e => setFiltroRiesgo(e.target.value as any)}
                className="appearance-none bg-white border border-slate-200 text-slate-600 text-sm rounded-xl py-2 pl-3 pr-8 outline-none hover:bg-slate-50 cursor-pointer"
              >
                <option value="TODOS">Riesgo: Todos</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Medio</option>
                <option value="BAJO">Bajo</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={() => toast.info('Funcionalidad pendiente de conectar al backend')}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo expediente
            </button>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto">
            {loadingRows ? (
              <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Evaluando riesgos PLD...</span>
              </div>
            ) : isError ? (
              <EmptyState title="Error al cargar" sub="Verifica tu conexión" onRetry={refetch} />
            ) : !proyectoId ? (
              <EmptyState title="Selecciona un proyecto" />
            ) : rows.length === 0 ? (
              <EmptyState title="Sin expedientes de pago" sub="Este proyecto no tiene cuentas de cobranza con pagos" />
            ) : filtered.length === 0 ? (
              <EmptyState title="Sin resultados" sub="Ajusta los filtros" />
            ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    {['ID Cuenta', 'Unidad / Cliente', 'Estatus PLD', 'Riesgo', 'Pagado / Precio', 'Pagos', 'Señales', 'Actualizado'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(row => {
                    const isSelected = selected?.cuentaId === row.cuentaId;
                    return (
                      <tr
                        key={row.cuentaId}
                        onClick={() => setSelected(isSelected ? null : row)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/40' : ''} ${row.escrituraBloqueada ? 'border-l-2 border-l-red-400' : ''}`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600">{row.cuentaLabel}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{row.proyectoNombre}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{row.unidad}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{row.clienteNombre}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <PldBadge status={row.pldStatus} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <RiskBadge level={row.riesgo} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-sm text-emerald-600 font-semibold tabular-nums">{fmtMxn(row.totalPagado)}</p>
                          <p className="text-xs text-slate-400 tabular-nums">{fmtMxn(row.precioFinal)}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700 tabular-nums font-semibold">{row.numPagos}</span>
                          <p className="text-xs text-slate-400">pagos</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {row.hasSinCR && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                                <AlertTriangle className="w-3 h-3" /> Sin CR
                              </span>
                            )}
                            {row.hasSinCep && !row.hasSinCR && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                <Clock className="w-3 h-3" /> Sin CEP
                              </span>
                            )}
                            {row.escrituraBloqueada && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg font-semibold">
                                🔒 Bloqueada
                              </span>
                            )}
                            {!row.hasSinCR && !row.hasSinCep && !row.escrituraBloqueada && (
                              <span className="text-xs text-emerald-600">✓ Sin alertas</span>
                            )}
                          </div>
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
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} expedientes
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50">
                  {'<'}
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium ${p === page ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50">
                  {'>'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && <DetailPanel row={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
