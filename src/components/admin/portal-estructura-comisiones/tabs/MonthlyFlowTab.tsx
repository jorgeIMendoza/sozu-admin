import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency, formatNumber } from '@/lib/portal-estructura-comisiones/utils/calculations';
import MetricCard from '../shared/MetricCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, Area, AreaChart } from 'recharts';

export default function MonthlyFlowTab() {
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

  // Cumulative data
  const cumulativeData = result.monthlyPL.reduce((acc, m, i) => {
    const prev = i > 0 ? acc[i - 1] : { cumSales: 0, cumCommExt: 0, cumCommInt: 0, cumMargin: 0 };
    acc.push({
      ...m,
      cumSales: prev.cumSales + m.salesAmount,
      cumCommExt: prev.cumCommExt + m.externalCommission,
      cumCommInt: prev.cumCommInt + m.internalCommission,
      cumMargin: prev.cumMargin + m.sozuMargin,
    });
    return acc;
  }, [] as any[]);

  const totalUnits = result.monthlyPL.reduce((s, m) => s + m.units, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Flujo Mensual Comercial</h2>
          <p className="text-sm text-muted-foreground">Proyección mensual de ventas, comisiones y margen</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Unidades Totales" value={formatNumber(totalUnits)} tooltip="Suma de unidades vendidas en 12 meses" />
        <MetricCard label="Ventas Acumuladas" value={formatCurrency(result.totalSalesAmount)} tooltip="Ingresos totales por ventas" />
        <MetricCard label="Comisión Ext. Total" value={formatCurrency(result.totalExternalCommission)} tooltip="Total pagado a canales externos" />
        <MetricCard label="Margen SOZU Anual" value={formatCurrency(result.sozuNetProfit)} tooltip="Utilidad neta de SOZU en el año" />
      </div>

      {/* Monthly table */}
      <div className="rounded-xl border bg-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Detalle Mensual</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Uds</th>
              <th>Ventas</th>
              <th>Com. Generada</th>
              <th>Com. Externa</th>
              <th>Com. Interna</th>
              <th>Costos Fijos</th>
              <th>Margen SOZU</th>
            </tr>
          </thead>
          <tbody>
            {result.monthlyPL.map(m => (
              <tr key={m.month}>
                <td className="font-medium">{m.label}</td>
                <td className="font-mono">{m.units}</td>
                <td className="font-mono">{formatCurrency(m.salesAmount)}</td>
                <td className="font-mono">{formatCurrency(m.totalCommission)}</td>
                <td className="font-mono">{formatCurrency(m.externalCommission)}</td>
                <td className="font-mono">{formatCurrency(m.internalCommission)}</td>
                <td className="font-mono">{formatCurrency(m.fixedCosts)}</td>
                <td className={`font-mono font-semibold ${m.sozuMargin >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                  {formatCurrency(m.sozuMargin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Comisiones Mensuales</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.monthlyPL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                <Bar dataKey="externalCommission" name="Externa" fill="hsl(var(--chart-5))" radius={[2, 2, 0, 0]} stackId="comm" />
                <Bar dataKey="internalCommission" name="Interna" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} stackId="comm" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Flujo Acumulado</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Area type="monotone" dataKey="cumCommInt" name="Com. Interna Acum." fill="hsl(var(--chart-2))" fillOpacity={0.15} stroke="hsl(var(--chart-2))" strokeWidth={2} />
                <Area type="monotone" dataKey="cumMargin" name="Margen SOZU Acum." fill="hsl(var(--chart-3))" fillOpacity={0.15} stroke="hsl(var(--chart-3))" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
