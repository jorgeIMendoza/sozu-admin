import { useState, useMemo } from 'react';
import { useInventory } from '@/store/InventoryContext';
import { formatCurrency } from '@/lib/calculations';
import type { PricingRule, IncrementType, IncrementFrequency } from '@/types/inventory';
import { TrendingUp, Plus, Trash2, Pencil, Play, Eye, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const TYPE_LABELS: Record<IncrementType, string> = {
  manual: 'Manual',
  by_absorption: 'Por absorción',
  by_time: 'Por tiempo',
};

const FREQ_LABELS: Record<IncrementFrequency, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  per_hit: 'Por hit',
};

interface Props {
  projectId: string;
}

export default function PricingStrategy({ projectId }: Props) {
  const { getProjectRules, getProjectUnits, addPricingRule, updatePricingRule, deletePricingRule, simulateIncrement, applyIncrement, getProjectHistory } = useInventory();
  const rules = getProjectRules(projectId);
  const units = getProjectUnits(projectId);
  const history = getProjectHistory(projectId);

  const models = useMemo(() => [...new Set(units.map(u => u.model))].sort(), [units]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simModel, setSimModel] = useState('');
  const [simPct, setSimPct] = useState(0);
  const [simResults, setSimResults] = useState<{ unitId: string; current: number; simulated: number }[]>([]);

  const emptyRule: PricingRule = {
    id: '', projectId, model: models[0] || '', basePrice: 0,
    incrementPct: 0, incrementType: 'manual', frequency: 'monthly',
    active: true, createdAt: '',
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (r: PricingRule) => { setEditing(r); setFormOpen(true); };

  const handleSave = (rule: PricingRule) => {
    if (rule.id) {
      updatePricingRule(rule);
      toast.success('Regla actualizada');
    } else {
      addPricingRule({ ...rule, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      toast.success('Regla creada');
    }
    setFormOpen(false);
  };

  const handleApply = (rule: PricingRule) => {
    applyIncrement(projectId, rule.model, rule.incrementPct, `${TYPE_LABELS[rule.incrementType]} +${rule.incrementPct}%`);
    toast.success(`Incremento de ${rule.incrementPct}% aplicado al modelo ${rule.model}`);
  };

  const handleSimulate = (rule: PricingRule) => {
    setSimModel(rule.model);
    setSimPct(rule.incrementPct);
    const results = simulateIncrement(projectId, rule.model, rule.incrementPct);
    setSimResults(results);
    setSimOpen(true);
  };

  // Calculate avg base price per model from units
  const modelAvgPrice = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    units.forEach(u => {
      if (!map[u.model]) map[u.model] = { sum: 0, count: 0 };
      map[u.model].sum += u.currentPrice;
      map[u.model].count++;
    });
    const result: Record<string, number> = {};
    for (const [m, v] of Object.entries(map)) result[m] = Math.round(v.sum / v.count);
    return result;
  }, [units]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Estrategia de Precios</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Configura incrementos de precios por modelo. Puedes simular antes de aplicar para ver el impacto sobre el inventario.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5" disabled={models.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Nueva Regla
        </Button>
      </div>

      {models.length === 0 && (
        <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Carga el inventario primero</p>
          <p className="text-xs mt-1">Necesitas unidades con modelos para configurar estrategias de precios.</p>
        </div>
      )}

      {/* Rules Table */}
      {rules.length > 0 && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Modelo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Precio Prom.</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">% Incremento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Frecuencia</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Estatus</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(rule => (
                <TableRow key={rule.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{rule.model}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(modelAvgPrice[rule.model] || rule.basePrice)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-primary">+{rule.incrementPct}%</TableCell>
                  <TableCell>
                    <span className="text-xs">{TYPE_LABELS[rule.incrementType]}</span>
                    {rule.incrementType === 'by_absorption' && rule.absorptionThresholdPct && (
                      <span className="text-[10px] text-muted-foreground ml-1">({rule.absorptionThresholdPct}% vendido)</span>
                    )}
                    {rule.incrementType === 'by_time' && rule.intervalMonths && (
                      <span className="text-[10px] text-muted-foreground ml-1">(cada {rule.intervalMonths} meses)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{FREQ_LABELS[rule.frequency]}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${rule.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {rule.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleSimulate(rule)} className="rounded-md p-1.5 hover:bg-muted"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          </TooltipTrigger>
                          <TooltipContent>Simular sin aplicar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleApply(rule)} className="rounded-md p-1.5 hover:bg-primary/10"><Play className="h-3.5 w-3.5 text-primary" /></button>
                          </TooltipTrigger>
                          <TooltipContent>Aplicar incremento</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button onClick={() => openEdit(rule)} className="rounded-md p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={() => { deletePricingRule(rule.id); toast.success('Regla eliminada'); }} className="rounded-md p-1.5 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Price History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Historial de Cambios de Precio
          </h4>
          <div className="border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Modelo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Anterior</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Nuevo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Variación</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Regla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(-10).reverse().map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.appliedAt).toLocaleDateString('es-MX')}</TableCell>
                    <TableCell className="text-xs font-medium">{h.model}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatCurrency(h.previousPrice)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-semibold">{formatCurrency(h.newPrice)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-primary">+{h.incrementPct}%</TableCell>
                    <TableCell className="text-xs">{h.rule}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Regla' : 'Nueva Regla de Precio'}</DialogTitle>
          </DialogHeader>
          <RuleForm rule={editing || emptyRule} models={models} onSave={handleSave} onCancel={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Simulation Dialog */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Simulación de incremento — {simModel} (+{simPct}%)</DialogTitle>
          </DialogHeader>
          <div className="bg-primary-light/30 border border-primary/20 rounded-lg p-3 mb-3">
            <p className="text-xs text-primary font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Esta simulación NO aplica cambios. Es solo una vista previa.
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Unidad</TableHead>
                  <TableHead className="text-xs text-right">Precio Actual</TableHead>
                  <TableHead className="text-xs text-right">Precio Simulado</TableHead>
                  <TableHead className="text-xs text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simResults.map(r => (
                  <TableRow key={r.unitId}>
                    <TableCell className="text-xs font-medium">{r.unitId}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatCurrency(r.current)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-semibold text-primary">{formatCurrency(r.simulated)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatCurrency(r.simulated - r.current)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({ rule, models, onSave, onCancel }: { rule: PricingRule; models: string[]; onSave: (r: PricingRule) => void; onCancel: () => void }) {
  const [form, setForm] = useState(rule);
  const set = (key: keyof PricingRule, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Modelo</Label>
          <Select value={form.model} onValueChange={v => set('model', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>% Incremento</Label>
          <Input type="number" step="0.1" value={form.incrementPct} onChange={e => set('incrementPct', +e.target.value)} />
        </div>
        <div>
          <Label>Tipo de incremento</Label>
          <Select value={form.incrementType} onValueChange={v => set('incrementType', v as IncrementType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="by_absorption">Por absorción</SelectItem>
              <SelectItem value="by_time">Por tiempo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.incrementType === 'by_absorption' && (
          <div>
            <Label>Umbral absorción (%)</Label>
            <Input type="number" value={form.absorptionThresholdPct || 0} onChange={e => set('absorptionThresholdPct', +e.target.value)} />
          </div>
        )}
        {form.incrementType === 'by_time' && (
          <div>
            <Label>Cada N meses</Label>
            <Input type="number" value={form.intervalMonths || 3} onChange={e => set('intervalMonths', +e.target.value)} />
          </div>
        )}
        <div>
          <Label>Frecuencia</Label>
          <Select value={form.frequency} onValueChange={v => set('frequency', v as IncrementFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="per_hit">Por hit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
          <Label>Regla activa</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.model}>Guardar</Button>
      </div>
    </div>
  );
}
