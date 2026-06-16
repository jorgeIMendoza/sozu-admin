import { useMemo } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Info, HelpCircle } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import type { CommercialPolicy, WeightedCollectionKPIs } from '@/types/simulator';
import { formatPct } from '@/lib/calculations';

export function calculateWeightedKPIs(policies: CommercialPolicy[]): WeightedCollectionKPIs {
  let weightedDownPayment = 0;
  let weightedInstallments = 0;
  let weightedDelivery = 0;

  for (const p of policies) {
    const w = p.mixPct / 100;
    weightedDownPayment += p.downPaymentPct * w;
    weightedInstallments += p.installmentsPct * w;
    weightedDelivery += p.deliveryPct * w;
  }

  return {
    weightedDownPayment,
    weightedInstallments,
    weightedDelivery,
    avgInitialCollection: weightedDownPayment,
    avgDeferredCollection: weightedInstallments,
    avgFinalCollection: weightedDelivery,
  };
}

export default function CommercialPoliciesPanel() {
  const { commercialPolicies, updateCommercialPolicies } = useSimulator();
  const { enabled, policies } = commercialPolicies;

  const updatePolicy = (id: string, field: keyof CommercialPolicy, value: string | number) => {
    const prev = policies.find(x => x.id === id);
    const parsedValue = typeof value === 'string' && field !== 'name' ? parseFloat(value) || 0 : value;
    const updated = policies.map(p =>
      p.id === id ? { ...p, [field]: parsedValue } : p
    );
    let nextHistory = commercialPolicies.discountHistory || [];
    if (field === 'discountPct' && prev && typeof parsedValue === 'number' && parsedValue !== prev.discountPct) {
      nextHistory = [
        {
          id: crypto.randomUUID(),
          policyId: prev.id,
          policyName: prev.name,
          previousDiscount: prev.discountPct ?? 0,
          newDiscount: parsedValue,
          user: 'Admin',
          timestamp: new Date().toISOString(),
        },
        ...nextHistory,
      ].slice(0, 50);
    }
    updateCommercialPolicies({ ...commercialPolicies, policies: updated, discountHistory: nextHistory });
  };

  const toggleEnabled = (val: boolean) => {
    updateCommercialPolicies({ ...commercialPolicies, enabled: val });
  };

  const validations = useMemo(() => {
    const policyErrors: Record<string, string | null> = {};
    for (const p of policies) {
      const sum = p.downPaymentPct + p.installmentsPct + p.deliveryPct;
      if (Math.abs(sum - 100) > 0.01) {
        policyErrors[p.id] = `Suma = ${sum.toFixed(1)}% (debe ser 100%)`;
      } else {
        policyErrors[p.id] = null;
      }
    }
    const mixTotal = policies.reduce((s, p) => s + p.mixPct, 0);
    const mixValid = Math.abs(mixTotal - 100) < 0.01;
    return { policyErrors, mixTotal, mixValid };
  }, [policies]);

  const kpis = useMemo(() => calculateWeightedKPIs(policies), [policies]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Políticas Comerciales</h3>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Las políticas comerciales permiten modelar cómo se distribuye el cobro de las ventas entre enganche, parcialidades y contra-entrega. El mix define cuánto pesa cada política en el resultado financiero total.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Aplicar a todos los escenarios</span>
          <Switch checked={enabled} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      {/* Editable table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left">Política</th>
              <th className="text-center">% Enganche</th>
              <th className="text-center">% Parcialidades</th>
              <th className="text-center">% Contra-entrega</th>
              <th className="text-center">Subtotal</th>
              <th className="text-center">Descuento</th>
              <th className="text-center">% Mix de Uso</th>
              <th className="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {policies.map(p => {
              const rowSum = p.downPaymentPct + p.installmentsPct + p.deliveryPct;
              const rowValid = Math.abs(rowSum - 100) < 0.01;
              const discount = p.discountPct ?? 0;
              const discountHigh = discount > 5;
              return (
                <tr key={p.id} className={!rowValid ? 'bg-destructive/5' : ''}>
                  <td>
                    <Input
                      value={p.name}
                      onChange={e => updatePolicy(p.id, 'name', e.target.value)}
                      className="h-8 text-sm w-40"
                    />
                  </td>
                  <td className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={p.downPaymentPct}
                      onChange={e => updatePolicy(p.id, 'downPaymentPct', e.target.value)}
                      className="h-8 text-sm w-20 mx-auto text-center font-mono"
                    />
                  </td>
                  <td className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={p.installmentsPct}
                      onChange={e => updatePolicy(p.id, 'installmentsPct', e.target.value)}
                      className="h-8 text-sm w-20 mx-auto text-center font-mono"
                    />
                  </td>
                  <td className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={p.deliveryPct}
                      onChange={e => updatePolicy(p.id, 'deliveryPct', e.target.value)}
                      className="h-8 text-sm w-20 mx-auto text-center font-mono"
                    />
                  </td>
                  <td className="text-center">
                    <span className={`font-mono text-sm font-semibold ${rowValid ? 'text-primary' : 'text-destructive'}`}>
                      {rowSum.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={discount}
                        onChange={e => updatePolicy(p.id, 'discountPct', e.target.value)}
                        className={`h-8 text-sm w-20 mx-auto text-center font-mono ${discountHigh ? 'border-warning focus-visible:ring-warning' : ''}`}
                      />
                      {discount > 0 ? (
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${discountHigh ? 'border-warning text-warning' : 'border-primary/40 text-primary'}`}
                        >
                          {discountHigh ? 'Descuento alto' : 'Con descuento'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                          Sin descuento
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={p.mixPct}
                      onChange={e => updatePolicy(p.id, 'mixPct', e.target.value)}
                      className="h-8 text-sm w-20 mx-auto text-center font-mono"
                    />
                  </td>
                  <td className="text-center">
                    {rowValid ? (
                      <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {validations.policyErrors[p.id]}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td>Total</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="text-center">
                <span className={`font-mono text-sm ${validations.mixValid ? 'text-primary' : 'text-destructive'}`}>
                  {validations.mixTotal.toFixed(1)}%
                </span>
              </td>
              <td className="text-center">
                {validations.mixValid ? (
                  <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      La suma del mix de uso debe ser 100% (actual: {validations.mixTotal.toFixed(1)}%)
                    </TooltipContent>
                  </Tooltip>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Validation alerts */}
      {Object.entries(validations.policyErrors).map(([id, err]) => {
        if (!err) return null;
        const p = policies.find(x => x.id === id);
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            En "{p?.name}" la suma de enganche, parcialidades y contra-entrega debe ser 100%
          </div>
        );
      })}
      {!validations.mixValid && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          La suma del mix de uso de las políticas comerciales debe ser 100% (actual: {validations.mixTotal.toFixed(1)}%)
        </div>
      )}

      {/* High-discount warnings */}
      {policies.filter(p => (p.discountPct ?? 0) > 5).map(p => (
        <div key={`hd-${p.id}`} className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Descuento alto en "{p.name}" ({p.discountPct}%): requiere revisión
        </div>
      ))}

      {/* Discount history */}
      {(commercialPolicies.discountHistory?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de cambios de descuento
          </h4>
          <div className="rounded-lg border bg-secondary/20 overflow-x-auto max-h-56 overflow-y-auto">
            <table className="data-table w-full text-xs">
              <thead className="sticky top-0 bg-secondary/40">
                <tr>
                  <th className="text-left">Fecha</th>
                  <th className="text-left">Usuario</th>
                  <th className="text-left">Política</th>
                  <th className="text-center">Anterior</th>
                  <th className="text-center">Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {commercialPolicies.discountHistory!.map(h => (
                  <tr key={h.id}>
                    <td className="font-mono text-[11px]">{new Date(h.timestamp).toLocaleString('es-MX')}</td>
                    <td>{h.user}</td>
                    <td>{h.policyName}</td>
                    <td className="text-center font-mono">{h.previousDiscount}%</td>
                    <td className="text-center font-mono font-semibold">{h.newDiscount}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weighted KPIs */}
      {enabled && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            KPIs de Cobro Ponderado
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard
              label="Enganche Prom. Ponderado"
              value={formatPct(kpis.weightedDownPayment)}
              tooltip="Promedio ponderado del % de enganche según el mix de uso"
            />
            <MetricCard
              label="Parcialidades Prom. Ponderadas"
              value={formatPct(kpis.weightedInstallments)}
              tooltip="Promedio ponderado del % de parcialidades según el mix de uso"
            />
            <MetricCard
              label="Contra-entrega Prom. Ponderada"
              value={formatPct(kpis.weightedDelivery)}
              tooltip="Promedio ponderado del % de contra-entrega según el mix de uso"
            />
            <MetricCard
              label="Cobro Inicial Promedio"
              value={formatPct(kpis.avgInitialCollection)}
              tooltip="% cobrado al momento de la venta (enganche ponderado)"
            />
            <MetricCard
              label="Cobro Diferido Promedio"
              value={formatPct(kpis.avgDeferredCollection)}
              tooltip="% cobrado en parcialidades durante la obra"
            />
            <MetricCard
              label="Cobro Final Promedio"
              value={formatPct(kpis.avgFinalCollection)}
              tooltip="% cobrado contra-entrega del inmueble"
            />
          </div>
        </div>
      )}
    </div>
  );
}
