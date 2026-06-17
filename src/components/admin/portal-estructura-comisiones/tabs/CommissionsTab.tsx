import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Plus, Trash2, RefreshCw, Info, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateCommissionRules, formatPct } from '@/lib/portal-estructura-comisiones/utils/calculations';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import SyncCommissionsDialog from '../shared/SyncCommissionsDialog';

interface SyncHistoryEntry {
  id: string;
  date: string;
  user: string;
  scenarioId: string;
  scenarioName: string;
  rolesAdded: number;
  channelChanges: Array<{ channelId: string; channelName: string; from: number; to: number }>;
  inactiveSkipped: string[];
}

const SYNC_HISTORY_KEY = 'sozu_commission_sync_history';
const loadHistory = (): SyncHistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(SYNC_HISTORY_KEY) || '[]'); } catch { return []; }
};
const saveHistory = (h: SyncHistoryEntry[]) => localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(h));

export default function CommissionsTab() {
  const { scenarios, channels, roles, roleAssignments, updateScenario } = useSimulator();
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const [syncOpen, setSyncOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SyncHistoryEntry[]>(loadHistory);

  const commRoles = roles.filter(r => r.participatesInCommission);

  // Auto-load: ensure all commRoles exist in every channel for this scenario
  const syncRolesToScenario = useCallback((applyUpdate = true) => {
    if (!scenario) return { added: 0, newRules: [] as typeof scenario.commissionRules };
    let newRules = [...scenario.commissionRules];
    let added = 0;

    channels.forEach(ch => {
      commRoles.forEach(role => {
        const exists = newRules.some(r => r.channelId === ch.id && r.roleId === role.id);
        if (!exists) {
          newRules.push({
            id: crypto.randomUUID(),
            scenarioId: scenario.id,
            channelId: ch.id,
            roleId: role.id,
            percentage: 0,
            pool: role.belongsTo === 'sozu_central' ? 'sozu' : 'project',
          });
          added++;
        }
      });
    });

    if (applyUpdate && added > 0) {
      updateScenario({ ...scenario, commissionRules: newRules });
    }
    return { added, newRules };
  }, [scenario, channels, commRoles, updateScenario]);

  // Auto-load on scenario change
  useEffect(() => {
    syncRolesToScenario(true);
  }, [selectedScenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rolesToAdd = useMemo(() => {
    if (!scenario) return 0;
    let n = 0;
    channels.forEach(ch => {
      commRoles.forEach(role => {
        if (!scenario.commissionRules.some(r => r.channelId === ch.id && r.roleId === role.id)) n++;
      });
    });
    return n;
  }, [scenario, channels, commRoles]);

  const handleConfirmSync = (replaceManual: boolean) => {
    if (!scenario) return;
    const { added, newRules } = syncRolesToScenario(false);

    const updatedExternal = { ...scenario.channelExternalPcts };
    const channelChanges: SyncHistoryEntry['channelChanges'] = [];
    const inactiveSkipped: string[] = [];

    channels.forEach(ch => {
      if (!ch.active) {
        const override = scenario.channelExternalPcts[ch.id];
        const current = override ?? ch.externalCommissionPct;
        if (current !== ch.externalCommissionPct) inactiveSkipped.push(ch.name);
        return;
      }
      const override = scenario.channelExternalPcts[ch.id];
      const current = override ?? ch.externalCommissionPct;
      const next = ch.externalCommissionPct;
      if (current === next) return;
      const manuallyModified = override !== undefined && override !== ch.externalCommissionPct;
      if (manuallyModified && !replaceManual) return;
      updatedExternal[ch.id] = next;
      channelChanges.push({ channelId: ch.id, channelName: ch.name, from: current, to: next });
    });

    updateScenario({
      ...scenario,
      commissionRules: newRules,
      channelExternalPcts: updatedExternal,
    });

    const entry: SyncHistoryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      user: 'Admin',
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      rolesAdded: added,
      channelChanges,
      inactiveSkipped,
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    saveHistory(next);

    if (inactiveSkipped.length > 0) {
      toast.warning(`Canales inactivos omitidos: ${inactiveSkipped.join(', ')}`);
    }
    toast.success('Roles y comisiones sincronizados correctamente.');
    setSyncOpen(false);
  };

  if (!scenario) return <p className="text-muted-foreground p-6">Crea un escenario primero</p>;

  const getRoleInfo = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    const assignment = roleAssignments.find(ra => ra.roleId === roleId);
    return { role, assignment };
  };

  const addRule = (channelId: string) => {
    if (commRoles.length === 0) return;
    // Find a role not yet in this channel
    const channelRules = scenario.commissionRules.filter(r => r.channelId === channelId);
    const unusedRole = roles.find(r => !channelRules.some(cr => cr.roleId === r.id));
    const roleId = unusedRole?.id || roles[0]?.id;
    if (!roleId) return;

    const newRule = {
      id: crypto.randomUUID(),
      scenarioId: scenario.id,
      channelId,
      roleId,
      percentage: 0,
      pool: 'project' as const,
    };
    updateScenario({
      ...scenario,
      commissionRules: [...scenario.commissionRules, newRule],
    });
  };

  const updateRule = (ruleId: string, updates: Partial<typeof scenario.commissionRules[0]>) => {
    updateScenario({
      ...scenario,
      commissionRules: scenario.commissionRules.map(r =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    });
  };

  const deleteRule = (ruleId: string) => {
    updateScenario({
      ...scenario,
      commissionRules: scenario.commissionRules.filter(r => r.id !== ruleId),
    });
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Motor de Comisiones</h2>
          <p className="text-sm text-muted-foreground">
            Configura cómo se distribuye la comisión por canal y rol
            <Tooltip>
              <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
              <TooltipContent className="max-w-sm text-xs">
                <strong>Modo A (sobre venta):</strong> el % de cada rol se aplica sobre el valor de venta del canal. La suma + ext debe = comisión total.<br />
                <strong>Modo B (sobre remanente):</strong> el % se aplica sobre el remanente interno. La suma debe = 100%.
              </TooltipContent>
            </Tooltip>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Sincronizar roles y comisiones
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Actualiza roles desde Roles y Sueldos y porcentajes de comisión desde Canales de Venta.
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(v => !v)} className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico
          </Button>
          <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Escenario" /></SelectTrigger>
            <SelectContent>
              {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={scenario.commissionMode}
            onValueChange={(v) => updateScenario({ ...scenario, commissionMode: v as any })}
          >
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on_sale_value">Modo A: Sobre Venta</SelectItem>
              <SelectItem value="on_internal_remainder">Modo B: Sobre Remanente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* UX Message */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          Los roles se cargan automáticamente desde la sección <strong>Roles y Sueldos</strong>. Puedes eliminarlos o modificar su comisión para este escenario.
        </span>
      </div>

      <div className="text-sm font-medium">
        Comisión total del escenario: <span className="font-bold text-accent">{scenario.totalCommissionPct}%</span>
      </div>

      {/* Channel cards */}
      {channels.map(ch => {
        const channelRules = scenario.commissionRules.filter(r => r.channelId === ch.id);
        const extPct = scenario.channelExternalPcts[ch.id] ?? ch.externalCommissionPct;
        const validation = validateCommissionRules(
          channelRules, scenario.commissionMode, scenario.totalCommissionPct, extPct
        );

        // Real-time channel summary calculations
        const comisionTotal = scenario.totalCommissionPct;
        const comisionExterna = extPct;
        const comisionInterna = comisionTotal - comisionExterna;
        const sumaDispersada = channelRules.reduce((sum, r) => sum + r.percentage, 0);
        const remanente = scenario.commissionMode === 'on_sale_value'
          ? comisionInterna - sumaDispersada
          : 100 - sumaDispersada;

        const statusColor = Math.abs(remanente) < 0.005
          ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
          : remanente > 0
            ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
            : 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400';

        const statusText = Math.abs(remanente) < 0.005
          ? 'Distribución completa'
          : remanente > 0
            ? `Falta por dispersar ${remanente.toFixed(2)}%`
            : `Excedido por ${Math.abs(remanente).toFixed(2)}%`;

        const statusIcon = Math.abs(remanente) < 0.005
          ? <CheckCircle className="h-3.5 w-3.5" />
          : <AlertTriangle className="h-3.5 w-3.5" />;

        return (
          <div key={ch.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{ch.name}</h3>
                <Badge variant="outline" className="text-[10px]">Ext: {extPct}%</Badge>
                <Badge variant="outline" className="text-[10px]">
                  Mix: {scenario.channelMix[ch.id] || 0}%
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border ${statusColor}`}>
                  {statusIcon}
                  {statusText}
                </div>
                <Button variant="outline" size="sm" onClick={() => addRule(ch.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Rol
                </Button>
              </div>
            </div>

            {channelRules.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin reglas de comisión definidas</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>% {scenario.commissionMode === 'on_sale_value' ? 'sobre venta' : 'sobre remanente'}</th>
                    <th>Pool</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {channelRules.map(rule => {
                    const { role, assignment } = getRoleInfo(rule.roleId);
                    return (
                      <tr key={rule.id}>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <select
                              value={rule.roleId}
                              onChange={e => updateRule(rule.id, { roleId: e.target.value })}
                              className="rounded border bg-transparent px-2 py-1 text-sm font-medium"
                            >
                              {roles.filter(r => r.participatesInCommission || r.id === rule.roleId).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            {assignment && role && (
                              <span className="text-[11px] text-muted-foreground pl-2">
                                {formatCurrency(assignment.baseSalary)} / mes · {role.belongsTo === 'sozu_central' ? 'SOZU' : 'Proyecto'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 h-8 text-sm font-mono"
                            value={rule.percentage}
                            onChange={e => updateRule(rule.id, { percentage: +e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            value={rule.pool}
                            onChange={e => updateRule(rule.id, { pool: e.target.value as 'sozu' | 'project' })}
                            className="rounded border bg-transparent px-2 py-1 text-sm"
                          >
                            <option value="sozu">SOZU</option>
                            <option value="project">Proyecto</option>
                          </select>
                        </td>
                        <td>
                          <button onClick={() => deleteRule(rule.id)} className="rounded p-1 hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Channel Summary Footer */}
            <div className={`mt-4 rounded-lg border p-4 ${statusColor}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Resumen del canal</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {statusIcon}
                  {statusText}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">Comisión total</p>
                  <p className="text-sm font-bold font-mono">{comisionTotal.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">Externa</p>
                  <p className="text-sm font-bold font-mono">{comisionExterna.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">Interna esperada</p>
                  <p className="text-sm font-bold font-mono">{comisionInterna.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">Dispersada</p>
                  <p className="text-sm font-bold font-mono">{sumaDispersada.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1 flex items-center justify-center gap-1">
                    Remanente
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        El remanente es la comisión interna disponible aún no asignada a roles. Se calcula como la comisión total del escenario menos la comisión externa del canal y menos la suma de los porcentajes capturados.
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-sm font-bold font-mono">{remanente.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {historyOpen && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Histórico de sincronización</h3>
            <Badge variant="outline" className="text-[10px]">{history.length} registros</Badge>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin sincronizaciones registradas.</p>
          ) : (
            <div className="max-h-80 overflow-auto space-y-2">
              {history.map(h => (
                <div key={h.id} className="rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{h.scenarioName}</span>
                    <span className="text-muted-foreground">{new Date(h.date).toLocaleString('es-MX')} · {h.user}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Roles agregados: <strong>{h.rolesAdded}</strong> · Canales actualizados: <strong>{h.channelChanges.length}</strong>
                    {h.inactiveSkipped.length > 0 && <> · Inactivos omitidos: <strong>{h.inactiveSkipped.join(', ')}</strong></>}
                  </div>
                  {h.channelChanges.length > 0 && (
                    <ul className="mt-1 pl-3 list-disc space-y-0.5">
                      {h.channelChanges.map((c, i) => (
                        <li key={i}>
                          {c.channelName}: <span className="font-mono">{c.from}% → {c.to}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scenario && (
        <SyncCommissionsDialog
          open={syncOpen}
          onOpenChange={setSyncOpen}
          scenario={scenario}
          channels={channels}
          rolesToAdd={rolesToAdd}
          onConfirm={handleConfirmSync}
        />
      )}
    </div>
  );
}
