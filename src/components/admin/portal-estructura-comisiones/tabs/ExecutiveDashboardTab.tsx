import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInventory } from '@/store/InventoryContext';
import { useSimulator } from '@/store/SimulatorContext';
import { useCompetitors } from '@/store/CompetitorsContext';
import {
  Building2, Package, CheckCircle2, Ban, DollarSign, TrendingUp,
  Target, Wallet, Users, ArrowRight, Layers, Compass,
} from 'lucide-react';

interface Props {
  onTabChange: (tab: string) => void;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n.toLocaleString('es-MX')}`;

export default function ExecutiveDashboardTab({ onTabChange }: Props) {
  const { units } = useInventory();
  const { projects, scenarios, channels } = useSimulator();
  const { competitors } = useCompetitors();

  const kpis = useMemo(() => {
    const total = units.length;
    const available = units.filter(u => u.status === 'available').length;
    const sold = units.filter(u => u.status === 'sold').length;
    const blocked = units.filter(u => u.status === 'blocked').length;
    const totalValue = units.reduce((s, u) => s + u.currentPrice, 0);
    const totalSqm = units.reduce((s, u) => s + (u.sqmSellable ?? u.sqm ?? 0), 0);
    const avgPricePerSqm = totalSqm > 0 ? totalValue / totalSqm : 0;
    const marketAvg = competitors.length
      ? competitors.reduce((s, c) => s + c.pricePerSqm, 0) / competitors.length
      : 0;
    const monthlyAbsorption = projects.reduce((s, p) => s + (p.monthlyAbsorption ?? 0), 0);
    return { total, available, sold, blocked, totalValue, avgPricePerSqm, marketAvg, monthlyAbsorption };
  }, [units, projects, competitors]);

  const hasInventory = kpis.total > 0;

  return (
    <div className="space-y-6">
      {/* Hero — dos accesos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <button
          onClick={() => onTabChange('structure')}
          className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-secondary/40 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3"><Users className="h-6 w-6 text-primary" /></div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">Estructura e Incentivos Comerciales</h3>
              <p className="text-sm text-muted-foreground mt-1">Roles, canales, comisiones, escenarios y motor de incentivos.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </button>
        <button
          onClick={() => onTabChange('inventory-advanced')}
          className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-secondary/40 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3"><Compass className="h-6 w-6 text-primary" /></div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">Command Center de Dirección</h3>
              <p className="text-sm text-muted-foreground mt-1">Inventario real, precios, competitividad y simuladores financieros.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={Package} label="Total unidades" value={kpis.total.toString()} />
        <KpiTile icon={CheckCircle2} label="Disponibles" value={kpis.available.toString()} tone="success" />
        <KpiTile icon={Building2} label="Vendidas" value={kpis.sold.toString()} tone="muted" />
        <KpiTile icon={Ban} label="Bloqueadas" value={kpis.blocked.toString()} tone="warning" />
        <KpiTile icon={DollarSign} label="Valor inventario" value={fmtMoney(kpis.totalValue)} />
        <KpiTile icon={Layers} label="Precio prom. / m²" value={kpis.avgPricePerSqm ? fmtMoney(kpis.avgPricePerSqm) : '—'} />
        <KpiTile icon={TrendingUp} label="Absorción / mes" value={`${kpis.monthlyAbsorption} u`} />
        <KpiTile
          icon={Target}
          label="vs mercado"
          value={kpis.marketAvg && kpis.avgPricePerSqm ? `${(((kpis.avgPricePerSqm - kpis.marketAvg) / kpis.marketAvg) * 100).toFixed(1)}%` : '—'}
          tone={kpis.marketAvg && kpis.avgPricePerSqm ? (kpis.avgPricePerSqm > kpis.marketAvg * 1.05 ? 'warning' : 'success') : 'muted'}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard title="Inventario y Precios" description="Carga CSV, vistas por torre y matriz de precios." cta="Ir al inventario" onClick={() => onTabChange('inventory-advanced')} icon={Package} />
        <QuickCard title="Competitividad de Mercado" description="Benchmarks de competidores con semáforo automático." cta="Ver benchmark" onClick={() => onTabChange('competitors-benchmark')} icon={Target} />
        <QuickCard title="Comisiones y Escenarios" description="Motor de comisiones por canal y escenario." cta="Abrir motor" onClick={() => onTabChange('commissions')} icon={Wallet} />
      </div>

      {!hasInventory && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay inventario cargado. Sube tu primer CSV en <span className="font-medium text-foreground">Inventario y Precios</span> para activar todos los KPIs reales.
            </p>
            <Button className="mt-4" onClick={() => onTabChange('inventory-advanced')}>
              Cargar inventario
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Context summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Proyectos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{projects.length}</p>
            <p className="text-xs text-muted-foreground mt-1">en simulación</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Escenarios activos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{scenarios.length}</p>
            <p className="text-xs text-muted-foreground mt-1">configurados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Canales</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {channels.filter(c => c.active).slice(0, 6).map(c => (
                <Badge key={c.id} variant="secondary" className="text-xs">{c.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = 'default' }: {
  icon: any; label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  const toneClasses = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-semibold mt-2 ${toneClasses}`}>{value}</p>
    </div>
  );
}

function QuickCard({ title, description, cta, onClick, icon: Icon }: {
  title: string; description: string; cta: string; onClick: () => void; icon: any;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <Button variant="outline" size="sm" onClick={onClick}>{cta}</Button>
      </CardContent>
    </Card>
  );
}
