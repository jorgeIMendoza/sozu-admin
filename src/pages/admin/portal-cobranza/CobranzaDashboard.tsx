import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';
import { navigateWithFilters } from '@/lib/navigationFilters';
import { useCobranzaDashboard, useProyectosCobranza, type DuenoOption } from '@/hooks/useCobranzaDashboard';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  TrendingUp, AlertTriangle, DollarSign,
  Target, BarChart3, Building2, Shield,
  Activity, Loader2,
  ArrowRight, Stamp, ChevronsUpDown, Check, X,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] as const;
const _now = new Date();
const CURRENT_YEAR = _now.getFullYear();
const CURRENT_MONTH = _now.getMonth() + 1;
const YEARS = Array.from({ length: CURRENT_YEAR - 2021 }, (_, i) => 2022 + i);
const AGING_COLOR = '#e04444';

type DashTab = 'resumen' | 'riesgo' | 'cobranza' | 'operacion';
const tabs: { id: DashTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen', label: 'Resumen Ejecutivo', icon: Target },
  { id: 'riesgo', label: 'Riesgo y Cartera', icon: Shield },
  { id: 'cobranza', label: 'Cobranza por Proyecto', icon: Building2 },
  { id: 'operacion', label: 'Operación', icon: Activity },
];

function FilterCombobox({ options, value, onChange, placeholder, className }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = options.find(o => o.value === value)?.label ?? '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '140px' }}
      >
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value || '__empty__'}
                  value={opt.label}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OwnerMultiCombobox({ options, value, onChange, placeholder, className }: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0 ? (placeholder ?? 'Todos los dueños')
    : value.length === 1 ? value[0]
    : `${value.length} dueños`;
  const toggle = (name: string) =>
    onChange(value.includes(name) ? value.filter(v => v !== name) : [...value, name]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}
        >
          <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '200px' }}
      >
        <Command>
          <CommandInput placeholder="Buscar dueño..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => toggle(name)}>
                  <div className={cn(
                    'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                    value.includes(name) ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                  )}>
                    {value.includes(name) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function drill(navigate: ReturnType<typeof useNavigate>, path: string, filters: Record<string, string> = {}) {
  navigateWithFilters(navigate, `/admin/portal-cobranza${path}`, { ...filters, from: 'dashboard' });
}

export default function CobranzaDashboard() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [activeTab, setActiveTab] = useState<DashTab>('resumen');
  const [selectedProyecto, setSelectedProyecto] = useState<number | null>(null);
  const [selectedDuenos, setSelectedDuenos] = useState<string[]>([]);
  // La lista de dueños viene DENTRO de la respuesta del RPC (kpis.duenos). Se cachea
  // en estado para romper la dependencia circular con la query de kpis.
  const [duenos, setDuenos] = useState<DuenoOption[]>([]);

  // Nombres seleccionados → unión de todos los entidad_ids de esos dueños.
  const entidadIds = useMemo(() => {
    if (selectedDuenos.length === 0 || duenos.length === 0) return null;
    const sel = new Set(selectedDuenos);
    const ids = duenos.filter(d => sel.has(d.nombre)).flatMap(d => d.entidadIds);
    return ids.length > 0 ? ids : null;
  }, [selectedDuenos, duenos]);

  const isFiltered = selectedYear !== CURRENT_YEAR || selectedMonth !== CURRENT_MONTH || selectedProyecto !== null || selectedDuenos.length > 0;
  const clearFilters = () => {
    setSelectedYear(CURRENT_YEAR);
    setSelectedMonth(CURRENT_MONTH);
    setSelectedProyecto(null);
    setSelectedDuenos([]);
  };

  const fechaInicio = useMemo(() => new Date(selectedYear, selectedMonth - 1, 1).toISOString().slice(0, 10), [selectedYear, selectedMonth]);
  const fechaFin = useMemo(() => new Date(selectedYear, selectedMonth, 0).toISOString().slice(0, 10), [selectedYear, selectedMonth]);
  const periodLabel = useMemo(() => `${MONTH_NAMES[selectedMonth - 1].toLowerCase()} ${selectedYear}`, [selectedYear, selectedMonth]);

  const { data: proyectos } = useProyectosCobranza();

  const { data: kpis, isLoading, error } = useCobranzaDashboard(selectedProyecto, fechaInicio, fechaFin, entidadIds);

  // El RPC unificado alimenta TODO el dashboard en una sola llamada.
  const pipeline = kpis?.pipeline ?? null;
  const cepsSinValidar = kpis?.ceps_sin_validar ?? 0;
  // clientes_criticos ya viene filtrado (proyecto+dueño) y ordenado (días desc, monto desc) server-side.
  const clientesCriticos = kpis?.clientes_criticos ?? [];

  // Sincroniza la lista de dueños (viene en la respuesta del RPC) al estado local.
  useEffect(() => {
    if (kpis?.duenos) {
      setDuenos(kpis.duenos.map(d => ({ nombre: d.nombre, entidadIds: d.entidad_ids })));
    }
  }, [kpis?.duenos]);

  const accessibleIds = useMemo(() => {
    if (!proyectos) return null;
    return new Set(proyectos.map((p: any) => p.id as number));
  }, [proyectos]);

  useEffect(() => {
    if (selectedProyecto !== null && accessibleIds && !accessibleIds.has(selectedProyecto)) {
      setSelectedProyecto(null);
    }
  }, [selectedProyecto, accessibleIds]);

  const filteredPorProyecto = useMemo(() => {
    if (!kpis?.por_proyecto) return [];
    const base = accessibleIds ? kpis.por_proyecto.filter(p => accessibleIds.has(p.proyecto_id)) : kpis.por_proyecto;
    return [...base].sort((a, b) => a.cobrado - b.cobrado);
  }, [kpis?.por_proyecto, accessibleIds]);

  // Top 5 by cobrado asc (matches chart order: lowest at top, highest at bottom)
  const tableProyectos = useMemo(() => {
    return filteredPorProyecto.slice(0, 5);
  }, [filteredPorProyecto]);

  const chartData = useMemo(() => {
    if (!kpis?.cobrado_mensual) return [];
    const programadoMap = new Map(
      (kpis.programado_mensual ?? []).map(p => [p.mes, { total: p.programado, sinCe: p.programado_sin_ce }])
    );
    return kpis.cobrado_mensual.map(c => {
      const prog = programadoMap.get(c.mes);
      return {
        month: c.mes,
        cobrado: c.cobrado,
        programado: prog?.total ?? 0,
        programado_sin_ce: prog?.sinCe ?? 0,
      };
    });
  }, [kpis?.cobrado_mensual, kpis?.programado_mensual]);

  const getMorosidad = (grupo: string) =>
    kpis?.morosidad?.find(m => m.grupo === grupo)?.cuentas ?? 0;

  const cuentas1 = getMorosidad('1_vencida');
  const cuentas2 = getMorosidad('2_vencidas');
  const cuentas3Plus = getMorosidad('3_plus');
  const totalMorosas = cuentas1 + cuentas2 + cuentas3Plus;

  const cumplimiento = kpis && kpis.programado_mes > 0
    ? Math.round((kpis.cobrado_mes / kpis.programado_mes) * 100)
    : 0;
  const porCobrarMes = kpis?.por_cobrar_mes ?? 0;
  const porCobrarMesSinCe = kpis?.por_cobrar_mes_sin_ce ?? 0;
  const totalProyecto = (kpis?.cobrado_total ?? 0) + (kpis?.pendiente_total ?? 0);

  const riskLevel = cuentas3Plus > 0 ? 'Crítico' : totalMorosas > 0 ? 'Riesgo activo' : 'Controlado';
  const riskColor = cuentas3Plus > 0 ? 'text-danger' : totalMorosas > 0 ? 'text-warning' : 'text-success';

  const riskBadgeCls = riskColor === 'text-danger'
    ? 'bg-danger/10 text-danger border-danger/20'
    : riskColor === 'text-warning'
    ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-success/10 text-success border-success/20';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground text-sm">Cargando dashboard...</span>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="w-6 h-6 text-danger" />
        <span className="ml-2 text-danger text-sm">Error al cargar datos: {(error as Error)?.message}</span>
      </div>
    );
  }

  // Risk by project for Riesgo tab
  const riskByProject = filteredPorProyecto
    .filter(p => p.vencido > 0)
    .sort((a, b) => b.vencido - a.vencido);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filters */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-3">
        {/* Año + Mes: 2 cols on mobile, flat in flex on desktop */}
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Año</span>
            <FilterCombobox
              value={String(selectedYear)}
              onChange={v => setSelectedYear(Number(v))}
              options={YEARS.map(y => ({ label: String(y), value: String(y) }))}
              className="w-full sm:w-[100px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Mes</span>
            <FilterCombobox
              value={String(selectedMonth)}
              onChange={v => setSelectedMonth(Number(v))}
              options={MONTH_NAMES.map((m, i) => ({ label: m, value: String(i + 1) }))}
              className="w-full sm:w-[148px]"
            />
          </div>
        </div>
        {/* Proyecto + Dueño + Limpiar: flex row on mobile, flat in flex on desktop */}
        <div className="flex items-end gap-3 sm:contents">
          <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:min-w-[180px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Proyecto</span>
            <FilterCombobox
              value={selectedProyecto != null ? String(selectedProyecto) : ''}
              onChange={v => setSelectedProyecto(v ? Number(v) : null)}
              placeholder="Todos los proyectos"
              options={[
                { label: 'Todos los proyectos', value: '' },
                ...(proyectos ?? []).map((p: any) => ({ label: p.nombre, value: String(p.id) })),
              ]}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:min-w-[180px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Dueño</span>
            <OwnerMultiCombobox
              options={(duenos ?? []).map(d => d.nombre)}
              value={selectedDuenos}
              onChange={setSelectedDuenos}
              placeholder="Todos los dueños"
              className="w-full sm:w-[200px]"
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
              Limpiar
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
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Cartera total</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(totalProyecto)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">precio final acumulado</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', kpis.cobrado_total < totalProyecto ? 'text-warning' : 'text-success')}>Cobrado total</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(kpis.cobrado_total)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">pagos registrados</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', kpis.pendiente_total > 0 ? 'text-warning' : 'text-muted-foreground')}>Pendiente total</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(kpis.pendiente_total)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">saldo por cobrar</p>
              </div>
              <button
                className="sozu-kpi-card overflow-hidden text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/bandeja', { preset: 'critical' })}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Vencido total</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-danger break-all">{formatCurrency(kpis.vencido_total_sin_ce)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">excl. contraentrega</p>
              </button>
            </div>
          </section>

          {/* ── Sección: Mes seleccionado ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 capitalize">{periodLabel}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Programado</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(kpis.programado_mes_sin_ce)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">excl. contraentrega</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Cobrado en el mes</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(kpis.cobrado_mes)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug capitalize">{periodLabel}</p>
              </div>
              <div className="sozu-kpi-card overflow-hidden">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', Math.max(porCobrarMesSinCe, 0) > 0 ? 'text-warning' : 'text-success')}>Por cobrar</span>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">{formatCurrency(Math.max(porCobrarMesSinCe, 0))}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">excl. contraentrega</p>
              </div>
              <div className="sozu-kpi-card">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', cumplimiento >= 90 ? 'text-success' : 'text-danger')}>Cumplimiento</span>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cumplimiento >= 90 ? 'text-success' : 'text-danger')}>{cumplimiento}%</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{cumplimiento >= 90 ? 'En meta' : 'Bajo meta'}</p>
              </div>
            </div>
          </section>

          {/* ── Sección: Ruta a Escrituración ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5" strokeWidth={1.75} />
              Ruta a Escrituración
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/bandeja')}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vendidas</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-primary shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-foreground">{pipeline?.vendidas ?? 0}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">en cobranza activa</p>
              </button>
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Listas p/ escriturar</span>
                <p className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-success">{pipeline?.listas_escrituracion ?? 0}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">saldo liquidado</p>
              </div>
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">En escrituración</span>
                <p className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-foreground">{pipeline?.en_escrituracion ?? 0}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">proceso notarial activo</p>
              </div>
              <div className="sozu-kpi-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Entregadas</span>
                <p className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-foreground">{pipeline?.entregadas ?? 0}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">acta de entrega firmada</p>
              </div>
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
              <button
                className="sozu-kpi-card overflow-hidden text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/bandeja', { preset: 'critical' })}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Cartera vencida</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-danger break-all">{formatCurrency(kpis.vencido_total)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">total incl. contraentrega</p>
              </button>
              <button
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/bandeja', { preset: 'prelegal' })}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Cuentas críticas</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cuentas3Plus > 0 ? 'text-danger' : 'text-foreground')}>{cuentas3Plus}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">3 o más parc. vencidas</p>
              </button>
              <button
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/bandeja')}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">En riesgo</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-warning shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cuentas2 > 0 ? 'text-warning' : 'text-foreground')}>{cuentas2}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">2 parc. vencidas</p>
              </button>
              <button
                className="sozu-kpi-card overflow-hidden text-left group hover:shadow-sm transition-all duration-200"
                onClick={() => drill(navigate, '/pagos')}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Meta del mes</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-primary shrink-0 transition-colors" strokeWidth={1.75} />
                </div>
                <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-primary break-all">{formatCurrency(Math.max(porCobrarMes, 0))}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">falta para cumplir</p>
              </button>
            </div>
          </section>

          {/* ── Sección: Tendencia de cobro ── */}
          {chartData.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cobrado vs programado por mes
              </h3>
              <div className="sozu-kpi-card">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="cobrado" stroke="#17c653" strokeWidth={2} dot={{ r: 3 }} name="Cobrado" />
                    <Line type="monotone" dataKey="programado" stroke="#697280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Programado (con contraentrega)" />
                    <Line type="monotone" dataKey="programado_sin_ce" stroke="#f59f0a" strokeWidth={1.5} strokeDasharray="2 4" dot={false} name="Programado (sin contraentrega)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

        </div>
      )}



      {/* ════ TAB: RIESGO Y CARTERA ════ */}
      {activeTab === 'riesgo' && (
        <div className="space-y-10">

          {/* ── Sección: Semáforo de morosidad ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
              Nivel de morosidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => drill(navigate, '/bandeja', { parcVencidas: '1' })}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">Alerta temprana</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-warning transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cuentas1 > 0 ? 'text-warning' : 'text-foreground')}>{cuentas1}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">1 parcialidad vencida</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Intervención preventiva - aún se pueden recuperar fácilmente</p>
              </button>

              <button onClick={() => drill(navigate, '/bandeja', { parcVencidas: '2' })}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Riesgo activo</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cuentas2 > 0 ? 'text-danger' : 'text-foreground')}>{cuentas2}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">2 parcialidades vencidas</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Patrón de incumplimiento detectado - gestión urgente</p>
              </button>

              <button onClick={() => drill(navigate, '/bandeja', { parcVencidas: '3plus' })}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Crítico / prelegal</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', cuentas3Plus > 0 ? 'text-danger' : 'text-foreground')}>{cuentas3Plus}</p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">3+ parcialidades vencidas</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Candidatos a proceso legal - requieren acción inmediata</p>
              </button>
            </div>
          </section>

          {/* ── Sección: Antigüedad y riesgo por proyecto ── */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {kpis.aging && kpis.aging.length > 0 && (
                <div className="sozu-kpi-card">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Antigüedad de cartera</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={kpis.aging.map(a => ({ range: `${a.rango} días`, amount: a.monto_sin_ce, amountCE: a.monto }))} barSize={32}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                      <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                      <Tooltip
                        formatter={(v: number, name: string) => [formatCurrency(v), name === 'amount' ? 'Sin CE' : 'Con CE']}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="amount" fill={AGING_COLOR} radius={[4, 4, 0, 0]} name="Sin CE" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="sozu-kpi-card">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Riesgo por proyecto
                </h3>
                {riskByProject.length > 0 ? (
                  <div className="space-y-1">
                    {riskByProject.map((p, i) => {
                      const total = (p.cobrado ?? 0) + (p.pendiente ?? 0);
                      const pct = total > 0 ? Math.round((p.vencido / total) * 100) : 0;
                      const rank = i + 1;
                      return (
                        <button key={p.proyecto_id}
                          className="w-full px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                          onClick={() => drill(navigate, '/bandeja', { proyecto: p.proyecto })}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-[18px] h-[18px] rounded-full bg-danger/10 text-danger text-[10px] font-bold flex items-center justify-center shrink-0">{rank}</span>
                              <span className="text-[13px] font-semibold text-foreground truncate">{p.proyecto}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-[13px] font-bold text-danger tabular-nums">{formatCurrency(p.vencido)}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-danger transition-colors shrink-0" strokeWidth={1.75} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-danger transition-all"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums font-semibold text-danger/70 shrink-0 w-[52px] text-right">{pct}% venc.</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground text-center py-6">Sin datos de riesgo por proyecto</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Sección: Clientes críticos ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                Clientes críticos
              </h3>
              <div className="flex items-center gap-3">
                {clientesCriticos.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 tabular-nums">
                    {clientesCriticos.length} cuenta{clientesCriticos.length !== 1 ? 's' : ''} · 3+ parc.
                  </span>
                )}
                <button
                  onClick={() => drill(navigate, '/bandeja', { parcVencidas: '3plus' })}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium whitespace-nowrap"
                >
                  Ver todas <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            {clientesCriticos.length === 0 ? (
              <div className="sozu-kpi-card flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                <span className="text-[13px] text-muted-foreground">Sin cuentas críticas para los filtros seleccionados.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {clientesCriticos.slice(0, 3).map((c) => {
                  const tipoLabel = c.tipo_cuenta === 'Propiedad' ? 'Propiedad'
                    : c.tipo_cuenta === 'Producto' ? (c.producto_nombre ?? 'Producto')
                    : 'Servicio';
                  const tipoCls = c.tipo_cuenta === 'Propiedad'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground';
                  return (
                    <button
                      key={c.cuenta_id}
                      className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
                      onClick={() => navigate(`/admin/portal-cobranza/expediente/${c.cuenta_id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Crítico</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground/60">CC-{String(c.cuenta_id).padStart(6, '0')}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />
                        </div>
                      </div>
                      <p className="text-[20px] font-bold tabular-nums leading-none mb-2 text-danger">{formatCurrency(c.monto_vencido)}</p>
                      <p className="text-[13px] font-semibold text-foreground mb-0.5 truncate">{c.cliente_nombre}</p>
                      <p className="text-[11px] text-muted-foreground mb-3 truncate">{c.proyecto}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', tipoCls)}>{tipoLabel}</span>
                        {c.numero_propiedad && (
                          <span className="text-[10px] text-muted-foreground">Prop. {c.numero_propiedad}</span>
                        )}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger/10 text-danger tabular-nums">
                          {c.parcialidades_vencidas} parc.
                        </span>
                        <span className={cn('text-[10px] tabular-nums', c.dias_sin_pagar > 90 ? 'text-danger' : c.dias_sin_pagar > 30 ? 'text-warning' : 'text-muted-foreground')}>
                          {c.dias_sin_pagar}d sin pagar
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ════ TAB: COBRANZA POR PROYECTO ════ */}
      {activeTab === 'cobranza' && (
        <div className="space-y-10">

          {/* ── Sección: Tabla por proyecto ── */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Cobranza por proyecto
            </h3>
            <div className="sozu-kpi-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sozu-thead">
                    <tr>
                      <th className="pl-5 !text-center">Proyecto</th>
                      <th className="!text-center">Cobrado</th>
                      <th className="!text-center">Por cobrar</th>
                      <th className="!text-center pr-5">Vencido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableProyectos.length > 0 ? tableProyectos.map(p => (
                      <tr key={p.proyecto_id}
                        className="border-b border-border/60 hover:bg-muted/40 cursor-pointer h-[48px] transition-colors group"
                        onClick={() => drill(navigate, '/bandeja', { proyecto: p.proyecto })}>
                        <td className="pl-5 pr-4 text-center text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{p.proyecto}</td>
                        <td className="px-4 text-center text-[13px] text-success font-medium tabular-nums">{formatCurrency(p.cobrado)}</td>
                        <td className="px-4 text-center text-[13px] text-muted-foreground tabular-nums">{formatCurrency(p.pendiente)}</td>
                        <td className="pl-4 pr-5 text-center text-[13px] tabular-nums">
                          {p.vencido > 0
                            ? <span className="text-danger font-semibold">{formatCurrency(p.vencido)}</span>
                            : <span className="text-muted-foreground/40">-</span>}
                        </td>
                      </tr>
                    )) : (
                      <tr className="h-[64px]">
                        <td colSpan={4} className="text-center text-[13px] text-muted-foreground">Sin datos de cobranza para los filtros seleccionados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Sección: Gráfica cobrado por proyecto ── */}
          {filteredPorProyecto.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Cobrado por proyecto
              </h3>
              <div className="sozu-kpi-card">
                <ResponsiveContainer width="100%" height={Math.max(160, filteredPorProyecto.length * 40)}>
                  <BarChart data={filteredPorProyecto} barSize={22} layout="vertical">
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="proyecto" tick={{ fontSize: 11, fill: '#0f1219' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="cobrado" fill="#3068db" radius={[0, 4, 4, 0]} name="Cobrado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

        </div>
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
                onClick={() => drill(navigate, '/ceps')}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    cepsSinValidar > 0 ? 'text-danger' : 'text-success'
                  )}>
                    Validación de pagos
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-primary transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn(
                  'text-[32px] font-bold tabular-nums leading-none mb-1.5',
                  cepsSinValidar > 0 ? 'text-danger' : 'text-foreground'
                )}>
                  {cepsSinValidar >= 1000
                    ? `+${Math.floor(cepsSinValidar / 1000)}k`
                    : cepsSinValidar.toLocaleString('es-MX')}
                </p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">Pagos sin validar</p>
                <p className="text-[11px] text-muted-foreground leading-snug">Pendientes de conciliar en Validación de Pagos</p>
              </button>

              <button
                onClick={() => drill(navigate, '/bandeja')}
                className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    totalMorosas > 0 ? 'text-warning' : 'text-success'
                  )}>
                    Cuentas en mora
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-warning transition-colors shrink-0" strokeWidth={1.75} />
                </div>
                <p className={cn(
                  'text-[32px] font-bold tabular-nums leading-none mb-1.5',
                  totalMorosas > 0 ? 'text-warning' : 'text-foreground'
                )}>
                  {totalMorosas}
                </p>
                <p className="text-[13px] font-medium text-foreground mb-0.5">Con pagos vencidos</p>
                <p className="text-[11px] text-muted-foreground leading-snug">1 o más parcialidades sin pagar</p>
              </button>

              <div className="sozu-kpi-card">
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider block mb-3',
                  (kpis.recovery_rate ?? 0) >= 90 ? 'text-success' : (kpis.recovery_rate ?? 0) >= 70 ? 'text-warning' : 'text-danger'
                )}>
                  Tasa de recuperación
                </span>
                <p className={cn(
                  'text-[32px] font-bold tabular-nums leading-none mb-1.5',
                  (kpis.recovery_rate ?? 0) >= 90 ? 'text-success' : (kpis.recovery_rate ?? 0) >= 70 ? 'text-warning' : 'text-danger'
                )}>
                  {kpis.recovery_rate != null ? `${Math.round(kpis.recovery_rate)}%` : '-'}
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

/* ════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ════════════════════════════════════════════════════════════════ */

