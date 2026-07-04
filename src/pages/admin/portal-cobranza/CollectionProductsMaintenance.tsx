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
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Target, Shield, Building2, Activity, AlertTriangle, TrendingUp, BarChart3, ArrowRight, ChevronsUpDown, Check, X,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// Portal Cobranza > "Complementos" (URL /complementos, posición 2, hermano de
// "Inmuebles"). Complemento EXACTO del dashboard de unidades. Mismo mood que
// Inmuebles: filtros (Año/Mes/Proyecto/Dueño/Tipo), tabs (Resumen Ejecutivo /
// Riesgo y Cartera / Cobranza por Proyecto / Operación), totales generales,
// sección por mes, gráfica de líneas Cobrado vs Programado, cartera y acciones.

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] as const;
const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] as const;
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
const AGING_COLOR = '#e04444';
const fmtMes = (m: string) => { const [y, mm] = m.split('-'); return `${MONTH_ABBR[Number(mm) - 1]} ${y.slice(2)}`; };

function SelectCombobox({ options, value, onChange, placeholder, className }: {
  options: { label: string; value: string }[];
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = options.find(o => o.value === value)?.label ?? '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}>
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '160px' }}>
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value || '__empty__'} value={opt.label} onSelect={() => { onChange(opt.value); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <span className={cn('truncate min-w-0', !opt.value && 'text-muted-foreground')}>{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OwnerMultiSelect({ options, value, onChange, className }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0 ? 'Todos' : value.length === 1 ? value[0] : `${value.length} dueños`;
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter(v => v !== n) : [...value, n]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}>
          <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '160px' }}>
        <Command>
          <CommandInput placeholder="Buscar dueño..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map(n => (
                <CommandItem key={n} value={n} onSelect={() => toggle(n)}>
                  <div className={cn('mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                    value.includes(n) ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                    {value.includes(n) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate min-w-0">{n}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const FLabel = ({ label }: { label: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{label}</span>
);

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

  const carteraTotal = (data.cobrado_total ?? 0) + (data.pendiente_total ?? 0);
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
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Totales generales</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Cartera total</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(carteraTotal)}</p>
                <p className="text-[11px] text-muted-foreground">cobrado + pendiente</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Cobrado total</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(data.cobrado_total)}</p>
                <p className="text-[11px] text-muted-foreground">aplicado a complementos</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', data.pendiente_total > 0 ? 'text-warning' : 'text-muted-foreground')}>Pendiente total</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(data.pendiente_total)}</p>
                <p className="text-[11px] text-muted-foreground">saldo por cobrar</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-danger block mb-3">Vencido total</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 text-danger whitespace-nowrap">{formatCurrency(data.vencido_total)}</p>
                <p className="text-[11px] text-muted-foreground">con atraso</p>
              </div>
            </div>
          </section>

          {/* Por mes */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 capitalize">{periodLabel}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Programado</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(data.programado_mes)}</p>
                <p className="text-[11px] text-muted-foreground">vence en el mes</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Cobrado en el mes</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(data.cobrado_mes)}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{periodLabel}</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warning block mb-3">Por cobrar</span>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 whitespace-nowrap">{formatCurrency(data.por_cobrar_mes)}</p>
                <p className="text-[11px] text-muted-foreground">pendiente del mes</p>
              </div>
              <div className="sozu-kpi-card">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', cumplimiento >= 90 ? 'text-success' : 'text-danger')}>Cumplimiento</span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cumplimiento >= 90 ? 'text-success' : 'text-danger')}>{cumplimiento}%</p>
                <p className="text-[11px] text-muted-foreground">{cumplimiento >= 90 ? 'En meta' : 'Bajo meta'}</p>
              </div>
            </div>
          </section>

          {/* Cartera y acciones (espejo de Inmuebles) */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cartera y acciones
              </h3>
              <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', riskBadgeCls)}>{riskLevel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => setActiveTab('riesgo')} className="sozu-kpi-card overflow-hidden text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Cartera vencida</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 text-danger whitespace-nowrap">{formatCurrency(data.vencido_total)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">total vencido</p>
              </button>
              <button onClick={() => setActiveTab('riesgo')} className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Cuentas críticas</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', criticos3 > 0 ? 'text-danger' : 'text-foreground')}>{criticos3}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">3 o más cargos vencidos</p>
              </button>
              <button onClick={() => setActiveTab('riesgo')} className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">En riesgo</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-warning shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', riesgo2 > 0 ? 'text-warning' : 'text-foreground')}>{riesgo2}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">2 cargos vencidos</p>
              </button>
              <div className="sozu-kpi-card overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Meta del mes</span>
                </div>
                <p className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-none mb-1.5 text-primary whitespace-nowrap">{formatCurrency(metaMes)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">falta para cumplir</p>
              </div>
            </div>
          </section>

          {/* Gráfica: Cobrado vs Programado mensual */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              Cobrado vs programado por mes
            </h3>
            <div className="sozu-kpi-card">
              {chartData.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-8 text-center">Sin datos para los filtros seleccionados.</p>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="#eef1f5" />
                      <XAxis dataKey="month" tickFormatter={fmtMes} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={16} />
                      <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={54} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={fmtMes}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e6eaef' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="programado" name="Programado" stroke={COLOR.programado} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke={COLOR.cobrado} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ════ TAB: RIESGO Y CARTERA (espejo de Inmuebles) ════ */}
      {activeTab === 'riesgo' && (
        <div className="space-y-10">
          {/* Nivel de morosidad */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />Nivel de morosidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warning block mb-3">Alerta temprana</span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', alerta1 > 0 ? 'text-warning' : 'text-foreground')}>{alerta1}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">1 cargo vencido</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Intervención preventiva - aún se recuperan fácil</p>
              </div>
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-danger block mb-3">Riesgo activo</span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', riesgo2 > 0 ? 'text-danger' : 'text-foreground')}>{riesgo2}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">2 cargos vencidos</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Patrón de incumplimiento - gestión urgente</p>
              </div>
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-danger block mb-3">Crítico</span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', criticos3 > 0 ? 'text-danger' : 'text-foreground')}>{criticos3}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">3+ cargos vencidos</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Requieren acción inmediata</p>
              </div>
            </div>
          </section>

          {/* Antigüedad de cartera + Riesgo por proyecto */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(data.aging?.length ?? 0) > 0 && (
                <div className="sozu-kpi-card">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Antigüedad de cartera</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(data.aging ?? []).map(a => ({ range: `${a.rango} días`, amount: a.monto }))} barSize={32}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                      <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="amount" fill={AGING_COLOR} radius={[4, 4, 0, 0]} name="Vencido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="sozu-kpi-card">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Riesgo por proyecto</h3>
                {riskByProject.length > 0 ? (
                <div className="space-y-1">
                  {riskByProject.map((p, i) => {
                    const total = (p.cobrado ?? 0) + (p.pendiente ?? 0);
                    const pct = total > 0 ? Math.round((p.vencido / total) * 100) : 0;
                    return (
                      <div key={p.proyecto_id} className="px-3 py-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-[18px] h-[18px] rounded-full bg-danger/10 text-danger text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                            <span className="text-[13px] font-semibold text-foreground truncate">{p.proyecto}</span>
                          </div>
                          <span className="text-[13px] font-bold text-danger tabular-nums shrink-0 ml-2 whitespace-nowrap">{formatCurrency(p.vencido)}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums font-semibold text-danger/70 shrink-0 w-[52px] text-right">{pct}% venc.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground text-center py-6">Sin riesgo por proyecto para los filtros seleccionados.</p>
              )}
              </div>
            </div>
          </section>

          {/* Cuentas críticas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />Cuentas críticas
              </h3>
              <div className="flex items-center gap-3">
                {criticos3 > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 tabular-nums">
                    {criticos3} cuenta{criticos3 !== 1 ? 's' : ''} · 3+ cargos
                  </span>
                )}
                <button
                  onClick={() => drill(navigate, '/cuentas-cobranza', { parcVencidas: '3plus' })}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium whitespace-nowrap"
                >
                  Ver todas <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            {criticalCards.length === 0 ? (
              <div className="sozu-kpi-card flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                <span className="text-[13px] text-muted-foreground">Sin cuentas críticas para los filtros seleccionados.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {criticalCards.map(c => (
                  <div key={c.cuenta_id} className="sozu-kpi-card">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Crítico</span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">CC-{String(c.cuenta_id).padStart(6, '0')}</span>
                    </div>
                    <p className="text-[20px] font-bold tabular-nums leading-none mb-2 text-danger whitespace-nowrap">{formatCurrency(c.vencido)}</p>
                    <p className={cn('text-[13px] font-semibold text-foreground mb-0.5 truncate', !c.cliente && 'italic text-muted-foreground/60 font-normal')}>{c.cliente ?? 'Sin registro'}</p>
                    <p className="text-[11px] text-muted-foreground mb-3 truncate">{c.proyecto ?? '—'}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', tipoMeta(c.tipo).cls)}>{c.categoria}</span>
                      {c.numero_propiedad && (
                        <span className="text-[10px] text-muted-foreground">Unidad {c.numero_propiedad}</span>
                      )}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger/10 text-danger tabular-nums">{c.parcialidades_vencidas} venc.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ════ TAB: COBRANZA POR PROYECTO ════ */}
      {activeTab === 'cobranza' && (
        <div className="space-y-8">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Cobranza por proyecto
            </h3>
            {byProject.length === 0 ? (
              <div className="sozu-kpi-card text-[13px] text-muted-foreground">Sin datos para los filtros seleccionados.</div>
            ) : (
              <div className="sozu-kpi-card overflow-x-auto p-0">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left font-semibold px-4 py-2.5">Proyecto</th>
                      <th className="text-right font-semibold px-4 py-2.5">Cobrado</th>
                      <th className="text-right font-semibold px-4 py-2.5">Pendiente</th>
                      <th className="text-right font-semibold px-4 py-2.5">Vencido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProject.map(p => (
                      <tr key={p.proyecto_id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5">{p.proyecto}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.cobrado)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.pendiente)}</td>
                        <td className={cn('px-4 py-2.5 text-right tabular-nums', p.vencido > 0 && 'text-danger font-medium')}>{formatCurrency(p.vencido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {byProject.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cobrado por proyecto
              </h3>
              <div className="sozu-kpi-card">
                <div style={{ width: '100%', height: Math.max(160, byProject.length * 46) }}>
                  <ResponsiveContainer>
                    <BarChart data={byProject.map(p => ({ name: p.proyecto, cobrado: p.cobrado, vencido: p.vencido }))}
                      layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barGap={2}>
                      <CartesianGrid horizontal={false} stroke="#eef1f5" />
                      <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11.5, fill: '#0f172a' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'rgba(148,163,184,.08)' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e6eaef' }} />
                      <Bar dataKey="cobrado" name="Cobrado" fill={COLOR.cobrado} radius={[0, 3, 3, 0]} />
                      <Bar dataKey="vencido" name="Vencido" fill={COLOR.vencido} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ════ TAB: OPERACIÓN (detalle por categoría) ════ */}
      {activeTab === 'operacion' && (
        <div className="space-y-8">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Cobranza por categoría
            </h3>
            <div className="sozu-kpi-card">
              {byCategory.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-8 text-center">Sin cargos para los filtros seleccionados.</p>
              ) : (
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
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Detalle por categoría</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCategory.map(c => (
                <div key={c.categoria} className="sozu-kpi-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold">{c.categoria}</span>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', tipoMeta(c.tipo).cls)}>{tipoMeta(c.tipo).label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">Cobrado</p><p className="text-[13px] font-semibold tabular-nums">{formatCurrency(c.cobrado)}</p></div>
                    <div><p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">Pendiente</p><p className="text-[13px] font-semibold tabular-nums">{formatCurrency(c.pendiente)}</p></div>
                    <div><p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">Vencido</p><p className={cn('text-[13px] font-semibold tabular-nums', c.vencido > 0 && 'text-danger')}>{formatCurrency(c.vencido)}</p></div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-dashed border-border flex justify-between text-[11px] text-muted-foreground">
                    <span>{c.acuerdos.toLocaleString('es-MX')} cargos</span>
                    <span className="tabular-nums">Total {formatCurrency(c.monto_total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
