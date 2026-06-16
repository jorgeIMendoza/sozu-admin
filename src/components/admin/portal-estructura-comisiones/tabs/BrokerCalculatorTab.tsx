import { useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { useSimulator } from '@/store/SimulatorContext';
import MetricCard from '@/components/MetricCard';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Calculator, TrendingUp } from 'lucide-react';

export default function BrokerCalculatorTab() {
  const { projects } = useSimulator();
  const defaultPrice = projects[0]?.averagePrice || 11700000;

  const [unitPrice, setUnitPrice] = useState(defaultPrice);
  const [commPct, setCommPct] = useState(2.5);
  const [units, setUnits] = useState(3);

  const incomePerUnit = unitPrice * (commPct / 100);
  const totalIncome = incomePerUnit * units;

  const tiers = [1, 3, 5, 10, 15, 20];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calculator className="h-5 w-5 text-accent" />
          Calculadora de Ingresos del Broker
        </h2>
        <p className="text-sm text-muted-foreground">Herramienta para demostrar ingresos potenciales a aliados comerciales</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio por Unidad</label>
            <Input
              type="number"
              value={unitPrice}
              onChange={e => setUnitPrice(Number(e.target.value))}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{formatCurrency(unitPrice)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Comisión Broker: {commPct}%</label>
            <Slider
              value={[commPct]}
              onValueChange={v => setCommPct(v[0])}
              min={0.5}
              max={6}
              step={0.1}
              className="mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0.5%</span><span>6%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Unidades Vendidas</label>
            <Input
              type="number"
              value={units}
              onChange={e => setUnits(Math.max(0, Number(e.target.value)))}
              min={0}
              className="font-mono"
            />
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Ingreso por Unidad"
              value={formatCurrency(incomePerUnit)}
              tooltip={`${commPct}% de ${formatCurrency(unitPrice)}`}
              className="bg-accent/5 border-accent/20"
            />
            <MetricCard
              label="Ingreso Total Estimado"
              value={formatCurrency(totalIncome)}
              tooltip={`${units} unidades × ${formatCurrency(incomePerUnit)}`}
              className="bg-accent/5 border-accent/20"
            />
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
              Tabla de Ingresos por Volumen
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unidades</th>
                  <th>Ingreso Total</th>
                  <th>Ingreso Mensual (12m)</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(n => (
                  <tr key={n} className={n === units ? 'bg-accent/5' : ''}>
                    <td className="font-mono font-medium">{n}</td>
                    <td className="font-mono font-semibold">{formatCurrency(incomePerUnit * n)}</td>
                    <td className="font-mono text-muted-foreground">{formatCurrency((incomePerUnit * n) / 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
