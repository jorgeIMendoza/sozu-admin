import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BankLead, BankId, LeadStatus, ActivityEntry } from "./bank-leads";

interface BankStore {
  leads: BankLead[];
  getLeadsForBank: (bankId: BankId) => BankLead[];
  getLead: (id: string) => BankLead | undefined;
  updateStatus: (id: string, to: LeadStatus, author: string, closeReason?: string) => void;
  addNote: (id: string, author: string, note: string) => void;
  logContact: (id: string, author: string, channel: string) => void;
  assignLead: (id: string, agentId: string, author?: string) => void;
  reassignLead: (id: string, agentId: string, author?: string) => void;
  resetSeed: () => void;
}

const nowISO = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

export const useBankStore = create<BankStore>()(
  persist(
    (set, get) => ({
      // Sin datos mock: las solicitudes reales se conectarán en una iteración futura.
      leads: [],
      getLeadsForBank: (bankId) => get().leads.filter((l) => l.bankId === bankId),
      getLead: (id) => get().leads.find((l) => l.id === id),

      updateStatus: (id, to, author, closeReason) => set((state) => ({
        leads: state.leads.map((l) => {
          if (l.id !== id) return l;
          const entry: ActivityEntry = { id: uid(), ts: nowISO(), author, type: "status_change", from: l.status, to, note: closeReason };
          return { ...l, status: to, closeReason: closeReason ?? l.closeReason, lastUpdate: nowISO(), activity: [entry, ...l.activity] };
        }),
      })),

      addNote: (id, author, note) => set((state) => ({
        leads: state.leads.map((l) => l.id === id
          ? { ...l, lastUpdate: nowISO(), activity: [{ id: uid(), ts: nowISO(), author, type: "nota", note }, ...l.activity] }
          : l),
      })),

      logContact: (id, author, channel) => set((state) => ({
        leads: state.leads.map((l) => l.id === id
          ? { ...l, lastUpdate: nowISO(), activity: [{ id: uid(), ts: nowISO(), author, type: "contacto", note: `Contacto vía ${channel}` }, ...l.activity] }
          : l),
      })),

      assignLead: (id, agentId, author = "Sistema SOZU") => set((state) => ({
        leads: state.leads.map((l) => {
          if (l.id !== id) return l;
          const wasAssigned = !!l.assignedAgentId;
          const note = wasAssigned ? "Reasignado" : "Asignado a ejecutivo";
          const toStatus: LeadStatus = l.status === "nuevo" ? "asignado" : l.status;
          return {
            ...l, assignedAgentId: agentId, status: toStatus, lastUpdate: nowISO(),
            activity: [
              { id: uid(), ts: nowISO(), author, type: "status_change", from: l.status, to: toStatus, note },
              ...l.activity,
            ],
          };
        }),
      })),

      reassignLead: (id, agentId, author = "Sistema SOZU") => get().assignLead(id, agentId, author),

      resetSeed: () => set({ leads: [] }),
    }),
    { name: "sozu-portal-bancos-leads", version: 1 }
  )
);