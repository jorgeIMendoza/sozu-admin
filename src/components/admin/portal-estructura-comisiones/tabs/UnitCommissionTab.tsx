import { useState, useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { formatCurrency, formatPct } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export default function UnitCommissionTab() {
  const { scenarios, projects, roles, channels } = useSimulator();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || '');
  const [channelId, setChannelId] = useState(channels[0]?.id || '');

  const scenario = scenarios.find(s => s.id === scenarioId);

  const data = useMemo(() => {
    if (!scenario) return null;
    const scenarioProjects = projects.filter(p => scenario.projectIds.includes(p.id));
    const avgPrice = scenarioProjects.length > 0
      ? scenarioProjects.reduce((s, p) => s + p.averagePrice, 0) / scenarioProjects.length
      : 0;
    const totalCommPct = scenario.totalCommissionPct / 100;
    const totalCommPerUnit = avgPrice * totalCommPct;
    const extPct = (scenario.channelExternalPcts[channelId] ?? 0) / 100;
    const extPerUnit = avgPrice * extPct;
    const intPerUnit = totalCommPerUnit - extPerUnit;

    const rules = scenario.commissionRules.filter(r => r.channelId === channelId);
    const roleRows = rules.map(rule => {
      const role = roles.find(r => r.id === rule.roleId);
      let amount: number;
      if (scenario.commissionMode === 'on_sale_value') {
        amount = avgPrice * (rule.percentage / 100);
      } else {
        amount = intPerUnit * (rule.percentage / 100);
      }
      return {
        roleId: rule.roleId,
        roleName: role?.name || 'Desconocido',
        pool: rule.pool,
        pct: rule.percentage,
        amountPerUnit: amount,
      };
    });

    return { avgPrice, totalCommPct: scenario.totalCommissionPct, totalCommPerUnit, extPct: extPct * 100, extPerUnit, intPerUnit, roleRows };
  }, [scenario, channelId, projects, roles]);

  if (!scenario || !data) {
    return <p className="text-muted-foreground p-6">No hay escenarios disponibles.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Comisión por Unidad</h2>
        <p className="text-sm text-muted-foreground">Cuánto gana cada rol por la venta de una sola unidad</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Escenario</label>
          <Select value={scenarioId} onValueChange={setScenarioId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Canal</label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Precio Promedio" value={formatCurrency(data.avgPrice)} tooltip="Precio promedio de los proyectos del escenario" />
        <MetricCard label="Comisión Total / Unidad" value={formatCurrency(data.totalCommPerUnit)} tooltip={`${data.totalCommPct}% del precio promedio`} />
        <MetricCard label="Comisión Externa / Unidad" value={formatCurrency(data.extPerUnit)} tooltip={`${formatPct(data.extPct)} pagada al canal externo`} />
        <MetricCard label="Remanente Interno / Unidad" value={formatCurrency(data.intPerUnit)} tooltip="Comisión total menos externa, por unidad" />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          Desglose por Rol
          <Tooltip>
            <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">Ingreso que cada rol recibe por una unidad vendida a través de este canal</TooltipContent>
          </Tooltip>
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Pool</th>
              <th>% sobre venta</th>
              <th>Ingreso por Unidad</th>
            </tr>
          </thead>
          <tbody>
            {data.roleRows.map(r => (
              <tr key={r.roleId}>
                <td className="font-medium">{r.roleName}</td>
                <td>
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${r.pool === 'sozu' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'}`}>
                    {r.pool === 'sozu' ? 'SOZU' : 'Proyecto'}
                  </span>
                </td>
                <td className="font-mono">{formatPct(r.pct)}</td>
                <td className="font-mono font-semibold">{formatCurrency(r.amountPerUnit)}</td>
              </tr>
            ))}
            {data.roleRows.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No hay reglas definidas para este canal</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
