import { useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct, formatNumber } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip as RTooltip
} from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function DashboardTab() {
  const { scenarios, projects, roles, channels, roleAssignments } = useSimulator();

  const mainScenario = scenarios[0];
  const result = useMemo(() => {
    if (!mainScenario) return null;
    return calculateScenario(mainScenario, projects, roles, channels);
  }, [mainScenario, projects, roles, channels]);

  if (!result || !mainScenario) {
    return <p className="text-muted-foreground p-8">Crea al menos un escenario para ver el dashboard.</p>;
  }

  const totalUnits = result.monthlyPL.reduce((s, m) => s + m.units, 0);
  const costoPctVentas = result.totalSalesAmount > 0
    ? ((result.monthlyFixedCost * 12 + result.totalExternalCommission + result.totalInternalCommission) / result.totalSalesAmount) * 100
    : 0;
  const comisionPromUnidad = totalUnits > 0 ? result.totalCommissionAmount / totalUnits : 0;

  // Channel distribution data
  const channelSalesData = result.channelBreakdown
    .filter(cb => cb.salesPct > 0)
    .map(cb => ({ name: cb.channelName, value: cb.salesAmount }));

  const channelCommData = result.channelBreakdown
    .filter(cb => cb.salesPct > 0)
    .map(cb => ({ name: cb.channelName, externa: cb.externalCommission, interna: cb.internalCommission }));

  // Costs vs income
  const costVsIncomeData = [
    { name: 'Comisión Total', value: result.totalCommissionAmount },
    { name: 'Costos Fijos (anual)', value: result.monthlyFixedCost * 12 },
    { name: 'Com. Externa', value: result.totalExternalCommission },
    { name: 'Utilidad SOZU', value: Math.max(0, result.sozuNetProfit) },
  ];

  // Commission flow data
  const totalCommPct = mainScenario.totalCommissionPct;
  const extPct = result.totalSalesAmount > 0 ? (result.totalExternalCommission / result.totalSalesAmount) * 100 : 0;
  const sozuPoolPct = result.roleBreakdown.filter(r => r.pool === 'sozu').reduce((s, r) => s + r.totalCommissionEarned, 0);
  const projPoolPct = result.roleBreakdown.filter(r => r.pool === 'project').reduce((s, r) => s + r.totalCommissionEarned, 0);

  const flowData = [
    { name: 'Com. Externa', value: result.totalExternalCommission, pct: extPct },
    { name: 'Pool SOZU', value: sozuPoolPct, pct: result.totalSalesAmount > 0 ? (sozuPoolPct / result.totalSalesAmount) * 100 : 0 },
    { name: 'Pool Proyecto', value: projPoolPct, pct: result.totalSalesAmount > 0 ? (projPoolPct / result.totalSalesAmount) * 100 : 0 },
  ];

  // Commission distribution donut data
  const commDonutData = [
    { name: 'Com. Externa', value: result.totalExternalCommission },
    { name: 'Pool SOZU', value: sozuPoolPct },
    { name: 'Pool Proyecto', value: projPoolPct },
  ];

  // Competitiveness index (simple: margin health)
  const margenSozuPct = result.totalSalesAmount > 0 ? (result.sozuNetProfit / result.totalSalesAmount) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Dashboard Comercial</h2>
        <p className="text-sm text-muted-foreground">
          Vista ejecutiva · Escenario: <span className="font-semibold text-foreground">{mainScenario.name}</span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Ventas Proyectadas" value={formatCurrency(result.totalSalesAmount)} tooltip="Total de ventas anuales proyectadas" />
        <MetricCard label="Comisión Total" value={formatCurrency(result.totalCommissionAmount)} tooltip="Ventas × comisión total %" />
        <MetricCard label="Comisión Externa" value={formatCurrency(result.totalExternalCommission)} tooltip="Pagos a canales externos" />
        <MetricCard label="Comisión Interna" value={formatCurrency(result.totalInternalCommission)} tooltip="Remanente después de comisiones externas" />
        <MetricCard label="Utilidad SOZU" value={formatCurrency(result.sozuNetProfit)} tooltip="Ingresos SOZU – sueldos – costos" />
        <MetricCard label="Costo Comercial %" value={formatPct(costoPctVentas)} tooltip="Costo comercial total / ventas" />
        <MetricCard label="CAC Comercial" value={formatCurrency(result.cacCommercial)} tooltip="Costo de adquisición por unidad vendida" />
        <MetricCard label="Costo por Unidad" value={formatCurrency(result.costPerUnit)} tooltip="Costo comercial total / unidades" />
        <MetricCard label="Margen SOZU %" value={formatPct(margenSozuPct)} tooltip="Utilidad SOZU / ventas totales" />
        <MetricCard label="Com. Prom/Unidad" value={formatCurrency(comisionPromUnidad)} tooltip="Comisión total / unidades vendidas" />
      </div>

      {/* Commission Flow */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Flujo de Comisión ({totalCommPct}% total)
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-lg bg-primary px-4 py-3 text-primary-foreground text-center min-w-[120px]">
            <div className="text-lg font-bold">{totalCommPct}%</div>
            <div className="text-[10px] opacity-80">Comisión Total</div>
          </div>
          <div className="text-muted-foreground text-lg">→</div>
          <div className="flex flex-col gap-2 flex-1">
            {flowData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="h-3 rounded-full" style={{ width: `${Math.max(8, (item.value / result.totalCommissionAmount) * 100)}%`, backgroundColor: COLORS[i % COLORS.length], minWidth: 32 }} />
                <span className="text-xs font-medium whitespace-nowrap">{item.name}: {formatPct(item.pct)} ({formatCurrency(item.value)})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Commission distribution donut */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Distribución de Comisión</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={commDonutData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name.split(' ').pop()} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {commDonutData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Channel */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Ventas por Canal</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelSalesData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {channelSalesData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commissions by Channel */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Comisiones por Canal</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelCommData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Bar dataKey="externa" name="Externa" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="interna" name="Interna" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} stackId="a" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Costs vs Revenue */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Costos del Equipo vs Ingresos</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costVsIncomeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
              <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              <RTooltip formatter={(v: number) => formatCurrency(v)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
