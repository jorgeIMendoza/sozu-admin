import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct, formatNumber } from '@/lib/portal-estructura-comisiones/utils/calculations';
import MetricCard from '../shared/MetricCard';
import CommercialPoliciesPanel, { calculateWeightedKPIs } from '../shared/CommercialPoliciesPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Download, BarChart3, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import type { ScenarioResults, MonthlyPL } from '@/lib/portal-estructura-comisiones/types/simulator';

type AnalysisWindowOption = '12' | '18' | '24' | '36' | 'full' | 'custom';

function getWindowMonths(option: AnalysisWindowOption, customStart: string, customEnd: string, projects: any[], scenario: any): number {
  if (option === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, diff);
  }
  if (option === 'full') {
    // Use max project duration
    const scenarioProjects = projects.filter((p: any) => scenario.projectIds.includes(p.id));
    let maxMonths = 12;
    for (const p of scenarioProjects) {
      if (p.salesStartDate && p.deliveryDate) {
        const s = new Date(p.salesStartDate);
        const e = new Date(p.deliveryDate);
        const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
        if (diff > maxMonths) maxMonths = diff;
      }
    }
    return maxMonths;
  }
  return parseInt(option);
}

function sliceMonthlyPL(monthlyPL: MonthlyPL[], windowMonths: number): MonthlyPL[] {
  // Extend or trim to match window
  const result: MonthlyPL[] = [];
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  for (let i = 0; i < windowMonths; i++) {
    if (i < monthlyPL.length) {
      result.push(monthlyPL[i]);
    } else {
      // Beyond original 12 months — repeat absorption pattern cyclically or zeros
      const srcIdx = i % monthlyPL.length;
      const src = monthlyPL[srcIdx];
      result.push({
        ...src,
        month: i + 1,
        label: `${MONTH_LABELS[i % 12]} ${Math.floor(i / 12) + 1 > 1 ? 'A' + (Math.floor(i / 12) + 1) : ''}`.trim(),
      });
    }
  }
  return result;
}

function recalcResultForWindow(result: ScenarioResults, windowMonths: number): { windowResult: ScenarioResults; windowPL: MonthlyPL[] } {
  const windowPL = sliceMonthlyPL(result.monthlyPL, windowMonths);
  const totalSalesAmount = windowPL.reduce((s, m) => s + m.salesAmount, 0);
  const totalCommissionAmount = windowPL.reduce((s, m) => s + m.totalCommission, 0);
  const totalExternalCommission = windowPL.reduce((s, m) => s + m.externalCommission, 0);
  const totalInternalCommission = windowPL.reduce((s, m) => s + m.internalCommission, 0);
  const totalUnits = windowPL.reduce((s, m) => s + m.units, 0);
  const monthlyFixedCost = result.monthlyFixedCost;
  const totalFixedCost = monthlyFixedCost * windowMonths;
  const totalCommercialCost = totalFixedCost + totalExternalCommission + totalInternalCommission;
  const cacCommercial = totalUnits > 0 ? totalCommercialCost / totalUnits : 0;
  const costPerUnit = cacCommercial;

  // Approximate margins for window
  const sozuRoles = result.roleBreakdown.filter(r => r.pool === 'sozu');
  const sozuFixedForWindow = sozuRoles.reduce((s, r) => s + r.totalFixedCost, 0) * windowMonths;
  const ratio = result.totalSalesAmount > 0 ? totalSalesAmount / result.totalSalesAmount : 0;
  const sozuCommissions = sozuRoles.reduce((s, r) => s + r.totalCommissionEarned, 0) * ratio;
  const sozuNetProfit = totalInternalCommission - sozuFixedForWindow - sozuCommissions;

  return {
    windowPL,
    windowResult: {
      ...result,
      totalSalesAmount,
      totalCommissionAmount,
      totalExternalCommission,
      totalInternalCommission,
      monthlyFixedCost,
      monthlyVariableCost: (totalExternalCommission + totalInternalCommission) / windowMonths,
      sozuMargin: result.sozuMargin * ratio,
      projectMargin: result.projectMargin * ratio,
      cacCommercial,
      costPerUnit,
      sozuNetProfit,
      monthlyPL: windowPL,
    },
  };
}

export default function ResultsTab() {
  const { scenarios, projects, roles, channels, commercialPolicies } = useSimulator();
  const [selectedIds, setSelectedIds] = useState<string[]>(scenarios.slice(0, 2).map(s => s.id));
  const [compareMode, setCompareMode] = useState(false);
  const [windowOption, setWindowOption] = useState<AnalysisWindowOption>('12');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const results = useMemo(() => {
    return selectedIds.map(id => {
      const sc = scenarios.find(s => s.id === id);
      if (!sc) return null;
      const baseResult = calculateScenario(sc, projects, roles, channels);
      const windowMonths = getWindowMonths(windowOption, customStart, customEnd, projects, sc);
      const { windowResult } = recalcResultForWindow(baseResult, windowMonths);
      return { scenario: sc, result: windowResult, windowMonths };
    }).filter(Boolean) as { scenario: typeof scenarios[0]; result: ScenarioResults; windowMonths: number }[];
  }, [selectedIds, scenarios, projects, roles, channels, windowOption, customStart, customEnd]);

  const toggleScenario = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const exportCSV = (result: ScenarioResults, name: string) => {
    const rows = [
      ['Métrica', 'Valor'],
      ['Ventas Totales', result.totalSalesAmount.toString()],
      ['Comisión Total', result.totalCommissionAmount.toString()],
      ['Comisión Externa', result.totalExternalCommission.toString()],
      ['Comisión Interna', result.totalInternalCommission.toString()],
      ['Costo Fijo Mensual', result.monthlyFixedCost.toString()],
      ['Margen SOZU', result.sozuMargin.toString()],
      ['CAC Comercial', result.cacCommercial.toString()],
      ['Utilidad Neta SOZU', result.sozuNetProfit.toString()],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sozu-${name}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Resultados & Reportes</h2>
          <p className="text-sm text-muted-foreground">
            {compareMode ? 'Comparando escenarios lado a lado' : 'Selecciona escenarios para analizar'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
            className="gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {compareMode ? 'Vista Individual' : 'Comparar'}
          </Button>
        </div>
      </div>

      {/* Analysis Window Control */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Ventana de Análisis</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              La ventana de análisis define el periodo sobre el cual se calculan ventas, comisiones, cobros y resultados financieros.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label className="text-xs">Periodo</Label>
            <Select value={windowOption} onValueChange={(v) => setWindowOption(v as AnalysisWindowOption)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
                <SelectItem value="36">36 meses</SelectItem>
                <SelectItem value="full">Todo el ciclo del proyecto</SelectItem>
                <SelectItem value="custom">Rango personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {windowOption === 'custom' && (
            <>
              <div>
                <Label className="text-xs">Fecha inicio</Label>
                <Input type="date" className="h-9 w-40" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fecha fin</Label>
                <Input type="date" className="h-9 w-40" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          {results.length > 0 && (
            <Badge variant="secondary" className="text-xs h-9 px-3 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {results[0].windowMonths} meses analizados
            </Badge>
          )}
        </div>
      </div>

      {/* Scenario selector */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map(sc => (
          <button
            key={sc.id}
            onClick={() => toggleScenario(sc.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
              selectedIds.includes(sc.id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground hover:border-accent'
            }`}
          >
            {sc.name}
          </button>
        ))}
      </div>

      {/* Commercial Policies Panel */}
      <CommercialPoliciesPanel />

      {compareMode ? (
        <CompareView results={results} onExport={exportCSV} />
      ) : (
        results.map(({ scenario, result, windowMonths }) => (
          <SingleResultView
            key={scenario.id}
            scenario={scenario}
            result={result}
            windowMonths={windowMonths}
            onExport={() => exportCSV(result, scenario.name)}
            policiesEnabled={commercialPolicies.enabled}
            policies={commercialPolicies.policies}
            projects={projects}
          />
        ))
      )}
    </div>
  );
}

const CASHFLOW_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

function SingleResultView({ scenario, result, windowMonths, onExport, policiesEnabled, policies, projects }: {
  scenario: any; result: ScenarioResults; windowMonths: number; onExport: () => void;
  policiesEnabled: boolean; policies: import('@/lib/portal-estructura-comisiones/types/simulator').CommercialPolicy[];
  projects: import('@/lib/portal-estructura-comisiones/types/simulator').Project[];
}) {
  const [view, setView] = useState<'executive' | 'channels' | 'roles' | 'pl' | 'cashflow'>('executive');

  // Project time KPIs
  const scenarioProjects = projects.filter(p => scenario.projectIds?.includes(p.id));
  const earliestStart = scenarioProjects
    .filter(p => p.salesStartDate)
    .map(p => p.salesStartDate)
    .sort()[0] || '—';
  const latestDelivery = scenarioProjects
    .filter(p => p.deliveryDate)
    .map(p => p.deliveryDate)
    .sort()
    .reverse()[0] || '—';
  const projectDurationMonths = earliestStart !== '—' && latestDelivery !== '—'
    ? Math.max(1, (new Date(latestDelivery).getFullYear() - new Date(earliestStart).getFullYear()) * 12 + (new Date(latestDelivery).getMonth() - new Date(earliestStart).getMonth()))
    : null;
  const coveragePct = projectDurationMonths ? Math.min(100, (windowMonths / projectDurationMonths) * 100) : null;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{scenario.name}</h3>
        <div className="flex gap-2">
          <div className="flex gap-0 rounded-lg border overflow-hidden">
            {(['executive', 'channels', 'roles', 'pl', 'cashflow'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {v === 'executive' ? 'Ejecutivo' : v === 'channels' ? 'Canales' : v === 'roles' ? 'Roles' : v === 'pl' ? 'P&L' : 'Cashflow'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {view === 'executive' && (() => {
        const totalUnits = result.monthlyPL.reduce((s, m) => s + m.units, 0);
        const costoPctVentas = result.totalSalesAmount > 0 ? ((result.monthlyFixedCost * windowMonths + result.totalExternalCommission + result.totalInternalCommission) / result.totalSalesAmount) * 100 : 0;
        const comisionPromUnidad = totalUnits > 0 ? result.totalCommissionAmount / totalUnits : 0;
        const margenSozuPct = result.totalSalesAmount > 0 ? (result.sozuNetProfit / result.totalSalesAmount) * 100 : 0;
        const sozuPool = result.roleBreakdown.filter(r => r.pool === 'sozu');
        const projPool = result.roleBreakdown.filter(r => r.pool === 'project');
        const ratio = result.totalSalesAmount > 0 && result.monthlyPL.length > 0 ? 1 : 0;
        const sozuPoolComm = sozuPool.reduce((s, r) => s + r.totalCommissionEarned, 0) * (windowMonths / 12);
        const projPoolComm = projPool.reduce((s, r) => s + r.totalCommissionEarned, 0) * (windowMonths / 12);

        return (
        <div className="space-y-4">
          {/* Time KPIs */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Indicadores de Tiempo
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricCard label="Meses Analizados" value={`${windowMonths}`} tooltip="Cantidad de meses en la ventana de análisis" />
              {projectDurationMonths && <MetricCard label="Duración Proyecto" value={`${projectDurationMonths} meses`} tooltip="Meses entre inicio de venta y entrega" />}
              {coveragePct !== null && <MetricCard label="% Cubierto" value={formatPct(coveragePct)} tooltip="Porcentaje del proyecto cubierto por la ventana" />}
              <MetricCard label="Inicio Venta" value={earliestStart !== '—' ? earliestStart : '—'} tooltip="Fecha de inicio de venta más temprana" />
              <MetricCard label="Entrega" value={latestDelivery !== '—' ? latestDelivery : '—'} tooltip="Fecha de entrega más tardía" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Ventas Totales" value={formatCurrency(result.totalSalesAmount)} tooltip="Unidades totales × precio promedio" />
            <MetricCard label="Comisión Total" value={formatCurrency(result.totalCommissionAmount)} tooltip="Ventas × % comisión total del escenario" />
            <MetricCard label="Utilidad Neta SOZU" value={formatCurrency(result.sozuNetProfit)} tooltip="Ingresos SOZU – sueldos SOZU – costos SOZU" />
            <MetricCard label="Costo Fijo Mensual" value={formatCurrency(result.monthlyFixedCost)} tooltip="Sueldos + prestaciones de toda la estructura" />
            <MetricCard label="Comisión Externa" value={formatCurrency(result.totalExternalCommission)} tooltip="Pagos a canales externos" />
            <MetricCard label="Comisión Interna" value={formatCurrency(result.totalInternalCommission)} tooltip="Remanente después de pagar comisión externa" />
            <MetricCard label="CAC Comercial" value={formatCurrency(result.cacCommercial)} tooltip="Costo comercial total / unidades vendidas" />
            <MetricCard label="Costo por Unidad" value={formatCurrency(result.costPerUnit)} tooltip="Costo comercial total dividido entre unidades" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Costo Comercial %" value={formatPct(costoPctVentas)} tooltip="Costo comercial total como % de las ventas" />
            <MetricCard label="Com. Promedio/Unidad" value={formatCurrency(comisionPromUnidad)} tooltip="Comisión total / unidades vendidas" />
            <MetricCard label="Margen SOZU %" value={formatPct(margenSozuPct)} tooltip="Utilidad neta SOZU como % de las ventas" />
            <MetricCard label="Unidades Vendidas" value={formatNumber(totalUnits)} tooltip="Total de unidades en el escenario" />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Separación de Pools</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Pool SOZU (Comisiones)" value={formatCurrency(sozuPoolComm)} tooltip="Comisiones asignadas a roles del pool SOZU" />
              <MetricCard label="Pool Proyecto (Comisiones)" value={formatCurrency(projPoolComm)} tooltip="Comisiones asignadas a roles del pool Proyecto" />
              <MetricCard label="Pool SOZU (Fijo)" value={formatCurrency(sozuPool.reduce((s, r) => s + r.totalFixedCost * windowMonths, 0))} tooltip="Costo fijo de roles SOZU para la ventana" />
              <MetricCard label="Pool Proyecto (Fijo)" value={formatCurrency(projPool.reduce((s, r) => s + r.totalFixedCost * windowMonths, 0))} tooltip="Costo fijo de roles Proyecto para la ventana" />
            </div>
          </div>
        </div>
        );
      })()}

      {view === 'channels' && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Canal</th>
                <th>Mix %</th>
                <th>Ventas $</th>
                <th>Com. Total</th>
                <th>Com. Externa</th>
                <th>Remanente</th>
              </tr>
            </thead>
            <tbody>
              {result.channelBreakdown.map(cb => (
                <tr key={cb.channelId}>
                  <td className="font-medium">{cb.channelName}</td>
                  <td className="font-mono">{formatPct(cb.salesPct)}</td>
                  <td className="font-mono">{formatCurrency(cb.salesAmount)}</td>
                  <td className="font-mono">{formatCurrency(cb.totalCommission)}</td>
                  <td className="font-mono">{formatCurrency(cb.externalCommission)}</td>
                  <td className="font-mono">{formatCurrency(cb.internalCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'roles' && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Pool</th>
                <th>HC</th>
                <th>Costo Fijo/mes</th>
                <th>Comisión Ganada</th>
                <th>Costo Total ({windowMonths}m)</th>
                <th>Payout Ratio</th>
              </tr>
            </thead>
            <tbody>
              {result.roleBreakdown.map(rb => (
                <tr key={rb.roleId}>
                  <td className="font-medium">{rb.roleName}</td>
                  <td><Badge variant={rb.pool === 'sozu' ? 'default' : 'secondary'} className="text-[10px]">{rb.pool === 'sozu' ? 'SOZU' : 'Proyecto'}</Badge></td>
                  <td className="font-mono">{rb.headcount}</td>
                  <td className="font-mono">{formatCurrency(rb.totalFixedCost)}</td>
                  <td className="font-mono">{formatCurrency(rb.totalCommissionEarned)}</td>
                  <td className="font-mono">{formatCurrency(rb.totalCost)}</td>
                  <td className="font-mono">{formatPct(rb.payoutRatio * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'pl' && (
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>{windowMonths} meses</th>
                <th>Mensual Prom.</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="font-medium">Ingresos por Comisiones</td><td className="font-mono">{formatCurrency(result.totalCommissionAmount)}</td><td className="font-mono">{formatCurrency(result.totalCommissionAmount / windowMonths)}</td></tr>
              <tr><td className="font-medium text-destructive">(–) Comisión Externa</td><td className="font-mono">{formatCurrency(result.totalExternalCommission)}</td><td className="font-mono">{formatCurrency(result.totalExternalCommission / windowMonths)}</td></tr>
              <tr className="border-b-2"><td className="font-semibold">= Remanente Interno</td><td className="font-mono font-semibold">{formatCurrency(result.totalInternalCommission)}</td><td className="font-mono">{formatCurrency(result.totalInternalCommission / windowMonths)}</td></tr>
              <tr><td className="font-medium text-destructive">(–) Costos Fijos</td><td className="font-mono">{formatCurrency(result.monthlyFixedCost * windowMonths)}</td><td className="font-mono">{formatCurrency(result.monthlyFixedCost)}</td></tr>
              <tr className="border-b-2"><td className="font-bold">= Margen SOZU</td><td className="font-mono font-bold">{formatCurrency(result.sozuNetProfit)}</td><td className="font-mono">{formatCurrency(result.sozuNetProfit / windowMonths)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {view === 'cashflow' && (() => {
        const kpis = policiesEnabled ? calculateWeightedKPIs(policies) : null;

        // Calculate installment period from project dates
        const totalInstallmentMonths = projectDurationMonths || 12;
        const installmentMonthsInWindow = Math.min(windowMonths, totalInstallmentMonths);
        const deliveryMonthIndex = totalInstallmentMonths; // delivery happens at end of project

        // Calculate windowed collection amounts
        const totalSales = result.totalSalesAmount;
        const totalParcialidadesAmount = kpis ? totalSales * (kpis.weightedInstallments / 100) : 0;
        const monthlyInstallmentAmount = totalInstallmentMonths > 0 ? totalParcialidadesAmount / totalInstallmentMonths : 0;
        const parcialidadesInWindow = Math.min(totalParcialidadesAmount, monthlyInstallmentAmount * installmentMonthsInWindow);
        const engancheInWindow = kpis ? totalSales * (kpis.weightedDownPayment / 100) : 0;
        const contraEntregaInWindow = kpis && windowMonths >= deliveryMonthIndex
          ? totalSales * (kpis.weightedDelivery / 100)
          : 0;

        const cashflowData = result.monthlyPL.map((m, idx) => {
          if (kpis) {
            const enganche = m.salesAmount * (kpis.weightedDownPayment / 100);
            // Spread parcialidades evenly across installment months within window
            const parcialidades = idx < installmentMonthsInWindow ? monthlyInstallmentAmount : 0;
            // Contra-entrega only at delivery month
            const contraEntrega = idx === deliveryMonthIndex - 1
              ? totalSales * (kpis.weightedDelivery / 100)
              : 0;
            return { ...m, enganche, parcialidades, contraEntrega };
          }
          return m;
        });

        const pieData = kpis ? [
          { name: 'Enganche', value: engancheInWindow },
          { name: 'Parcialidades', value: parcialidadesInWindow },
          { name: 'Contra-entrega', value: contraEntregaInWindow },
        ] : [];
        const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
        const piePctData = pieTotal > 0 ? pieData.map(d => ({ ...d, pct: (d.value / pieTotal) * 100 })) : [];

        return (
        <div className="space-y-4">
          {kpis && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Distribución de Cobro por Políticas Comerciales
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Cobro en Enganche" value={formatCurrency(engancheInWindow)} tooltip="Monto total cobrado al momento de la venta dentro de la ventana" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <MetricCard
                        label="Cobro en Parcialidades"
                        value={formatCurrency(parcialidadesInWindow)}
                        tooltip={`El cobro en parcialidades se calcula únicamente con base en las ${installmentMonthsInWindow} mensualidades que caen dentro de la ventana de análisis seleccionada (de ${totalInstallmentMonths} meses totales).`}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    El cobro en parcialidades se calcula únicamente con base en las mensualidades que caen dentro de la ventana de análisis seleccionada.
                    <br /><br />
                    <strong>Meses de parcialidades en ventana:</strong> {installmentMonthsInWindow} de {totalInstallmentMonths}
                    <br />
                    <strong>Monto mensual:</strong> {formatCurrency(monthlyInstallmentAmount)}
                  </TooltipContent>
                </Tooltip>
                <MetricCard
                  label="Cobro Contra-entrega"
                  value={formatCurrency(contraEntregaInWindow)}
                  tooltip={windowMonths >= deliveryMonthIndex
                    ? "Monto cobrado al entregar inmueble (la entrega cae dentro de la ventana)"
                    : "La fecha de entrega está fuera de la ventana de análisis seleccionada. No se registra cobro contra-entrega."}
                />
              </div>

              {/* Windowed collection summary */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  <Info className="inline h-3 w-3 mr-1" />
                  Parcialidades: {installmentMonthsInWindow} de {totalInstallmentMonths} meses cubiertos por la ventana
                  ({totalInstallmentMonths > 0 ? ((installmentMonthsInWindow / totalInstallmentMonths) * 100).toFixed(0) : 0}%).
                  {windowMonths < deliveryMonthIndex && ' La contra-entrega queda fuera de esta ventana.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={piePctData.length > 0 ? piePctData : [{ name: 'Sin datos', pct: 100 }]} dataKey="pct" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, pct }) => `${name}: ${pct.toFixed(1)}%`}>
                        {(piePctData.length > 0 ? piePctData : [{ name: 'Sin datos', pct: 100 }]).map((_, i) => (
                          <Cell key={i} fill={CASHFLOW_COLORS[i % CASHFLOW_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                      <Bar dataKey="enganche" name="Enganche" stackId="a" fill={CASHFLOW_COLORS[0]} />
                      <Bar dataKey="parcialidades" name="Parcialidades" stackId="a" fill={CASHFLOW_COLORS[1]} />
                      <Bar dataKey="contraEntrega" name="Contra-entrega" stackId="a" fill={CASHFLOW_COLORS[2]} radius={[3, 3, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.monthlyPL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Bar dataKey="internalCommission" name="Comisión Interna" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="fixedCosts" name="Costos Fijos" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.monthlyPL}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Line type="monotone" dataKey="netProfit" name="Utilidad Neta" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function CompareView({ results, onExport }: {
  results: { scenario: any; result: ScenarioResults }[];
  onExport: (r: ScenarioResults, name: string) => void;
}) {
  if (results.length === 0) return <p className="text-muted-foreground">Selecciona al menos un escenario</p>;

  const metrics = [
    { key: 'totalSalesAmount', label: 'Ventas Totales', format: formatCurrency },
    { key: 'totalCommissionAmount', label: 'Comisión Total', format: formatCurrency },
    { key: 'totalExternalCommission', label: 'Com. Externa', format: formatCurrency },
    { key: 'totalInternalCommission', label: 'Com. Interna', format: formatCurrency },
    { key: 'monthlyFixedCost', label: 'Costo Fijo/mes', format: formatCurrency },
    { key: 'sozuNetProfit', label: 'Utilidad SOZU', format: formatCurrency },
    { key: 'cacCommercial', label: 'CAC Comercial', format: formatCurrency },
  ];

  const chartData = results.map(r => ({
    name: r.scenario.name,
    comisionExterna: r.result.totalExternalCommission,
    comisionInterna: r.result.totalInternalCommission,
    utilidadSOZU: r.result.sozuNetProfit,
  }));

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Métrica</th>
              {results.map(r => <th key={r.scenario.id}>{r.scenario.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => (
              <tr key={m.key}>
                <td className="font-medium">{m.label}</td>
                {results.map(r => (
                  <td key={r.scenario.id} className="font-mono">
                    {m.format((r.result as any)[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
            <Bar dataKey="comisionExterna" name="Com. Externa" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="comisionInterna" name="Com. Interna" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="utilidadSOZU" name="Utilidad SOZU" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
