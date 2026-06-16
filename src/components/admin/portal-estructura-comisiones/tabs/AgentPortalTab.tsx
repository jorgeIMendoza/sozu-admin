import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  User, TrendingUp, DollarSign, Target, Award, Star,
  ChevronRight, Eye, Zap, Trophy, ArrowUpRight, Wallet,
  BarChart3, Calculator, Info, Clock
} from 'lucide-react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { calculateBrokerCommission } from '@/lib/portal-estructura-comisiones/utils/broker-calculations';
import { formatCurrency } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { DEFAULT_BROKER_CONFIG } from '@/lib/portal-estructura-comisiones/types/broker-incentives';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, AreaChart, Area, Cell
} from 'recharts';

// ─── Mock Data ───
const MOCK_AGENTS = [
  { id: 'a1', name: 'Carlos Mendoza', avatar: 'CM', level: 'Gold', salesCount: 3, totalVolume: 38700000 },
  { id: 'a2', name: 'Ana Rodríguez', avatar: 'AR', level: 'Platinum', salesCount: 5, totalVolume: 62500000 },
  { id: 'a3', name: 'Miguel Torres', avatar: 'MT', level: 'Elite', salesCount: 8, totalVolume: 98400000 },
];

type SaleStatus = 'prospecto' | 'apartado' | 'contrato' | 'pagos' | 'escriturado';
const STATUS_CONFIG: Record<SaleStatus, { label: string; color: string; pct: number }> = {
  prospecto: { label: 'Prospecto', color: 'bg-muted text-muted-foreground', pct: 10 },
  apartado: { label: 'Apartado', color: 'bg-info/10 text-info', pct: 30 },
  contrato: { label: 'Contrato', color: 'bg-warning/10 text-warning', pct: 55 },
  pagos: { label: 'Pagos en proceso', color: 'bg-accent/10 text-accent', pct: 80 },
  escriturado: { label: 'Escriturado', color: 'bg-primary/10 text-primary', pct: 100 },
};

interface MockSale {
  id: string;
  unit: string;
  client: string;
  amount: number;
  status: SaleStatus;
  date: string;
  commission: number;
  downPaymentPct: number;
}

const MOCK_SALES: MockSale[] = [
  { id: 's1', unit: 'MX-204', client: 'García López', amount: 12800000, status: 'escriturado', date: '2025-01-15', commission: 384000, downPaymentPct: 40 },
  { id: 's2', unit: 'MX-512', client: 'Hernández R.', amount: 14200000, status: 'pagos', date: '2025-02-20', commission: 426000, downPaymentPct: 35 },
  { id: 's3', unit: 'MX-308', client: 'Morales G.', amount: 11700000, status: 'contrato', date: '2025-03-10', commission: 292500, downPaymentPct: 30 },
  { id: 's4', unit: 'MX-701', client: 'Vázquez P.', amount: 16500000, status: 'apartado', date: '2025-03-22', commission: 495000, downPaymentPct: 50 },
];

const MOCK_INCOME_DATA = [
  { month: 'Ene', cobrado: 384000, porCobrar: 0 },
  { month: 'Feb', cobrado: 0, porCobrar: 426000 },
  { month: 'Mar', cobrado: 0, porCobrar: 292500 },
  { month: 'Abr', cobrado: 0, porCobrar: 495000 },
  { month: 'May', cobrado: 0, porCobrar: 0 },
  { month: 'Jun', cobrado: 0, porCobrar: 0 },
];

const RANKING = [
  { rank: 1, name: 'Miguel Torres', sales: 8, commission: 2952000, level: 'Elite' },
  { rank: 2, name: 'Ana Rodríguez', sales: 5, commission: 1562500, level: 'Platinum' },
  { rank: 3, name: 'Carlos Mendoza', sales: 3, commission: 1102500, level: 'Gold' },
  { rank: 4, name: 'Laura Sánchez', sales: 3, commission: 936000, level: 'Gold' },
  { rank: 5, name: 'Pedro Ramírez', sales: 2, commission: 580000, level: 'Silver' },
];

const LEVEL_BADGES: Record<string, { bg: string; text: string; icon: typeof Star }> = {
  Silver: { bg: 'bg-muted', text: 'text-muted-foreground', icon: Star },
  Gold: { bg: 'bg-warning/10', text: 'text-warning', icon: Award },
  Platinum: { bg: 'bg-info/10', text: 'text-info', icon: Trophy },
  Elite: { bg: 'bg-accent/10', text: 'text-accent', icon: Zap },
};

export default function AgentPortalTab() {
  const { projects } = useSimulator();
  const [selectedAgent, setSelectedAgent] = useState(MOCK_AGENTS[0].id);
  const agent = MOCK_AGENTS.find(a => a.id === selectedAgent) || MOCK_AGENTS[0];

  // Current volume rules for level progression
  const config = DEFAULT_BROKER_CONFIG;
  const currentRule = config.volumeRules.find(r => r.active && agent.salesCount >= r.minUnits && (r.maxUnits === null || agent.salesCount <= r.maxUnits));
  const nextRule = config.volumeRules.find(r => r.active && r.minUnits > agent.salesCount);
  const salesForNext = nextRule ? nextRule.minUnits - agent.salesCount : 0;
  const progressPct = nextRule ? ((agent.salesCount - (currentRule?.minUnits || 0)) / ((nextRule?.minUnits || 1) - (currentRule?.minUnits || 0))) * 100 : 100;

  // KPIs
  const totalCommission = MOCK_SALES.reduce((s, sale) => s + sale.commission, 0);
  const commissionCobrada = MOCK_SALES.filter(s => s.status === 'escriturado').reduce((s, sale) => s + sale.commission, 0);
  const commissionPendiente = totalCommission - commissionCobrada;
  const ticketPromedio = agent.totalVolume / agent.salesCount;
  const avgDownPayment = MOCK_SALES.reduce((s, sale) => s + sale.downPaymentPct, 0) / MOCK_SALES.length;

  // Simulator
  const [simPrice, setSimPrice] = useState(projects[0]?.averagePrice || 12000000);
  const [simDown, setSimDown] = useState(30);

  const simResult = useMemo(() => {
    return calculateBrokerCommission(config, {
      unitPrice: simPrice,
      unitsSold: agent.salesCount + 1,
      downPaymentPct: simDown,
      period: 'semiannual',
    });
  }, [simPrice, simDown, agent.salesCount]);

  const LevelBadge = ({ level }: { level: string }) => {
    const cfg = LEVEL_BADGES[level] || LEVEL_BADGES.Silver;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
        <Icon className="h-3 w-3" />
        {level}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              {agent.avatar}
            </div>
            Hola, {agent.name.split(' ')[0]}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Tu portal de rendimiento y comisiones en tiempo real</p>
        </div>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Seleccionar agente" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_AGENTS.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Ventas del periodo', value: agent.salesCount.toString(), icon: TrendingUp, accent: true },
          { label: 'Comisión generada', value: formatCurrency(totalCommission), icon: DollarSign },
          { label: 'Comisión pendiente', value: formatCurrency(commissionPendiente), icon: Clock },
          { label: 'Ticket promedio', value: formatCurrency(ticketPromedio), icon: BarChart3 },
          { label: 'Enganche promedio', value: `${avgDownPayment.toFixed(0)}%`, icon: Target },
          { label: 'Nivel comisión', value: `${currentRule?.commissionPct || config.baseCommissionPct}%`, icon: Award },
        ].map((kpi, i) => (
          <Card key={i} className={kpi.accent ? 'border-primary/30 bg-primary/5' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon className={`h-4 w-4 ${kpi.accent ? 'text-primary' : 'text-muted-foreground'}`} />
                {kpi.accent && <ArrowUpRight className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incentives Progress + Level */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Incentivos Activos
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">Tu progreso hacia el siguiente nivel de comisión</p>
            </div>
            <LevelBadge level={agent.level} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Progress bar */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">
                  {currentRule?.commissionPct || config.baseCommissionPct}% → {nextRule?.commissionPct || '—'}%
                </span>
                <span className="text-xs text-muted-foreground">{agent.salesCount} / {nextRule?.minUnits || '∞'} ventas</span>
              </div>
              <Progress value={Math.min(progressPct, 100)} className="h-3 bg-muted" />
              {salesForNext > 0 && (
                <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Te faltan <span className="font-bold">{salesForNext} venta{salesForNext > 1 ? 's' : ''}</span> para subir a {nextRule?.commissionPct}%
                </p>
              )}
            </div>

            {/* Level tiers */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Niveles</p>
              {config.volumeRules.filter(r => r.active).map(rule => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    currentRule?.id === rule.id ? 'bg-primary/10 border border-primary/20 font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span>{rule.name}</span>
                  <span className="font-mono">{rule.commissionPct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="commissions" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="commissions">Mis Comisiones</TabsTrigger>
          <TabsTrigger value="sales">Mis Ventas</TabsTrigger>
          <TabsTrigger value="simulator">Simula tu Comisión</TabsTrigger>
          <TabsTrigger value="income">Flujo de Ingresos</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* ── Commissions Tab ── */}
        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Desglose de Comisiones</CardTitle>
              <CardDescription>Detalle transparente por cada operación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Monto Venta</th>
                      <th>Comisión Base</th>
                      <th>Bono Volumen</th>
                      <th>Bono Monto</th>
                      <th>Bono Enganche</th>
                      <th>Comisión Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SALES.map(sale => {
                      const basePct = currentRule?.commissionPct || config.baseCommissionPct;
                      const baseAmt = sale.amount * (basePct / 100);
                      const volBonus = sale.amount * ((currentRule?.incrementalPct || 0) / 100);
                      const saleBonus = sale.amount >= 15000000 ? sale.amount * 0.0025 : 0;
                      const dpBonus = sale.downPaymentPct >= 50 ? sale.amount * 0.005 : sale.downPaymentPct >= 40 ? sale.amount * 0.0025 : 0;
                      return (
                        <tr key={sale.id}>
                          <td className="font-medium text-foreground">{sale.unit}</td>
                          <td className="font-mono">{formatCurrency(sale.amount)}</td>
                          <td className="font-mono">{formatCurrency(baseAmt)}</td>
                          <td className="font-mono text-primary">{formatCurrency(volBonus)}</td>
                          <td className="font-mono text-info">{formatCurrency(saleBonus)}</td>
                          <td className="font-mono text-warning">{formatCurrency(dpBonus)}</td>
                          <td className="font-mono font-semibold text-foreground">{formatCurrency(sale.commission)}</td>
                          <td>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Eye className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <p className="font-semibold mb-1">Detalle de cálculo</p>
                                <p>Base: {basePct}% × {formatCurrency(sale.amount)}</p>
                                <p>Enganche: {sale.downPaymentPct}%</p>
                                <p>Estatus: {STATUS_CONFIG[sale.status].label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sales Tab ── */}
        <TabsContent value="sales" className="space-y-3">
          {MOCK_SALES.map(sale => {
            const sc = STATUS_CONFIG[sale.status];
            return (
              <Card key={sale.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground font-semibold text-xs">
                        {sale.unit}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{sale.client}</p>
                        <p className="text-xs text-muted-foreground">{sale.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(sale.amount)}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progreso del proceso</span>
                      <span>{sc.pct}%</span>
                    </div>
                    <Progress value={sc.pct} className="h-1.5" />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">Comisión asociada</span>
                    <span className="text-sm font-semibold text-primary tabular-nums">{formatCurrency(sale.commission)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── Simulator Tab ── */}
        <TabsContent value="simulator">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Simula tu Comisión</CardTitle>
              <CardDescription>Estima tus ingresos antes de cerrar una operación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Precio de la unidad</label>
                    <Input
                      type="number"
                      value={simPrice}
                      onChange={e => setSimPrice(Number(e.target.value))}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">{formatCurrency(simPrice)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">% de Enganche: {simDown}%</label>
                    <Slider value={[simDown]} onValueChange={v => setSimDown(v[0])} min={10} max={100} step={5} className="mt-2" />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>10%</span><span>100%</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Resultado Estimado</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-foreground tabular-nums">{formatCurrency(simPrice * (simResult.finalCommission / 100))}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Comisión base</span><span className="font-mono">{simResult.baseCommission}%</span></div>
                      {simResult.volumeBonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Bono volumen</span><span className="font-mono text-primary">+{simResult.volumeBonus}%</span></div>}
                      {simResult.saleAmountBonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Bono monto</span><span className="font-mono text-info">+{simResult.saleAmountBonus}%</span></div>}
                      {simResult.downPaymentBonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Bono enganche</span><span className="font-mono text-warning">+{simResult.downPaymentBonus}%</span></div>}
                      <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Comisión total</span><span className="font-mono">{simResult.finalCommission}%</span></div>
                    </div>
                  </div>
                  {simResult.appliedRules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {simResult.appliedRules.map((rule, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{rule}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Income Flow Tab ── */}
        <TabsContent value="income">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Cobrado</p>
                <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(commissionCobrada)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Por cobrar</p>
                <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(commissionPendiente)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total proyectado</p>
                <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(totalCommission)}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Flujo Mensual de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_INCOME_DATA} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="cobrado" name="Cobrado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="porCobrar" name="Por cobrar" fill="hsl(var(--accent-blue))" radius={[4, 4, 0, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ranking Tab ── */}
        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top Brokers del Semestre</CardTitle>
              <CardDescription>Ranking basado en comisiones generadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {RANKING.map((broker, i) => {
                  const isCurrentAgent = broker.name === agent.name;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                        isCurrentAgent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
                        broker.rank === 1 ? 'bg-warning/10 text-warning' :
                        broker.rank === 2 ? 'bg-muted text-muted-foreground' :
                        broker.rank === 3 ? 'bg-accent-orange/10 text-accent-orange' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {broker.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{broker.name}</p>
                        <p className="text-xs text-muted-foreground">{broker.sales} ventas</p>
                      </div>
                      <LevelBadge level={broker.level} />
                      <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(broker.commission)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
