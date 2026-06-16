import { useState, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Settings2, TrendingUp, DollarSign, Percent, Plus, Trash2, Copy, Power, PowerOff,
  AlertTriangle, CheckCircle, BarChart3, Calculator, FileText, ChevronDown, ChevronUp,
  ShieldCheck, ShieldX, Eye,
} from 'lucide-react';
import type {
  BrokerIncentiveConfig, VolumeRule, SaleAmountRule, DownPaymentRule,
  MeasurementPeriod, AuditRecord, OperationInput, OperationBreakdown,
} from '@/lib/portal-estructura-comisiones/types/broker-incentives';
import { DEFAULT_BROKER_CONFIG } from '@/lib/portal-estructura-comisiones/types/broker-incentives';
import {
  calculateBrokerBaseCommission, calculateOperationBreakdown,
  formatMoney, periodLabel,
} from '@/lib/portal-estructura-comisiones/utils/broker-calculations';

const STORAGE_KEY = 'sozu-broker-incentives';
function loadConfig(): BrokerIncentiveConfig {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch { /* */ }
  return DEFAULT_BROKER_CONFIG;
}
function saveConfig(c: BrokerIncentiveConfig) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

const AUDIT_KEY = 'sozu-broker-audit';
function loadAudit(): AuditRecord[] {
  try { const s = localStorage.getItem(AUDIT_KEY); if (s) return JSON.parse(s); } catch { /* */ }
  return [];
}
function saveAudit(r: AuditRecord[]) { localStorage.setItem(AUDIT_KEY, JSON.stringify(r)); }

// ─── Editable Rule Tables (unchanged logic) ───

function VolumeRulesTable({ rules, onChange }: { rules: VolumeRule[]; onChange: (r: VolumeRule[]) => void }) {
  const addRule = () => onChange([...rules, {
    id: crypto.randomUUID(), name: 'Nueva regla', period: 'semiannual',
    minUnits: 1, maxUnits: null, commissionPct: 2, incrementalPct: 0,
    description: '', validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
  }]);
  const update = (id: string, p: Partial<VolumeRule>) => onChange(rules.map(r => r.id === id ? { ...r, ...p } : r));
  const remove = (id: string) => onChange(rules.filter(r => r.id !== id));
  const dup = (r: VolumeRule) => onChange([...rules, { ...r, id: crypto.randomUUID(), name: `${r.name} (copia)` }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Escala de comisión por volumen
        </h4>
        <Button size="sm" onClick={addRule} className="gap-1"><Plus className="h-3 w-3" /> Nueva regla</Button>
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">No hay reglas de volumen configuradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th>Nombre</th><th>Periodo</th><th>Mín.</th><th>Máx.</th><th>% Comisión</th><th>Δ vs base</th><th>Vigencia</th><th>Estatus</th><th></th>
            </tr></thead>
            <tbody>{rules.map(r => (
              <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                <td><Input value={r.name} onChange={e => update(r.id, { name: e.target.value })} className="h-8 text-sm min-w-[120px]" /></td>
                <td>
                  <select value={r.period} onChange={e => update(r.id, { period: e.target.value as MeasurementPeriod })}
                    className="h-8 rounded-md border border-border bg-card px-2 text-sm">
                    <option value="monthly">Mensual</option><option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option><option value="annual">Anual</option>
                  </select>
                </td>
                <td><Input type="number" value={r.minUnits} onChange={e => update(r.id, { minUnits: +e.target.value })} className="h-8 w-16 text-sm font-mono" /></td>
                <td><Input type="number" value={r.maxUnits ?? ''} onChange={e => update(r.id, { maxUnits: e.target.value ? +e.target.value : null })} placeholder="∞" className="h-8 w-16 text-sm font-mono" /></td>
                <td><Input type="number" step="0.01" value={r.commissionPct} onChange={e => update(r.id, { commissionPct: +e.target.value })} className="h-8 w-20 text-sm font-mono" /></td>
                <td className="font-mono text-sm text-primary font-semibold">+{r.incrementalPct.toFixed(2)}%</td>
                <td className="text-xs text-muted-foreground whitespace-nowrap">
                  <Input type="date" value={r.validFrom} onChange={e => update(r.id, { validFrom: e.target.value })} className="h-7 text-xs w-28 mb-0.5" />
                  <Input type="date" value={r.validTo} onChange={e => update(r.id, { validTo: e.target.value })} className="h-7 text-xs w-28" />
                </td>
                <td><Switch checked={r.active} onCheckedChange={v => update(r.id, { active: v })} /></td>
                <td><div className="flex gap-1">
                  <button onClick={() => dup(r)} className="rounded p-1 hover:bg-secondary"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => remove(r.id)} className="rounded p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SaleAmountRulesTable({ rules, onChange }: { rules: SaleAmountRule[]; onChange: (r: SaleAmountRule[]) => void }) {
  const addRule = () => onChange([...rules, {
    id: crypto.randomUUID(), name: 'Nuevo bono', minAmount: 10000000, maxAmount: null,
    bonusPct: 0.25, description: '', validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
  }]);
  const update = (id: string, p: Partial<SaleAmountRule>) => onChange(rules.map(r => r.id === id ? { ...r, ...p } : r));
  const remove = (id: string) => onChange(rules.filter(r => r.id !== id));
  const dup = (r: SaleAmountRule) => onChange([...rules, { ...r, id: crypto.randomUUID(), name: `${r.name} (copia)` }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-accent-blue" /> Bono por monto de venta
        </h4>
        <Button size="sm" onClick={addRule} className="gap-1"><Plus className="h-3 w-3" /> Nueva regla</Button>
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">No hay reglas de bono por monto configuradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Monto mínimo</th><th>Monto máximo</th><th>% Bono</th><th>Descripción</th><th>Vigencia</th><th>Estatus</th><th></th></tr></thead>
            <tbody>{rules.map(r => (
              <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                <td><Input value={r.name} onChange={e => update(r.id, { name: e.target.value })} className="h-8 text-sm min-w-[120px]" /></td>
                <td><Input type="number" value={r.minAmount} onChange={e => update(r.id, { minAmount: +e.target.value })} className="h-8 w-32 text-sm font-mono" /></td>
                <td><Input type="number" value={r.maxAmount ?? ''} onChange={e => update(r.id, { maxAmount: e.target.value ? +e.target.value : null })} placeholder="∞" className="h-8 w-32 text-sm font-mono" /></td>
                <td><Input type="number" step="0.01" value={r.bonusPct} onChange={e => update(r.id, { bonusPct: +e.target.value })} className="h-8 w-20 text-sm font-mono" /></td>
                <td><Input value={r.description} onChange={e => update(r.id, { description: e.target.value })} className="h-8 text-sm min-w-[100px]" /></td>
                <td className="text-xs text-muted-foreground whitespace-nowrap">
                  <Input type="date" value={r.validFrom} onChange={e => update(r.id, { validFrom: e.target.value })} className="h-7 text-xs w-28 mb-0.5" />
                  <Input type="date" value={r.validTo} onChange={e => update(r.id, { validTo: e.target.value })} className="h-7 text-xs w-28" />
                </td>
                <td><Switch checked={r.active} onCheckedChange={v => update(r.id, { active: v })} /></td>
                <td><div className="flex gap-1">
                  <button onClick={() => dup(r)} className="rounded p-1 hover:bg-secondary"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => remove(r.id)} className="rounded p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DownPaymentRulesTable({ rules, onChange }: { rules: DownPaymentRule[]; onChange: (r: DownPaymentRule[]) => void }) {
  const addRule = () => onChange([...rules, {
    id: crypto.randomUUID(), name: 'Nuevo bono', minPct: 30, maxPct: null,
    bonusPct: 0.25, description: '', validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
  }]);
  const update = (id: string, p: Partial<DownPaymentRule>) => onChange(rules.map(r => r.id === id ? { ...r, ...p } : r));
  const remove = (id: string) => onChange(rules.filter(r => r.id !== id));
  const dup = (r: DownPaymentRule) => onChange([...rules, { ...r, id: crypto.randomUUID(), name: `${r.name} (copia)` }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-accent-orange" /> Bono por compromiso financiero / enganche
          <Badge variant="outline" className="text-[10px] font-normal ml-1">Transaccional por operación</Badge>
        </h4>
        <Button size="sm" onClick={addRule} className="gap-1"><Plus className="h-3 w-3" /> Nueva regla</Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Este bono se evalúa individualmente por cada operación. Solo la venta que cumple la condición de enganche recibe el bono.
      </p>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">No hay reglas de enganche configuradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>% Enganche mín</th><th>% Enganche máx</th><th>% Bono</th><th>Descripción</th><th>Vigencia</th><th>Estatus</th><th></th></tr></thead>
            <tbody>{rules.map(r => (
              <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                <td><Input value={r.name} onChange={e => update(r.id, { name: e.target.value })} className="h-8 text-sm min-w-[120px]" /></td>
                <td><Input type="number" value={r.minPct} onChange={e => update(r.id, { minPct: +e.target.value })} className="h-8 w-20 text-sm font-mono" /></td>
                <td><Input type="number" value={r.maxPct ?? ''} onChange={e => update(r.id, { maxPct: e.target.value ? +e.target.value : null })} placeholder="∞" className="h-8 w-20 text-sm font-mono" /></td>
                <td><Input type="number" step="0.01" value={r.bonusPct} onChange={e => update(r.id, { bonusPct: +e.target.value })} className="h-8 w-20 text-sm font-mono" /></td>
                <td><Input value={r.description} onChange={e => update(r.id, { description: e.target.value })} className="h-8 text-sm min-w-[100px]" /></td>
                <td className="text-xs text-muted-foreground whitespace-nowrap">
                  <Input type="date" value={r.validFrom} onChange={e => update(r.id, { validFrom: e.target.value })} className="h-7 text-xs w-28 mb-0.5" />
                  <Input type="date" value={r.validTo} onChange={e => update(r.id, { validTo: e.target.value })} className="h-7 text-xs w-28" />
                </td>
                <td><Switch checked={r.active} onCheckedChange={v => update(r.id, { active: v })} /></td>
                <td><div className="flex gap-1">
                  <button onClick={() => dup(r)} className="rounded p-1 hover:bg-secondary"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => remove(r.id)} className="rounded p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Operation Evaluation Card ───
function OperationCard({ op, index }: { op: OperationBreakdown; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const dpEval = op.downPaymentEvaluation;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{op.operationLabel}</span>
          <Badge variant="outline" className="text-[10px] font-mono">{new Date(op.date).toLocaleDateString('es-MX')}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {dpEval.meetsCondition ? (
            <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px]">
              <ShieldCheck className="h-3 w-3" /> Bono enganche aplicado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <ShieldX className="h-3 w-3" /> No cumple enganche
            </Badge>
          )}
          <button onClick={() => setExpanded(!expanded)} className="rounded p-1 hover:bg-secondary">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Monto venta</p>
          <p className="text-sm font-mono font-semibold">{formatMoney(op.unitPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">% Enganche</p>
          <p className="text-sm font-mono font-semibold">{op.downPaymentPct}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Comisión final</p>
          <p className="text-sm font-mono font-bold text-primary">{op.finalCommission.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">$ Comisión</p>
          <p className="text-sm font-mono font-bold text-primary">{formatMoney(op.finalAmount)}</p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border pt-3 space-y-3 animate-fade-in">
          {/* Commission breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desglose de comisión</p>
            {[
              { label: 'Comisión base (volumen)', value: op.baseCommission, color: 'text-foreground' },
              { label: 'Bono por monto', value: op.saleAmountBonus, color: 'text-accent-blue' },
              { label: 'Bono por enganche', value: op.downPaymentBonus, color: dpEval.meetsCondition ? 'text-accent-orange' : 'text-muted-foreground' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-mono font-semibold ${item.color}`}>
                  {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}%
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-primary/20">
              <span className="text-xs font-bold">Comisión final</span>
              <span className="text-sm font-mono font-bold text-primary">{op.finalCommission.toFixed(2)}%</span>
            </div>
          </div>

          {/* Down payment evaluation detail */}
          <div className={`rounded-lg p-3 ${dpEval.meetsCondition ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border'}`}>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Percent className="h-3 w-3" /> Evaluación de bono por enganche
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">% Enganche operación:</span>
                <span className="ml-1 font-mono font-semibold">{dpEval.operationDownPaymentPct}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Regla evaluada:</span>
                <span className="ml-1 font-medium">{dpEval.ruleName || 'Ninguna'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Condición:</span>
                <span className="ml-1 font-mono">{dpEval.ruleCondition || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resultado:</span>
                {dpEval.meetsCondition ? (
                  <Badge className="ml-1 bg-primary/10 text-primary text-[9px] py-0">Sí aplica +{dpEval.bonusPct}%</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-1 text-[9px] py-0">No aplica</Badge>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 italic">{dpEval.reason}</p>
          </div>

          {/* Applied rules */}
          {op.appliedRules.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Reglas aplicadas:</span>
              {op.appliedRules.map((n, i) => <Badge key={i} variant="secondary" className="text-[10px]">{n}</Badge>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function BrokerIncentivesTab() {
  const { projects, scenarios, channels } = useSimulator();
  const [config, setConfig] = useState<BrokerIncentiveConfig>(loadConfig);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>(loadAudit);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const [showAudit, setShowAudit] = useState(false);
  const [activeSection, setActiveSection] = useState<'rules' | 'simulator' | 'summary'>('rules');

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const defaultPrice = projects[0]?.averagePrice || 11700000;

  // Simulation inputs
  const [simPeriod, setSimPeriod] = useState<MeasurementPeriod>('semiannual');
  const [brokerName, setBrokerName] = useState('Broker Ejemplo');

  // Multi-operation list
  const [operations, setOperations] = useState<OperationInput[]>([
    { id: crypto.randomUUID(), unitPrice: defaultPrice, downPaymentPct: 50, date: '2025-03-15', label: 'MX-204' },
    { id: crypto.randomUUID(), unitPrice: 12000000, downPaymentPct: 30, date: '2025-04-02', label: 'MX-205' },
    { id: crypto.randomUUID(), unitPrice: 18500000, downPaymentPct: 45, date: '2025-05-10', label: 'MX-206' },
  ]);

  const updateConfig = (patch: Partial<BrokerIncentiveConfig>) => {
    const newConfig = { ...config, ...patch };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const addOperation = () => {
    const num = operations.length + 1;
    setOperations([...operations, {
      id: crypto.randomUUID(),
      unitPrice: defaultPrice,
      downPaymentPct: 30,
      date: new Date().toISOString().slice(0, 10),
      label: `MX-${200 + num + 3}`,
    }]);
  };
  const updateOp = (id: string, patch: Partial<OperationInput>) =>
    setOperations(ops => ops.map(o => o.id === id ? { ...o, ...patch } : o));
  const removeOp = (id: string) => setOperations(ops => ops.filter(o => o.id !== id));

  // Calculate per-operation breakdowns
  const unitsSold = operations.length;
  const opBreakdowns = useMemo(() =>
    operations.map(op => calculateOperationBreakdown(
      config,
      { unitPrice: op.unitPrice, unitsSold, downPaymentPct: op.downPaymentPct, period: simPeriod },
      op
    )),
    [config, operations, unitsSold, simPeriod]
  );

  // Aggregates
  const totalSaleAmount = operations.reduce((s, o) => s + o.unitPrice, 0);
  const totalCommissionAmount = opBreakdowns.reduce((s, b) => s + b.finalAmount, 0);
  const opsWithBonus = opBreakdowns.filter(b => b.downPaymentEvaluation.meetsCondition).length;
  const opsWithoutBonus = opBreakdowns.length - opsWithBonus;
  const totalDpBonus = opBreakdowns.reduce((s, b) => s + (b.downPaymentBonus > 0 ? b.unitPrice * b.downPaymentBonus / 100 : 0), 0);
  const avgDp = operations.length > 0 ? operations.reduce((s, o) => s + o.downPaymentPct, 0) / operations.length : 0;

  // Validation
  const scenarioTotal = scenario?.totalCommissionPct || 6;
  const brokerChannel = channels.find(c => c.name.toLowerCase().includes('inmobiliaria') || c.name.toLowerCase().includes('broker'));
  const channelRules = scenario?.commissionRules.filter(r => r.channelId === brokerChannel?.id) || [];
  const internalDispersed = channelRules.reduce((sum, r) => sum + r.percentage, 0);

  // Use worst-case (highest) commission for validation
  const maxFinalCommission = opBreakdowns.length > 0 ? Math.max(...opBreakdowns.map(b => b.finalCommission)) : config.baseCommissionPct;
  const totalUsed = maxFinalCommission + internalDispersed;
  const isOverLimit = totalUsed > scenarioTotal;
  const overAmount = totalUsed - scenarioTotal;

  // Volume progress
  const volumeRulesSorted = [...config.volumeRules].filter(r => r.active).sort((a, b) => a.minUnits - b.minUnits);
  const currentVolumeRule = volumeRulesSorted.find(r => unitsSold >= r.minUnits && (r.maxUnits === null || unitsSold <= r.maxUnits));
  const nextVolumeRule = volumeRulesSorted.find(r => r.minUnits > unitsSold);
  const unitsToNext = nextVolumeRule ? nextVolumeRule.minUnits - unitsSold : 0;
  const maxUnitsInRules = volumeRulesSorted.length > 0 ? (volumeRulesSorted[volumeRulesSorted.length - 1].maxUnits || volumeRulesSorted[volumeRulesSorted.length - 1].minUnits + 5) : 10;
  const progressPct = Math.min(100, (unitsSold / maxUnitsInRules) * 100);

  // Base commission (broker-level, no DP)
  const brokerBase = useMemo(() =>
    calculateBrokerBaseCommission(config, { unitPrice: defaultPrice, unitsSold, downPaymentPct: 0, period: simPeriod }),
    [config, unitsSold, simPeriod, defaultPrice]
  );

  // Save all operations as audit
  const saveAllAudit = () => {
    const newRecords: AuditRecord[] = opBreakdowns.map(b => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      brokerName,
      channelId: brokerChannel?.id || '',
      period: simPeriod,
      accumulatedSales: unitsSold,
      saleAmount: b.unitPrice,
      downPaymentPct: b.downPaymentPct,
      baseCommission: b.baseCommission,
      volumeBonus: b.volumeBonus,
      saleAmountBonus: b.saleAmountBonus,
      downPaymentBonus: b.downPaymentBonus,
      finalCommission: b.finalCommission,
      finalAmount: b.finalAmount,
      appliedRuleIds: [],
      appliedRuleNames: b.appliedRules,
      operationId: b.operationId,
      operationLabel: b.operationLabel,
      downPaymentEvaluation: b.downPaymentEvaluation,
    }));
    const updated = [...newRecords, ...auditRecords].slice(0, 200);
    setAuditRecords(updated);
    saveAudit(updated);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Incentivos Dinámicos de Broker
          </h2>
          <p className="text-sm text-muted-foreground">Motor de compensación configurable — bono por enganche evaluado por operación individual</p>
        </div>
        <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Escenario" /></SelectTrigger>
          <SelectContent>
            {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { key: 'rules' as const, label: 'Reglas Comerciales', icon: Settings2 },
          { key: 'simulator' as const, label: 'Simulador por Operación', icon: Calculator },
          { key: 'summary' as const, label: 'Resumen por Broker', icon: BarChart3 },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeSection === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* ══════ SECTION: RULES ══════ */}
      {activeSection === 'rules' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Comisión base del broker
              </h4>
              <Badge variant="outline" className="font-mono">{config.baseCommissionPct}%</Badge>
            </div>
            <div className="flex items-center gap-4">
              <Slider value={[config.baseCommissionPct]} onValueChange={v => updateConfig({ baseCommissionPct: v[0] })} min={0.5} max={6} step={0.1} className="flex-1" />
              <Input type="number" step="0.1" value={config.baseCommissionPct} onChange={e => updateConfig({ baseCommissionPct: +e.target.value })} className="w-24 h-8 font-mono text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'volumeEnabled' as const, label: 'Escalonamiento por volumen', sublabel: 'Acumulado por periodo', icon: BarChart3, color: 'text-primary' },
              { key: 'saleAmountEnabled' as const, label: 'Bono por monto de venta', sublabel: 'Por operación', icon: DollarSign, color: 'text-accent-blue' },
              { key: 'downPaymentEnabled' as const, label: 'Bono por enganche alto', sublabel: 'Transaccional por operación', icon: Percent, color: 'text-accent-orange' },
            ].map(toggle => (
              <div key={toggle.key} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <toggle.icon className={`h-4 w-4 ${toggle.color}`} />
                    <div>
                      <span className="text-sm font-medium">{toggle.label}</span>
                      <p className="text-[10px] text-muted-foreground">{toggle.sublabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {config[toggle.key] ? <Power className="h-3.5 w-3.5 text-primary" /> : <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    <Switch checked={config[toggle.key]} onCheckedChange={v => updateConfig({ [toggle.key]: v })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {config.volumeEnabled && (
            <div className="rounded-xl border border-border bg-card p-5">
              <VolumeRulesTable rules={config.volumeRules} onChange={r => updateConfig({ volumeRules: r })} />
            </div>
          )}
          {config.saleAmountEnabled && (
            <div className="rounded-xl border border-border bg-card p-5">
              <SaleAmountRulesTable rules={config.saleAmountRules} onChange={r => updateConfig({ saleAmountRules: r })} />
            </div>
          )}
          {config.downPaymentEnabled && (
            <div className="rounded-xl border border-border bg-card p-5">
              <DownPaymentRulesTable rules={config.downPaymentRules} onChange={r => updateConfig({ downPaymentRules: r })} />
            </div>
          )}
        </div>
      )}

      {/* ══════ SECTION: SIMULATOR (PER-OPERATION) ══════ */}
      {activeSection === 'simulator' && (
        <div className="space-y-6">
          {/* Broker-level params */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Parámetros del broker
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del Broker</label>
                <Input value={brokerName} onChange={e => setBrokerName(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Periodo de medición</label>
                <Select value={simPeriod} onValueChange={v => setSimPeriod(v as MeasurementPeriod)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Operaciones en periodo</label>
                <p className="text-lg font-bold font-mono">{unitsSold}</p>
                {currentVolumeRule && <Badge variant="secondary" className="text-[10px] mt-1">{currentVolumeRule.name} → {currentVolumeRule.commissionPct}%</Badge>}
              </div>
            </div>
          </div>

          {/* Operations list */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Operaciones del periodo
              </h4>
              <Button size="sm" onClick={addOperation} className="gap-1"><Plus className="h-3 w-3" /> Agregar operación</Button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr>
                  <th>ID Operación</th>
                  <th>Fecha</th>
                  <th>Monto de venta</th>
                  <th>% Enganche</th>
                  <th></th>
                </tr></thead>
                <tbody>{operations.map(op => (
                  <tr key={op.id}>
                    <td><Input value={op.label} onChange={e => updateOp(op.id, { label: e.target.value })} className="h-8 text-sm w-24 font-mono" /></td>
                    <td><Input type="date" value={op.date} onChange={e => updateOp(op.id, { date: e.target.value })} className="h-8 text-sm w-32" /></td>
                    <td>
                      <Input type="number" value={op.unitPrice} onChange={e => updateOp(op.id, { unitPrice: +e.target.value })} className="h-8 w-36 text-sm font-mono" />
                      <p className="text-[10px] text-muted-foreground">{formatMoney(op.unitPrice)}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={op.downPaymentPct} onChange={e => updateOp(op.id, { downPaymentPct: +e.target.value })} className="h-8 w-20 text-sm font-mono" min={0} max={100} />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => removeOp(op.id)} className="rounded p-1 hover:bg-destructive/10" disabled={operations.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Per-operation evaluation results */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Evaluación de incentivos por operación
            </h4>
            {opBreakdowns.map((ob, i) => (
              <OperationCard key={ob.operationId} op={ob} index={i} />
            ))}
          </div>

          {/* Validation */}
          <div className={`rounded-xl border p-4 ${isOverLimit ? 'border-destructive bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
            <div className="flex items-start gap-2">
              {isOverLimit ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              <div className="text-sm">
                {isOverLimit ? (
                  <>
                    <p className="font-semibold text-destructive">
                      La comisión máxima del broker ({maxFinalCommission.toFixed(2)}%) + distribución interna ({internalDispersed.toFixed(2)}%) exceden en {overAmount.toFixed(2)}% la comisión total del escenario.
                    </p>
                    <p className="text-muted-foreground mt-1">Total: {totalUsed.toFixed(2)}% &gt; {scenarioTotal}% permitido</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-primary">Validación exitosa</p>
                    <p className="text-muted-foreground mt-1">
                      Máx broker: {maxFinalCommission.toFixed(2)}% + Interna: {internalDispersed.toFixed(2)}% = {totalUsed.toFixed(2)}% ≤ {scenarioTotal}% permitido
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Save audit */}
          <Button onClick={saveAllAudit} className="w-full gap-2" disabled={isOverLimit}>
            <FileText className="h-4 w-4" /> Guardar {operations.length} operaciones para auditoría
          </Button>

          {/* Audit log */}
          <div className="rounded-xl border border-border bg-card p-5">
            <button onClick={() => setShowAudit(!showAudit)} className="flex items-center justify-between w-full text-left">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Historial de auditoría ({auditRecords.length} registros)
              </h4>
              {showAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAudit && auditRecords.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="data-table">
                  <thead><tr>
                    <th>Fecha</th><th>Operación</th><th>Broker</th><th>Monto</th><th>Enganche</th>
                    <th>Bono Eng.</th><th>Evaluación</th><th>Final</th><th>$ Comisión</th><th>Reglas</th>
                  </tr></thead>
                  <tbody>{auditRecords.slice(0, 30).map(r => (
                    <tr key={r.id}>
                      <td className="text-xs whitespace-nowrap">{new Date(r.timestamp).toLocaleDateString('es-MX')}</td>
                      <td className="text-sm font-mono font-medium">{r.operationLabel || '—'}</td>
                      <td className="text-sm">{r.brokerName}</td>
                      <td className="font-mono text-xs">{formatMoney(r.saleAmount)}</td>
                      <td className="font-mono text-xs">{r.downPaymentPct}%</td>
                      <td className="font-mono text-xs text-accent-orange">
                        {r.downPaymentBonus > 0 ? `+${r.downPaymentBonus.toFixed(2)}%` : '—'}
                      </td>
                      <td>
                        {r.downPaymentEvaluation?.meetsCondition ? (
                          <Badge className="bg-primary/10 text-primary text-[9px]">Aplica</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px]">No aplica</Badge>
                        )}
                      </td>
                      <td className="font-mono text-sm font-bold">{r.finalCommission.toFixed(2)}%</td>
                      <td className="font-mono text-sm font-semibold text-primary">{formatMoney(r.finalAmount)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.appliedRuleNames.map((n, i) => <Badge key={i} variant="secondary" className="text-[9px]">{n}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {showAudit && auditRecords.length === 0 && (
              <p className="text-sm text-muted-foreground italic mt-3">No hay registros de auditoría</p>
            )}
          </div>
        </div>
      )}

      {/* ══════ SECTION: BROKER SUMMARY ══════ */}
      {activeSection === 'summary' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-5">
              <BarChart3 className="h-4 w-4 text-primary" /> Resumen de desempeño del broker
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Ventas acumuladas', value: `${unitsSold}`, sublabel: periodLabel(simPeriod) },
                { label: 'Monto total vendido', value: formatMoney(totalSaleAmount) },
                { label: 'Ticket promedio', value: formatMoney(unitsSold > 0 ? totalSaleAmount / unitsSold : 0) },
                { label: '% Promedio enganche', value: `${avgDp.toFixed(1)}%` },
              ].map((m, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{m.label}</p>
                  <p className="text-lg font-bold font-mono">{m.value}</p>
                  {m.sublabel && <p className="text-[10px] text-muted-foreground">{m.sublabel}</p>}
                </div>
              ))}
            </div>

            {/* Down payment bonus stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ops. con bono enganche</p>
                <p className="text-lg font-bold font-mono text-primary">{opsWithBonus}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ops. sin bono enganche</p>
                <p className="text-lg font-bold font-mono">{opsWithoutBonus}</p>
              </div>
              <div className="rounded-xl border border-accent-orange/20 bg-accent-orange/5 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Total bono enganche</p>
                <p className="text-lg font-bold font-mono text-accent-orange">{formatMoney(totalDpBonus)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Comisión total generada</p>
                <p className="text-lg font-bold font-mono text-primary">{formatMoney(totalCommissionAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nivel actual de comisión (base + volumen)</p>
                <p className="text-2xl font-bold font-mono text-primary">{brokerBase.baseCommission.toFixed(2)}%</p>
                {currentVolumeRule && <Badge variant="secondary" className="mt-1 text-[10px]">{currentVolumeRule.name}</Badge>}
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Bonos activos</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {brokerBase.appliedRules.length > 0 ? brokerBase.appliedRules.map((name, i) => (
                    <Badge key={i} className="bg-primary/10 text-primary border-primary/20">{name}</Badge>
                  )) : (
                    <span className="text-sm text-muted-foreground italic">Sin bonos de volumen</span>
                  )}
                  {config.downPaymentEnabled && (
                    <Badge variant="outline" className="text-[10px] text-accent-orange border-accent-orange/30">Enganche: transaccional</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Per-operation mini-summary */}
            {opBreakdowns.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Detalle por operación</p>
                <div className="space-y-2">
                  {opBreakdowns.map(ob => (
                    <div key={ob.operationId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-medium">{ob.operationLabel}</span>
                        <span className="text-xs text-muted-foreground">{formatMoney(ob.unitPrice)}</span>
                        <span className="text-xs text-muted-foreground">Eng: {ob.downPaymentPct}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {ob.downPaymentEvaluation.meetsCondition ? (
                          <Badge className="bg-primary/10 text-primary text-[9px] gap-1"><ShieldCheck className="h-2.5 w-2.5" /> +{ob.downPaymentBonus.toFixed(2)}%</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] gap-1"><ShieldX className="h-2.5 w-2.5" /> Sin bono eng.</Badge>
                        )}
                        <span className="text-sm font-mono font-bold text-primary">{ob.finalCommission.toFixed(2)}%</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatMoney(ob.finalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {config.volumeEnabled && nextVolumeRule && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso hacia siguiente nivel</span>
                  <span className="text-xs text-muted-foreground">
                    Faltan <strong className="text-foreground">{unitsToNext}</strong> ventas para subir a <strong className="text-primary">{nextVolumeRule.commissionPct}%</strong>
                  </span>
                </div>
                <Progress value={progressPct} className="h-3" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{unitsSold} ventas</span>
                  <span className="text-[10px] text-muted-foreground">{nextVolumeRule.minUnits} ventas requeridas</span>
                </div>
              </div>
            )}
            {config.volumeEnabled && !nextVolumeRule && unitsSold > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">¡Nivel máximo alcanzado!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
