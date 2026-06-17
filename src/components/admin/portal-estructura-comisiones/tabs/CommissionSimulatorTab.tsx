import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/portal-estructura-comisiones/utils/calculations';
import MetricCard from '../shared/MetricCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CommissionSimulatorTab() {
  const { scenarios, projects, roles, channels } = useSimulator();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || '');
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const scenario = scenarios.find(s => s.id === scenarioId);

  const baseResult = useMemo(() => {
    if (!scenario) return null;
    return calculateScenario(scenario, projects, roles, channels);
  }, [scenario, projects, roles, channels]);

  const modifiedResult = useMemo(() => {
    if (!scenario) return null;
    if (Object.keys(overrides).length === 0) return null;
    // Create modified scenario with overridden commission percentages
    const modifiedScenario = {
      ...scenario,
      commissionRules: scenario.commissionRules.map(rule => ({
        ...rule,
        percentage: overrides[rule.roleId] !== undefined ? overrides[rule.roleId] : rule.percentage,
      })),
    };
    return calculateScenario(modifiedScenario, projects, roles, channels);
  }, [scenario, overrides, projects, roles, channels]);

  if (!scenario || !baseResult) {
    return <p className="text-muted-foreground p-6">No hay escenarios disponibles.</p>;
  }

  const commRoles = [...new Map(scenario.commissionRules.map(r => {
    const role = roles.find(rl => rl.id === r.roleId);
    return [r.roleId, { roleId: r.roleId, roleName: role?.name || 'Desconocido', basePct: r.percentage }];
  })).values()];

  const current = modifiedResult || baseResult;
  const hasChanges = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-accent" />
            Simulador de Cambio de Comisiones
          </h2>
          <p className="text-sm text-muted-foreground">Modifica % de comisión por rol y ve el impacto inmediato</p>
        </div>
        <div className="flex gap-2">
          <Select value={scenarioId} onValueChange={v => { setScenarioId(v); setOverrides({}); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={() => setOverrides({})} className="gap-1">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Comparison metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Margen SOZU', base: baseResult.sozuNetProfit, curr: current.sozuNetProfit, fmt: formatCurrency },
          { label: 'CAC Comercial', base: baseResult.cacCommercial, curr: current.cacCommercial, fmt: formatCurrency },
          { label: 'Costo Fijo/mes', base: baseResult.monthlyFixedCost, curr: current.monthlyFixedCost, fmt: formatCurrency },
          { label: 'Com. Interna', base: baseResult.totalInternalCommission, curr: current.totalInternalCommission, fmt: formatCurrency },
        ].map(m => {
          const diff = m.curr - m.base;
          const changed = hasChanges && Math.abs(diff) > 0.01;
          return (
            <div key={m.label} className="metric-card">
              <p className="metric-label">{m.label}</p>
              <p className="metric-value mt-2">{m.fmt(m.curr)}</p>
              {changed && (
                <p className={`text-xs font-mono mt-1 ${diff > 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                  {diff > 0 ? '+' : ''}{m.fmt(diff)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Role sliders */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Ajustar Comisiones por Rol</h3>
        <div className="space-y-4">
          {commRoles.map(r => {
            const val = overrides[r.roleId] ?? r.basePct;
            return (
              <div key={r.roleId} className="flex items-center gap-4">
                <span className="w-48 text-sm font-medium truncate">{r.roleName}</span>
                <Slider
                  value={[val]}
                  onValueChange={v => setOverrides(prev => ({ ...prev, [r.roleId]: v[0] }))}
                  min={0}
                  max={5}
                  step={0.05}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono text-sm">{formatPct(val)}</span>
                {overrides[r.roleId] !== undefined && overrides[r.roleId] !== r.basePct && (
                  <Badge variant="outline" className="text-[10px]">
                    base: {formatPct(r.basePct)}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Role impact table */}
      {hasChanges && modifiedResult && (
        <div className="rounded-xl border bg-card p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Impacto por Rol</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Com. Original</th>
                <th>Com. Modificada</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {modifiedResult.roleBreakdown.map(rb => {
                const orig = baseResult.roleBreakdown.find(r => r.roleId === rb.roleId);
                const diff = rb.totalCommissionEarned - (orig?.totalCommissionEarned || 0);
                return (
                  <tr key={rb.roleId}>
                    <td className="font-medium">{rb.roleName}</td>
                    <td className="font-mono">{formatCurrency(orig?.totalCommissionEarned || 0)}</td>
                    <td className="font-mono font-semibold">{formatCurrency(rb.totalCommissionEarned)}</td>
                    <td className={`font-mono ${diff > 0 ? 'text-[hsl(var(--success))]' : diff < 0 ? 'text-destructive' : ''}`}>
                      {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
