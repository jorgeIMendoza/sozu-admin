import { useState, useEffect, useMemo } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Plus, Trash2, RefreshCw, Info, History, Send, Loader2, Building2, Save, ChevronRight } from 'lucide-react';
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

type Cuadre = 'completo' | 'falta' | 'excedido' | 'sin_definir';

interface EstadoCanal {
  totalDefinido: boolean;
  comisionTotal: number;
  comisionExterna: number;
  comisionInterna: number;
  dispersada: number;
  remanente: number;
  comisionistas: number;
  /** Cuántos de ellos ya tienen un porcentaje capturado. */
  conPorcentaje: number;
  cuadre: Cuadre;
}

/**
 * Estado del cuadre como color de acento, no como fondo de bloque completo.
 *
 * El resumen antes se pintaba entero del color del estado, así que un canal con
 * faltante gritaba en ámbar sobre toda su tarjeta y competía con las cifras que
 * uno va a leer. Aquí el color queda en el chip y en el remanente, que es el
 * único dato que cambia de significado según el estado.
 */
const ESTILO_CUADRE: Record<Cuadre, { chip: string; texto: string; etiqueta: (e: EstadoCanal) => string }> = {
  completo: {
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    texto: 'text-emerald-600',
    etiqueta: () => 'Distribución completa',
  },
  falta: {
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    texto: 'text-amber-600',
    etiqueta: (e) => `Falta por dispersar ${e.remanente.toFixed(2)}%`,
  },
  excedido: {
    chip: 'border-destructive/40 bg-destructive/10 text-destructive',
    texto: 'text-destructive',
    etiqueta: (e) => `Excedido por ${Math.abs(e.remanente).toFixed(2)}%`,
  },
  sin_definir: {
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    texto: 'text-amber-600',
    etiqueta: () => 'Comisión total sin definir',
  },
};

/** Los `select` nativos se alinean con los Input del sistema de diseño. */
const CLASE_SELECT =
  'h-8 rounded-md border border-input bg-background px-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

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
   *
   * No se filtra por tipo de personal: el colaborador de Investimento comisiona
   * igual que el empleado directo, aunque su sueldo no lo pague SOZU. Lo único
   * que excluye a alguien es no tener rol, porque la regla se guarda contra uno.
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

  /*
   * NO se sincroniza solo al entrar.
   *
   * Antes un `useEffect` metía a todo el personal con rol que comisiona cada vez
   * que se abría el menú o se cambiaba de proyecto. Eso deshacía el trabajo del
   * usuario: quien quitaba un comisionista lo veía volver al siguiente ingreso,
   * y la matriz guardada dejaba de ser la que se había decidido. Dar de alta a
   * alguien es una decisión, no un efecto de navegar.
   *
   * La sincronización sigue existiendo, pero solo cuando se pide: el botón
   * «Sincronizar» del encabezado o el alta puntual con «Agregar comisionista».
   */

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

  /**
   * Estado de cuadre de cada canal, calculado una vez para todos.
   *
   * Antes cada tarjeta lo resolvía por su cuenta, así que no existía forma de
   * saber cuántos canales estaban mal sin recorrerlos uno por uno.
   */
  const estadoPorCanal = useMemo(() => {
    const mapa = new Map<string, EstadoCanal>();
    for (const ch of channels) {
      const reglas = commissionRules.filter(r => r.channelId === ch.id);
      const totalDefinido = motorConfig.channelTotals[ch.id] !== undefined;
      const comisionTotal = motorConfig.channelTotals[ch.id] ?? 0;
      const comisionInterna = comisionTotal - ch.externalCommissionPct;
      const dispersada = reglas.reduce((s, r) => s + r.percentage, 0);
      const remanente = comisionInterna - dispersada;
      mapa.set(ch.id, {
        totalDefinido,
        comisionTotal,
        comisionExterna: ch.externalCommissionPct,
        comisionInterna,
        dispersada,
        remanente,
        comisionistas: reglas.length,
        conPorcentaje: reglas.filter(r => r.percentage > 0).length,
        cuadre: !totalDefinido ? 'sin_definir'
          : Math.abs(remanente) < 0.005 ? 'completo'
            : remanente > 0 ? 'falta' : 'excedido',
      });
    }
    return mapa;
  }, [channels, commissionRules, motorConfig.channelTotals]);

  const resumenCanales = useMemo(() => {
    const conteo = { completo: 0, falta: 0, excedido: 0, sin_definir: 0 };
    for (const e of estadoPorCanal.values()) conteo[e.cuadre]++;
    return conteo;
  }, [estadoPorCanal]);

  /**
   * Canales plegados. Se arranca plegando los que ya cuadran: lo que necesita
   * atención queda a la vista y lo resuelto no ocupa media pantalla. El
   * encabezado plegado conserva las cifras, así que nada queda escondido.
   */
  const [plegados, setPlegados] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (plegados !== null || estadoPorCanal.size === 0) return;
    const iniciales = new Set<string>();
    for (const [id, e] of estadoPorCanal) if (e.cuadre === 'completo') iniciales.add(id);
    setPlegados(iniciales);
  }, [estadoPorCanal, plegados]);
  const estaPlegado = (id: string) => plegados?.has(id) ?? false;
  const alternarPliegue = (id: string) => setPlegados(prev => {
    const siguiente = new Set(prev ?? []);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    return siguiente;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado. Antes cuatro botones del mismo peso competían en una sola
          fila; ahora se separan por jerarquía: contexto arriba, acciones
          secundarias en línea, y guardar solo cuando hay algo que guardar. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Motor de Comisiones</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Da de alta a los comisionistas de cada canal y su % sobre el precio de venta final. La
            suma de los comisionistas más la comisión externa debe igualar la comisión total del
            canal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                    <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Da de alta en cada canal al personal de Roles y Sueldos cuyo rol participa en comisión y aún no esté.
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(v => !v)} className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Barra de cambios pendientes: guardar y enviar a validar viven aquí,
          donde el estado del documento se explica en vez de vivir en un
          tooltip sobre un botón deshabilitado. */}
      {motorProjectId != null && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${
          motorDirty ? 'border-amber-500/40 bg-amber-500/10' : 'bg-muted/30'
        }`}>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {motorDirty ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-foreground font-medium">Cambios sin guardar</span>
                <span>en la matriz o en la comisión total. Guárdalos para poder enviar a validar.</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Todo guardado{proyectoActual ? ` en ${proyectoActual.nombre}` : ''}.
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
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
            <Button
              variant={motorDirty ? 'outline' : 'default'}
              size="sm"
              onClick={() => setValidarOpen(true)}
              disabled={motorDirty}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Enviar a validar
            </Button>
          </div>
        </div>
      )}

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
      {/* Estado de los canales de un vistazo: antes había que recorrer las seis
          tarjetas para saber cuáles estaban mal. */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              {channels.length} canal{channels.length === 1 ? '' : 'es'}
            </span>
            {resumenCanales.completo > 0 && (
              <ChipCuadre cuadre="completo" texto={`${resumenCanales.completo} cuadran`} />
            )}
            {resumenCanales.falta > 0 && (
              <ChipCuadre cuadre="falta" texto={`${resumenCanales.falta} con faltante`} />
            )}
            {resumenCanales.excedido > 0 && (
              <ChipCuadre cuadre="excedido" texto={`${resumenCanales.excedido} excedido${resumenCanales.excedido === 1 ? '' : 's'}`} />
            )}
            {resumenCanales.sin_definir > 0 && (
              <ChipCuadre cuadre="sin_definir" texto={`${resumenCanales.sin_definir} sin comisión total`} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Precio prom. ponderado / unidad</p>
              {precioPromUnidad > 0 ? (
                <p className="text-sm font-semibold font-mono">{formatCurrency(precioPromUnidad)}</p>
              ) : (
                <p className="text-xs text-amber-600">Sin unidades disponibles</p>
              )}
            </div>
            {plegados !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setPlegados(
                  plegados.size === channels.length ? new Set() : new Set(channels.map(c => c.id)),
                )}
              >
                {plegados.size === channels.length ? 'Expandir todos' : 'Plegar todos'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Los comisionistas son el personal dado de alta en <strong>Roles y Sueldos</strong>; su rol
          se muestra y no se teclea aquí.
          {comisionistas.length === 0 && (
            <span className="text-amber-600">
              {' '}Todavía no hay personal con rol vinculado, así que no hay a quién dar de alta.
            </span>
          )}
          {precioPromUnidad === 0 && (
            <span className="text-amber-600">
              {' '}Sin unidades disponibles en {proyectoActual?.nombre ?? 'este proyecto'} no se puede
              estimar el valor de comisión en pesos.
            </span>
          )}
        </p>
      </div>

      {/* Channel cards */}
      {channels.map(ch => {
        const channelRules = commissionRules.filter(r => r.channelId === ch.id);
        const extPct = ch.externalCommissionPct;

        // Cifras del canal, ya resueltas junto con las de los demás.
        const estado = estadoPorCanal.get(ch.id)!;
        const {
          totalDefinido, comisionTotal, comisionExterna, comisionInterna, remanente,
          dispersada: sumaDispersada,
        } = estado;
        const estilo = ESTILO_CUADRE[estado.cuadre];
        const plegado = estaPlegado(ch.id);

        return (
          <div key={ch.id} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => alternarPliegue(ch.id)}
                className="flex items-center gap-2 min-w-0 text-left"
              >
                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${plegado ? '' : 'rotate-90'}`} />
                <h3 className="font-semibold truncate">{ch.name}</h3>
                <Badge variant="outline" className="text-[10px] shrink-0">Ext: {extPct}%</Badge>
                {/* Cuántos hay y cuántos ya tienen porcentaje: un canal con
                    cuatro comisionistas y dos en cero no está repartido. */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {estado.comisionistas} comisionista{estado.comisionistas === 1 ? '' : 's'}
                  {estado.comisionistas > estado.conPorcentaje && (
                    <span className="text-amber-600"> · {estado.comisionistas - estado.conPorcentaje} sin %</span>
                  )}
                </span>
              </button>

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
                    className={`w-24 h-8 text-sm font-mono ${totalDefinido ? '' : 'border-amber-500'}`}
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
                <ChipCuadre cuadre={estado.cuadre} texto={estilo.etiqueta(estado)} />
                <Button variant="outline" size="sm" onClick={() => setAltaCanal(ch.id)} className="h-8">
                  <Plus className="h-3 w-3 mr-1" /> Agregar comisionista
                </Button>
              </div>
            </div>

            {plegado ? null : (
            <div className="mt-4">
            {!totalDefinido && (
              <p className="mb-3 text-xs text-amber-600">
                Define la comisión total de este canal para poder repartirla entre sus comisionistas.
              </p>
            )}

            {channelRules.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">Sin comisionistas en este canal.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAltaCanal(ch.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar comisionista
                </Button>
              </div>
            ) : (
              /* Sin contenedor propio la tabla empujaba la página entera a
                 desplazarse y la columna del comisionista quedaba cortada bajo el
                 menú lateral. Aquí el scroll es de la tabla y esa columna se ancla. */
              <div className="overflow-x-auto">
              <table className="data-table data-table--anclada">
                <thead>
                  <tr>
                    <th>Comisionista</th>
                    <th>Rol</th>
                    {/* Encabezados cortos con su explicación en el tooltip: los
                        largos estiraban la tabla más allá del ancho útil. */}
                    <th className="text-right">
                      % s/ venta
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Porcentaje de comisión a dispersar a esta persona, calculado sobre el precio de venta final de la unidad.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-right">
                      Valor estimado
                      <Tooltip>
                        <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          % sobre precio de venta final × precio promedio ponderado por unidad
                          disponible del proyecto{precioPromUnidad > 0 ? ` (${formatCurrency(precioPromUnidad)})` : ''}.
                          Es lo que cobraría el comisionista por vender una unidad al precio promedio.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-right">
                      % del reparto
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
                              className={`${CLASE_SELECT} font-medium ${rule.personalId ? '' : 'border-amber-500 text-amber-600'}`}
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
                                className={CLASE_SELECT}
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
                        <td className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-24 h-8 text-sm font-mono text-right ml-auto"
                            value={rule.percentage}
                            onChange={e => updateRule(rule.id, { percentage: Math.max(0, +e.target.value) })}
                          />
                        </td>
                        <td className="text-right font-semibold font-mono text-sm whitespace-nowrap">
                          {precioPromUnidad > 0
                            ? formatCurrency(rule.percentage / 100 * precioPromUnidad)
                            : <span className="font-normal text-muted-foreground">—</span>}
                        </td>
                        {/* Dato derivado: se muestra como texto. Como campo
                            deshabilitado parecía editable pero averiado. */}
                        <td className="text-right font-mono text-sm text-foreground/70">
                          {Number.isFinite(sharePct) ? sharePct.toFixed(2) : '0.00'}%
                        </td>
                        <td>
                          <select
                            value={rule.pool}
                            onChange={e => updateRule(rule.id, { pool: e.target.value as 'sozu' | 'project' })}
                            className={CLASE_SELECT}
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

                  {/* Cierra el circuito con el resumen de abajo: lo que suman los
                      renglones es exactamente la cifra "Dispersada". */}
                  <tr className="border-t">
                    <td className="font-semibold text-sm">Total dispersado</td>
                    <td></td>
                    <td className="text-right font-bold font-mono text-sm">
                      {sumaDispersada.toFixed(2)}%
                    </td>
                    <td className="text-right font-bold font-mono text-sm whitespace-nowrap">
                      {precioPromUnidad > 0
                        ? formatCurrency(sumaDispersada / 100 * precioPromUnidad)
                        : '—'}
                    </td>
                    <td className="text-right font-bold font-mono text-sm">
                      {comisionInterna > 0 ? ((sumaDispersada / comisionInterna) * 100).toFixed(2) : '0.00'}%
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
              </div>
            )}

            {/* Resumen del canal. Las cuatro primeras cifras comparten estilo —son
                la bolsa y sus salidas—; solo el remanente se distingue, porque es
                el resultado y el que cambia de color según el cuadre. Misma
                convención que el menú Escenarios. */}
            <div className="mt-4 rounded-lg border bg-muted/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Resumen del canal
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <CifraCanal etiqueta="Comisión total" valor={comisionTotal} />
                <CifraCanal etiqueta="Externa" valor={comisionExterna} />
                <CifraCanal etiqueta="Interna esperada" valor={comisionInterna} />
                <CifraCanal etiqueta="Dispersada" valor={sumaDispersada} />
                <CifraCanal
                  etiqueta="Remanente"
                  valor={remanente}
                  destacado
                  color={estilo.texto}
                  ayuda="Comisión interna aún no asignada: la comisión total, menos la externa del canal, menos la suma de los porcentajes capturados."
                />
              </div>
            </div>
            </div>
            )}
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
/** Estado de cuadre, con icono y texto: nunca solo por color. */
function ChipCuadre({ cuadre, texto }: { cuadre: Cuadre; texto: string }) {
  const Icono = cuadre === 'completo' ? CheckCircle : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap ${ESTILO_CUADRE[cuadre].chip}`}>
      <Icono className="h-3.5 w-3.5 shrink-0" />
      {texto}
    </span>
  );
}

/**
 * Una cifra del resumen del canal. Todas comparten estilo salvo la destacada:
 * comparar cuatro porcentajes exige que nada más que el número las separe.
 */
function CifraCanal({ etiqueta, valor, destacado, color, ayuda }: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
  color?: string;
  ayuda?: string;
}) {
  return (
    <div className={`rounded-md px-3 py-2 ${destacado ? 'border border-primary/30 bg-background' : ''}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {etiqueta}
        {ayuda && (
          <Tooltip>
            <TooltipTrigger><Info className="h-3 w-3 opacity-60" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{ayuda}</TooltipContent>
          </Tooltip>
        )}
      </p>
      <p className={`text-base font-bold font-mono mt-0.5 ${destacado ? color ?? '' : 'text-foreground'}`}>
        {valor.toFixed(2)}%
      </p>
    </div>
  );
}

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

  // Solo quien realmente se puede agregar: sin rol no hay regla que guardar.
  const disponibles = filtrados.filter(c => !yaEnCanal.has(c.personalId) && c.roles.length > 0).length;
  const sinRolCount = filtrados.filter(c => c.roles.length === 0).length;

  return (
    <Dialog open={canal !== null} onOpenChange={(open) => { if (!open) cerrar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Agregar comisionista</DialogTitle>
          <DialogDescription>
            Personal de la organización dado de alta en <strong>Roles y Sueldos</strong>, incluidos
            los colaboradores de Investimento: no son empleados directos, pero sí comisionan.
            Se agregará al canal <strong>{canal?.name}</strong> con 0% para que captures su porcentaje.
          </DialogDescription>
        </DialogHeader>

        {comisionistas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            No hay personal dado de alta. Regístralo en Roles y Sueldos.
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
                const sinRol = persona.roles.length === 0;
                const multiRol = persona.roles.length > 1;
                const rolId = rolElegido[persona.personalId] ?? persona.roles[0]?.roleId;
                const rol = persona.roles.find(r => r.roleId === rolId) ?? persona.roles[0];
                const esInvestimento = persona.tipoPersonal === 'colaborador_investimento';

                return (
                  <div
                    key={persona.personalId}
                    className={`rounded-lg border px-3 py-2 ${yaEsta || sinRol ? 'opacity-70 bg-muted/40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate flex items-center gap-1.5">
                          {persona.nombre}
                          {/* El colaborador de Investimento comisiona igual: se
                              distingue para saber que su sueldo no es de SOZU. */}
                          {esInvestimento && (
                            <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                              Investimento
                            </Badge>
                          )}
                        </span>
                        {sinRol ? (
                          <span className="text-xs text-amber-600 truncate">
                            Sin rol asignado — vincúlale uno en Roles y Sueldos para poder comisionar
                          </span>
                        ) : !multiRol && (
                          <span className="text-xs text-muted-foreground truncate">
                            {rol.rolNombre} · {rol.belongsTo === 'sozu_central' ? 'SOZU Central' : 'Proyecto'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!sinRol && !rol.participaComision && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                            Rol sin comisión
                          </Badge>
                        )}
                        {yaEsta ? (
                          <Badge variant="secondary" className="text-[10px]">Ya en el canal</Badge>
                        ) : sinRol ? (
                          // La regla se guarda contra un rol: sin rol no hay qué
                          // guardar, así que se dice en vez de fallar al hacer clic.
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                            Falta su rol
                          </Badge>
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
                ? 'Nadie más se puede agregar a este canal.'
                : `${disponibles} persona${disponibles === 1 ? '' : 's'} para agregar.`}
              {sinRolCount > 0 && ` ${sinRolCount} sin rol asignado.`}
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
