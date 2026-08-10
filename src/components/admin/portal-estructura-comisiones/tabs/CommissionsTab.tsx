import { useState, useEffect, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Plus, Trash2, RefreshCw, Info, History, Send, Loader2, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import SyncCommissionsDialog from '../shared/SyncCommissionsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProyectosMotorComisiones } from '@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones';
import {
  useEstructuraRealRaw, comisionistasDisponibles,
  type ComisionistaReal, type RolComisionista,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador';
import { useEnviarPropuesta, type MotorSnapshot } from '@/hooks/usePortalEstructuraComisiones/useComisionesValidacion';
import {
  useCanalesConfigProyecto, resolverCanalesDeProyecto, canalesAplicables,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';
import { useProyectosSozuReales } from '@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales';

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
    channels: catalogoCanales, roles, roleAssignments, motorConfig, updateMotorConfig, motorProjectId, setMotorProjectId,
    motorLoading, motorDirty, motorSaving, saveMotorComisiones,
    commissionRules, addCommissionRule, updateCommissionRule, deleteCommissionRule, syncMissingCommissionRules,
  } = useSimulator();
  const [syncOpen, setSyncOpen] = useState(false);
  /** Canal para el que está abierto el selector de "Agregar comisionista". */
  const [altaCanal, setAltaCanal] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SyncHistoryEntry[]>(loadHistory);

  const { data: proyectosMotor = [], isLoading: isLoadingProyectos } = useProyectosMotorComisiones();
  const proyectoActual = proyectosMotor.find(p => p.id === motorProjectId);

  /**
   * Precio promedio ponderado por unidad disponible del proyecto seleccionado
   * —el mismo que muestra el menú Proyectos—. Sirve de base para estimar en
   * pesos lo que cobra cada comisionista. `0` = el proyecto no tiene inventario
   * disponible o no está en el universo comercializado por SOZU.
   */
  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioPromUnidad = useMemo(
    () => proyectosSozu.find(p => p.id === motorProjectId)?.precioPromedioUnidad ?? 0,
    [proyectosSozu, motorProjectId],
  );

  // Solo los canales que aplican al proyecto, con su comisión externa vigente:
  // un canal puede estar quitado de este desarrollo o cobrar distinto que en
  // otro. Se configura en Canales de Venta eligiendo el proyecto.
  const { data: canalesConfig } = useCanalesConfigProyecto(motorProjectId);
  const channels = useMemo(
    () => canalesAplicables(resolverCanalesDeProyecto(catalogoCanales, canalesConfig)),
    [catalogoCanales, canalesConfig],
  );

  // Enviar a validar (Portal Alta Dirección) — para el proyecto seleccionado.
  const { profile, user } = useAuth();
  const enviarPropuesta = useEnviarPropuesta();
  const [validarOpen, setValidarOpen] = useState(false);

  // Comisionistas elegibles: personal activo de "Roles y Sueldos" cuyo rol existe
  // en el catálogo del simulador. La regla guarda el rol porque el motor agrupa
  // los pagos por rol, pero quien se da de alta es la persona.
  const { data: estructuraRaw } = useEstructuraRealRaw();
  // El rol se resuelve para el proyecto del motor: la misma persona puede
  // comisionar con roles distintos en desarrollos distintos.
  const comisionistas = useMemo(
    () => comisionistasDisponibles(estructuraRaw, roles, motorProjectId),
    [estructuraRaw, roles, motorProjectId],
  );
  const comisionistaPorId = useMemo(
    () => new Map(comisionistas.map(c => [c.personalId, c])),
    [comisionistas],
  );
  /**
   * Para "Sincronizar comisionistas" se toma el rol primario de cada persona —el
   * del proyecto del motor si lo tiene, si no su rol base— y solo si ese rol
   * participa en comisión. Elegir otro rol es una decisión manual.
   */
  const comisionistasComision = useMemo(
    () => comisionistas
      .filter(c => c.roles[0]?.participaComision)
      .map(c => ({
        personalId: c.personalId,
        nombre: c.nombre,
        roleId: c.roles[0].roleId,
        belongsTo: c.roles[0].belongsTo,
      })),
    [comisionistas],
  );

  // La matriz canal×puesto es del proyecto seleccionado — se sincroniza cada
  // vez que cambia el proyecto. Espera a que `motorLoading` termine: si esto
  // corriera mientras la carga de `commissionRules` del proyecto nuevo sigue
  // en vuelo, calcularía "faltantes" contra datos todavía del proyecto
  // anterior (o vacíos) y agregaría filas duplicadas.
  useEffect(() => {
    if (motorProjectId != null && !motorLoading) syncMissingCommissionRules(comisionistasComision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorProjectId, motorLoading, comisionistasComision]);

  // Ya no autoguarda: avisa antes de cerrar/recargar si hay cambios sin guardar.
  useEffect(() => {
    if (!motorDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [motorDirty]);

  const rolesToAdd = useMemo(() => {
    let n = 0;
    channels.forEach(ch => {
      comisionistasComision.forEach(c => {
        if (!commissionRules.some(r => r.channelId === ch.id && r.personalId === c.personalId)) n++;
      });
    });
    return n;
  }, [commissionRules, channels, comisionistasComision]);

  const handleConfirmSync = async () => {
    const added = await syncMissingCommissionRules(comisionistasComision);

    const entry: SyncHistoryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      user: 'Admin',
      rolesAdded: added,
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    saveHistory(next);

    toast.success('Comisionistas agregados. Presiona "Guardar cambios" para persistirlos.');
    setSyncOpen(false);
  };

  const buildSnapshot = (): MotorSnapshot => ({
    // Ya no hay un total único: viaja el de cada canal.
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      externalCommissionPct: c.externalCommissionPct,
      active: c.active,
      totalCommissionPct: motorConfig.channelTotals[c.id] ?? 0,
    })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, belongsTo: r.belongsTo })),
    roleAssignments: roleAssignments.map((a) => ({ roleId: a.roleId, baseSalary: a.baseSalary })),
    commissionRules: commissionRules.map((r) => ({
      channelId: r.channelId,
      roleId: r.roleId,
      percentage: r.percentage,
      pool: r.pool,
      comisionista: r.personalId ? comisionistaPorId.get(r.personalId)?.nombre ?? null : null,
    })),
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

  /** Alta de comisionista: se eligen persona y rol en el selector, no se asumen. */
  const altaComisionista = (channelId: string, persona: ComisionistaReal, rol: RolComisionista) => {
    addCommissionRule(
      channelId,
      rol.roleId,
      rol.belongsTo === 'sozu_central' ? 'sozu' : 'project',
      persona.personalId,
    );
    toast.success(`${persona.nombre} agregado como comisionista (${rol.rolNombre}).`);
  };

  /**
   * Cambiar la persona de un renglón arrastra su rol primario. Si esa persona
   * ejerce varios roles, se puede afinar después con el selector de rol.
   */
  const cambiarComisionista = (ruleId: string, personalId: string) => {
    const persona = comisionistaPorId.get(personalId);
    if (!persona) return;
    const rule = commissionRules.find(r => r.id === ruleId);
    if (!rule) return;
    if (commissionRules.some(r => r.id !== ruleId && r.channelId === rule.channelId && r.personalId === personalId)) {
      toast.error(`${persona.nombre} ya está dado de alta como comisionista en este canal.`);
      return;
    }
    // Si el rol actual sigue siendo uno de los que ejerce, se conserva.
    const rol = persona.roles.find(r => r.roleId === rule.roleId) ?? persona.roles[0];
    updateCommissionRule({ ...rule, personalId, roleId: rol.roleId });
  };

  /** Cambiar el rol con el que comisiona una persona, entre los que ejerce. */
  const cambiarRolComisionista = (ruleId: string, roleId: string) => {
    const rule = commissionRules.find(r => r.id === ruleId);
    if (!rule) return;
    const rol = roles.find(r => r.id === roleId);
    updateCommissionRule({
      ...rule,
      roleId,
      pool: rol?.belongsTo === 'sozu_central' ? 'sozu' : 'project',
    });
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
            Da de alta a los comisionistas de cada canal y su % sobre el precio de venta final
            <Tooltip>
              <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
              <TooltipContent className="max-w-sm text-xs">
                El % de cada comisionista se aplica sobre el precio de venta final de la unidad. La suma de los comisionistas + la comisión externa debe ser igual a la Comisión Total.
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
                    <RefreshCw className="h-3.5 w-3.5" /> Sincronizar comisionistas
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Da de alta en cada canal al personal de Roles y Sueldos cuyo rol participa en comisión y aún no esté.
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(v => !v)} className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setValidarOpen(true)}
                      disabled={motorDirty}
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar a validar
                    </Button>
                  </span>
                </TooltipTrigger>
                {motorDirty && (
                  <TooltipContent className="max-w-xs text-xs">
                    Guarda los cambios pendientes antes de enviar a validar.
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={motorDirty ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => saveMotorComisiones()}
                      disabled={!motorDirty || motorSaving}
                      className="gap-1.5"
                    >
                      {motorSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar cambios
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {motorDirty
                    ? 'Tienes cambios sin guardar en la matriz de comisiones o la Comisión Total.'
                    : 'No hay cambios pendientes por guardar.'}
                </TooltipContent>
              </Tooltip>
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
          Los comisionistas son el personal dado de alta en <strong>Roles y Sueldos</strong>; su rol se muestra
          y no se teclea aquí. Puedes darlos de alta, de baja o modificar su porcentaje por canal.
          {comisionistas.length === 0 && (
            <span className="text-amber-600">
              {' '}Todavía no hay personal con rol vinculado, así que no hay a quién dar de alta.
            </span>
          )}
          {precioPromUnidad > 0 ? (
            <span>
              {' '}El valor estimado se calcula sobre el precio promedio ponderado por unidad
              disponible de {proyectoActual?.nombre ?? 'este proyecto'}:{' '}
              <strong>{formatCurrency(precioPromUnidad)}</strong>.
            </span>
          ) : (
            <span className="text-amber-600">
              {' '}Sin unidades disponibles en {proyectoActual?.nombre ?? 'este proyecto'} no hay
              precio promedio con el que estimar el valor de comisión.
            </span>
          )}
        </span>
      </div>

      {/* Channel cards */}
      {channels.map(ch => {
        const channelRules = commissionRules.filter(r => r.channelId === ch.id);
        const extPct = ch.externalCommissionPct;

        // Real-time channel summary calculations (siempre Modo A: sobre venta).
        // La comisión total es de ESTE canal: cada uno define la suya.
        const totalDefinido = motorConfig.channelTotals[ch.id] !== undefined;
        const comisionTotal = motorConfig.channelTotals[ch.id] ?? 0;
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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{ch.name}</h3>
                <Badge variant="outline" className="text-[10px]">Ext: {extPct}%</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* La comisión total se define por canal, no una sola para todos. */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Comisión total</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Sin definir"
                    className={`w-24 h-9 text-sm font-mono ${totalDefinido ? '' : 'border-amber-500'}`}
                    value={totalDefinido ? comisionTotal : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = { ...motorConfig.channelTotals };
                      if (raw === '') delete next[ch.id];
                      else next[ch.id] = Math.min(100, Math.max(0, +raw));
                      updateMotorConfig({ channelTotals: next });
                    }}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border ${statusColor}`}>
                  {statusIcon}
                  {statusText}
                </div>
                <Button variant="outline" size="sm" onClick={() => setAltaCanal(ch.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar comisionista
                </Button>
              </div>
            </div>

            {!totalDefinido && (
              <p className="mb-3 text-xs text-amber-600">
                Define la comisión total de este canal para poder repartirla entre sus comisionistas.
              </p>
            )}

            {channelRules.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin comisionistas dados de alta en este canal</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Comisionista</th>
                    <th>Rol</th>
                    <th>
                      % sobre precio de venta final
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Porcentaje de comisión a dispersar a esta persona, calculado sobre el precio de venta final de la unidad.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th>
                      Valor comisión estimado
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          % sobre precio de venta final × precio promedio ponderado por unidad
                          disponible del proyecto{precioPromUnidad > 0 ? ` (${formatCurrency(precioPromUnidad)})` : ''}.
                          Es lo que cobraría el comisionista por vender una unidad al precio promedio.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th>
                      % de la comisión a dispersar
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Qué parte de la Comisión a Dispersar del canal ({comisionInterna.toFixed(2)}%) se lleva esta persona. Se calcula solo.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th>Pool</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {channelRules.map(rule => {
                    const { role } = getRoleInfo(rule.roleId);
                    const persona = rule.personalId ? comisionistaPorId.get(rule.personalId) : undefined;
                    const sharePct = comisionInterna > 0 ? (rule.percentage / comisionInterna) * 100 : 0;
                    // Personas ya dadas de alta en este canal: no se ofrecen de nuevo.
                    const yaEnCanal = new Set(
                      channelRules.filter(r => r.id !== rule.id).map(r => r.personalId).filter(Boolean) as string[],
                    );
                    return (
                      <tr key={rule.id}>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <select
                              value={rule.personalId ?? ''}
                              onChange={e => cambiarComisionista(rule.id, e.target.value)}
                              className={`rounded border bg-transparent px-2 py-1 text-sm font-medium ${rule.personalId ? '' : 'border-amber-500 text-amber-600'}`}
                            >
                              {!rule.personalId && <option value="">Sin comisionista asignado</option>}
                              {comisionistas
                                .filter(c => !yaEnCanal.has(c.personalId))
                                .map(c => (
                                  <option key={c.personalId} value={c.personalId}>
                                    {c.nombre} — {c.roles[0].rolNombre}
                                    {c.roles.length > 1 ? ` (+${c.roles.length - 1})` : ''}
                                  </option>
                                ))}
                            </select>
                            {!rule.personalId && (
                              <span className="text-[11px] text-amber-600 pl-2">
                                Regla heredada por rol — asigna una persona o elimínala
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {/* Con más de un rol se elige cuál aplica; con uno solo
                              se muestra, porque no hay nada que decidir. */}
                          {persona && persona.roles.length > 1 ? (
                            <div className="flex flex-col gap-0.5">
                              <select
                                value={rule.roleId}
                                onChange={e => cambiarRolComisionista(rule.id, e.target.value)}
                                className="rounded border bg-transparent px-2 py-1 text-sm"
                              >
                                {persona.roles.map(r => (
                                  <option key={r.roleId} value={r.roleId}>
                                    {r.rolNombre}
                                    {r.origen === 'proyecto' && r.proyectoNombre ? ` · en ${r.proyectoNombre}` : ''}
                                  </option>
                                ))}
                              </select>
                              <span className="text-[11px] text-muted-foreground">
                                {persona.roles.length} roles disponibles
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm">
                                {persona?.roles[0]?.rolNombre ?? role?.name ?? '—'}
                              </span>
                              {role && (
                                <span className="text-[11px] text-muted-foreground">
                                  {role.belongsTo === 'sozu_central' ? 'SOZU Central' : 'Proyecto'}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 h-8 text-sm font-mono"
                            value={rule.percentage}
                            onChange={e => updateRule(rule.id, { percentage: Math.max(0, +e.target.value) })}
                          />
                        </td>
                        <td className="font-semibold font-mono text-sm whitespace-nowrap">
                          {precioPromUnidad > 0
                            ? formatCurrency(rule.percentage / 100 * precioPromUnidad)
                            : <span className="font-normal text-muted-foreground">—</span>}
                        </td>
                        <td>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 h-8 text-sm font-mono"
                            value={Number.isFinite(sharePct) ? +sharePct.toFixed(2) : 0}
                            disabled
                            readOnly
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
                        El remanente es la comisión interna disponible aún no asignada a comisionistas. Se calcula como la comisión total menos la comisión externa del canal y menos la suma de los porcentajes capturados.
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
                    Comisionistas agregados: <strong>{h.rolesAdded}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AltaComisionistaDialog
        canal={channels.find(c => c.id === altaCanal) ?? null}
        comisionistas={comisionistas}
        yaEnCanal={new Set(
          commissionRules.filter(r => r.channelId === altaCanal).map(r => r.personalId).filter(Boolean) as string[],
        )}
        onClose={() => setAltaCanal(null)}
        onAgregar={(persona, rol) => {
          if (!altaCanal) return;
          altaComisionista(altaCanal, persona, rol);
        }}
      />

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


/**
 * Selector de alta: lista el personal dado de alta en "Roles y Sueldos" con sus
 * roles. Quien ejerce más de un rol —porque asume roles distintos según el
 * proyecto— permite elegir con cuál comisiona en este canal.
 */
function AltaComisionistaDialog({ canal, comisionistas, yaEnCanal, onClose, onAgregar }: {
  canal: { id: string; name: string } | null;
  comisionistas: ComisionistaReal[];
  yaEnCanal: Set<string>;
  onClose: () => void;
  onAgregar: (persona: ComisionistaReal, rol: RolComisionista) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  /** Rol elegido por persona cuando ejerce varios. */
  const [rolElegido, setRolElegido] = useState<Record<string, string>>({});

  const cerrar = () => { setBusqueda(''); setRolElegido({}); onClose(); };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comisionistas;
    return comisionistas.filter(c =>
      `${c.nombre} ${c.roles.map(r => r.rolNombre).join(' ')}`.toLowerCase().includes(q),
    );
  }, [comisionistas, busqueda]);

  const disponibles = filtrados.filter(c => !yaEnCanal.has(c.personalId)).length;

  return (
    <Dialog open={canal !== null} onOpenChange={(open) => { if (!open) cerrar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Agregar comisionista</DialogTitle>
          <DialogDescription>
            Personal de la organización dado de alta en <strong>Roles y Sueldos</strong>.
            Se agregará al canal <strong>{canal?.name}</strong> con 0% para que captures su porcentaje.
          </DialogDescription>
        </DialogHeader>

        {comisionistas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            No hay personal con rol vinculado. Da de alta personal y asígnale un rol en Roles y Sueldos.
          </p>
        ) : (
          <>
            <Input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o rol..."
              className="h-9 text-sm"
            />
            <div className="max-h-96 overflow-y-auto -mx-1 px-1 space-y-1">
              {filtrados.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4">Ningún resultado para la búsqueda.</p>
              ) : filtrados.map(persona => {
                const yaEsta = yaEnCanal.has(persona.personalId);
                const multiRol = persona.roles.length > 1;
                const rolId = rolElegido[persona.personalId] ?? persona.roles[0].roleId;
                const rol = persona.roles.find(r => r.roleId === rolId) ?? persona.roles[0];

                return (
                  <div
                    key={persona.personalId}
                    className={`rounded-lg border px-3 py-2 ${yaEsta ? 'opacity-55 bg-muted/40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{persona.nombre}</span>
                        {!multiRol && (
                          <span className="text-xs text-muted-foreground truncate">
                            {rol.rolNombre} · {rol.belongsTo === 'sozu_central' ? 'SOZU Central' : 'Proyecto'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!rol.participaComision && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                            Rol sin comisión
                          </Badge>
                        )}
                        {yaEsta ? (
                          <Badge variant="secondary" className="text-[10px]">Ya en el canal</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 gap-1"
                            onClick={() => { onAgregar(persona, rol); cerrar(); }}>
                            <Plus className="h-3 w-3" /> Agregar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Solo quien ejerce varios roles necesita elegir. */}
                    {multiRol && !yaEsta && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-muted-foreground shrink-0">Comisiona como</span>
                        <select
                          value={rolId}
                          onChange={e => setRolElegido(prev => ({ ...prev, [persona.personalId]: e.target.value }))}
                          className="flex-1 rounded border bg-transparent px-2 py-1 text-xs"
                        >
                          {persona.roles.map(r => (
                            <option key={r.roleId} value={r.roleId}>
                              {r.rolNombre}
                              {r.origen === 'proyecto' && r.proyectoNombre ? ` · en ${r.proyectoNombre}` : ' · rol base'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {multiRol && yaEsta && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ejerce {persona.roles.length} roles: {persona.roles.map(r => r.rolNombre).join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {disponibles === 0
                ? 'Todo el personal listado ya comisiona en este canal.'
                : `${disponibles} persona(s) disponible(s) para agregar.`}
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
