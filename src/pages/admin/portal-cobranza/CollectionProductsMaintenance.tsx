import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';
import { navigateWithFilters } from '@/lib/navigationFilters';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import {
  useCollectionProductsMaintenance,
  type CollectionExtraType,
  type OwnerOption,
} from '@/hooks/useCollectionProductsMaintenance';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import { CollectionLoading, CollectionError } from '@/components/admin/portal-cobranza/CollectionStates';
import { SelectCombobox, OwnerMultiSelect, FilterLabel as FLabel } from '@/components/admin/portal-cobranza/CollectionFilterControls';
import { StatCard } from '@/components/admin/portal-cobranza/CollectionStatCard';
import { NivelMorosidad, AgingYRiesgo, ClientesCriticos } from '@/components/admin/portal-cobranza/CollectionRiskSections';
import { FilterScopeInfo, AcumuladoTag, AnioMesTag } from '@/components/admin/portal-cobranza/FilterScopeHints';
import { TrendChart } from '@/components/admin/portal-cobranza/CollectionTrendChart';
import { CobranzaPorProyecto } from '@/components/admin/portal-cobranza/CollectionProjectTab';
import { Button } from '@/components/ui/button';
import {
  Target, Shield, Building2, Activity, BarChart3, Package, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

// Portal Cobranza > "Complementos" (URL /complementos, posición 2, hermano de
// "Inmuebles"). Complemento EXACTO del dashboard de unidades. Mismo mood que
// Inmuebles: filtros (Año/Mes/Proyecto/Dueño/Tipo), tabs (Resumen Ejecutivo /
// Riesgo y Cartera / Cobranza por Proyecto / Operación), totales generales,
// sección por mes, gráfica de líneas Cobrado vs Programado, cartera y acciones.

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] as const;
const _now = new Date();
const CURRENT_YEAR = _now.getFullYear();
const CURRENT_MONTH = _now.getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

type Tab = 'resumen' | 'riesgo' | 'cobranza' | 'operacion';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen', label: 'Resumen Ejecutivo', icon: Target },
  { id: 'riesgo', label: 'Riesgo y Cartera', icon: Shield },
  { id: 'cobranza', label: 'Cobranza por Proyecto', icon: Building2 },
  { id: 'operacion', label: 'Operación', icon: Activity },
];

const TIPO_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Productos', value: 'productos' },
  { label: 'Mantenimiento', value: 'mantenimiento' },
  { label: 'Otros', value: 'otros' },
];

const TIPO_META: Record<CollectionExtraType, { label: string; cls: string }> = {
  productos:     { label: 'Producto',      cls: 'bg-primary/10 text-primary' },
  mantenimiento: { label: 'Mantenimiento', cls: 'bg-warning/10 text-warning' },
  otros:         { label: 'Otros',         cls: 'bg-muted text-muted-foreground' },
};

// Acceso seguro: si el tipo no viene (RPC viejo/dato inesperado), no truena.
const tipoMeta = (t?: string | null) =>
  TIPO_META[t as CollectionExtraType] ?? { label: t ?? 'Otros', cls: 'bg-muted text-muted-foreground' };

const COLOR = { cobrado: '#16a34a', pendiente: '#94a3b8', vencido: '#e04444', programado: '#2563eb' };

function drill(navigate: ReturnType<typeof useNavigate>, path: string, filters: Record<string, string> = {}) {
  navigateWithFilters(navigate, `/admin/portal-cobranza${path}`, { ...filters, from: 'complementos' });
}

export default function CollectionProductsMaintenance() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [tipo, setTipo] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const entityIds = useMemo(() => {
    if (selectedOwners.length === 0 || owners.length === 0) return null;
    const sel = new Set(selectedOwners);
    const ids = owners.filter(o => sel.has(o.nombre)).flatMap(o => o.entidadIds);
    return ids.length > 0 ? ids : null;
  }, [selectedOwners, owners]);

  const hasPeriod = selectedYear !== null && selectedMonth !== null;
  const startDate = useMemo(() => hasPeriod ? new Date(selectedYear!, selectedMonth! - 1, 1).toISOString().slice(0, 10) : null, [hasPeriod, selectedYear, selectedMonth]);
  const endDate = useMemo(() => hasPeriod ? new Date(selectedYear!, selectedMonth!, 0).toISOString().slice(0, 10) : null, [hasPeriod, selectedYear, selectedMonth]);
  const periodLabel = useMemo(() => `${MONTH_NAMES[(selectedMonth ?? CURRENT_MONTH) - 1]} ${selectedYear ?? CURRENT_YEAR}`, [selectedYear, selectedMonth]);

  const { data: projects } = useProyectosCobranza();
  const { data, isLoading, isError, refetch } = useCollectionProductsMaintenance(
    selectedProject, entityIds, (tipo || null) as CollectionExtraType | null, startDate, endDate,
  );

  useEffect(() => {
    if (data?.duenos) setOwners(data.duenos.map(d => ({ nombre: d.nombre, entidadIds: d.entidad_ids })));
  }, [data?.duenos]);

  const accessibleIds = useMemo(
    () => (projects ? new Set(projects.map((p: { id: number }) => p.id)) : null),
    [projects],
  );
  const isFiltered = tipo !== '' || selectedYear !== null || selectedMonth !== null || selectedProject !== null || selectedOwners.length > 0;
  const clearFilters = () => { setTipo(''); setSelectedYear(null); setSelectedMonth(null); setSelectedProject(null); setSelectedOwners([]); };

  const byCategory = useMemo(
    () => [...(data?.por_categoria ?? [])].sort((a, b) => b.monto_total - a.monto_total),
    [data?.por_categoria],
  );
  const byProject = useMemo(() => {
    const base = data?.por_proyecto ?? [];
    const filtered = accessibleIds ? base.filter(p => accessibleIds.has(p.proyecto_id)) : base;
    return [...filtered].sort((a, b) => b.vencido - a.vencido);
  }, [data?.por_proyecto, accessibleIds]);
  const overdue = useMemo(
    () => [...(data?.cuentas_vencidas ?? [])].sort((a, b) => b.vencido - a.vencido),
    [data?.cuentas_vencidas],
  );

  // Serie mensual Cobrado vs Programado (union de meses; recorta al año si aplica).
  const chartData = useMemo(() => {
    const cob = new Map((data?.cobrado_mensual ?? []).map(c => [c.mes, c.cobrado]));
    const prog = new Map((data?.programado_mensual ?? []).map(p => [p.mes, p.programado]));
    let meses = Array.from(new Set([...cob.keys(), ...prog.keys()])).sort();
    if (selectedYear != null) {
      const hi = `${selectedYear}-${String(selectedMonth ?? 12).padStart(2, '0')}`;
      meses = meses.filter(m => m >= `${selectedYear}-01` && m <= hi);
    }
    return meses.map(m => ({ month: m, cobrado: cob.get(m) ?? 0, programado: prog.get(m) ?? 0 }));
  }, [data?.cobrado_mensual, data?.programado_mensual, selectedYear, selectedMonth]);

  if (isLoading && !data) return <CollectionLoading label="Cargando complementos..." />;
  if (isError || !data) return <CollectionError title="No pudimos cargar complementos" onRetry={() => refetch()} />;

  // Cartera = cobrado + saldo. Saldo = por vencer (pendiente_total) + vencido.
  const carteraTotal = (data.cobrado_total ?? 0) + (data.pendiente_total ?? 0) + (data.vencido_total ?? 0);
  const cumplimiento = Math.round(data.recovery_rate ?? 0);
  const enMora = overdue.length;
  // Morosidad por # de cargos vencidos (para "Cartera y acciones").
  const alerta1 = overdue.filter(a => a.parcialidades_vencidas === 1).length;
  const criticos3 = overdue.filter(a => a.parcialidades_vencidas >= 3).length;
  const riesgo2 = overdue.filter(a => a.parcialidades_vencidas === 2).length;
  const criticalCards = overdue.filter(a => a.parcialidades_vencidas >= 3).slice(0, 3);
  const riskByProject = byProject.filter(p => p.vencido > 0);
  const metaMes = Math.max((data.programado_mes ?? 0) - (data.cobrado_mes ?? 0), 0);
  const riskLevel = criticos3 > 0 ? 'Crítico' : enMora > 0 ? 'Riesgo activo' : 'Controlado';
  const riskBadgeCls = criticos3 > 0
    ? 'bg-danger/10 text-danger border-danger/20'
    : enMora > 0
    ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-success/10 text-success border-success/20';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtros — Tipo al final, mismo estándar que Inmuebles */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="flex flex-col gap-1"><FLabel label="Año" />
            <SelectCombobox value={selectedYear != null ? String(selectedYear) : ''} onChange={v => setSelectedYear(v ? Number(v) : null)}
              placeholder="Todos" options={[{ label: 'Todos', value: '' }, ...YEARS.map(y => ({ label: String(y), value: String(y) }))]} className="w-full sm:w-[148px]" />
          </div>
          <div className="flex flex-col gap-1"><FLabel label="Mes" />
            <SelectCombobox value={selectedMonth != null ? String(selectedMonth) : ''} onChange={v => setSelectedMonth(v ? Number(v) : null)}
              placeholder="Todos" options={[{ label: 'Todos', value: '' }, ...MONTH_NAMES.map((m, i) => ({ label: m, value: String(i + 1) }))]} className="w-full sm:w-[148px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="flex flex-col gap-1 sm:w-[148px]"><FLabel label="Proyecto" />
            <CobranzaProjectFilter projects={projects ?? []} value={selectedProject} onChange={setSelectedProject} allLabel="Todos" className="h-9 w-full" popoverClassName="w-[240px]" />
          </div>
          <div className="flex flex-col gap-1 sm:w-[148px]"><FLabel label="Dueño" />
            <OwnerMultiSelect options={(owners ?? []).map(o => o.nombre)} value={selectedOwners} onChange={setSelectedOwners} className="w-full sm:w-[148px]" />
          </div>
          <div className="flex flex-col gap-1 sm:w-[148px]"><FLabel label="Tipo" />
            <SelectCombobox options={TIPO_OPTIONS} value={tipo} onChange={setTipo} placeholder="Todos" className="w-full sm:w-[148px]" />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 invisible select-none">Limpiar</span>
            <Button variant="outline" size="sm" onClick={isFiltered ? clearFilters : undefined}
              className={cn('h-9 px-3 text-[13px] gap-1.5 transition-all duration-150',
                isFiltered ? 'border-success/50 text-success bg-success/5 hover:bg-success/10 hover:border-success cursor-pointer'
                  : 'border-border/40 text-muted-foreground/35 bg-transparent pointer-events-none')}>
              <X className="w-3.5 h-3.5" /><span className="hidden xl:inline">Limpiar</span>
            </Button>
          </div>
          <div className="flex flex-col gap-1 shrink-0 justify-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 invisible select-none">Info</span>
            <FilterScopeInfo className="h-9" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('flex items-center justify-start gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-100 flex-1 min-w-0',
              activeTab === t.id ? 'border-b-primary text-primary bg-primary/5' : 'border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
            <t.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ════ TAB: RESUMEN EJECUTIVO ════ */}
      {activeTab === 'resumen' && (
        <div className="space-y-10">
          {/* Totales generales */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">Totales generales <AcumuladoTag /></h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Cartera total" value={formatCurrency(carteraTotal)} sublabel="meta total" />
              <StatCard label="Cobrado total" labelClass="text-success" value={formatCurrency(data.cobrado_total)} sublabel="ya pagado" />
              <StatCard label="Por vencer" labelClass={data.pendiente_total > 0 ? 'text-warning' : 'text-muted-foreground'} value={formatCurrency(data.pendiente_total)} sublabel="aún no vence" />
              <StatCard label="Vencido" labelClass="text-danger" valueClass="text-danger" value={formatCurrency(data.vencido_total)} sublabel="pagos atrasados" />
            </div>
          </section>

          {/* Por mes */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5"><span className="capitalize">{periodLabel}</span> <AnioMesTag /></h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Programado" value={formatCurrency(data.programado_mes)} sublabel="vence este mes" />
              <StatCard label="Cobrado en el mes" labelClass="text-success" value={formatCurrency(data.cobrado_mes)} sublabel={periodLabel} />
              <StatCard label="Por cobrar" labelClass="text-warning" value={formatCurrency(data.por_cobrar_mes)} sublabel="falta este mes" />
              <StatCard label="Cumplimiento" labelClass={cumplimiento >= 90 ? 'text-success' : 'text-danger'} variant="count" valueClass={cumplimiento >= 90 ? 'text-success' : 'text-danger'} value={`${cumplimiento}%`} sublabel={cumplimiento >= 90 ? 'En meta' : 'Bajo meta'} />
            </div>
          </section>

          {/* Cartera y acciones (espejo de Inmuebles) */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cartera y acciones <AcumuladoTag />
              </h3>
              <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', riskBadgeCls)}>{riskLevel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Cartera vencida" labelClass="text-danger" valueClass="text-danger" value={formatCurrency(data.vencido_total)} sublabel="monto atrasado total" />
              <StatCard label="Cuentas críticas" labelClass="text-danger" variant="count" valueClass={criticos3 > 0 ? 'text-danger' : 'text-foreground'} value={criticos3} sublabel="3 o más cargos vencidos" onClick={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' })} arrowClass="group-hover:text-danger" />
              <StatCard label="En riesgo" labelClass="text-warning" variant="count" valueClass={riesgo2 > 0 ? 'text-warning' : 'text-foreground'} value={riesgo2} sublabel="2 cargos vencidos" onClick={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Urgente' })} arrowClass="group-hover:text-warning" />
              <StatCard label="Meta del mes" labelClass="text-primary" valueClass="text-primary" value={formatCurrency(metaMes)} sublabel="falta para cumplir" />
            </div>
          </section>

          {/* Gráfica: Cobrado vs Programado mensual */}
          <TrendChart
            data={chartData}
            lines={[
              { key: 'programado', name: 'Programado', color: COLOR.programado, dashed: true },
              { key: 'cobrado', name: 'Cobrado', color: COLOR.cobrado },
            ]}
          />
        </div>
      )}

      {/* ════ TAB: RIESGO Y CARTERA (espejo de Inmuebles) ════ */}
      {activeTab === 'riesgo' && (
        <div className="space-y-10">
          <NivelMorosidad acumulado items={[
            { label: 'Alerta temprana', labelClass: 'text-warning', count: alerta1, valueClass: 'text-warning', title: '1 cargo vencido', desc: 'Intervención preventiva - aún se recuperan fácil', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Alerta' }), arrowClass: 'group-hover:text-warning' },
            { label: 'Riesgo activo', labelClass: 'text-danger', count: riesgo2, valueClass: 'text-danger', title: '2 cargos vencidos', desc: 'Patrón de incumplimiento - gestión urgente', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Urgente' }), arrowClass: 'group-hover:text-danger' },
            { label: 'Crítico', labelClass: 'text-danger', count: criticos3, valueClass: 'text-danger', title: '3+ cargos vencidos', desc: 'Requieren acción inmediata', onClick: () => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' }), arrowClass: 'group-hover:text-danger' },
          ]} />

          <AgingYRiesgo
            acumulado
            aging={(data.aging ?? []).map(a => ({ range: `${a.rango} días`, amount: a.monto }))}
            projectRows={riskByProject}
            onSelectProject={(id) => drill(navigate, '/cuentas-cobranza', { proyecto: String(id) })}
          />

          <ClientesCriticos
            acumulado
            title="Cuentas críticas"
            badgeSuffix="3+ cargos"
            count={criticos3}
            accounts={criticalCards.map(c => ({
              cuentaId: c.cuenta_id,
              monto: c.vencido,
              cliente: c.cliente,
              proyecto: c.proyecto,
              unidad: c.numero_propiedad,
              badgeLabel: c.categoria,
              badgeClass: tipoMeta(c.tipo).cls,
              parcLabel: `${c.parcialidades_vencidas} venc.`,
            }))}
            onSelect={(card) => navigate(`/admin/portal-cobranza/cuentas-cobranza/${card.cuentaId}/detalle`)}
            onSeeAll={() => drill(navigate, '/cuentas-cobranza', { prioridad: 'Crítico' })}
          />
        </div>
      )}

      {/* ════ TAB: COBRANZA POR PROYECTO ════ */}
      {activeTab === 'cobranza' && (
        <CobranzaPorProyecto
          acumulado
          rows={byProject}
          onSelectProject={(id) => drill(navigate, '/cuentas-cobranza', { proyecto: String(id) })}
        />
      )}

      {/* ════ TAB: OPERACIÓN (detalle por categoría) ════ */}
      {activeTab === 'operacion' && (
        <div className="space-y-10">

          {/* ── Tarjetas por categoría ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" strokeWidth={1.75} />
              Detalle por categoría <AcumuladoTag />
            </h3>
            {byCategory.length === 0 ? (
              <div className="sozu-kpi-card text-[13px] text-muted-foreground text-center py-8">Sin cargos para los filtros seleccionados.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byCategory.map(c => {
                  const total = c.cobrado + c.pendiente;
                  const pct = total > 0 ? Math.round((c.cobrado / total) * 100) : 0;
                  const rows: { label: string; value: number; cls: string }[] = [
                    { label: 'Cobrado', value: c.cobrado, cls: 'text-success' },
                    { label: 'Pendiente', value: c.pendiente, cls: 'text-foreground' },
                    { label: 'Vencido', value: c.vencido, cls: c.vencido > 0 ? 'text-danger' : 'text-muted-foreground/50' },
                  ];
                  return (
                    <div key={c.categoria} className="sozu-kpi-card flex flex-col">
                      {/* encabezado */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-[14px] font-semibold text-foreground leading-tight min-w-0">{c.categoria}</span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0', tipoMeta(c.tipo).cls)}>{tipoMeta(c.tipo).label}</span>
                      </div>
                      {/* métricas en filas — label izq / monto der (nunca se tocan) */}
                      <div className="space-y-1.5">
                        {rows.map(r => (
                          <div key={r.label} className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 shrink-0">{r.label}</span>
                            <span className={cn('text-[14px] font-semibold tabular-nums whitespace-nowrap text-right', r.cls)}>{formatCurrency(r.value)}</span>
                          </div>
                        ))}
                      </div>
                      {/* barra progreso cobrado */}
                      {total > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums font-semibold text-success/70 shrink-0 w-[42px] text-right">{pct}% cob.</span>
                        </div>
                      )}
                      {/* pie */}
                      <div className="mt-3 pt-2.5 border-t border-dashed border-border flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="shrink-0">{c.acuerdos.toLocaleString('es-MX')} cargos</span>
                        <span className="tabular-nums whitespace-nowrap font-medium text-foreground">Total {formatCurrency(c.monto_total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Gráfica cobranza por categoría ── */}
          {byCategory.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cobranza por categoría
              </h3>
              <div className="sozu-kpi-card">
                <div style={{ width: '100%', height: Math.max(180, byCategory.length * 52) }}>
                  <ResponsiveContainer>
                    <BarChart data={byCategory.map(c => ({ name: c.categoria, cobrado: c.cobrado, pendiente: c.pendiente, vencido: c.vencido }))}
                      layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barGap={2}>
                      <CartesianGrid horizontal={false} stroke="#eef1f5" />
                      <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11.5, fill: '#0f172a' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'rgba(148,163,184,.08)' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e6eaef' }} />
                      <Bar dataKey="cobrado" name="Cobrado" fill={COLOR.cobrado} radius={[0, 3, 3, 0]} />
                      <Bar dataKey="pendiente" name="Pendiente" fill={COLOR.pendiente} radius={[0, 3, 3, 0]} />
                      <Bar dataKey="vencido" name="Vencido" fill={COLOR.vencido} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
