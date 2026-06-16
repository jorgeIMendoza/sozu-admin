import { useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, Tooltip as RTooltip, PieChart, Pie, Cell
} from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// Market benchmarks for commissions by role
const COMMISSION_BENCHMARKS: Record<string, { min: number; avg: number; max: number }> = {
  'role-dir-sozu': { min: 0.2, avg: 0.4, max: 0.7 },
  'role-alianzas': { min: 0.1, avg: 0.3, max: 0.5 },
  'role-dir-com': { min: 0.4, avg: 0.6, max: 1.0 },
  'role-admin-com': { min: 0.1, avg: 0.3, max: 0.5 },
  'role-asesor': { min: 1.0, avg: 1.5, max: 2.5 },
};

// Market salary benchmarks
const SALARY_BENCHMARKS: Record<string, { min: number; avg: number; max: number }> = {
  'role-dir-sozu': { min: 60000, avg: 80000, max: 120000 },
  'role-mkt': { min: 25000, avg: 35000, max: 50000 },
  'role-alianzas': { min: 30000, avg: 42000, max: 60000 },
  'role-data': { min: 35000, avg: 48000, max: 70000 },
  'role-dir-com': { min: 40000, avg: 55000, max: 80000 },
  'role-admin-com': { min: 18000, avg: 25000, max: 35000 },
  'role-asesor': { min: 12000, avg: 18000, max: 28000 },
};

type CompStatus = 'competitivo' | 'aceptable' | 'bajo';

function getStatus(value: number, bench: { min: number; avg: number; max: number }): CompStatus {
  if (value >= bench.avg) return 'competitivo';
  if (value >= bench.min) return 'aceptable';
  return 'bajo';
}

const STATUS_STYLES: Record<CompStatus, string> = {
  competitivo: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  aceptable: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  bajo: 'bg-red-500/15 text-red-600 border-red-500/30',
};

const STATUS_LABELS: Record<CompStatus, string> = {
  competitivo: '🟢 Competitivo',
  aceptable: '🟡 Aceptable',
  bajo: '🔴 Por debajo',
};

export default function CompetitividadTab() {
  const { scenarios, projects, roles, channels, roleAssignments } = useSimulator();
  const mainScenario = scenarios[0];

  const result = useMemo(() => {
    if (!mainScenario) return null;
    return calculateScenario(mainScenario, projects, roles, channels);
  }, [mainScenario, projects, roles, channels]);

  if (!result || !mainScenario) {
    return <p className="text-muted-foreground p-8">Crea al menos un escenario para ver competitividad.</p>;
  }

  const totalUnits = result.monthlyPL.reduce((s, m) => s + m.units, 0);
  const totalCommercialCost = result.monthlyFixedCost * 12 + result.totalExternalCommission + result.totalInternalCommission;
  const costoPctVentas = result.totalSalesAmount > 0 ? (totalCommercialCost / result.totalSalesAmount) * 100 : 0;

  // Commission competitiveness data
  const commCompData = roles.filter(r => r.participatesInCommission).map(role => {
    const rb = result.roleBreakdown.find(r => r.roleId === role.id);
    const commPct = rb && result.totalSalesAmount > 0
      ? (rb.totalCommissionEarned / result.totalSalesAmount) * 100
      : 0;
    const bench = COMMISSION_BENCHMARKS[role.id] || { min: 0, avg: 0, max: 0 };
    const status = getStatus(commPct, bench);
    return { role: role.name, roleId: role.id, sozu: commPct, ...bench, status };
  });

  // Salary competitiveness
  const salaryCompData = roles.map(role => {
    const assigns = roleAssignments.filter(ra => ra.roleId === role.id);
    const avgSalary = assigns.length > 0 ? assigns.reduce((s, a) => s + a.baseSalary, 0) / assigns.length : 0;
    const bench = SALARY_BENCHMARKS[role.id] || { min: 0, avg: 0, max: 0 };
    const status = getStatus(avgSalary, bench);
    const rb = result.roleBreakdown.find(r => r.roleId === role.id);
    const annualComm = rb?.totalCommissionEarned || 0;
    const annualFixed = assigns.reduce((s, a) => s + a.headcount * (a.baseSalary * (1 + a.benefitsPct / 100) + a.fixedBonus) * 12, 0);
    return { role: role.name, roleId: role.id, salary: avgSalary, annualComm, annualCost: annualFixed + annualComm, ...bench, status };
  });

  // Competitiveness index: % of roles that are competitivo or aceptable
  const commScores = commCompData.map(d => d.status === 'competitivo' ? 1 : d.status === 'aceptable' ? 0.5 : 0);
  const salaryScores = salaryCompData.map(d => d.status === 'competitivo' ? 1 : d.status === 'aceptable' ? 0.5 : 0);
  const allScores = [...commScores, ...salaryScores];
  const competitivenessIndex = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100 : 0;

  // Commission distribution donut
  const commDistribution = [
    { name: 'Com. Externa', value: result.totalExternalCommission },
    { name: 'Pool SOZU', value: result.roleBreakdown.filter(r => r.pool === 'sozu').reduce((s, r) => s + r.totalCommissionEarned, 0) },
    { name: 'Pool Proyecto', value: result.roleBreakdown.filter(r => r.pool === 'project').reduce((s, r) => s + r.totalCommissionEarned, 0) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Competitividad Comercial</h2>
        <p className="text-sm text-muted-foreground">
          Análisis de competitividad en comisiones, sueldos y costos · Escenario: <span className="font-semibold text-foreground">{mainScenario.name}</span>
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Índice Competitividad" value={formatPct(competitivenessIndex)} tooltip="% de roles con compensación competitiva vs mercado" />
        <MetricCard label="Costo Comercial %" value={formatPct(costoPctVentas)} tooltip="(Comisiones + Costos fijos) / Ventas" />
        <MetricCard label="Costo Comercial Total" value={formatCurrency(totalCommercialCost)} tooltip="Suma de comisiones y sueldos anuales" />
        <MetricCard label="CAC Comercial" value={formatCurrency(result.cacCommercial)} tooltip="Costo total / unidades vendidas" />
        <MetricCard label="Costo por Unidad" value={formatCurrency(result.costPerUnit)} tooltip="Costo comercial / unidades" />
      </div>

      {/* Commission distribution donut + traffic light table */}
      <div className="grid md:grid-cols-5 gap-4">
        {/* Donut */}
        <div className="md:col-span-2 rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Distribución de Comisión</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={commDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name.split(' ').pop()} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {commDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commission traffic light */}
        <div className="md:col-span-3 rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Semáforo de Comisiones</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>SOZU</th>
                  <th>Mercado Prom</th>
                  <th>Máximo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {commCompData.map(row => (
                  <tr key={row.roleId}>
                    <td className="font-medium text-sm">{row.role}</td>
                    <td className="font-mono text-sm">{formatPct(row.sozu)}</td>
                    <td className="font-mono text-sm text-muted-foreground">{formatPct(row.avg)}</td>
                    <td className="font-mono text-sm text-muted-foreground">{formatPct(row.max)}</td>
                    <td>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Salary cost matrix with traffic light */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Costo del Equipo Comercial</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Sueldo Base</th>
                <th>Benchmark Prom</th>
                <th>Com. Anual Est.</th>
                <th>Costo Anual Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {salaryCompData.map(row => (
                <tr key={row.roleId}>
                  <td className="font-medium text-sm">{row.role}</td>
                  <td className="font-mono text-sm">{formatCurrency(row.salary)}</td>
                  <td className="font-mono text-sm text-muted-foreground">{formatCurrency(row.avg)}</td>
                  <td className="font-mono text-sm">{formatCurrency(row.annualComm)}</td>
                  <td className="font-mono text-sm font-semibold">{formatCurrency(row.annualCost)}</td>
                  <td>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission comparison bar chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Comisión SOZU vs Mercado por Rol</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commCompData.map(d => ({ name: d.role.replace(/\s+/g, ' ').substring(0, 15), sozu: d.sozu, promedio: d.avg, maximo: d.max }))} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-10} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Bar dataKey="promedio" name="Mercado Prom" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="maximo" name="Mercado Máx" fill="hsl(var(--chart-4) / 0.4)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sozu" name="SOZU" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <RTooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
