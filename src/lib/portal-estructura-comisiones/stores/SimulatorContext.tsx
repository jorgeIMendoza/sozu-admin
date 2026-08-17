import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AppState, Project, Role, Channel, Scenario, RoleAssignment, CommercialPoliciesConfig, CommissionRule, MotorConfig } from '../types/simulator';
import {
  defaultProjects, defaultRoles, defaultChannels, defaultScenarios,
  defaultRoleAssignments, defaultCommercialPolicies,
} from '../utils/seed-data';
import {
  fetchCanalesReales, seedCanalesReales, insertCanalRemoto, updateCanalRemoto, deleteCanalRemoto,
  fetchReglasComisionReales, insertReglasComisionRemotas,
  updateReglaComisionRemota, deleteReglaComisionRemota,
  fetchMotorConfigReal, updateMotorConfigRemoto,
} from '@/hooks/usePortalEstructuraComisiones/useMotorComisionesSync';
import {
  useEstructuraRealRaw, derivarEstructura, derivarRolesSimulador, type EstructuraDerivada,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador';

/**
 * Sin config guardada, no hay total por canal: cada canal arranca sin definir y
 * la pantalla lo pide. Antes el default era un 6% global que se aplicaba a
 * todos los canales por igual y que nunca se persistía.
 */
const DEFAULT_MOTOR_CONFIG: MotorConfig = { channelTotals: {} };

const STORAGE_KEY = 'sozu-ec-simulator-state';

interface SimulatorContextType extends AppState {
  addProject: (p: Project) => void;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  addRole: (r: Role) => void;
  updateRole: (r: Role) => void;
  deleteRole: (id: string) => void;
  addRoleAssignment: (ra: RoleAssignment) => void;
  updateRoleAssignment: (ra: RoleAssignment) => void;
  deleteRoleAssignment: (id: string) => void;
  addChannel: (c: Channel) => Promise<void>;
  updateChannel: (c: Channel, changeNote?: string) => void;
  duplicateChannel: (id: string) => Promise<void>;
  deleteChannel: (id: string) => void;
  getChannelDependencies: (id: string) => string[];
  addScenario: (s: Scenario) => void;
  updateScenario: (s: Scenario) => void;
  deleteScenario: (id: string) => void;
  duplicateScenario: (id: string) => void;
  updateCommercialPolicies: (cp: CommercialPoliciesConfig) => void;
  resetToDefaults: () => void;
  /** Proyecto (desarrollo real) para el que el Motor de Comisiones está configurando la matriz y el Modo/Total. `null` = ninguno seleccionado todavía. */
  motorProjectId: number | null;
  setMotorProjectId: (id: number | null) => void;
  /** true mientras se está cargando la matriz/config del proyecto seleccionado desde el servidor. */
  motorLoading: boolean;
  /** true si hay cambios locales (reglas o Comisión Total) sin guardar todavía en el servidor. */
  motorDirty: boolean;
  /** true mientras `saveMotorComisiones` está en vuelo. */
  motorSaving: boolean;
  /**
   * Matriz de comisión canal × puesto del proyecto seleccionado (`motorProjectId`).
   * Estas 3 acciones son 100% locales — no tocan el servidor. Los cambios se
   * acumulan en memoria hasta llamar `saveMotorComisiones`.
   */
  addCommissionRule: (channelId: string, roleId: string, pool: 'sozu' | 'project', personalId: string | null) => void;
  updateCommissionRule: (rule: CommissionRule) => void;
  deleteCommissionRule: (id: string) => void;
  /**
   * Copia las reglas de un canal a otro. `replace` sustituye lo que hubiera en
   * el destino; si no, conserva a quien ya esté y solo suma a los que falten.
   */
  copyChannelRules: (
    fromChannelId: string,
    toChannelId: string,
    replace: boolean,
  ) => { copiadas: number; omitidas: number };
  /**
   * Agrega localmente los comisionistas que falten: cada persona activa cuyo rol
   * participa en comisión, en cada canal donde aún no esté. No persiste —
   * requiere `saveMotorComisiones`.
   */
  syncMissingCommissionRules: (comisionistas: ComisionistaDisponible[]) => number;
  /** Config real del Motor de Comisiones (Modo A/B + Comisión Total) del proyecto seleccionado. Local únicamente. */
  updateMotorConfig: (config: MotorConfig) => void;
  /** Persiste en el servidor todos los cambios locales acumulados (reglas agregadas/editadas/eliminadas + Comisión Total) para el proyecto seleccionado. */
  saveMotorComisiones: () => Promise<boolean>;
  /**
   * Relee del servidor los datos imperativos del Motor (catálogo de canales +
   * matriz de comisiones y config del proyecto seleccionado). Alimenta el botón
   * "Actualizar" de la consulta de solo lectura: como estos datos no son de
   * react-query, invalidar la caché no basta para refrescarlos.
   */
  reloadMotor: () => Promise<void>;
  /**
   * Diagnóstico de la derivación de `roleAssignments` desde el Directorio real
   * ("Roles y Sueldos"). `null` cuando todavía no hay personal capturado y la
   * estructura sigue siendo la local del simulador.
   */
  estructuraReal: EstructuraDerivada | null;
}

/**
 * Persona elegible como comisionista: su rol ya resuelto al catálogo del
 * simulador (`roleId`), para que la regla siga agrupando pagos por rol.
 */
export interface ComisionistaDisponible {
  personalId: string;
  nombre: string;
  roleId: string;
  belongsTo: 'sozu_central' | 'project';
}

const SimulatorContext = createContext<SimulatorContextType | null>(null);

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.channels) {
        parsed.channels = parsed.channels.map((ch: any) => ({
          ...ch, active: ch.active !== undefined ? ch.active : true,
        }));
      }
      if (!parsed.commercialPolicies) parsed.commercialPolicies = defaultCommercialPolicies;
      else {
        parsed.commercialPolicies.policies = (parsed.commercialPolicies.policies || []).map((p: any) => ({
          ...p, discountPct: typeof p.discountPct === 'number' ? p.discountPct : 0,
        }));
        if (!parsed.commercialPolicies.discountHistory) parsed.commercialPolicies.discountHistory = [];
      }
      if (parsed.projects) {
        parsed.projects = parsed.projects.map((p: any) => ({
          ...p,
          salesStartDate: p.salesStartDate || p.startDate || '',
          deliveryDate: p.deliveryDate || p.endDate || '',
        }));
        const existingIds = new Set(parsed.projects.map((p: any) => p.id));
        const missingDefaults = defaultProjects.filter((p) => !existingIds.has(p.id));
        parsed.projects = [...parsed.projects, ...missingDefaults];
      }
      if (!parsed.commissionRules) parsed.commissionRules = [];
      // El localStorage puede traer el formato viejo `{ totalCommissionPct }`,
      // de cuando el total era único para todos los canales. Se descarta: el
      // total por canal se lee del servidor al seleccionar proyecto.
      if (!parsed.motorConfig?.channelTotals) parsed.motorConfig = DEFAULT_MOTOR_CONFIG;
      return parsed;
    }
  } catch { /* ignore */ }
  return {
    projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
    scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
    commercialPolicies: defaultCommercialPolicies, commissionRules: [],
    motorConfig: DEFAULT_MOTOR_CONFIG,
  };
}

const MOTOR_PROJECT_KEY = 'sozu-ec-motor-project-id';

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [motorProjectId, setMotorProjectIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(MOTOR_PROJECT_KEY);
    return stored ? Number(stored) : null;
  });
  const [motorLoading, setMotorLoading] = useState(false);
  const [motorDirty, setMotorDirty] = useState(false);
  const [motorSaving, setMotorSaving] = useState(false);
  /** Ids reales (no `local-`) de reglas eliminadas localmente, pendientes de borrar en el servidor al guardar. */
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const setMotorProjectId = useCallback((id: number | null) => {
    setMotorProjectIdState(id);
    if (id == null) localStorage.removeItem(MOTOR_PROJECT_KEY);
    else localStorage.setItem(MOTOR_PROJECT_KEY, String(id));
  }, []);

  // Lectura del catálogo global de canales desde el servidor (sin sembrar: el
  // seed solo aplica en el primer montaje). La BD manda sobre lo local.
  const loadCanales = useCallback(async () => {
    const remoteChannels = await fetchCanalesReales();
    setState(prev => ({
      ...prev,
      channels: remoteChannels && remoteChannels.length > 0 ? remoteChannels : prev.channels,
    }));
  }, []);

  // Lectura de la matriz de comisiones + config del proyecto indicado.
  const loadMotorProyecto = useCallback(async (projId: number) => {
    setMotorLoading(true);
    try {
      const [remoteRules, remoteMotorConfig] = await Promise.all([
        fetchReglasComisionReales(projId), fetchMotorConfigReal(projId),
      ]);
      setState(prev => ({
        ...prev,
        commissionRules: remoteRules ?? [],
        motorConfig: remoteMotorConfig ?? DEFAULT_MOTOR_CONFIG,
      }));
    } finally {
      setMotorLoading(false);
    }
  }, []);

  // Botón "Actualizar": relee canales + matriz/config del proyecto en curso y
  // descarta cualquier borrador local (no aplica en la vista de solo lectura).
  const reloadMotor = useCallback(async () => {
    setMotorDirty(false);
    setPendingDeletes([]);
    await Promise.all([
      loadCanales(),
      motorProjectId != null ? loadMotorProyecto(motorProjectId) : Promise.resolve(),
    ]);
  }, [loadCanales, loadMotorProyecto, motorProjectId]);

  // Canales (catálogo global) son compartidos vía Supabase — al montar, la
  // BD manda sobre el localStorage local. Si la tabla aún no existe (DDL
  // pendiente) o hay un error de red, sigue funcionando 100% local.
  useEffect(() => {
    (async () => {
      const remoteChannels = await fetchCanalesReales();
      if (remoteChannels !== null && remoteChannels.length === 0) {
        await seedCanalesReales(state.channels);
      }
      setState(prev => ({
        ...prev,
        channels: remoteChannels && remoteChannels.length > 0 ? remoteChannels : prev.channels,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La matriz de Comisiones (canal × puesto) y la config del motor (Modo/Total)
  // son por proyecto — se recargan cada vez que cambia `motorProjectId`. Sin
  // proyecto seleccionado, quedan vacías/en default (nada que editar todavía).
  //
  // `motorLoading` marca la ventana en la que este fetch está en vuelo.
  // Es importante para que otros efectos (ej. el auto-sync de roles nuevos en
  // `CommissionsTab.tsx`) no operen sobre `commissionRules` todavía obsoleto
  // (del proyecto anterior) mientras este fetch no haya resuelto — hacerlo
  // causaba que se intentaran crear reglas que ya existían en el proyecto
  // nuevo, y Postgres rechazaba el insert con `23505 duplicate key`.
  useEffect(() => {
    setMotorDirty(false);
    setPendingDeletes([]);
    if (motorProjectId == null) {
      setState(prev => ({ ...prev, commissionRules: [], motorConfig: DEFAULT_MOTOR_CONFIG }));
      setMotorLoading(false);
      return;
    }
    void loadMotorProyecto(motorProjectId);
  }, [motorProjectId, loadMotorProyecto]);

  // La estructura organizacional dejó de teclearse aparte: se deriva del
  // Directorio real de personal ("Roles y Sueldos"). Mientras no haya personal
  // capturado —o falte el DDL— `estructuraReal` es null y se conserva la
  // estructura local previa, así ninguna pantalla se queda sin datos.
  const { data: estructuraRaw } = useEstructuraRealRaw();

  // El catálogo de roles también se deriva del real: si se quedara en la semilla
  // local, todo rol dado de alta en "Roles y Sueldos" que no coincidiera de
  // nombre quedaría fuera del motor y su personal no podría comisionar.
  // Los roles que sí coinciden conservan el id semilla, porque
  // `comisiones_reglas.id_rol` ya tiene reglas apuntando a ellos.
  const roles = useMemo(
    () => derivarRolesSimulador(estructuraRaw, state.roles) ?? state.roles,
    [estructuraRaw, state.roles],
  );
  const estructuraReal = useMemo(
    () => derivarEstructura(estructuraRaw, roles, state.projects),
    [estructuraRaw, roles, state.projects],
  );
  const roleAssignments = estructuraReal?.roleAssignments ?? state.roleAssignments;

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  const getChannelDependencies = useCallback((id: string): string[] => {
    const deps: string[] = [];
    const s = state;
    const usedInRules = s.commissionRules.some(r => r.channelId === id);
    if (usedInRules) deps.push('reglas de comisión');
    const usedInScenarios = s.scenarios.filter(sc =>
      sc.channelMix[id] !== undefined || sc.channelExternalPcts[id] !== undefined
    );
    if (usedInScenarios.length > 0) deps.push(`${usedInScenarios.length} escenario(s)`);
    const usedInProjects = s.projects.filter(p => p.channelMix[id] !== undefined);
    if (usedInProjects.length > 0) deps.push(`${usedInProjects.length} desarrollo(s)`);
    return deps;
  }, [state]);

  // La matriz de comisiones es única y compartida (no depende de escenario)
  // — se inyecta igual en cada escenario expuesto, así el resto de tabs
  // (Resultados, Simuladores, etc.) sigue leyendo `scenario.commissionRules`
  // sin cambios.
  const scenariosWithRules = state.scenarios.map(sc => ({ ...sc, commissionRules: state.commissionRules }));

  const ctx: SimulatorContextType = {
    ...state,
    scenarios: scenariosWithRules,
    roles,
    roleAssignments,
    estructuraReal,
    motorProjectId,
    setMotorProjectId,
    addProject: (p) => update(s => ({ ...s, projects: [...s.projects, p] })),
    updateProject: (p) => update(s => ({ ...s, projects: s.projects.map(x => x.id === p.id ? p : x) })),
    deleteProject: (id) => update(s => ({ ...s, projects: s.projects.filter(x => x.id !== id) })),
    addRole: (r) => update(s => ({ ...s, roles: [...s.roles, r] })),
    updateRole: (r) => update(s => ({ ...s, roles: s.roles.map(x => x.id === r.id ? r : x) })),
    deleteRole: (id) => update(s => ({ ...s, roles: s.roles.filter(x => x.id !== id) })),
    addRoleAssignment: (ra) => update(s => ({ ...s, roleAssignments: [...s.roleAssignments, ra] })),
    updateRoleAssignment: (ra) => update(s => ({ ...s, roleAssignments: s.roleAssignments.map(x => x.id === ra.id ? ra : x) })),
    deleteRoleAssignment: (id) => update(s => ({ ...s, roleAssignments: s.roleAssignments.filter(x => x.id !== id) })),
    addChannel: async (c) => {
      const now = new Date().toISOString();
      const entry = { id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: 'created' as const };
      const draft: Channel = { ...c, id: '', createdAt: now, updatedAt: now, history: [entry] };
      const { channel: created, tableMissing } = await insertCanalRemoto(draft);
      if (!created && !tableMissing) toast.error(`No se pudo guardar el canal "${c.name}" en el servidor.`);
      const withMeta: Channel = created ? { ...draft, ...created } : { ...draft, id: `local-${crypto.randomUUID()}` };
      update(s => ({ ...s, channels: [...s.channels, withMeta] }));
    },
    updateChannel: (c, changeNote) => {
      const prev = state.channels.find(x => x.id === c.id);
      const now = new Date().toISOString();
      const history = [...(prev?.history || c.history || [])];
      if (prev && prev.active !== c.active) {
        history.push({ id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: c.active ? 'activated' : 'deactivated' });
      } else {
        history.push({ id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: 'updated', note: changeNote });
      }
      const next: Channel = { ...c, updatedAt: now, history };
      update(s => ({ ...s, channels: s.channels.map(x => x.id === c.id ? next : x) }));
      updateCanalRemoto(next).then(({ ok, tableMissing }) => {
        if (!ok && !tableMissing) toast.error(`No se pudo guardar el canal "${c.name}" en el servidor.`);
      });
    },
    duplicateChannel: async (id) => {
      const orig = state.channels.find(x => x.id === id);
      if (!orig) return;
      const now = new Date().toISOString();
      const draft: Channel = {
        ...orig, id: '', name: `${orig.name} (copia)`,
        code: orig.code ? `${orig.code}_COPY` : undefined,
        createdAt: now, updatedAt: now,
        history: [{ id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: 'duplicated', note: `Duplicado desde ${orig.name}` }],
      };
      const { channel: created, tableMissing } = await insertCanalRemoto(draft);
      if (!created && !tableMissing) toast.error(`No se pudo duplicar el canal "${orig.name}" en el servidor.`);
      const dup: Channel = created ? { ...draft, ...created } : { ...draft, id: `local-${crypto.randomUUID()}` };
      update(s => ({ ...s, channels: [...s.channels, dup] }));
    },
    deleteChannel: (id) => {
      update(s => ({ ...s, channels: s.channels.filter(x => x.id !== id) }));
      deleteCanalRemoto(id).then(({ ok, tableMissing }) => {
        if (!ok && !tableMissing) toast.error('No se pudo eliminar el canal en el servidor.');
      });
    },
    getChannelDependencies,
    // Escenarios: 100% locales (localStorage) — no se persisten en BD.
    addScenario: (s) => update(st => ({ ...st, scenarios: [...st.scenarios, s] })),
    updateScenario: (s) => update(st => ({ ...st, scenarios: st.scenarios.map(x => x.id === s.id ? s : x) })),
    deleteScenario: (id) => update(s => ({ ...s, scenarios: s.scenarios.filter(x => x.id !== id) })),
    duplicateScenario: (id) => {
      const orig = state.scenarios.find(x => x.id === id);
      if (!orig) return;
      const dup: Scenario = {
        ...orig, id: crypto.randomUUID(), name: `${orig.name} (copia)`,
        roleAssignments: orig.roleAssignments.map(r => ({ ...r, id: crypto.randomUUID() })),
      };
      update(s => ({ ...s, scenarios: [...s.scenarios, dup] }));
    },
    updateCommercialPolicies: (cp) => update(s => ({ ...s, commercialPolicies: cp })),
    motorLoading,
    motorDirty,
    motorSaving,
    reloadMotor,
    // Las siguientes 4 acciones (addCommissionRule, updateCommissionRule,
    // deleteCommissionRule, updateMotorConfig) son 100% locales — ya no
    // llaman al servidor en cada cambio (antes cada tecleo de un % disparaba
    // un request). Solo marcan `motorDirty` y acumulan el cambio en memoria;
    // `saveMotorComisiones` es quien persiste todo junto cuando el usuario
    // presiona "Guardar cambios".
    addCommissionRule: (channelId, roleId, pool, personalId) => {
      if (motorProjectId == null) return;
      const draft: CommissionRule = {
        id: `local-${crypto.randomUUID()}`, scenarioId: '', channelId, roleId, personalId, percentage: 0, pool,
      };
      update(s => ({ ...s, commissionRules: [...s.commissionRules, draft] }));
      setMotorDirty(true);
    },
    updateCommissionRule: (rule) => {
      update(s => ({ ...s, commissionRules: s.commissionRules.map(r => r.id === rule.id ? rule : r) }));
      setMotorDirty(true);
    },
    deleteCommissionRule: (id) => {
      update(s => ({ ...s, commissionRules: s.commissionRules.filter(r => r.id !== id) }));
      if (!id.startsWith('local-')) setPendingDeletes(prev => [...prev, id]);
      setMotorDirty(true);
    },
    /**
     * Copia las reglas de un canal a otro, conservando persona, rol, porcentaje
     * y pool.
     *
     * Vive aquí y no en la pantalla porque `addCommissionRule` genera el id
     * internamente: crear y luego actualizar desde fuera no encontraría la fila
     * recién creada. Con una sola pasada sobre el estado, las reglas nacen ya
     * con su porcentaje.
     *
     * Devuelve cuántas se copiaron y cuántas se omitieron por estar ya en el
     * destino, para que quien llame pueda decirlo sin volver a calcularlo.
     */
    copyChannelRules: (fromChannelId, toChannelId, replace) => {
      let copiadas = 0;
      let omitidas = 0;

      update(s => {
        const origen = s.commissionRules.filter(r => r.channelId === fromChannelId);
        const previas = s.commissionRules.filter(r => r.channelId === toChannelId);

        // Las que ya estaban en el destino y venían del servidor deben borrarse
        // allá también; las locales basta con no volver a incluirlas.
        if (replace) {
          const delServidor = previas.filter(r => !r.id.startsWith('local-')).map(r => r.id);
          if (delServidor.length) setPendingDeletes(prev => [...prev, ...delServidor]);
        }

        const conservadas = replace
          ? s.commissionRules.filter(r => r.channelId !== toChannelId)
          : s.commissionRules;

        const yaEnDestino = replace
          ? new Set<string>()
          : new Set(previas.map(r => r.personalId).filter(Boolean) as string[]);

        const nuevas: CommissionRule[] = [];
        for (const r of origen) {
          if (r.personalId && yaEnDestino.has(r.personalId)) { omitidas++; continue; }
          nuevas.push({
            ...r,
            id: `local-${crypto.randomUUID()}`,
            channelId: toChannelId,
          });
          copiadas++;
        }

        return { ...s, commissionRules: [...conservadas, ...nuevas] };
      });

      setMotorDirty(true);
      return { copiadas, omitidas };
    },
    // Agrega localmente (sin tocar el servidor) las combinaciones canal×puesto
    // que falten para los roles que participan en comisión. Antes esto
    // insertaba directo en la BD y se disparaba automáticamente al cambiar de
    // proyecto (ver efecto de `motorProjectId` arriba) — si ese insert
    // corría con `commissionRules` todavía del proyecto anterior (fetch en
    // vuelo), calculaba "faltantes" que en realidad ya existían para el
    // proyecto nuevo, y el INSERT completo fallaba con `23505 duplicate key`.
    // Al ser ahora 100% local, ese fetch en vuelo ya no puede reventar nada;
    // el usuario guarda con el botón cuando quiere persistir.
    syncMissingCommissionRules: (comisionistas) => {
      if (motorProjectId == null) return 0;
      const missing: CommissionRule[] = [];
      state.channels.forEach(ch => {
        comisionistas.forEach(c => {
          const exists = state.commissionRules.some(
            r => r.channelId === ch.id && r.personalId === c.personalId,
          );
          if (!exists) {
            missing.push({
              id: `local-${crypto.randomUUID()}`, scenarioId: '', channelId: ch.id,
              roleId: c.roleId, personalId: c.personalId, percentage: 0,
              pool: c.belongsTo === 'sozu_central' ? 'sozu' : 'project',
            });
          }
        });
      });
      if (missing.length === 0) return 0;
      update(s => ({ ...s, commissionRules: [...s.commissionRules, ...missing] }));
      setMotorDirty(true);
      return missing.length;
    },
    updateMotorConfig: (config) => {
      if (motorProjectId == null) return;
      update(s => ({ ...s, motorConfig: config }));
      setMotorDirty(true);
    },
    saveMotorComisiones: async () => {
      if (motorProjectId == null) return false;
      setMotorSaving(true);
      try {
        const toInsert = state.commissionRules.filter(r => r.id.startsWith('local-'));
        const toUpdate = state.commissionRules.filter(r => !r.id.startsWith('local-'));
        let hadError = false;
        let hadDuplicate = false;
        let hadColumnMissing = false;

        const [deleteResults, updateResults, insertResult, motorConfigResult] = await Promise.all([
          Promise.all(pendingDeletes.map(id => deleteReglaComisionRemota(id))),
          Promise.all(toUpdate.map(r => updateReglaComisionRemota(r))),
          insertReglasComisionRemotas(toInsert, motorProjectId),
          updateMotorConfigRemoto(state.motorConfig, motorProjectId),
        ]);

        deleteResults.forEach(({ ok, tableMissing }) => { if (!ok && !tableMissing) hadError = true; });
        updateResults.forEach(({ ok, tableMissing, duplicate, columnMissing }) => {
          if (!ok && !tableMissing) {
            hadError = true;
            if (duplicate) hadDuplicate = true;
            if (columnMissing) hadColumnMissing = true;
          }
        });
        if (toInsert.length > 0 && insertResult.rules.length !== toInsert.length && !insertResult.tableMissing) {
          hadError = true;
          if (insertResult.columnMissing) hadColumnMissing = true;
        }
        if (!motorConfigResult.ok && !motorConfigResult.tableMissing) hadError = true;

        if (hadError) {
          // Falta el DDL: reintentar no sirve, hay que decir qué ejecutar.
          if (hadColumnMissing) {
            toast.error(
              'La base de datos aún no tiene la columna de comisionistas (id_personal). ' +
              'Ejecuta el DDL "Comisionistas por canal" en Ejecuciones_manuales antes de guardar.',
              { duration: 10000 },
            );
            return false;
          }
          toast.error(
            hadDuplicate
              ? 'No se pudo guardar: esa persona ya está dada de alta como comisionista en el mismo canal. Quita el duplicado e inténtalo de nuevo.'
              : 'No se pudieron guardar todos los cambios del Motor de Comisiones. Intenta de nuevo.'
          );
          return false;
        }

        // Reemplaza los ids `local-` recién insertados por los ids reales que asignó la BD.
        if (insertResult.rules.length > 0) {
          update(s => ({
            ...s,
            commissionRules: s.commissionRules.map(r => {
              if (!r.id.startsWith('local-')) return r;
              const created = insertResult.rules.find(
                c => c.channelId === r.channelId && c.personalId === r.personalId && c.roleId === r.roleId,
              );
              return created ?? r;
            }),
          }));
        }

        setPendingDeletes([]);
        setMotorDirty(false);
        toast.success('Cambios del Motor de Comisiones guardados.');
        return true;
      } finally {
        setMotorSaving(false);
      }
    },
    resetToDefaults: () => setState({
      projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
      scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
      commercialPolicies: defaultCommercialPolicies, commissionRules: [],
      motorConfig: DEFAULT_MOTOR_CONFIG,
    }),
  };

  return <SimulatorContext.Provider value={ctx}>{children}</SimulatorContext.Provider>;
}

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used within SimulatorProvider');
  return ctx;
}