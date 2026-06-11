import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BankId } from "./bank-leads";

export type AgentRole = "admin" | "agente";

export interface Agent {
  id: string; name: string; email: string; phone: string;
  bankId: BankId; role: AgentRole; active: boolean; createdAt: string;
}

const now = new Date().toISOString();
const SEED_AGENTS: Agent[] = [
  { id: "e1", name: "Mariana Ruiz",    email: "mariana.ruiz@bbva.mx",        phone: "+52 55 1000 0001", bankId: "bbva",      role: "agente", active: true, createdAt: now },
  { id: "e2", name: "Carlos Méndez",   email: "carlos.mendez@bbva.mx",       phone: "+52 55 1000 0002", bankId: "bbva",      role: "admin",  active: true, createdAt: now },
  { id: "e3", name: "Paola Cervantes", email: "paola.cervantes@bbva.mx",     phone: "+52 55 1000 0003", bankId: "bbva",      role: "agente", active: true, createdAt: now },
  { id: "e4", name: "Diana Salgado",   email: "diana.salgado@santander.mx",  phone: "+52 55 1000 0004", bankId: "santander", role: "agente", active: true, createdAt: now },
  { id: "e5", name: "Luis Fonseca",    email: "luis.fonseca@santander.mx",   phone: "+52 55 1000 0005", bankId: "santander", role: "agente", active: true, createdAt: now },
  { id: "e6", name: "Andrea Villalba", email: "andrea.villalba@santander.mx",phone: "+52 55 1000 0006", bankId: "santander", role: "admin",  active: true, createdAt: now },
  { id: "e7", name: "Hugo Ramírez",    email: "hugo.ramirez@banorte.mx",     phone: "+52 55 1000 0007", bankId: "banorte",   role: "agente", active: true, createdAt: now },
  { id: "e8", name: "Sergio Patiño",   email: "sergio.patino@banorte.mx",    phone: "+52 55 1000 0008", bankId: "banorte",   role: "agente", active: true, createdAt: now },
  { id: "e9", name: "Renata Ochoa",    email: "renata.ochoa@banorte.mx",     phone: "+52 55 1000 0009", bankId: "banorte",   role: "admin",  active: true, createdAt: now },
];

const uid = () => "ag-" + Math.random().toString(36).slice(2, 9);

interface AgentsStore {
  agents: Agent[];
  agentsByBank: (bankId: BankId, opts?: { onlyActive?: boolean; role?: AgentRole }) => Agent[];
  getAgent: (id?: string) => Agent | undefined;
  agentName: (id?: string) => string;
  createAgent: (data: Omit<Agent, "id" | "createdAt" | "active">) => Agent;
  updateAgent: (id: string, patch: Partial<Omit<Agent, "id" | "createdAt">>) => void;
  deactivateAgent: (id: string) => void;
  reactivateAgent: (id: string) => void;
  resetSeed: () => void;
}

export const useBankAgentsStore = create<AgentsStore>()(
  persist(
    (set, get) => ({
      agents: structuredClone(SEED_AGENTS),
      agentsByBank: (bankId, opts) =>
        get().agents.filter(
          (a) => a.bankId === bankId &&
            (opts?.onlyActive ? a.active : true) &&
            (opts?.role ? a.role === opts.role : true)
        ),
      getAgent: (id) => (id ? get().agents.find((a) => a.id === id) : undefined),
      agentName: (id) => !id ? "Sin asignar" : (get().agents.find((a) => a.id === id)?.name ?? "Sin asignar"),
      createAgent: (data) => {
        const a: Agent = { ...data, id: uid(), active: true, createdAt: new Date().toISOString() };
        set((s) => ({ agents: [...s.agents, a] }));
        return a;
      },
      updateAgent: (id, patch) => set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deactivateAgent: (id) => set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, active: false } : a)) })),
      reactivateAgent: (id) => set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, active: true } : a)) })),
      resetSeed: () => set({ agents: structuredClone(SEED_AGENTS) }),
    }),
    { name: "sozu-portal-bancos-agents" }
  )
);

export const DEFAULT_BANK_AGENT_ID = "e6";