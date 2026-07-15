import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AppState, Project, Role, Channel, Scenario, RoleAssignment, CommercialPoliciesConfig, CommissionRule } from '../types/simulator';
import {
  defaultProjects, defaultRoles, defaultChannels, defaultScenarios,
  defaultRoleAssignments, defaultCommercialPolicies,
} from '../utils/seed-data';
import {
  fetchCanalesReales, seedCanalesReales, insertCanalRemoto, updateCanalRemoto, deleteCanalRemoto,
  fetchReglasComisionReales, insertReglaComisionRemota, insertReglasComisionRemotas,
  updateReglaComisionRemota, deleteReglaComisionRemota,
} from '@/hooks/usePortalEstructuraComisiones/useMotorComisionesSync';

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
  /** Matriz de comisión canal × puesto — única y compartida, independiente de escenario. */
  addCommissionRule: (channelId: string, roleId: string, pool: 'sozu' | 'project') => Promise<void>;
  updateCommissionRule: (rule: CommissionRule) => void;
  deleteCommissionRule: (id: string) => void;
  /** Crea las combinaciones canal×puesto que falten para los roles que participan en comisión. */
  syncMissingCommissionRules: () => Promise<number>;
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
      return parsed;
    }
  } catch { /* ignore */ }
  return {
    projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
    scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
    commercialPolicies: defaultCommercialPolicies, commissionRules: [],
  };
}

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  // Canales y la matriz de Comisiones (canal × puesto) son compartidos vía
  // Supabase — al montar, la BD manda sobre el localStorage local. Si las
  // tablas aún no existen (DDL pendiente) o hay un error de red, no pasa
  // nada: sigue funcionando 100% local, igual que antes. Los Escenarios
  // (simulación) siguen siendo 100% locales — no se persisten en BD.
  useEffect(() => {
    (async () => {
      const [remoteChannels, remoteRules] = await Promise.all([fetchCanalesReales(), fetchReglasComisionReales()]);
      if (remoteChannels !== null && remoteChannels.length === 0) {
        await seedCanalesReales(state.channels);
      }
      setState(prev => ({
        ...prev,
        channels: remoteChannels && remoteChannels.length > 0 ? remoteChannels : prev.channels,
        commissionRules: remoteRules ?? prev.commissionRules,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    addCommissionRule: async (channelId, roleId, pool) => {
      const draft: CommissionRule = { id: '', scenarioId: '', channelId, roleId, percentage: 0, pool };
      const { rule: created, tableMissing } = await insertReglaComisionRemota(draft);
      if (!created) {
        if (!tableMissing) toast.error('No se pudo guardar la regla de comisión en el servidor.');
        update(s => ({ ...s, commissionRules: [...s.commissionRules, { ...draft, id: `local-${crypto.randomUUID()}` }] }));
        return;
      }
      update(s => ({ ...s, commissionRules: [...s.commissionRules, created] }));
    },
    updateCommissionRule: (rule) => {
      update(s => ({ ...s, commissionRules: s.commissionRules.map(r => r.id === rule.id ? rule : r) }));
      updateReglaComisionRemota(rule).then(({ ok, tableMissing }) => {
        if (!ok && !tableMissing) toast.error('No se pudo guardar la regla de comisión en el servidor.');
      });
    },
    deleteCommissionRule: (id) => {
      update(s => ({ ...s, commissionRules: s.commissionRules.filter(r => r.id !== id) }));
      deleteReglaComisionRemota(id).then(({ ok, tableMissing }) => {
        if (!ok && !tableMissing) toast.error('No se pudo eliminar la regla de comisión en el servidor.');
      });
    },
    syncMissingCommissionRules: async () => {
      const commRoles = state.roles.filter(r => r.participatesInCommission);
      const missing: CommissionRule[] = [];
      state.channels.forEach(ch => {
        commRoles.forEach(role => {
          const exists = state.commissionRules.some(r => r.channelId === ch.id && r.roleId === role.id);
          if (!exists) {
            missing.push({
              id: '', scenarioId: '', channelId: ch.id, roleId: role.id, percentage: 0,
              pool: role.belongsTo === 'sozu_central' ? 'sozu' : 'project',
            });
          }
        });
      });
      if (missing.length === 0) return 0;
      const { rules: created, tableMissing } = await insertReglasComisionRemotas(missing);
      if (created.length === 0 && !tableMissing) {
        toast.error('No se pudieron sincronizar las reglas de comisión en el servidor.');
      }
      const toAdd = created.length > 0 ? created : missing.map(r => ({ ...r, id: `local-${crypto.randomUUID()}` }));
      update(s => ({ ...s, commissionRules: [...s.commissionRules, ...toAdd] }));
      return toAdd.length;
    },
    resetToDefaults: () => setState({
      projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
      scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
      commercialPolicies: defaultCommercialPolicies, commissionRules: [],
    }),
  };

  return <SimulatorContext.Provider value={ctx}>{children}</SimulatorContext.Provider>;
}

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used within SimulatorProvider');
  return ctx;
}