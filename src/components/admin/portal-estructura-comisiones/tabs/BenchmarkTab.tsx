import { useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/calculations';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, Tooltip as RTooltip
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export default function BenchmarkTab() {
  const { channels, scenarios, roles, roleAssignments, projects } = useSimulator();
  const mainScenario = scenarios[0];

  const result = useMemo(() => {
    if (!mainScenario) return null;
    return calculateScenario(mainScenario, projects, roles, channels);
  }, [mainScenario, projects, roles, channels]);

  // Derive ranges directly from the channels catalog (single source of truth)
  const getRangeForChannel = (ch: typeof channels[0]) => ({
    min: ch.minCommissionPct,
    avg: +((ch.minCommissionPct + ch.maxCommissionPct) / 2).toFixed(2),
    max: ch.maxCommissionPct,
  });

  const chartData = channels.map(ch => {
    const range = getRangeForChannel(ch);
    const sozu = mainScenario?.channelExternalPcts[ch.id] ?? ch.externalCommissionPct;
    return {
      name: ch.name.replace('Canal ', '').substring(0, 12),
      min: range.min,
      promedio: range.avg,
      max: range.max,
      sozu,
    };
  });

  const getPositioning = (sozu: number, min: number, max: number) => {
    if (max === 0 && min === 0) return 'neutral';
    if (sozu < min) return 'muy_competitivo';
    if (sozu <= max) return 'competitivo';
    return 'por_encima';
  };

  const posColors: Record<string, string> = {
    muy_competitivo: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
    competitivo: 'bg-success/10 text-success border-success/30',
    por_encima: 'bg-destructive/10 text-destructive border-destructive/30',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  const posLabels: Record<string, string> = {
    muy_competitivo: 'Muy competitivo',
    competitivo: 'Competitivo',
    por_encima: 'Por encima del mercado',
    neutral: 'N/A',
  };

  // Incentive matrix data
  const matrixData = useMemo(() => {
    if (!result) return [];
    return roles.filter(r => r.participatesInCommission).map(role => {
      const assigns = roleAssignments.filter(ra => ra.roleId === role.id);
      const avgSalary = assigns.length > 0
        ? assigns.reduce((s, a) => s + a.baseSalary, 0) / assigns.length
        : 0;
      const rb = result.roleBreakdown.find(r => r.roleId === role.id);
      const commPct = rb ? (rb.totalCommissionEarned / Math.max(1, result.totalSalesAmount)) * 100 : 0;
      const totalUnits = result.monthlyPL.reduce((s, m) => s + m.units, 0) || 1;
      const perUnit = rb ? rb.totalCommissionEarned / totalUnits : 0;
      const annualComm = rb?.totalCommissionEarned || 0;
      const annualBase = assigns.reduce((s, a) => s + a.headcount * (a.baseSalary * (1 + a.benefitsPct / 100) + a.fixedBonus) * 12, 0);
      return { role: role.name, baseSalary: avgSalary, commPct, perUnit, annualComm, totalAnnual: annualBase + annualComm };
    });
  }, [roles, roleAssignments, result]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Benchmark de Comisiones</h2>
        <p className="text-sm text-muted-foreground">
          Compara tus comisiones contra el mercado inmobiliario.
          Los rangos de mercado se leen automáticamente del catálogo de <span className="font-medium text-foreground">Canales de Venta</span>.
        </p>
      </div>

      {/* Comparison chart */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Tu Comisión vs Mercado</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Bar dataKey="min" name="Mínimo Mercado" fill="hsl(var(--muted-foreground) / 0.2)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="promedio" name="Promedio Mercado" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="max" name="Máximo Mercado" fill="hsl(var(--chart-4) / 0.5)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sozu" name="SOZU" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <RTooltip formatter={(v: number) => `${v}%`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positioning cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {channels.map(ch => {
          const range = getRangeForChannel(ch);
          const sozu = mainScenario?.channelExternalPcts[ch.id] ?? ch.externalCommissionPct;
          const pos = getPositioning(sozu, range.min, range.max);

          return (
            <div key={ch.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">{ch.name}</h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${posColors[pos]}`}>
                  {posLabels[pos]}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold font-mono text-accent">{sozu.toFixed(2)}%</span>
                <span className="text-xs text-muted-foreground">vs mercado {range.min.toFixed(2)}–{range.max.toFixed(2)}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <span className="block text-muted-foreground text-[10px]">Mín</span>
                  <span className="font-mono font-semibold">{range.min.toFixed(2)}%</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <span className="block text-muted-foreground text-[10px]">Prom</span>
                  <span className="font-mono font-semibold">{range.avg.toFixed(2)}%</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <span className="block text-muted-foreground text-[10px]">Máx</span>
                  <span className="font-mono font-semibold">{range.max.toFixed(2)}%</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      Los rangos de mercado se configuran en Configuración → Canales de Venta. Cualquier cambio allí se refleja automáticamente aquí.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span>Datos del catálogo de canales</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Incentive Matrix */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Matriz de Incentivos</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Sueldo Base</th>
                <th>Comisión %</th>
                <th>Ingreso/Venta</th>
                <th>Com. Anual Est.</th>
                <th>Total Anual</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map(row => (
                <tr key={row.role}>
                  <td className="font-medium">{row.role}</td>
                  <td className="font-mono">{formatCurrency(row.baseSalary)}</td>
                  <td className="font-mono">{formatPct(row.commPct)}</td>
                  <td className="font-mono">{formatCurrency(row.perUnit)}</td>
                  <td className="font-mono">{formatCurrency(row.annualComm)}</td>
                  <td className="font-mono font-semibold">{formatCurrency(row.totalAnnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
