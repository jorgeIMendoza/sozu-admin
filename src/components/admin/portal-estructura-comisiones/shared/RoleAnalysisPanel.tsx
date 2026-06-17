import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateScenario, formatCurrency, formatPct } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, TrendingUp, Target, BarChart3, Gauge, Info, DollarSign, Percent, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, Tooltip as RTooltip } from 'recharts';
import type { Role, RoleAssignment } from '@/lib/portal-estructura-comisiones/types/simulator';

export interface RoleCardInfo {
  role: Role;
  assignments: RoleAssignment[];
  totalHeadcount: number;
  monthlyCost: number;
  annualCommission: number;
}

// Market benchmark data by role
const SALARY_BENCHMARKS: Record<string, { min: number; avg: number; max: number }> = {
  'Director SOZU': { min: 60000, avg: 80000, max: 120000 },
  'Marketing': { min: 20000, avg: 35000, max: 55000 },
  'Alianzas/Onboarding': { min: 25000, avg: 40000, max: 60000 },
  'Data & IA': { min: 30000, avg: 50000, max: 80000 },
  'Director Comercial Proyecto': { min: 40000, avg: 55000, max: 90000 },
  'Admin Comercial': { min: 15000, avg: 25000, max: 40000 },
  'Asesor de Ventas': { min: 12000, avg: 20000, max: 35000 },
};

const COMMISSION_BENCHMARKS: Record<string, { avg: number; high: number; top: number }> = {
  'Director SOZU': { avg: 0.3, high: 0.5, top: 0.8 },
  'Alianzas/Onboarding': { avg: 0.2, high: 0.4, top: 0.6 },
  'Director Comercial Proyecto': { avg: 0.5, high: 0.8, top: 1.2 },
  'Admin Comercial': { avg: 0.2, high: 0.4, top: 0.6 },
  'Asesor de Ventas': { avg: 1.2, high: 1.5, top: 2.0 },
};

const ROLE_KPIS: Record<string, string[]> = {
  'Director SOZU': ['Margen SOZU mensual', 'Retención de aliados', 'NPS comercial', 'ROI estructura comercial'],
  'Marketing': ['Leads generados', 'Costo por lead', 'Conversión de leads', 'Awareness de marca'],
  'Alianzas/Onboarding': ['Brokers activos', 'Tiempo de onboarding', 'Retención de aliados', 'Ventas por aliado'],
  'Data & IA': ['Precisión de forecast', 'Dashboards activos', 'Tiempo de reporte', 'Data quality score'],
  'Director Comercial Proyecto': ['Absorción mensual', 'Ventas totales proyecto', 'CAC comercial', 'Ventas por asesor'],
  'Admin Comercial': ['Tiempo de gestión', 'Contratos procesados', 'Errores documentales', 'Satisfacción cliente'],
  'Asesor de Ventas': ['Unidades vendidas', 'Conversión de leads', 'Ticket promedio', 'Tiempo de cierre'],
};

interface Props {
  info: RoleCardInfo | null;
  open: boolean;
  onClose: () => void;
}

export default function RoleAnalysisPanel({ info, open, onClose }: Props) {
  const { projects, scenarios, roles, channels } = useSimulator();
  const [simSalary, setSimSalary] = useState<number | null>(null);
  const [simCommPct, setSimCommPct] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

  const scenario = scenarios[0];
  const result = useMemo(() => {
    if (!scenario) return null;
    return calculateScenario(scenario, projects, roles, channels);
  }, [scenario, projects, roles, channels]);

  // Reset simulation when role changes
  const avgSalary = info?.assignments.length
    ? info.assignments.reduce((s, a) => s + a.baseSalary, 0) / info.assignments.length
    : 0;

  const avgPrice = projects.length > 0
    ? projects.reduce((s, p) => s + p.averagePrice, 0) / projects.length
    : 11700000;

  const { role } = info || { role: { name: '', type: 'operative' as const, belongsTo: 'project' as const, participatesInCommission: false, id: '' } };
  const salaryBench = SALARY_BENCHMARKS[role.name] || { min: avgSalary * 0.7, avg: avgSalary, max: avgSalary * 1.5 };
  const commBench = COMMISSION_BENCHMARKS[role.name];
  const kpis = ROLE_KPIS[role.name] || ['Productividad', 'Calidad de entrega', 'Colaboración'];

  // Commission % for this role (weighted average across channels)
  const roleRules = scenario?.commissionRules.filter(r => r.roleId === role.id) || [];
  const avgCommPct = roleRules.length > 0
    ? roleRules.reduce((s, r) => s + r.percentage, 0) / roleRules.length
    : 0;

  const effectiveCommPct = simCommPct ?? avgCommPct;
  const effectiveSalary = simSalary ?? avgSalary;

  // Income potential
  const incomePerUnit = avgPrice * (effectiveCommPct / 100);
  const estSalesPerYear = role.type === 'operative' && role.belongsTo === 'project' ? 6 : 12;
  const hc = info?.totalHeadcount || 0;
  const annualCommissionEst = incomePerUnit * estSalesPerYear * hc;

  // Structural impact
  const benefitsPct = info?.assignments[0]?.benefitsPct || 30;
  const annualCostRole = effectiveSalary * 12 * hc * (1 + benefitsPct / 100);
  const totalCommercialCost = result ? result.monthlyFixedCost * 12 + result.totalExternalCommission + result.totalInternalCommission : 1;
  const pctOfCommercialCost = (annualCostRole / totalCommercialCost) * 100;
  const pctOfTotalCommission = result && info ? (info.annualCommission / result.totalCommissionAmount) * 100 : 0;

  // Salary percentile
  const salaryPercentile = Math.min(100, Math.max(0,
    ((effectiveSalary - salaryBench.min) / (salaryBench.max - salaryBench.min)) * 100
  ));

  // Simulation impact
  const simResult = useMemo(() => {
    if (!simulating || !scenario) return null;
    const modifiedAssignments = scenario.roleAssignments.map(ra =>
      ra.roleId === role.id ? { ...ra, baseSalary: effectiveSalary } : ra
    );
    const modifiedRules = scenario.commissionRules.map(r =>
      r.roleId === role.id ? { ...r, percentage: effectiveCommPct } : r
    );
    const modScenario = { ...scenario, roleAssignments: modifiedAssignments, commissionRules: modifiedRules };
    return calculateScenario(modScenario, projects, roles, channels);
  }, [simulating, effectiveSalary, effectiveCommPct, scenario, projects, roles, channels, role.id]);

  if (!info) return null;

  const typeLabels = { strategic: 'Estratégico', operative: 'Operativo', support: 'Soporte' };

  // Salary chart data
  const salaryChartData = [
    { name: 'Mín', value: salaryBench.min, fill: 'hsl(var(--muted-foreground))' },
    { name: 'Promedio', value: salaryBench.avg, fill: 'hsl(var(--muted-foreground))' },
    { name: 'Máximo', value: salaryBench.max, fill: 'hsl(var(--muted-foreground))' },
    { name: 'SOZU', value: effectiveSalary, fill: 'hsl(var(--primary))' },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setSimulating(false); setSimSalary(null); setSimCommPct(null); } }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Análisis del Rol
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* 1. ROLE SUMMARY */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge>{role.belongsTo === 'sozu_central' ? 'SOZU Central' : 'Proyecto'}</Badge>
              <Badge variant="secondary">{typeLabels[role.type]}</Badge>
              {role.participatesInCommission && <Badge variant="outline" className="border-primary text-primary">Comisión</Badge>}
            </div>
            <h3 className="text-xl font-bold">{role.name}</h3>

            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={<Users className="h-4 w-4" />} label="Headcount" value={`${info.totalHeadcount}`} />
              <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Sueldo Base" value={formatCurrency(avgSalary)} />
              <KpiCard icon={<Gauge className="h-4 w-4" />} label="Costo Mensual" value={formatCurrency(info.monthlyCost)} />
              <KpiCard icon={<Building2 className="h-4 w-4" />} label="Área" value={role.belongsTo === 'sozu_central' ? 'Central' : 'Proyecto'} />
            </div>
          </section>

          {/* 2. SALARY BENCHMARK */}
          <section className="space-y-2">
            <SectionTitle icon={<BarChart3 className="h-4 w-4" />} title="Benchmark Sueldo" tooltip="Comparación del sueldo actual vs rangos del mercado inmobiliario" />
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salaryChartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                    {salaryChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">Percentil estimado:</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 rounded-full bg-muted relative overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${salaryPercentile}%` }} />
                </div>
                <span className="font-semibold">{salaryPercentile.toFixed(0)}%</span>
              </div>
            </div>
          </section>

          {/* 3. COMMISSION BENCHMARK */}
          {commBench && role.participatesInCommission && (
            <section className="space-y-2">
              <SectionTitle icon={<Percent className="h-4 w-4" />} title="Benchmark Comisión" tooltip="Comparación de la comisión asignada vs el mercado" />
              <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                <BenchmarkBar label="Promedio mercado" value={commBench.avg} max={commBench.top * 1.2} color="hsl(var(--muted-foreground))" />
                <BenchmarkBar label="Alto mercado" value={commBench.high} max={commBench.top * 1.2} color="hsl(var(--muted-foreground))" />
                <BenchmarkBar label="Top performer" value={commBench.top} max={commBench.top * 1.2} color="hsl(var(--muted-foreground))" />
                <BenchmarkBar label="SOZU actual" value={effectiveCommPct} max={commBench.top * 1.2} color="hsl(var(--primary))" highlight />
              </div>
            </section>
          )}

          {/* 4. INCOME POTENTIAL */}
          {role.participatesInCommission && (
            <section className="space-y-2">
              <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Ingreso Potencial" tooltip="Estimación basada en precio promedio, comisión y ventas esperadas" />
              <div className="grid grid-cols-3 gap-2">
                <KpiCard label="Ingreso/Venta" value={formatCurrency(incomePerUnit)} small />
                <KpiCard label="Ventas est./año" value={`${estSalesPerYear}`} small />
                <KpiCard label="Ingreso Anual" value={formatCurrency(annualCommissionEst)} small highlight />
              </div>
            </section>
          )}

          {/* 5. STRUCTURAL IMPACT */}
          <section className="space-y-2">
            <SectionTitle icon={<Target className="h-4 w-4" />} title="Impacto en Estructura" tooltip="Peso del rol en el costo comercial total" />
            <div className="rounded-lg bg-muted/40 p-3 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Costo anual del rol</span>
                <span className="font-mono font-semibold">{formatCurrency(annualCostRole)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">% del costo comercial</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-muted relative overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(pctOfCommercialCost, 100)}%` }} />
                  </div>
                  <span className="font-semibold">{formatPct(pctOfCommercialCost)}</span>
                </div>
              </div>
              {role.participatesInCommission && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">% de comisión total</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded-full bg-muted relative overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pctOfTotalCommission, 100)}%` }} />
                    </div>
                    <span className="font-semibold">{formatPct(pctOfTotalCommission)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 6. KPIs */}
          <section className="space-y-2">
            <SectionTitle icon={<Gauge className="h-4 w-4" />} title="KPIs Sugeridos" tooltip="Indicadores clave para evaluar el desempeño del rol" />
            <div className="grid grid-cols-2 gap-2">
              {kpis.map(kpi => (
                <div key={kpi} className="rounded-lg border bg-card px-3 py-2 text-xs flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {kpi}
                </div>
              ))}
            </div>
          </section>

          {/* 8. SIMULATION */}
          <section className="space-y-3 border-t pt-4">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Simular Ajuste" tooltip="Modifica sueldo o comisión y ve el impacto en métricas clave" />
            
            {!simulating ? (
              <Button onClick={() => { setSimulating(true); setSimSalary(avgSalary); setSimCommPct(avgCommPct); }} className="w-full">
                Simular ajuste
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sueldo base</span>
                    <span className="font-mono font-semibold">{formatCurrency(effectiveSalary)}</span>
                  </div>
                  <Slider
                    value={[effectiveSalary]}
                    min={salaryBench.min * 0.5}
                    max={salaryBench.max * 1.3}
                    step={1000}
                    onValueChange={([v]) => setSimSalary(v)}
                  />
                </div>

                {role.participatesInCommission && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Comisión %</span>
                      <span className="font-mono font-semibold">{effectiveCommPct.toFixed(2)}%</span>
                    </div>
                    <Slider
                      value={[effectiveCommPct * 100]}
                      min={0}
                      max={500}
                      step={5}
                      onValueChange={([v]) => setSimCommPct(v / 100)}
                    />
                  </div>
                )}

                {simResult && result && (
                  <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impacto</h5>
                    <ImpactRow label="Margen SOZU" original={result.sozuMargin} simulated={simResult.sozuMargin} />
                    <ImpactRow label="CAC Comercial" original={result.cacCommercial} simulated={simResult.cacCommercial} />
                    <ImpactRow label="Costo Comercial" original={result.monthlyFixedCost * 12} simulated={simResult.monthlyFixedCost * 12} />
                    <ImpactRow label="Utilidad SOZU" original={result.sozuNetProfit} simulated={simResult.sozuNetProfit} />
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={() => { setSimulating(false); setSimSalary(null); setSimCommPct(null); }} className="w-full">
                  Cerrar simulación
                </Button>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Sub-components

function KpiCard({ icon, label, value, small, highlight }: { icon?: React.ReactNode; label: string; value: string; small?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${small ? 'p-2' : ''} ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      {icon && <div className="text-primary mb-1">{icon}</div>}
      <div className={`font-mono font-bold ${small ? 'text-sm' : 'text-base'}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function SectionTitle({ icon, title, tooltip }: { icon: React.ReactNode; title: string; tooltip: string }) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h4 className="text-sm font-semibold">{title}</h4>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function BenchmarkBar({ label, value, max, color, highlight }: { label: string; value: number; max: number; color: string; highlight?: boolean }) {
  const width = (value / max) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className={highlight ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
        <span className={`font-mono ${highlight ? 'font-bold' : ''}`}>{value.toFixed(2)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted relative overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ImpactRow({ label, original, simulated }: { label: string; original: number; simulated: number }) {
  const diff = simulated - original;
  const isPositive = diff >= 0;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono">{formatCurrency(simulated)}</span>
        <span className={`font-mono text-[10px] ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{formatCurrency(diff)}
        </span>
      </div>
    </div>
  );
}
