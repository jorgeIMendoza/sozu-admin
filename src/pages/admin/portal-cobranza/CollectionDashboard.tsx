import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';
import { navigateWithFilters } from '@/lib/navigationFilters';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import { useCollectionDashboard, type OwnerOption } from '@/hooks/useCollectionDashboard';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import { SelectCombobox, OwnerMultiSelect } from '@/components/admin/portal-cobranza/CollectionFilterControls';
import { StatCard } from '@/components/admin/portal-cobranza/CollectionStatCard';
import { NivelMorosidad, AgingYRiesgo, ClientesCriticos } from '@/components/admin/portal-cobranza/CollectionRiskSections';
import { TrendChart } from '@/components/admin/portal-cobranza/CollectionTrendChart';
import { CobranzaPorProyecto } from '@/components/admin/portal-cobranza/CollectionProjectTab';
import { Button } from '@/components/ui/button';
import {
  Target, Building2, Shield,
  Activity, ArrowRight, Stamp, X,
} from 'lucide-react';
import { CollectionLoading, CollectionError } from '@/components/admin/portal-cobranza/CollectionStates';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] as const;
const _now = new Date();
const CURRENT_YEAR = _now.getFullYear();
const CURRENT_MONTH = _now.getMonth() + 1;
// Current year + 4 previous (5 years), newest to oldest. Matches the RPC's
// monthly-series window.
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

type DashboardTab = 'resumen' | 'riesgo' | 'cobranza' | 'operacion';
const tabs: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen', label: 'Resumen Ejecutivo', icon: Target },
  { id: 'riesgo', label: 'Riesgo y Cartera', icon: Shield },
  { id: 'cobranza', label: 'Cobranza por Proyecto', icon: Building2 },
  { id: 'operacion', label: 'Operación', icon: Activity },
];

function drill(navigate: ReturnType<typeof useNavigate>, path: string, filters: Record<string, string> = {}) {
  navigateWithFilters(navigate, `/admin/portal-cobranza${path}`, { ...filters, from: 'dashboard' });
}

export default function CollectionDashboard() {
  const navigate = useNavigate();
  // No default selection (null). Empty → dashboard uses the current period and the
  // chart shows the whole window (last 5 years). Picking year+month narrows it.
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  // The owners list comes INSIDE the RPC response (data.duenos). Cached in state to
  // break the circular dependency with the KPIs query.
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Selected names → union of all entidad_ids of those owners.
  const entityIds = useMemo(() => {
    if (selectedOwners.length === 0 || owners.length === 0) return null;
    const sel = new Set(selectedOwners);
    const ids = owners.filter(o => sel.has(o.nombre)).flatMap(o => o.entidadIds);
    return ids.length > 0 ? ids : null;
  }, [selectedOwners, owners]);

  // Bounded period only when both year AND month are selected.
  const hasPeriod = selectedYear !== null && selectedMonth !== null;
  const isFiltered = selectedYear !== null || selectedMonth !== null || selectedProject !== null || selectedOwners.length > 0;
  const clearFilters = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedProject(null);
    setSelectedOwners([]);
  };

  // No period → null (the RPC uses the current month for the month KPIs).
  const startDate = useMemo(() => hasPeriod ? new Date(selectedYear!, selectedMonth! - 1, 1).toISOString().slice(0, 10) : null, [hasPeriod, selectedYear, selectedMonth]);
  const endDate = useMemo(() => hasPeriod ? new Date(selectedYear!, selectedMonth!, 0).toISOString().slice(0, 10) : null, [hasPeriod, selectedYear, selectedMonth]);
  const periodLabel = useMemo(() => {
    const y = selectedYear ?? CURRENT_YEAR;
    const m = selectedMonth ?? CURRENT_MONTH;
    return `${MONTH_NAMES[m - 1].toLowerCase()} ${y}`;
  }, [selectedYear, selectedMonth]);

  const { data: projects } = useProyectosCobranza();

  const { data, isLoading, isError, refetch } = useCollectionDashboard(selectedProject, startDate, endDate, entityIds);

  // The unified RPC feeds the WHOLE dashboard in a single call.
  const pipeline = data?.pipeline ?? null;
  const pendingCeps = data?.ceps_sin_validar ?? 0;
  // clientes_criticos comes already filtered (project+owner) and sorted server-side.
  const criticalClients = data?.clientes_criticos ?? [];

  // Sync the owners list (comes in the RPC response) into local state.
  useEffect(() => {
    if (data?.duenos) {
      setOwners(data.duenos.map(d => ({ nombre: d.nombre, entidadIds: d.entidad_ids })));
    }
  }, [data?.duenos]);

  const accessibleIds = useMemo(() => {
    if (!projects) return null;
    return new Set(projects.map((p: { id: number }) => p.id));
  }, [projects]);

  useEffect(() => {
    if (selectedProject !== null && accessibleIds && !accessibleIds.has(selectedProject)) {
      setSelectedProject(null);
    }
  }, [selectedProject, accessibleIds]);

  const filteredByProject = useMemo(() => {
    if (!data?.por_proyecto) return [];
    const base = accessibleIds ? data.por_proyecto.filter(p => accessibleIds.has(p.proyecto_id)) : data.por_proyecto;
    return [...base].sort((a, b) => a.cobrado - b.cobrado);
  }, [data?.por_proyecto, accessibleIds]);

  const chartData = useMemo(() => {
    if (!data?.cobrado_mensual) return [];
    const programadoMap = new Map(
      (data.programado_mensual ?? []).map(p => [p.mes, { total: p.programado, sinCe: p.programado_sin_ce }])
    );
    // Selected year → that year (Jan–Dec, or Jan→month if a month is set too).
    const serie = selectedYear != null
      ? data.cobrado_mensual.filter(c =>
          c.mes >= `${selectedYear}-01` &&
          c.mes <= `${selectedYear}-${String(selectedMonth ?? 12).padStart(2, '0')}`)
      : data.cobrado_mensual;
    return serie.map(c => {
      const prog = programadoMap.get(c.mes);
      return {
        month: c.mes,
        cobrado: c.cobrado,
        programado: prog?.total ?? 0,
        programado_sin_ce: prog?.sinCe ?? 0,
      };
    });
  }, [data?.cobrado_mensual, data?.programado_mensual, selectedYear, selectedMonth]);

  const arrearsCount = (grupo: string) =>
    data?.morosidad?.find(m => m.grupo === grupo)?.cuentas ?? 0;

  const arrears1 = arrearsCount('1_vencida');
  const arrears2 = arrearsCount('2_vencidas');
  const arrears3Plus = arrearsCount('3_plus');
  const totalInArrears = arrears1 + arrears2 + arrears3Plus;

  const compliance = data && data.programado_mes > 0
    ? Math.round((data.cobrado_mes / data.programado_mes) * 100)
    : 0;
  const toCollectMonth = data?.por_cobrar_mes ?? 0;
  // Cartera = cobrado + saldo. Saldo = por vencer (pendiente_total) + vencido (todos
  // los conceptos, incl. contra-entrega). Así Cartera = Σ precio_final.
  const saldoPorCobrar = (data?.pendiente_total ?? 0) + (data?.vencido_total ?? 0);
  const totalPortfolio = (data?.cobrado_total ?? 0) + saldoPorCobrar;

  const riskLevel = arrears3Plus > 0 ? 'Crítico' : totalInArrears > 0 ? 'Riesgo activo' : 'Controlado';
  const riskColor = arrears3Plus > 0 ? 'text-danger' : totalInArrears > 0 ? 'text-warning' : 'text-success';
  const riskBadgeCls = riskColor === 'text-danger'
    ? 'bg-danger/10 text-danger border-danger/20'
    : riskColor === 'text-warning'
    ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-success/10 text-success border-success/20';

  if (isLoading && !data) {
    return <CollectionLoading label="Cargando dashboard..." />;
  }

  if (isError || !data) {
    return <CollectionError title="No pudimos cargar el dashboard" onRetry={() => refetch()} />;
  }

  // Risk by project for the Riesgo tab.
  const riskByProject = filteredByProject
    .filter(p => p.vencido > 0)
    .sort((a, b) => b.vencido - a.vencido);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filters */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        {/* Año + Mes: 2 cols on mobile, flat in flex on desktop */}
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Año</span>
            <SelectCombobox
              value={selectedYear != null ? String(selectedYear) : ''}
              onChange={v => setSelectedYear(v ? Number(v) : null)}
              placeholder="Todos"
              options={[{ label: 'Todos', value: '' }, ...YEARS.map(y => ({ label: String(y), value: String(y) }))]}
              className="w-full sm:w-[148px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Mes</span>
            <SelectCombobox
              value={selectedMonth != null ? String(selectedMonth) : ''}
              onChange={v => setSelectedMonth(v ? Number(v) : null)}
              placeholder="Todos"
              options={[{ label: 'Todos', value: '' }, ...MONTH_NAMES.map((m, i) => ({ label: m, value: String(i + 1) }))]}
              className="w-full sm:w-[148px]"
            />
          </div>
        </div>
        {/* Proyecto + Dueño + Limpiar: 2 cols on mobile, flat in flex on desktop */}
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="flex flex-col gap-1 sm:w-[148px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Proyecto</span>
            <CobranzaProjectFilter
              projects={projects ?? []}
              value={selectedProject}
              onChange={setSelectedProject}
              allLabel="Todos"
              className="h-9 w-full"
              popoverClassName="w-[240px]"
            />
          </div>
          <div className="flex flex-col gap-1 sm:w-[148px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Dueño</span>
            <OwnerMultiSelect
              options={(owners ?? []).map(o => o.nombre)}
              value={selectedOwners}
              onChange={setSelectedOwners}
              placeholder="Todos"
              className="w-full sm:w-[148px]"
            />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 invisible select-none">Limpiar</span>
            <Button
              variant="outline"
              size="sm"
              onClick={isFiltered ? clearFilters : undefined}
              className={cn(
                'h-9 px-3 text-[13px] gap-1.5 transition-all duration-150',
                isFiltered
                  ? 'border-success/50 text-success bg-success/5 hover:bg-success/10 hover:border-success cursor-pointer'
                  : 'border-border/40 text-muted-foreground/35 bg-transparent pointer-events-none',
              )}
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Limpiar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center justify-start gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-100 flex-1 min-w-0',
              activeTab === tab.id ? 'border-b-primary text-primary bg-primary/5' : 'border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
            <tab.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ════ TAB: RESUMEN EJECUTIVO ════ */}
      {activeTab === 'resumen' && (
        <div className="space-y-10">

          {/* ── Sección: Totales del proyecto ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Totales del proyecto</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Cartera total" value={formatCurrency(totalPortfolio)} sublabel="meta total de venta" />
              <StatCard label="Cobrado total" labelClass="text-success" value={formatCurrency(data.cobrado_total)} sublabel="ya pagado" />
              <StatCard label="Por vencer" labelClass={data.pendiente_total > 0 ? 'text-warning' : 'text-muted-foreground'} value={formatCurrency(data.pendiente_total)} sublabel="aún no vence" />
              <StatCard label="Vencido" labelClass="text-danger" valueClass="text-danger" value={formatCurrency(data.vencido_total)} sublabel="pagos atrasados" />
            </div>
          </section>

          {/* ── Sección: Mes seleccionado ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 capitalize">{periodLabel}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Programado" value={formatCurrency(data.programado_mes)} sublabel="vence este mes" />
              <StatCard label="Cobrado en el mes" labelClass="text-success" value={formatCurrency(data.cobrado_mes)} sublabel={periodLabel} />
              <StatCard label="Por cobrar" labelClass="text-warning" value={formatCurrency(Math.max(toCollectMonth, 0))} sublabel="falta este mes" />
              <StatCard label="Cumplimiento" labelClass={compliance >= 90 ? 'text-success' : 'text-danger'} variant="count" valueClass={compliance >= 90 ? 'text-success' : 'text-danger'} value={`${compliance}%`} sublabel={compliance >= 90 ? 'En meta' : 'Bajo meta'} />
            </div>
          </section>

          {/* ── Sección: Ruta a Escrituración (solo Inmuebles) ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5" strokeWidth={1.75} />
              Ruta a Escrituración
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vendidas" variant="count" value={pipeline?.vendidas ?? 0} sublabel="en cobranza activa" />
              <StatCard label="Listas p/ escriturar" labelClass="text-success" variant="count" valueClass="text-success" value={pipeline?.listas_escrituracion ?? 0} sublabel="pagos validados, solo resta el pago a escrituración" />
              <StatCard label="En escrituración" variant="count" value={pipeline?.en_escrituracion ?? 0} sublabel="proceso notarial activo" />
              <StatCard label="Entregadas" variant="count" value={pipeline?.entregadas ?? 0} sublabel="acta de entrega firmada" />
            </div>
          </section>

          {/* ── Sección: Cartera y acciones ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cartera y acciones
              </h3>
              <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', riskBadgeCls)}>{riskLevel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Cartera vencida" labelClass="text-danger" valueClass="text-danger" value={formatCurrency(data.vencido_total)} sublabel="monto atrasado total" />
              <StatCard label="Cuentas críticas" labelClass="text-danger" variant="count" valueClass={arrears3Plus > 0 ? 'text-danger' : 'text-foreground'} value={arrears3Plus} sublabel="3 o más parc. vencidas" onClick={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' })} arrowClass="group-hover:text-danger" />
              <StatCard label="En riesgo" labelClass="text-warning" variant="count" valueClass={arrears2 > 0 ? 'text-warning' : 'text-foreground'} value={arrears2} sublabel="2 parc. vencidas" onClick={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Urgente' })} arrowClass="group-hover:text-warning" />
              <StatCard label="Meta del mes" labelClass="text-primary" valueClass="text-primary" value={formatCurrency(Math.max(toCollectMonth, 0))} sublabel="falta para cumplir" />
            </div>
          </section>

          {/* ── Sección: Tendencia de cobro ── */}
          <TrendChart
            data={chartData}
            lines={[
              { key: 'cobrado', name: 'Cobrado', color: '#17c653' },
              { key: 'programado', name: 'Programado', color: '#697280', dashed: true },
            ]}
          />

        </div>
      )}

      {/* ════ TAB: RIESGO Y CARTERA ════ */}
      {activeTab === 'riesgo' && (
        <div className="space-y-10">
          <NivelMorosidad items={[
            { label: 'Alerta temprana', labelClass: 'text-warning', count: arrears1, valueClass: 'text-warning', title: '1 parcialidad vencida', desc: 'Intervención preventiva - aún se pueden recuperar fácilmente', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Alerta' }), arrowClass: 'group-hover:text-warning' },
            { label: 'Riesgo activo', labelClass: 'text-danger', count: arrears2, valueClass: 'text-danger', title: '2 parcialidades vencidas', desc: 'Patrón de incumplimiento detectado - gestión urgente', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Urgente' }), arrowClass: 'group-hover:text-danger' },
            { label: 'Crítico / prelegal', labelClass: 'text-danger', count: arrears3Plus, valueClass: 'text-danger', title: '3+ parcialidades vencidas', desc: 'Candidatos a proceso legal - requieren acción inmediata', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' }), arrowClass: 'group-hover:text-danger' },
          ]} />

          <AgingYRiesgo
            aging={(data.aging ?? []).map(a => ({ range: `${a.rango} días`, amount: a.monto }))}
            projectRows={riskByProject}
            onSelectProject={(id) => drill(navigate, '/cuentas-cobranza', { proyecto: String(id) })}
          />

          <ClientesCriticos
            title="Clientes críticos"
            badgeSuffix="3+ parc."
            count={criticalClients.length}
            accounts={criticalClients.slice(0, 3).map(c => ({
              cuentaId: c.cuenta_id,
              monto: c.monto_vencido,
              cliente: c.cliente_nombre,
              proyecto: c.proyecto,
              unidad: c.numero_propiedad,
              badgeLabel: c.tipo_cuenta === 'Propiedad' ? 'Propiedad' : c.tipo_cuenta === 'Producto' ? (c.producto_nombre ?? 'Producto') : 'Servicio',
              badgeClass: c.tipo_cuenta === 'Propiedad' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              parcLabel: `${c.parcialidades_vencidas} parc.`,
            }))}
            onSelect={(c) => navigate(`/admin/portal-cobranza/cuentas-cobranza/${c.cuentaId}/detalle`)}
            onSeeAll={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' })}
          />
        </div>
      )}

      {/* ════ TAB: COBRANZA POR PROYECTO ════ */}
      {activeTab === 'cobranza' && (
        <CobranzaPorProyecto
          rows={filteredByProject}
          onSelectProject={(id) => drill(navigate, '/cuentas-cobranza', { proyecto: String(id) })}
        />
      )}

      {/* ════ TAB: OPERACIÓN ════ */}
      {activeTab === 'operacion' && (
        <div className="space-y-10">

          {/* ── Sección: Tareas pendientes ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
              Tareas pendientes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => drill(navigate, '/relacion-pagos', { cep: 'sin' })}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider', pendingCeps > 0 ? 'text-danger' : 'text-success')}>
                    Validación de pagos
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-primary transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', pendingCeps > 0 ? 'text-danger' : 'text-foreground')}>
                  {pendingCeps >= 1000 ? `+${Math.floor(pendingCeps / 1000)}k` : pendingCeps.toLocaleString('es-MX')}
                </p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">Pagos sin validar</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Pendientes de conciliar en Validación de Pagos</p>
              </button>

              <button
                onClick={() => drill(navigate, '/cuentas-cobranza')}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider', totalInArrears > 0 ? 'text-warning' : 'text-success')}>
                    Cuentas en mora
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-warning transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', totalInArrears > 0 ? 'text-warning' : 'text-foreground')}>
                  {totalInArrears}
                </p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">Con pagos vencidos</p>
                <p className="text-[11px] text-muted-foreground leading-snug">1 o más parcialidades sin pagar</p>
              </button>

              <div className="sozu-kpi-card">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
                  (data.recovery_rate ?? 0) >= 90 ? 'text-success' : (data.recovery_rate ?? 0) >= 70 ? 'text-warning' : 'text-danger')}>
                  Tasa de recuperación
                </span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5',
                  (data.recovery_rate ?? 0) >= 90 ? 'text-success' : (data.recovery_rate ?? 0) >= 70 ? 'text-warning' : 'text-danger')}>
                  {data.recovery_rate != null ? `${Math.round(data.recovery_rate)}%` : '-'}
                </p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">Cobrado vs programado</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Acumulado del periodo seleccionado</p>
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
