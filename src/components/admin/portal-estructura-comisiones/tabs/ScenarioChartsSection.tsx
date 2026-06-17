import { useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/portal-estructura-comisiones/utils/calculations';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, Tooltip as RTooltip
} from 'recharts';

export default function ScenarioChartsSection() {
  const { scenarios, projects, roles, channels } = useSimulator();

  const compData = useMemo(() => {
    return scenarios.map(sc => {
      const r = calculateScenario(sc, projects, roles, channels);
      const totalUnits = r.monthlyPL.reduce((s, m) => s + m.units, 0);
      const costoPct = r.totalSalesAmount > 0
        ? ((r.monthlyFixedCost * 12 + r.totalExternalCommission + r.totalInternalCommission) / r.totalSalesAmount) * 100
        : 0;
      return {
        name: sc.name,
        ventas: r.totalSalesAmount,
        comisionTotal: r.totalCommissionAmount,
        costoComercial: r.monthlyFixedCost * 12 + r.totalExternalCommission + r.totalInternalCommission,
        utilidadSOZU: r.sozuNetProfit,
        cac: r.cacCommercial,
        costoPct,
      };
    });
  }, [scenarios, projects, roles, channels]);

  if (compData.length < 2) return null;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Comparación Visual de Escenarios</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs text-muted-foreground mb-2">Ventas & Comisiones</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Bar dataKey="comisionTotal" name="Com. Total" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="costoComercial" name="Costo Com." fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="utilidadSOZU" name="Utilidad SOZU" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="text-xs text-muted-foreground mb-2">CAC & Costo Comercial %</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                <Bar dataKey="cac" name="CAC Comercial" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
