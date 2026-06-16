import { useState, useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';

export default function CompensationTab() {
  const { scenarios, projects, roles, channels } = useSimulator();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || '');

  const scenario = scenarios.find(s => s.id === scenarioId);
  const result = useMemo(() => {
    if (!scenario) return null;
    return calculateScenario(scenario, projects, roles, channels);
  }, [scenario, projects, roles, channels]);

  if (!scenario || !result) {
    return <p className="text-muted-foreground p-6">No hay escenarios disponibles.</p>;
  }

  const compData = result.roleBreakdown.map(rb => ({
    roleName: rb.roleName,
    pool: rb.pool,
    headcount: rb.headcount,
    baseSalaryMonthly: rb.totalFixedCost,
    baseSalaryAnnual: rb.totalFixedCost * 12,
    commissionAnnual: rb.totalCommissionEarned,
    commissionMonthly: rb.totalCommissionEarned / 12,
    totalAnnual: rb.totalFixedCost * 12 + rb.totalCommissionEarned,
    totalMonthly: rb.totalFixedCost + rb.totalCommissionEarned / 12,
    commissionPctOfTotal: rb.totalCost > 0 ? (rb.totalCommissionEarned / rb.totalCost) * 100 : 0,
  }));

  const totalFixed = compData.reduce((s, r) => s + r.baseSalaryAnnual, 0);
  const totalComm = compData.reduce((s, r) => s + r.commissionAnnual, 0);
  const totalComp = totalFixed + totalComm;

  const chartData = compData.map(r => ({
    name: r.roleName,
    'Sueldo Anual': r.baseSalaryAnnual,
    'Comisión Anual': r.commissionAnnual,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Compensación del Equipo</h2>
          <p className="text-sm text-muted-foreground">Sueldo base + comisión estimada por rol</p>
        </div>
        <div className="w-56">
          <Select value={scenarioId} onValueChange={setScenarioId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Costo Fijo Anual" value={formatCurrency(totalFixed)} tooltip="Suma de sueldos + prestaciones de todos los roles × 12 meses" />
        <MetricCard label="Comisiones Anuales" value={formatCurrency(totalComm)} tooltip="Total de comisiones estimadas para todos los roles" />
        <MetricCard label="Compensación Total" value={formatCurrency(totalComp)} tooltip="Costo fijo anual + comisiones anuales estimadas" />
      </div>

      <div className="rounded-xl border bg-card p-5 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Pool</th>
              <th>HC</th>
              <th>Base Mensual</th>
              <th>Comisión Anual Est.</th>
              <th>Comisión Mensual Est.</th>
              <th>Total Anual</th>
              <th>% Variable</th>
            </tr>
          </thead>
          <tbody>
            {compData.map(r => (
              <tr key={r.roleName}>
                <td className="font-medium">{r.roleName}</td>
                <td><Badge variant={r.pool === 'sozu' ? 'default' : 'secondary'} className="text-[10px]">{r.pool === 'sozu' ? 'SOZU' : 'Proyecto'}</Badge></td>
                <td className="font-mono">{r.headcount}</td>
                <td className="font-mono">{formatCurrency(r.baseSalaryMonthly)}</td>
                <td className="font-mono">{formatCurrency(r.commissionAnnual)}</td>
                <td className="font-mono">{formatCurrency(r.commissionMonthly)}</td>
                <td className="font-mono font-semibold">{formatCurrency(r.totalAnnual)}</td>
                <td className="font-mono">{formatPct(r.commissionPctOfTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Composición de Compensación por Rol</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
              <Bar dataKey="Sueldo Anual" fill="hsl(var(--chart-1))" stackId="comp" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Comisión Anual" fill="hsl(var(--chart-2))" stackId="comp" radius={[0, 3, 3, 0]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
