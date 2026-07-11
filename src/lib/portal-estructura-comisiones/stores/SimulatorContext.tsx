import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AppState, Project, Role, Channel, Scenario, RoleAssignment, CommercialPoliciesConfig } from '../types/simulator';
import {
  defaultProjects, defaultRoles, defaultChannels, defaultScenarios,
  defaultRoleAssignments, defaultCommercialPolicies,
} from '../utils/seed-data';
import {
  fetchCanalesReales, fetchEscenariosReales, seedCanalesYEscenarios,
  upsertCanalRemoto, deleteCanalRemoto, upsertEscenarioRemoto, deleteEscenarioRemoto,
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
  addChannel: (c: Channel) => void;
  updateChannel: (c: Channel, changeNote?: string) => void;
  duplicateChannel: (id: string) => void;
  deleteChannel: (id: string) => void;
  getChannelDependencies: (id: string) => string[];
  addScenario: (s: Scenario) => void;
  updateScenario: (s: Scenario) => void;
  deleteScenario: (id: string) => void;
  duplicateScenario: (id: string) => void;
  updateCommercialPolicies: (cp: CommercialPoliciesConfig) => void;
  resetToDefaults: () => void;
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
      return parsed;
    }
  } catch { /* ignore */ }
  return {
    projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
    scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
    commercialPolicies: defaultCommercialPolicies,
  };
}

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  // Canales y Escenarios (incluye el % de comisión por rol/canal) son
  // compartidos vía Supabase — al montar, la BD manda sobre el localStorage
  // local. Si las tablas aún no existen (DDL pendiente) o hay un error de
  // red, no pasa nada: sigue funcionando 100% local, igual que antes.
  useEffect(() => {
    (async () => {
      const [remoteChannels, remoteScenarios] = await Promise.all([fetchCanalesReales(), fetchEscenariosReales()]);
      if (remoteChannels !== null && remoteChannels.length === 0) {
        await seedCanalesYEscenarios(state.channels, []);
      }
      if (remoteScenarios !== null && remoteScenarios.length === 0) {
        await seedCanalesYEscenarios([], state.scenarios);
      }
      setState(prev => ({
        ...prev,
        channels: remoteChannels && remoteChannels.length > 0 ? remoteChannels : prev.channels,
        scenarios: remoteScenarios && remoteScenarios.length > 0 ? remoteScenarios : prev.scenarios,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncChannel = useCallback((c: Channel) => {
    upsertCanalRemoto(c).then(ok => { if (!ok) toast.error(`No se pudo guardar el canal "${c.name}" en el servidor.`); });
  }, []);
  const syncChannelDelete = useCallback((id: string) => {
    deleteCanalRemoto(id).then(ok => { if (!ok) toast.error('No se pudo eliminar el canal en el servidor.'); });
  }, []);
  const syncScenario = useCallback((s: Scenario) => {
    upsertEscenarioRemoto(s).then(ok => { if (!ok) toast.error(`No se pudo guardar el escenario "${s.name}" en el servidor.`); });
  }, []);
  const syncScenarioDelete = useCallback((id: string) => {
    deleteEscenarioRemoto(id).then(ok => { if (!ok) toast.error('No se pudo eliminar el escenario en el servidor.'); });
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  const getChannelDependencies = useCallback((id: string): string[] => {
    const deps: string[] = [];
    const s = state;
    const usedInScenarios = s.scenarios.filter(sc =>
      sc.channelMix[id] !== undefined || sc.channelExternalPcts[id] !== undefined ||
      sc.commissionRules.some(r => r.channelId === id)
    );
    if (usedInScenarios.length > 0) deps.push(`${usedInScenarios.length} escenario(s)`);
    const usedInProjects = s.projects.filter(p => p.channelMix[id] !== undefined);
    if (usedInProjects.length > 0) deps.push(`${usedInProjects.length} desarrollo(s)`);
    return deps;
  }, [state]);

  const ctx: SimulatorContextType = {
    ...state,
    addProject: (p) => update(s => ({ ...s, projects: [...s.projects, p] })),
    updateProject: (p) => update(s => ({ ...s, projects: s.projects.map(x => x.id === p.id ? p : x) })),
    deleteProject: (id) => update(s => ({ ...s, projects: s.projects.filter(x => x.id !== id) })),
    addRole: (r) => update(s => ({ ...s, roles: [...s.roles, r] })),
    updateRole: (r) => update(s => ({ ...s, roles: s.roles.map(x => x.id === r.id ? r : x) })),
    deleteRole: (id) => update(s => ({ ...s, roles: s.roles.filter(x => x.id !== id) })),
    addRoleAssignment: (ra) => update(s => ({ ...s, roleAssignments: [...s.roleAssignments, ra] })),
    updateRoleAssignment: (ra) => update(s => ({ ...s, roleAssignments: s.roleAssignments.map(x => x.id === ra.id ? ra : x) })),
    deleteRoleAssignment: (id) => update(s => ({ ...s, roleAssignments: s.roleAssignments.filter(x => x.id !== id) })),
    addChannel: (c) => {
      const now = new Date().toISOString();
      const entry = { id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: 'created' as const };
      const withMeta: Channel = { ...c, createdAt: now, updatedAt: now, history: [...(c.history || []), entry] };
      update(s => ({ ...s, channels: [...s.channels, withMeta] }));
      syncChannel(withMeta);
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
      syncChannel(next);
    },
    duplicateChannel: (id) => {
      const orig = state.channels.find(x => x.id === id);
      if (!orig) return;
      const now = new Date().toISOString();
      const newId = `ch-${crypto.randomUUID().slice(0, 8)}`;
      const dup: Channel = {
        ...orig, id: newId, name: `${orig.name} (copia)`,
        code: orig.code ? `${orig.code}_COPY` : undefined,
        createdAt: now, updatedAt: now,
        history: [{ id: crypto.randomUUID(), timestamp: now, user: 'Tú', action: 'duplicated', note: `Duplicado desde ${orig.name}` }],
      };
      update(s => ({ ...s, channels: [...s.channels, dup] }));
      syncChannel(dup);
    },
    deleteChannel: (id) => {
      update(s => ({ ...s, channels: s.channels.filter(x => x.id !== id) }));
      syncChannelDelete(id);
    },
    getChannelDependencies,
    addScenario: (s) => { update(st => ({ ...st, scenarios: [...st.scenarios, s] })); syncScenario(s); },
    updateScenario: (s) => { update(st => ({ ...st, scenarios: st.scenarios.map(x => x.id === s.id ? s : x) })); syncScenario(s); },
    deleteScenario: (id) => { update(s => ({ ...s, scenarios: s.scenarios.filter(x => x.id !== id) })); syncScenarioDelete(id); },
    duplicateScenario: (id) => {
      const orig = state.scenarios.find(x => x.id === id);
      if (!orig) return;
      const newId = crypto.randomUUID();
      const dup: Scenario = {
        ...orig, id: newId, name: `${orig.name} (copia)`,
        commissionRules: orig.commissionRules.map(r => ({ ...r, id: crypto.randomUUID(), scenarioId: newId })),
        roleAssignments: orig.roleAssignments.map(r => ({ ...r, id: crypto.randomUUID() })),
      };
      update(s => ({ ...s, scenarios: [...s.scenarios, dup] }));
      syncScenario(dup);
    },
    updateCommercialPolicies: (cp) => update(s => ({ ...s, commercialPolicies: cp })),
    resetToDefaults: () => setState({
      projects: defaultProjects, roles: defaultRoles, channels: defaultChannels,
      scenarios: defaultScenarios, roleAssignments: defaultRoleAssignments,
      commercialPolicies: defaultCommercialPolicies,
    }),
  };

  return <SimulatorContext.Provider value={ctx}>{children}</SimulatorContext.Provider>;
}

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used within SimulatorProvider');
  return ctx;
}