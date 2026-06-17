import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MetricCard from '../shared/MetricCard';
import { formatCurrency, formatPct } from '@/lib/portal-estructura-comisiones/utils/calculations';

interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  avgPrice: number;
  totalCommPct: number;
  externalPct: number;
  roles: { name: string; pct: number }[];
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'inmobiliaria',
    name: 'Inmobiliaria',
    description: 'Venta directa con equipo comercial interno',
    avgPrice: 11700000,
    totalCommPct: 6,
    externalPct: 0,
    roles: [
      { name: 'Director SOZU', pct: 0.4 },
      { name: 'Director Comercial Proyecto', pct: 0.5 },
      { name: 'Alianzas', pct: 0.1 },
      { name: 'Admin Comercial', pct: 0.2 },
      { name: 'Asesor', pct: 1.5 },
      { name: 'Coordinador', pct: 0.3 },
    ],
  },
  {
    id: 'broker',
    name: 'Broker independiente',
    description: 'Venta a través de broker externo certificado',
    avgPrice: 11700000,
    totalCommPct: 6,
    externalPct: 2.5,
    roles: [
      { name: 'Director SOZU', pct: 0.3 },
      { name: 'Director Comercial Proyecto', pct: 0.4 },
      { name: 'Alianzas', pct: 0.1 },
      { name: 'Admin Comercial', pct: 0.2 },
      { name: 'Coordinador', pct: 0.2 },
    ],
  },
  {
    id: 'embajador',
    name: 'Embajador',
    description: 'Canal de referidos con comisión variable',
    avgPrice: 11700000,
    totalCommPct: 6,
    externalPct: 1.0,
    roles: [
      { name: 'Director SOZU', pct: 0.4 },
      { name: 'Director Comercial Proyecto', pct: 0.5 },
      { name: 'Alianzas', pct: 0.2 },
      { name: 'Admin Comercial', pct: 0.2 },
      { name: 'Asesor', pct: 1.2 },
      { name: 'Coordinador', pct: 0.2 },
    ],
  },
  {
    id: 'referido',
    name: 'Referido',
    description: 'Venta por referido con bono fijo',
    avgPrice: 11700000,
    totalCommPct: 6,
    externalPct: 0.5,
    roles: [
      { name: 'Director SOZU', pct: 0.4 },
      { name: 'Director Comercial Proyecto', pct: 0.5 },
      { name: 'Alianzas', pct: 0.15 },
      { name: 'Admin Comercial', pct: 0.2 },
      { name: 'Asesor', pct: 1.5 },
      { name: 'Coordinador', pct: 0.25 },
    ],
  },
  {
    id: 'canal-interno',
    name: 'Canal interno',
    description: 'Equipo de ventas 100% interno',
    avgPrice: 11700000,
    totalCommPct: 6,
    externalPct: 0,
    roles: [
      { name: 'Director SOZU', pct: 0.5 },
      { name: 'Director Comercial Proyecto', pct: 0.6 },
      { name: 'Alianzas', pct: 0.1 },
      { name: 'Admin Comercial', pct: 0.2 },
      { name: 'Asesor', pct: 1.8 },
      { name: 'Coordinador', pct: 0.3 },
    ],
  },
];

const DONUT_COLORS = [
  'hsl(143, 33%, 51%)',   // sozu green
  'hsl(0, 0%, 0%)',       // black
  'hsl(0, 0%, 42%)',      // gray
  'hsl(210, 92%, 45%)',   // blue
  'hsl(38, 92%, 50%)',    // warning
  'hsl(0, 72%, 51%)',     // red
  'hsl(280, 60%, 50%)',   // purple
  'hsl(170, 50%, 45%)',   // teal
];

export default function DistributionSimulatorTab() {
  const [selectedId, setSelectedId] = useState('inmobiliaria');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [customOverrides, setCustomOverrides] = useState<Record<string, Record<number, number>>>({});
  const [inputOverrides, setInputOverrides] = useState<Record<string, { avgPrice?: number; totalCommPct?: number; externalPct?: number }>>({});

  const getScenario = (id: string) => {
    const preset = SCENARIO_PRESETS.find(s => s.id === id)!;
    const overrides = inputOverrides[id] || {};
    const roleOverrides = customOverrides[id] || {};
    return {
      ...preset,
      avgPrice: overrides.avgPrice ?? preset.avgPrice,
      totalCommPct: overrides.totalCommPct ?? preset.totalCommPct,
      externalPct: overrides.externalPct ?? preset.externalPct,
      roles: preset.roles.map((r, i) => ({
        ...r,
        pct: roleOverrides[i] ?? r.pct,
      })),
    };
  };

  const scenario = useMemo(() => getScenario(selectedId), [selectedId, customOverrides, inputOverrides]);

  const calc = useMemo(() => {
    const totalCommAmt = scenario.avgPrice * (scenario.totalCommPct / 100);
    const externalAmt = scenario.avgPrice * (scenario.externalPct / 100);
    const internalPct = scenario.totalCommPct - scenario.externalPct;
    const roleDetails = scenario.roles.map(r => ({
      name: r.name,
      pct: r.pct,
      amount: scenario.avgPrice * (r.pct / 100),
    }));
    const totalRolesAmt = roleDetails.reduce((s, r) => s + r.amount, 0);
    const sozuRemainder = totalCommAmt - externalAmt - totalRolesAmt;
    const costCommercialPct = scenario.totalCommPct;

    return { totalCommAmt, externalAmt, internalPct, roleDetails, totalRolesAmt, sozuRemainder, costCommercialPct };
  }, [scenario]);

  const donutData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    if (calc.externalAmt > 0) data.push({ name: 'Comisión externa', value: calc.externalAmt });
    calc.roleDetails.forEach(r => data.push({ name: r.name, value: r.amount }));
    if (calc.sozuRemainder > 0) data.push({ name: 'Remanente SOZU', value: calc.sozuRemainder });
    return data;
  }, [calc]);

  const updateRolePct = (index: number, value: number) => {
    setCustomOverrides(prev => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || {}), [index]: value },
    }));
  };

  const updateInput = (field: 'avgPrice' | 'totalCommPct' | 'externalPct', value: number) => {
    setInputOverrides(prev => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || {}), [field]: value },
    }));
  };

  // Comparison data
  const compareData = useMemo(() => {
    if (!compareId) return null;
    const s = getScenario(compareId);
    const totalComm = s.avgPrice * (s.totalCommPct / 100);
    const extAmt = s.avgPrice * (s.externalPct / 100);
    const rolesAmt = s.roles.reduce((acc, r) => acc + s.avgPrice * (r.pct / 100), 0);
    const remainder = totalComm - extAmt - rolesAmt;
    return {
      name: s.name,
      totalComm,
      extAmt,
      rolesAmt,
      remainder,
      costPct: s.totalCommPct,
    };
  }, [compareId, customOverrides, inputOverrides]);

  const barData = useMemo(() => {
    if (!compareData) return [];
    return [
      {
        metric: 'Comisión equipo',
        [scenario.name]: calc.totalRolesAmt,
        [compareData.name]: compareData.rolesAmt,
      },
      {
        metric: 'Comisión externa',
        [scenario.name]: calc.externalAmt,
        [compareData.name]: compareData.extAmt,
      },
      {
        metric: 'Remanente SOZU',
        [scenario.name]: Math.max(0, calc.sozuRemainder),
        [compareData.name]: Math.max(0, compareData.remainder),
      },
    ];
  }, [calc, compareData, scenario.name]);

  return (
    <div className="space-y-8">
      {/* Scenario Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="metric-label mb-2 block">Escenario</label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-input bg-card px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              {SCENARIO_PRESETS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{scenario.description}</p>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="metric-label mb-1.5 block">Precio unidad</label>
            <Input
              type="number"
              value={scenario.avgPrice}
              onChange={e => updateInput('avgPrice', Number(e.target.value))}
              className="text-sm font-mono"
            />
          </div>
          <div>
            <label className="metric-label mb-1.5 block">Comisión total %</label>
            <Input
              type="number"
              step="0.1"
              value={scenario.totalCommPct}
              onChange={e => updateInput('totalCommPct', Number(e.target.value))}
              className="text-sm font-mono"
            />
          </div>
          <div>
            <label className="metric-label mb-1.5 block">Comisión ext %</label>
            <Input
              type="number"
              step="0.1"
              value={scenario.externalPct}
              onChange={e => updateInput('externalPct', Number(e.target.value))}
              className="text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Comisión total"
          value={formatCurrency(calc.totalCommAmt)}
          tooltip="Monto total de comisión por venta"
        />
        <MetricCard
          label="Comisión externa"
          value={formatCurrency(calc.externalAmt)}
          tooltip="Monto destinado a brokers/referidos externos"
        />
        <MetricCard
          label="Equipo comercial"
          value={formatCurrency(calc.totalRolesAmt)}
          tooltip="Suma de comisiones asignadas a roles internos"
        />
        <MetricCard
          label="Remanente SOZU"
          value={formatCurrency(Math.max(0, calc.sozuRemainder))}
          tooltip="Monto no asignado retenido por SOZU"
        />
      </div>

      {/* Donut + Role Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Distribución de comisión</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <ReTooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(0,0%,90%)', fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Role Table */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Comisión por rol</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th className="text-right">% Comisión</th>
                <th className="text-right">Por venta</th>
              </tr>
            </thead>
            <tbody>
              {scenario.roles.map((role, i) => (
                <tr key={i}>
                  <td className="font-medium text-foreground">{role.name}</td>
                  <td className="text-right">
                    <Input
                      type="number"
                      step="0.05"
                      value={role.pct}
                      onChange={e => updateRolePct(i, Number(e.target.value))}
                      className="w-20 text-right text-xs font-mono h-7 ml-auto"
                    />
                  </td>
                  <td className="text-right font-mono text-sm">{formatCurrency(calc.roleDetails[i].amount)}</td>
                </tr>
              ))}
              {calc.externalAmt > 0 && (
                <tr className="border-t-2 border-border">
                  <td className="font-medium text-muted-foreground">Comisión externa</td>
                  <td className="text-right font-mono text-xs text-muted-foreground">{formatPct(scenario.externalPct)}</td>
                  <td className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(calc.externalAmt)}</td>
                </tr>
              )}
              {calc.sozuRemainder > 0 && (
                <tr>
                  <td className="font-medium text-muted-foreground">Remanente SOZU</td>
                  <td className="text-right font-mono text-xs text-muted-foreground">—</td>
                  <td className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(calc.sozuRemainder)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/10">
                <td className="font-semibold text-foreground">Total</td>
                <td className="text-right font-mono text-xs font-semibold">{formatPct(scenario.totalCommPct)}</td>
                <td className="text-right font-mono text-sm font-semibold">{formatCurrency(calc.totalCommAmt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Scenario Comparator */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Comparador de escenarios</h3>
          <div className="relative">
            <select
              value={compareId || ''}
              onChange={e => setCompareId(e.target.value || null)}
              className="appearance-none rounded-lg border border-input bg-background px-3 py-1.5 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="">Seleccionar escenario…</option>
              {SCENARIO_PRESETS.filter(s => s.id !== selectedId).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        {compareData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary cards */}
            <div className="lg:col-span-1 space-y-3">
              {[
                { label: 'Costo comercial', a: formatPct(calc.costCommercialPct), b: formatPct(compareData.costPct) },
                { label: 'Equipo comercial', a: formatCurrency(calc.totalRolesAmt), b: formatCurrency(compareData.rolesAmt) },
                { label: 'Remanente SOZU', a: formatCurrency(Math.max(0, calc.sozuRemainder)), b: formatCurrency(Math.max(0, compareData.remainder)) },
              ].map((row, i) => (
                <div key={i} className="rounded-lg border border-border p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-foreground font-medium">{row.a}</span>
                    <span className="text-muted-foreground/40">vs</span>
                    <span className="text-foreground font-medium">{row.b}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar Chart */}
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                  <ReTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={scenario.name} fill="hsl(143, 33%, 51%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={compareData.name} fill="hsl(0, 0%, 0%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Selecciona un segundo escenario para comparar la distribución de comisiones.
          </p>
        )}
      </div>
    </div>
  );
}
