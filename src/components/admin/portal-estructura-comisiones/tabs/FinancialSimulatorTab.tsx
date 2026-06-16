import { useMemo, useState } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import { useInventory } from '@/store/InventoryContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import MetricCard from '@/components/MetricCard';
import { formatCurrency, formatPct } from '@/lib/calculations';
import { Calculator, Wallet, KeyRound, Calendar, AlertTriangle, Link2 } from 'lucide-react';

export default function FinancialSimulatorTab() {
  const { projects, channels, scenarios, roles, commercialPolicies } = useSimulator();
  const { units } = useInventory();

  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const projectUnits = useMemo(
    () => units.filter(u => u.projectId === projectId),
    [units, projectId]
  );

  const [unitId, setUnitId] = useState<string>('');
  const unit = projectUnits.find(u => u.id === unitId);

  const [scenarioId, setScenarioId] = useState<string>(scenarios[0]?.id || '');
  const scenario = scenarios.find(s => s.id === scenarioId);

  const activeChannels = channels.filter(c => c.active);
  const [channelId, setChannelId] = useState<string>(activeChannels[0]?.id || '');
  const channel = channels.find(c => c.id === channelId);

  const [policyId, setPolicyId] = useState<string>(commercialPolicies.policies[0]?.id || '');
  const policy = commercialPolicies.policies.find(p => p.id === policyId);

  const [discountPct, setDiscountPct] = useState<number>(0);

  // ---------- Calculations ----------
  const calc = useMemo(() => {
    if (!unit || !scenario || !channel || !policy) return null;

    const listPrice = unit.currentPrice;
    const maxDiscount = unit.maxDiscountPct ?? 100;
    const policyDiscount = policy.discountPct ?? 0;
    const requestedDiscount = policyDiscount + discountPct;
    const effectiveDiscount = Math.min(requestedDiscount, maxDiscount);
    const finalPrice = listPrice * (1 - effectiveDiscount / 100);
    const discountAmount = listPrice - finalPrice;

    const sqmForRate = unit.sqmInterior ?? unit.sqmSellable ?? unit.sqm;
    const pricePerSqmNet = sqmForRate ? finalPrice / sqmForRate : 0;

    const totalCommissionPct = scenario.totalCommissionPct;
    const externalPct = scenario.channelExternalPcts[channelId] ?? channel.externalCommissionPct;

    const totalCommission = finalPrice * (totalCommissionPct / 100);
    const externalCommission = finalPrice * (externalPct / 100);
    const internalRemainder = totalCommission - externalCommission;

    // Role distribution from commission rules
    const channelRules = scenario.commissionRules.filter(r => r.channelId === channelId);
    const base = scenario.commissionMode === 'on_sale_value' ? finalPrice : internalRemainder;

    const roleBreakdown = channelRules.map(rule => {
      const role = roles.find(r => r.id === rule.roleId);
      const amount = base * (rule.percentage / 100);
      return {
        roleId: rule.roleId,
        roleName: role?.name || 'Rol',
        pool: rule.pool,
        percentage: rule.percentage,
        amount,
      };
    });

    const totalInternalDistributed = roleBreakdown.reduce((s, r) => s + r.amount, 0);
    const netToProject = finalPrice - totalCommission;

    // Cashflow per policy
    const cashflow = {
      downPayment: finalPrice * (policy.downPaymentPct / 100),
      installments: finalPrice * (policy.installmentsPct / 100),
      delivery: finalPrice * (policy.deliveryPct / 100),
    };

    return {
      listPrice, effectiveDiscount, policyDiscount, manualDiscount: discountPct,
      finalPrice, discountAmount, pricePerSqmNet, sqmForRate,
      totalCommission, externalCommission, internalRemainder, totalCommissionPct, externalPct,
      roleBreakdown, totalInternalDistributed, netToProject, cashflow,
    };
  }, [unit, scenario, channel, policy, discountPct, channelId, roles]);

  const channelAllowed = !unit?.authorizedChannel
    || unit.authorizedChannel === 'both'
    || (unit.authorizedChannel === 'internal' && channelId.toLowerCase().includes('directa'))
    || (unit.authorizedChannel === 'brokers' && !channelId.toLowerCase().includes('directa'));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Simulador Financiero</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
              Selecciona una unidad real del inventario y modela el escenario completo: descuento,
              canal de venta, política de cobro y escenario de comisiones. El simulador usa el motor
              vigente y respeta los topes definidos por unidad.
            </p>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Conectado con: Inventario · Canales · Políticas · Escenarios de Comisión
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Proyecto</Label>
            <Select value={projectId} onValueChange={v => { setProjectId(v); setUnitId(''); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unidad ({projectUnits.length} disponibles)</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
              <SelectContent>
                {projectUnits.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Importa unidades en Inventario y Precios
                  </div>
                )}
                {projectUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.unitId} · {u.model} · {formatCurrency(u.currentPrice)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Escenario de Comisiones</Label>
            <Select value={scenarioId} onValueChange={setScenarioId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Canal de Venta</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeChannels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Política de Pago</Label>
            <Select value={policyId} onValueChange={setPolicyId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {commercialPolicies.policies.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              Descuento adicional (%) {unit?.maxDiscountPct != null && (
                <span className="text-muted-foreground">· tope {unit.maxDiscountPct}%</span>
              )}
              {policy && (policy.discountPct ?? 0) > 0 && (
                <span className="text-muted-foreground"> · política aplica {policy.discountPct}%</span>
              )}
            </Label>
            <Input
              type="number"
              min={0}
              max={unit?.maxDiscountPct ?? 100}
              step={0.5}
              value={discountPct}
              onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
              className="h-9 font-mono"
            />
          </div>
        </div>

        {unit && !channelAllowed && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Esta unidad tiene restricción de canal: <strong className="ml-1">{unit.authorizedChannel}</strong>
          </div>
        )}
        {unit && calc && (calc.policyDiscount + discountPct) > (unit.maxDiscountPct ?? 100) && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            El descuento combinado ({(calc.policyDiscount + discountPct).toFixed(1)}%) excede el tope autorizado para esta unidad ({unit.maxDiscountPct}%)
          </div>
        )}
      </div>

      {/* Results */}
      {calc && (
        <>
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-semibold">Desglose de Precio</h3>
              <div className="flex items-center gap-2">
                {calc.policyDiscount > 0 ? (
                  <Badge variant="outline" className={`text-[10px] ${calc.policyDiscount > 5 ? 'border-warning text-warning' : 'border-primary/40 text-primary'}`}>
                    {calc.policyDiscount > 5 ? 'Descuento alto' : 'Con descuento'} · política {calc.policyDiscount}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin descuento de política</Badge>
                )}
                {calc.manualDiscount > 0 && (
                  <Badge variant="outline" className="text-[10px]">+ {calc.manualDiscount}% adicional</Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Precio lista" value={formatCurrency(calc.listPrice)} />
              <MetricCard label="Descuento aplicado" value={`${calc.effectiveDiscount.toFixed(2)}%`} />
              <MetricCard label="Monto descontado" value={`-${formatCurrency(calc.discountAmount)}`} />
              <MetricCard label="Precio final" value={formatCurrency(calc.finalPrice)} className="border-primary/40" />
              <MetricCard
                label="Precio neto por m²"
                value={calc.pricePerSqmNet ? formatCurrency(calc.pricePerSqmNet) : '—'}
                tooltip={calc.sqmForRate ? `Calculado sobre ${calc.sqmForRate} m²` : 'Sin m² registrados en la unidad'}
              />
              <MetricCard label="Neto al proyecto" value={formatCurrency(calc.netToProject)} />
            </div>
          </div>

          {/* Commission breakdown */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Distribución de Comisión</h3>
              <Badge variant="outline" className="text-[10px]">
                Base: {scenario?.commissionMode === 'on_sale_value' ? 'Sobre venta' : 'Sobre remanente'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard
                label={`Comisión total (${formatPct(calc.totalCommissionPct)})`}
                value={formatCurrency(calc.totalCommission)}
              />
              <MetricCard
                label={`Externa al canal (${formatPct(calc.externalPct)})`}
                value={formatCurrency(calc.externalCommission)}
              />
              <MetricCard
                label="Remanente interno"
                value={formatCurrency(calc.internalRemainder)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Rol</th>
                    <th className="text-center">Pool</th>
                    <th className="text-center">% sobre base</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.roleBreakdown.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-4">
                      Este canal no tiene reglas de comisión configuradas en el escenario.
                    </td></tr>
                  )}
                  {calc.roleBreakdown.map(r => (
                    <tr key={r.roleId}>
                      <td>{r.roleName}</td>
                      <td className="text-center">
                        <Badge variant="outline" className="text-[10px] uppercase">{r.pool}</Badge>
                      </td>
                      <td className="text-center font-mono">{formatPct(r.percentage)}</td>
                      <td className="text-right font-mono">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {calc.roleBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td>Total distribuido</td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-mono text-primary">
                        {formatCurrency(calc.totalInternalDistributed)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Cashflow per policy */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Flujo de Cobro · Política "{policy?.name}"</h3>
              <Badge variant="outline" className="text-[10px]">
                {policy?.downPaymentPct}/{policy?.installmentsPct}/{policy?.deliveryPct}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Enganche ({policy?.downPaymentPct}%)
                  </span>
                </div>
                <div className="text-lg font-bold font-mono">{formatCurrency(calc.cashflow.downPayment)}</div>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Parcialidades ({policy?.installmentsPct}%)
                  </span>
                </div>
                <div className="text-lg font-bold font-mono">{formatCurrency(calc.cashflow.installments)}</div>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contra-entrega ({policy?.deliveryPct}%)
                  </span>
                </div>
                <div className="text-lg font-bold font-mono">{formatCurrency(calc.cashflow.delivery)}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {!calc && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Selecciona proyecto, unidad, escenario, canal y política para correr la simulación.
        </div>
      )}
    </div>
  );
}
