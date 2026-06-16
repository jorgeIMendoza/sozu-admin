import { useState } from 'react';
import { useSimulator } from '@/store/SimulatorContext';
import ScenarioChartsSection from '@/components/tabs/ScenarioChartsSection';
import { Plus, Copy, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { validateChannelMix, formatPct } from '@/lib/calculations';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Scenario } from '@/types/simulator';

export default function ScenariosTab() {
  const { scenarios, projects, channels, roles, roleAssignments, addScenario, updateScenario, deleteScenario, duplicateScenario } = useSimulator();
  const [editId, setEditId] = useState<string | null>(null);
  const editScenario = editId ? scenarios.find(s => s.id === editId) : null;

  const createNew = () => {
    const newScenario: Scenario = {
      id: crypto.randomUUID(),
      name: 'Nuevo Escenario',
      description: '',
      projectIds: projects.map(p => p.id),
      commissionMode: 'on_sale_value',
      totalCommissionPct: 6,
      channelMix: Object.fromEntries(channels.map((c, i) => [c.id, i === channels.length - 1 ? 100 - (channels.length - 1) * 20 : 20])),
      channelExternalPcts: Object.fromEntries(channels.map(c => [c.id, c.externalCommissionPct])),
      commissionRules: [],
      roleAssignments: roleAssignments.map(ra => ({ ...ra, id: crypto.randomUUID() })),
      monthlyUnits: Array(12).fill(5),
      isGroup: true,
    };
    addScenario(newScenario);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Escenarios</h2>
          <p className="text-sm text-muted-foreground">Modela y compara diferentes configuraciones comerciales</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={createNew}>
          <Plus className="h-3.5 w-3.5" /> Nuevo Escenario
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {scenarios.map(sc => {
          const mixValidation = validateChannelMix(sc.channelMix);
          return (
            <div key={sc.id} className="metric-card group">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{sc.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{sc.description || 'Sin descripción'}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditId(sc.id)} className="rounded-md p-1.5 hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => duplicateScenario(sc.id)} className="rounded-md p-1.5 hover:bg-muted" title="Duplicar">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteScenario(sc.id)} className="rounded-md p-1.5 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {sc.projectIds.map(pid => {
                  const p = projects.find(x => x.id === pid);
                  return p ? <Badge key={pid} variant="secondary" className="text-[10px]">{p.name}</Badge> : null;
                })}
                <Badge variant="outline" className="text-[10px]">
                  {sc.commissionMode === 'on_sale_value' ? 'Modo A' : 'Modo B'}
                </Badge>
                <Badge variant="outline" className="text-[10px]">Com: {sc.totalCommissionPct}%</Badge>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Mix de canales</span>
                  {mixValidation.valid ? (
                    <span className="flex items-center gap-1 text-success"><CheckCircle className="h-3 w-3" /> 100%</span>
                  ) : (
                    <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" /> {formatPct(mixValidation.total)}</span>
                  )}
                </div>
                {channels.map(ch => (
                  <div key={ch.id} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate">{ch.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${sc.channelMix[ch.id] || 0}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono">{sc.channelMix[ch.id] || 0}%</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Ventas anuales: <span className="font-semibold text-foreground">{sc.monthlyUnits.reduce((a, b) => a + b, 0)} uds</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scenario comparison charts */}
      <ScenarioChartsSection />

      {/* Inline editor */}
      {editScenario && (
        <Dialog open={!!editId} onOpenChange={(o) => { if (!o) setEditId(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar: {editScenario.name}</DialogTitle>
            </DialogHeader>
            <ScenarioEditor scenario={editScenario} onSave={(s) => { updateScenario(s); setEditId(null); }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ScenarioEditor({ scenario, onSave }: { scenario: Scenario; onSave: (s: Scenario) => void }) {
  const { channels, projects } = useSimulator();
  const [form, setForm] = useState(scenario);

  const setMix = (channelId: string, value: number) => {
    setForm(prev => ({ ...prev, channelMix: { ...prev.channelMix, [channelId]: value } }));
  };

  const setMonthlyUnit = (idx: number, value: number) => {
    setForm(prev => {
      const units = [...prev.monthlyUnits];
      units[idx] = value;
      return { ...prev, monthlyUnits: units };
    });
  };

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nombre</Label>
          <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
        </div>
        <div>
          <Label>Comisión Total %</Label>
          <Input type="number" step="0.1" value={form.totalCommissionPct}
            onChange={e => setForm(prev => ({ ...prev, totalCommissionPct: +e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Descripción</Label>
          <Input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Mix de Canales (%)</Label>
        <div className="space-y-3">
          {channels.map(ch => (
            <div key={ch.id} className="flex items-center gap-3">
              <span className="w-36 text-sm truncate">{ch.name}</span>
              <Slider
                value={[form.channelMix[ch.id] || 0]}
                onValueChange={([v]) => setMix(ch.id, v)}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                className="w-20 h-8 text-sm font-mono"
                value={form.channelMix[ch.id] || 0}
                onChange={e => setMix(ch.id, +e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Ventas Mensuales (unidades)</Label>
        <div className="grid grid-cols-6 gap-2">
          {months.map((m, i) => (
            <div key={m}>
              <Label className="text-[10px] text-muted-foreground">{m}</Label>
              <Input
                type="number"
                className="h-8 text-sm font-mono"
                value={form.monthlyUnits[i]}
                onChange={e => setMonthlyUnit(i, +e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={() => onSave(form)}>Guardar Escenario</Button>
      </div>
    </div>
  );
}
