import { useState, useMemo, useEffect, Fragment } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { formatCurrency, formatPct } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronDown, ChevronRight, Download, Save, RefreshCw, AlertTriangle, TrendingUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RTooltip,
  PieChart, Pie, Cell,
} from 'recharts';

const STORAGE_KEY = 'sozu-monthly-income-sims';
const PALETTE = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
const PERIOD_MULT: Record<Period, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

interface SavedSim {
  id: string;
  name: string;
  scenarioId: string;
  unitPrice: number;
  unitsByChannel: Record<string, number>;
  period: Period;
  createdAt: string;
  totals: { sales: number; commission: number; payroll: number; variable: number; total: number };
}

export default function MonthlyIncomeSimulatorTab() {
  const { scenarios, projects, roles, channels, roleAssignments: globalRoleAssignments } = useSimulator();
  const activeChannels = channels.filter(c => c.active);

  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || '');
  const scenario = scenarios.find(s => s.id === scenarioId);

  const defaultPrice = projects[0]?.averagePrice || 12000000;
  const [unitPrice, setUnitPrice] = useState(defaultPrice);
  const [unitsByChannel, setUnitsByChannel] = useState<Record<string, number>>({});
  const [period, setPeriod] = useState<Period>('monthly');

  const [filterPool, setFilterPool] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'role' | 'pool' | 'channel'>('role');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedSims(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Initialize units per active channel when scenario changes
  useEffect(() => {
    setUnitsByChannel(prev => {
      const next: Record<string, number> = {};
      activeChannels.forEach(ch => { next[ch.id] = prev[ch.id] ?? 1; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, channels.length]);

  // ===== Core calculation (monthly basis) =====
  const calc = useMemo(() => {
    if (!scenario) return null;

    // Role assignment aggregation (base salary PER ROLE, sin considerar headcount)
    // Fuente: módulo global "Roles y Sueldos" (no scenario-scoped)
    const roleAggMap = new Map<string, { roleId: string; roleName: string; pool: 'sozu' | 'project'; headcount: number; monthlyBase: number; _count: number; _sumBase: number; _sumBenefits: number; _sumBonus: number }>();
    for (const ra of globalRoleAssignments) {
      const role = roles.find(r => r.id === ra.roleId);
      if (!role) continue;
      const pool = role.belongsTo === 'sozu_central' ? 'sozu' : 'project';
      const ex = roleAggMap.get(ra.roleId);
      if (ex) {
        ex._count += 1;
        ex._sumBase += ra.baseSalary;
        ex._sumBenefits += ra.benefitsPct;
        ex._sumBonus += ra.fixedBonus;
        ex.headcount += ra.headcount;
      } else {
        roleAggMap.set(ra.roleId, {
          roleId: ra.roleId, roleName: role.name, pool,
          headcount: ra.headcount, monthlyBase: 0,
          _count: 1, _sumBase: ra.baseSalary, _sumBenefits: ra.benefitsPct, _sumBonus: ra.fixedBonus,
        });
      }
    }
    // Calcular base mensual promediada por rol, SIN multiplicar por headcount
    roleAggMap.forEach(agg => {
      const avgBase = agg._sumBase / agg._count;
      const avgBenefits = agg._sumBenefits / agg._count;
      const avgBonus = agg._sumBonus / agg._count;
      agg.monthlyBase = avgBase * (1 + avgBenefits / 100) + avgBonus;
    });

    const totalComPct = scenario.totalCommissionPct / 100;

    // Per channel breakdown
    const channelRows = activeChannels.map(ch => {
      const units = Number(unitsByChannel[ch.id] || 0);
      const salesAmount = units * unitPrice;
      const extPct = (scenario.channelExternalPcts[ch.id] ?? ch.externalCommissionPct) / 100;
      const totalChComm = salesAmount * totalComPct;
      const externalComm = salesAmount * extPct;
      const internalComm = Math.max(0, totalChComm - externalComm);

      const rules = scenario.commissionRules.filter(r => r.channelId === ch.id);
      const roleAmounts = rules.map(rule => {
        const role = roles.find(r => r.id === rule.roleId);
        const amount = scenario.commissionMode === 'on_sale_value'
          ? salesAmount * (rule.percentage / 100)
          : internalComm * (rule.percentage / 100);
        return { roleId: rule.roleId, roleName: role?.name || 'Unknown', amount, pct: rule.percentage };
      });

      const distributed = roleAmounts.reduce((s, r) => s + r.amount, 0);
      const overLimit = scenario.commissionMode === 'on_internal_remainder'
        ? distributed > internalComm + 0.5
        : distributed > totalChComm + 0.5;

      const hasScenarioMix = (scenario.channelMix[ch.id] || 0) > 0 || rules.length > 0;

      return {
        channel: ch,
        units,
        salesAmount,
        externalCommission: externalComm,
        internalCommission: internalComm,
        totalCommission: totalChComm,
        roleAmounts,
        overLimit,
        hasScenarioMix,
      };
    });

    // Role commission aggregation (across channels)
    const roleCommissionMap = new Map<string, { byChannel: Record<string, number>; total: number; avgPct: number; pctCount: number }>();
    channelRows.forEach(cr => {
      cr.roleAmounts.forEach(ra => {
        const ex = roleCommissionMap.get(ra.roleId) ?? { byChannel: {}, total: 0, avgPct: 0, pctCount: 0 };
        ex.byChannel[cr.channel.id] = (ex.byChannel[cr.channel.id] || 0) + ra.amount;
        ex.total += ra.amount;
        ex.avgPct += ra.pct;
        ex.pctCount += 1;
        roleCommissionMap.set(ra.roleId, ex);
      });
    });

    // Merge role rows (include roles with rules even if no assignment, and assignments even if no commission)
    const allRoleIds = new Set<string>([...roleAggMap.keys(), ...roleCommissionMap.keys()]);
    const roleRows = Array.from(allRoleIds).map(roleId => {
      const agg = roleAggMap.get(roleId);
      const com = roleCommissionMap.get(roleId);
      const role = roles.find(r => r.id === roleId);
      const pool: 'sozu' | 'project' = agg?.pool ?? (role?.belongsTo === 'sozu_central' ? 'sozu' : 'project');
      const monthlyBase = agg?.monthlyBase ?? 0;
      const commissionMonthly = com?.total ?? 0;
      const avgPct = com && com.pctCount > 0 ? com.avgPct / com.pctCount : 0;
      const totalMonthly = monthlyBase + commissionMonthly;
      return {
        roleId,
        roleName: role?.name || agg?.roleName || 'Unknown',
        pool,
        headcount: agg?.headcount ?? 0,
        monthlyBase,
        commissionPct: avgPct,
        commissionMonthly,
        commissionByChannel: com?.byChannel ?? {},
        totalMonthly,
        annualized: totalMonthly * 12,
        missingSalary: !agg,
        missingCommission: !com,
      };
    });

    const totalSales = channelRows.reduce((s, c) => s + c.salesAmount, 0);
    const totalCommission = channelRows.reduce((s, c) => s + c.totalCommission, 0);
    const totalExternal = channelRows.reduce((s, c) => s + c.externalCommission, 0);
    const totalInternal = channelRows.reduce((s, c) => s + c.internalCommission, 0);
    const totalPayroll = roleRows.reduce((s, r) => s + r.monthlyBase, 0);
    const totalVariable = roleRows.reduce((s, r) => s + r.commissionMonthly, 0);
    const totalCost = totalPayroll + totalVariable;
    const topRole = [...roleRows].sort((a, b) => b.totalMonthly - a.totalMonthly)[0];
    const topChannel = [...channelRows].sort((a, b) => b.internalCommission - a.internalCommission)[0];

    return {
      channelRows, roleRows,
      totalSales, totalCommission, totalExternal, totalInternal,
      totalPayroll, totalVariable, totalCost,
      commissionOverSales: totalSales > 0 ? (totalCommission / totalSales) * 100 : 0,
      topRole, topChannel,
    };
  }, [scenario, roles, activeChannels, unitsByChannel, unitPrice, globalRoleAssignments]);

  if (!scenario || !calc) {
    return <p className="text-muted-foreground p-6">No hay escenarios disponibles. Crea uno en "Escenarios".</p>;
  }

  const mult = PERIOD_MULT[period];

  // Filter role rows
  const visibleRoleRows = calc.roleRows.filter(r => {
    if (filterPool !== 'all' && r.pool !== filterPool) return false;
    if (filterChannel !== 'all' && !(r.commissionByChannel[filterChannel] > 0)) return false;
    return true;
  });

  // Grouped view
  let groupedRows: { key: string; label: string; base: number; commission: number; total: number; count: number }[] | null = null;
  if (groupBy !== 'role') {
    const map: Record<string, { label: string; base: number; commission: number; total: number; count: number }> = {};
    if (groupBy === 'pool') {
      visibleRoleRows.forEach(r => {
        const k = r.pool;
        map[k] = map[k] || { label: r.pool === 'sozu' ? 'SOZU' : 'Proyecto', base: 0, commission: 0, total: 0, count: 0 };
        map[k].base += r.monthlyBase;
        map[k].commission += r.commissionMonthly;
        map[k].total += r.totalMonthly;
        map[k].count += 1;
      });
    } else {
      calc.channelRows.forEach(cr => {
        const com = cr.roleAmounts.reduce((s, r) => s + r.amount, 0);
        map[cr.channel.id] = { label: cr.channel.name, base: 0, commission: com, total: com, count: cr.roleAmounts.length };
      });
    }
    groupedRows = Object.entries(map).map(([k, v]) => ({ key: k, ...v }));
  }

  // Chart data
  const barChartData = visibleRoleRows
    .slice()
    .sort((a, b) => b.totalMonthly - a.totalMonthly)
    .map(r => ({ name: r.roleName, 'Sueldo Base': r.monthlyBase, 'Comisión': r.commissionMonthly }));

  const poolDonut = ['sozu', 'project'].map(p => ({
    name: p === 'sozu' ? 'SOZU' : 'Proyecto',
    value: visibleRoleRows.filter(r => r.pool === p).reduce((s, r) => s + r.totalMonthly, 0),
  })).filter(d => d.value > 0);

  // Alerts
  const alerts: { type: 'warn' | 'error'; msg: string }[] = [];
  calc.roleRows.forEach(r => {
    if (r.missingSalary && r.commissionMonthly > 0)
      alerts.push({ type: 'warn', msg: `"${r.roleName}" no tiene sueldo base configurado.` });
  });
  calc.channelRows.forEach(cr => {
    if (cr.units > 0 && cr.roleAmounts.length === 0)
      alerts.push({ type: 'warn', msg: `Canal "${cr.channel.name}" no tiene escenario de comisión asignado.` });
    if (cr.overLimit)
      alerts.push({ type: 'error', msg: `Comisiones en "${cr.channel.name}" exceden el límite del escenario.` });
  });

  // Sync handlers (data is reactive — toast confirms refresh)
  const handleSyncRoles = () => toast.success('Roles y sueldos sincronizados desde el módulo central');
  const handleSyncCommissions = () => toast.success('Comisiones sincronizadas desde el Motor de Comisiones');

  // Save / compare
  const handleSave = () => {
    const name = prompt('Nombre del escenario guardado:', `Sim ${savedSims.length + 1}`);
    if (!name) return;
    const sim: SavedSim = {
      id: `sim-${Date.now()}`,
      name,
      scenarioId,
      unitPrice,
      unitsByChannel: { ...unitsByChannel },
      period,
      createdAt: new Date().toISOString(),
      totals: {
        sales: calc.totalSales,
        commission: calc.totalCommission,
        payroll: calc.totalPayroll,
        variable: calc.totalVariable,
        total: calc.totalCost,
      },
    };
    const next = [...savedSims, sim];
    setSavedSims(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast.success(`Escenario "${name}" guardado`);
  };

  const handleDeleteSim = (id: string) => {
    const next = savedSims.filter(s => s.id !== id);
    setSavedSims(next);
    setCompareIds(compareIds.filter(c => c !== id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleCompare = (id: string) => {
    setCompareIds(compareIds.includes(id)
      ? compareIds.filter(c => c !== id)
      : compareIds.length >= 3 ? compareIds : [...compareIds, id]);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows: string[] = [];
    rows.push('Simulador de Ingresos Mensuales');
    rows.push(`Escenario,${scenario.name}`);
    rows.push(`Precio por unidad,${unitPrice}`);
    rows.push(`Periodo,${period}`);
    rows.push('');
    rows.push('Canal,Unidades,Monto vendido,Comisión total,Externa,Interna');
    calc.channelRows.forEach(cr => {
      rows.push([cr.channel.name, cr.units, cr.salesAmount, cr.totalCommission, cr.externalCommission, cr.internalCommission].join(','));
    });
    rows.push('');
    rows.push('Rol,Pool,Headcount,Sueldo mensual,Comisión %,Comisión mensual,Ingreso mensual,Ingreso anualizado');
    calc.roleRows.forEach(r => {
      rows.push([r.roleName, r.pool, r.headcount, r.monthlyBase.toFixed(2), r.commissionPct.toFixed(2), r.commissionMonthly.toFixed(2), r.totalMonthly.toFixed(2), r.annualized.toFixed(2)].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `simulador-ingresos-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exportación CSV generada');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Simulador de Ingresos Mensuales</h2>
          <p className="text-sm text-muted-foreground">
            Ingreso por rol (sin headcount) — sueldo base proveniente de "Roles y Sueldos" + comisión por canal según unidades vendidas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleSyncRoles}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sincronizar roles y sueldos
          </Button>
          <Button size="sm" variant="outline" onClick={handleSyncCommissions}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sincronizar comisiones
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar escenario
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar simulación
          </Button>
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Escenario de comisión</label>
            <Select value={scenarioId} onValueChange={setScenarioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio promedio por unidad</label>
            <Input type="number" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} className="font-mono" />
            <p className="text-[11px] text-muted-foreground mt-1">{formatCurrency(unitPrice)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Periodo</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="semiannual">Semestral</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Unidades vendidas por canal (mensual)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeChannels.map(ch => (
              <div key={ch.id}>
                <label className="text-[11px] text-muted-foreground mb-1 block truncate">{ch.name}</label>
                <Input
                  type="number"
                  min={0}
                  value={unitsByChannel[ch.id] ?? 0}
                  onChange={e => setUnitsByChannel({ ...unitsByChannel, [ch.id]: Math.max(0, Number(e.target.value)) })}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 4).map((a, i) => (
            <Alert key={i} variant={a.type === 'error' ? 'destructive' : 'default'} className="py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{a.msg}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Executive cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={`Ventas totales (${period === 'monthly' ? 'mes' : period})`} value={formatCurrency(calc.totalSales * mult)} tooltip="Unidades × precio promedio por canal" />
        <MetricCard label="Comisión total" value={formatCurrency(calc.totalCommission * mult)} tooltip="Suma de comisiones por canal" />
        <MetricCard label="Nómina base" value={formatCurrency(calc.totalPayroll * mult)} tooltip="Sueldos + prestaciones de roles internos" />
        <MetricCard label="Ingreso variable" value={formatCurrency(calc.totalVariable * mult)} tooltip="Suma de comisiones distribuidas a roles" />
        <MetricCard label="Costo total equipo" value={formatCurrency(calc.totalCost * mult)} />
        <MetricCard label="% Comisión sobre ventas" value={formatPct(calc.commissionOverSales)} />
        <MetricCard label="Rol con mayor ingreso" value={calc.topRole?.roleName || '—'} tooltip={calc.topRole ? formatCurrency(calc.topRole.totalMonthly * mult) : ''} />
        <MetricCard label="Canal con mayor comisión interna" value={calc.topChannel?.channel.name || '—'} tooltip={calc.topChannel ? formatCurrency(calc.topChannel.internalCommission * mult) : ''} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtros:</span>
        <Select value={filterPool} onValueChange={setFilterPool}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Pool" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los pools</SelectItem>
            <SelectItem value="sozu">SOZU</SelectItem>
            <SelectItem value="project">Proyecto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {activeChannels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="role">Agrupar por rol</SelectItem>
            <SelectItem value="pool">Agrupar por pool</SelectItem>
            <SelectItem value="channel">Agrupar por canal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main table */}
      <div className="rounded-xl border bg-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Ingresos por Rol</h3>
        {groupedRows ? (
          <table className="data-table">
            <thead>
              <tr><th>{groupBy === 'pool' ? 'Pool' : 'Canal'}</th><th>Roles</th><th>Sueldo base</th><th>Comisión</th><th>Total</th></tr>
            </thead>
            <tbody>
              {groupedRows.map(g => (
                <tr key={g.key}>
                  <td className="font-medium">{g.label}</td>
                  <td className="font-mono">{g.count}</td>
                  <td className="font-mono">{formatCurrency(g.base * mult)}</td>
                  <td className="font-mono">{formatCurrency(g.commission * mult)}</td>
                  <td className="font-mono font-semibold">{formatCurrency(g.total * mult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Rol</th><th>Pool</th><th>Sueldo</th><th>Comisión %</th>
                <th>Comisión est.</th><th>Ingreso {period === 'monthly' ? 'mensual' : period}</th><th>Anualizado</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoleRows.map(r => {
                const isOpen = !!expanded[r.roleId];
                return (
                  <Fragment key={r.roleId}>
                    <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setExpanded({ ...expanded, [r.roleId]: !isOpen })}>
                      <td>{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                      <td className="font-medium">
                        {r.roleName}
                        {r.missingSalary && <Badge variant="outline" className="ml-2 text-[9px]">sin sueldo</Badge>}
                        {r.missingCommission && <Badge variant="outline" className="ml-2 text-[9px]">sin comisión</Badge>}
                      </td>
                      <td><Badge variant={r.pool === 'sozu' ? 'default' : 'secondary'} className="text-[10px]">{r.pool === 'sozu' ? 'SOZU' : 'Proyecto'}</Badge></td>
                      <td className="font-mono">{formatCurrency(r.monthlyBase * mult)}</td>
                      <td className="font-mono">{formatPct(r.commissionPct)}</td>
                      <td className="font-mono">{formatCurrency(r.commissionMonthly * mult)}</td>
                      <td className="font-mono font-semibold">{formatCurrency(r.totalMonthly * mult)}</td>
                      <td className="font-mono text-muted-foreground">{formatCurrency(r.annualized)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td>
                        <td colSpan={7} className="bg-muted/20 p-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-muted-foreground">Sueldo base:</span> <span className="font-mono">{formatCurrency(r.monthlyBase * mult)}</span></div>
                            {activeChannels.map(ch => {
                              const v = r.commissionByChannel[ch.id] || 0;
                              if (v === 0) return null;
                              return (
                                <div key={ch.id}>
                                  <span className="text-muted-foreground">{ch.name}:</span> <span className="font-mono">{formatCurrency(v * mult)}</span>
                                </div>
                              );
                            })}
                            <div className="col-span-full pt-1 border-t border-border/50">
                              <span className="text-muted-foreground">Comisión total:</span> <span className="font-mono font-semibold">{formatCurrency(r.commissionMonthly * mult)}</span>
                              <span className="text-muted-foreground ml-4">Ingreso total:</span> <span className="font-mono font-semibold">{formatCurrency(r.totalMonthly * mult)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Ingreso por rol — base vs comisión</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Sueldo Base" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="Comisión" stackId="a" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Costo total por pool</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={poolDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {poolDonut.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Saved scenarios / compare */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Escenarios guardados</h3>
          <span className="text-[11px] text-muted-foreground">Selecciona hasta 3 para comparar</span>
        </div>
        {savedSims.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay escenarios guardados. Usa "Guardar escenario" para almacenar la configuración actual.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Nombre</th><th>Escenario</th><th>Ventas</th><th>Comisión</th><th>Costo total</th><th>Fecha</th><th></th>
              </tr>
            </thead>
            <tbody>
              {savedSims.map(s => {
                const scen = scenarios.find(sc => sc.id === s.scenarioId);
                const checked = compareIds.includes(s.id);
                return (
                  <tr key={s.id} className={checked ? 'bg-accent/5' : ''}>
                    <td><input type="checkbox" checked={checked} onChange={() => toggleCompare(s.id)} /></td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-xs text-muted-foreground">{scen?.name || '—'}</td>
                    <td className="font-mono">{formatCurrency(s.totals.sales)}</td>
                    <td className="font-mono">{formatCurrency(s.totals.commission)}</td>
                    <td className="font-mono font-semibold">{formatCurrency(s.totals.total)}</td>
                    <td className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteSim(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {compareIds.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold mb-2">Comparativo</h4>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    {compareIds.map(id => <th key={id}>{savedSims.find(s => s.id === id)?.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: 'sales', label: 'Ventas totales' },
                    { k: 'commission', label: 'Comisión total' },
                    { k: 'payroll', label: 'Nómina base' },
                    { k: 'variable', label: 'Variable' },
                    { k: 'total', label: 'Costo total' },
                  ].map(row => {
                    const base = savedSims.find(s => s.id === compareIds[0])?.totals[row.k as keyof SavedSim['totals']] || 0;
                    return (
                      <tr key={row.k}>
                        <td className="font-medium">{row.label}</td>
                        {compareIds.map(id => {
                          const s = savedSims.find(x => x.id === id);
                          const v = s?.totals[row.k as keyof SavedSim['totals']] || 0;
                          const diff = id === compareIds[0] ? 0 : v - base;
                          return (
                            <td key={id} className="font-mono">
                              {formatCurrency(v)}
                              {diff !== 0 && (
                                <span className={`ml-2 text-[10px] ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
