import { useState, useEffect, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Plus, Trash2, RefreshCw, Info, History, Send, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import SyncCommissionsDialog from '../shared/SyncCommissionsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProyectosMotorComisiones } from '@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones';
import { useEnviarPropuesta, type MotorSnapshot } from '@/hooks/usePortalEstructuraComisiones/useComisionesValidacion';

interface SyncHistoryEntry {
  id: string;
  date: string;
  user: string;
  rolesAdded: number;
}

const SYNC_HISTORY_KEY = 'sozu_commission_sync_history';
const loadHistory = (): SyncHistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(SYNC_HISTORY_KEY) || '[]'); } catch { return []; }
};
const saveHistory = (h: SyncHistoryEntry[]) => localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(h));

export default function CommissionsTab() {
  const {
    channels, roles, roleAssignments, motorConfig, updateMotorConfig, motorProjectId, setMotorProjectId,
    commissionRules, addCommissionRule, updateCommissionRule, deleteCommissionRule, syncMissingCommissionRules,
  } = useSimulator();
  const [syncOpen, setSyncOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SyncHistoryEntry[]>(loadHistory);

  const { data: proyectosMotor = [], isLoading: isLoadingProyectos } = useProyectosMotorComisiones();
  const proyectoActual = proyectosMotor.find(p => p.id === motorProjectId);

  // Enviar a validar (Portal Alta Dirección) — para el proyecto seleccionado.
  const { profile, user } = useAuth();
  const enviarPropuesta = useEnviarPropuesta();
  const [validarOpen, setValidarOpen] = useState(false);

  const commRoles = roles.filter(r => r.participatesInCommission);

  // La matriz canal×puesto es del proyecto seleccionado — se sincroniza cada
  // vez que cambia el proyecto.
  useEffect(() => {
    if (motorProjectId != null) syncMissingCommissionRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorProjectId]);

  const rolesToAdd = useMemo(() => {
    let n = 0;
    channels.forEach(ch => {
      commRoles.forEach(role => {
        if (!commissionRules.some(r => r.channelId === ch.id && r.roleId === role.id)) n++;
      });
    });
    return n;
  }, [commissionRules, channels, commRoles]);

  const handleConfirmSync = async () => {
    const added = await syncMissingCommissionRules();

    const entry: SyncHistoryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      user: 'Admin',
      rolesAdded: added,
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    saveHistory(next);

    toast.success('Roles y comisiones sincronizados correctamente.');
    setSyncOpen(false);
  };

  const buildSnapshot = (): MotorSnapshot => ({
    totalCommissionPct: motorConfig.totalCommissionPct,
    channels: channels.map((c) => ({ id: c.id, name: c.name, externalCommissionPct: c.externalCommissionPct, active: c.active })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, belongsTo: r.belongsTo })),
    roleAssignments: roleAssignments.map((a) => ({ roleId: a.roleId, baseSalary: a.baseSalary })),
    commissionRules: commissionRules.map((r) => ({ channelId: r.channelId, roleId: r.roleId, percentage: r.percentage, pool: r.pool })),
  });

  const handleEnviarValidar = async () => {
    if (motorProjectId == null) return;
    const snapshot = buildSnapshot();
    const propuestaPor = profile?.email || user?.email || null;
    try {
      await enviarPropuesta.mutateAsync({
        id_proyecto: motorProjectId,
        snapshot,
        propuesta_por: propuestaPor,
      });
      toast.success(`Enviado a validar para ${proyectoActual?.nombre ?? 'el proyecto'}.`);
      setValidarOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar a validar.');
    }
  };

  const getRoleInfo = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    const assignment = roleAssignments.find(ra => ra.roleId === roleId);
    return { role, assignment };
  };

  const addRule = (channelId: string) => {
    if (commRoles.length === 0) return;
    // Find a role not yet in this channel
    const channelRules = commissionRules.filter(r => r.channelId === channelId);
    const unusedRole = roles.find(r => !channelRules.some(cr => cr.roleId === r.id));
    const roleId = unusedRole?.id || roles[0]?.id;
    if (!roleId) return;
    addCommissionRule(channelId, roleId, 'project');
  };

  const updateRule = (ruleId: string, updates: Partial<typeof commissionRules[0]>) => {
    const rule = commissionRules.find(r => r.id === ruleId);
    if (!rule) return;
    updateCommissionRule({ ...rule, ...updates });
  };

  const deleteRule = (ruleId: string) => {
    deleteCommissionRule(ruleId);
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
                El % de cada rol se aplica sobre el valor de venta del canal (Modo A: sobre venta). La suma de los roles + la comisión externa debe ser igual a la Comisión Total.
              </TooltipContent>
            </Tooltip>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={motorProjectId != null ? String(motorProjectId) : undefined}
              onValueChange={(v) => setMotorProjectId(Number(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={isLoadingProyectos ? 'Cargando proyectos…' : 'Selecciona un proyecto'} />
              </SelectTrigger>
              <SelectContent>
                {proyectosMotor.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {motorProjectId != null && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Sincronizar roles y comisiones
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Agrega al motor los roles nuevos que falten desde Roles y Sueldos.
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(v => !v)} className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </Button>
              <Button variant="default" size="sm" onClick={() => setValidarOpen(true)} className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Enviar a validar
              </Button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Comisión total</span>
                <Input
                  type="number"
                  step="0.1"
                  className="w-20 h-9 text-sm font-mono"
                  value={motorConfig.totalCommissionPct}
                  onChange={(e) => updateMotorConfig({ ...motorConfig, totalCommissionPct: +e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {motorProjectId == null ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Selecciona un proyecto</p>
          <p className="text-xs text-muted-foreground">
            El Motor de Comisiones configura una matriz y una Comisión Total distintas para cada desarrollo. Elige uno arriba para empezar.
          </p>
        </div>
      ) : (
      <>
      {/* UX Message */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          Los roles se cargan automáticamente desde la sección <strong>Roles y Sueldos</strong>. Puedes eliminarlos o modificar su comisión.
        </span>
      </div>

      <div className="text-sm font-medium">
        Comisión total: <span className="font-bold text-accent">{motorConfig.totalCommissionPct}%</span>
      </div>

      {/* Channel cards */}
      {channels.map(ch => {
        const channelRules = commissionRules.filter(r => r.channelId === ch.id);
        const extPct = ch.externalCommissionPct;

        // Real-time channel summary calculations (siempre Modo A: sobre venta)
        const comisionTotal = motorConfig.totalCommissionPct;
        const comisionExterna = extPct;
        const comisionInterna = comisionTotal - comisionExterna;
        const sumaDispersada = channelRules.reduce((sum, r) => sum + r.percentage, 0);
        const remanente = comisionInterna - sumaDispersada;

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
                    <th>
                      % sobre Comisión a Dispersar
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          % del rol respecto a la Comisión a Dispersar del canal (Interna esperada: {comisionInterna.toFixed(2)}%). El % sobre venta se calcula solo.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th>% sobre venta</th>
                    <th>Pool</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {channelRules.map(rule => {
                    const { role, assignment } = getRoleInfo(rule.roleId);
                    const sharePct = comisionInterna > 0 ? (rule.percentage / comisionInterna) * 100 : 0;
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
                            value={Number.isFinite(sharePct) ? +sharePct.toFixed(4) : 0}
                            onChange={e => {
                              const newShare = +e.target.value;
                              const newPercentage = comisionInterna > 0 ? (newShare / 100) * comisionInterna : 0;
                              updateRule(rule.id, { percentage: newPercentage });
                            }}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 h-8 text-sm font-mono"
                            value={rule.percentage}
                            disabled
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
                        El remanente es la comisión interna disponible aún no asignada a roles. Se calcula como la comisión total menos la comisión externa del canal y menos la suma de los porcentajes capturados.
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
                    <span className="font-medium">Sincronización</span>
                    <span className="text-muted-foreground">{new Date(h.date).toLocaleString('es-MX')} · {h.user}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Roles agregados: <strong>{h.rolesAdded}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SyncCommissionsDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        rolesToAdd={rolesToAdd}
        onConfirm={handleConfirmSync}
      />

      {/* Enviar a validar — Portal Alta Dirección */}
      <Dialog open={validarOpen} onOpenChange={setValidarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar a validar</DialogTitle>
            <DialogDescription>
              Se enviará el Motor de Comisiones de <strong>{proyectoActual?.nombre ?? 'este proyecto'}</strong> al
              Portal Alta Dirección para que lo validen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setValidarOpen(false)} disabled={enviarPropuesta.isPending}>Cancelar</Button>
            <Button onClick={handleEnviarValidar} disabled={enviarPropuesta.isPending} className="gap-1.5">
              {enviarPropuesta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
