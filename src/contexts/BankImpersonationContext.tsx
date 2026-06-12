import { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_BANK_AGENT_ID, useBankAgentsStore, type Agent } from "@/lib/portal-bancos/agents-store";

interface BankImpersonationContextType {
  impersonatedAgentId: string;
  setImpersonatedAgentId: (id: string) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const STORAGE_KEY = "sozu-portal-bancos-impersonation";

const BankImpersonationContext = createContext<BankImpersonationContextType>({
  impersonatedAgentId: DEFAULT_BANK_AGENT_ID,
  setImpersonatedAgentId: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

export function BankImpersonationProvider({ children }: { children: ReactNode }) {
  const [agentId, setAgentId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_BANK_AGENT_ID;
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BANK_AGENT_ID;
  });

  const setImpersonatedAgentId = (id: string) => {
    setAgentId(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
  };

  const clearImpersonation = () => {
    setAgentId(DEFAULT_BANK_AGENT_ID);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  return (
    <BankImpersonationContext.Provider value={{
      impersonatedAgentId: agentId,
      setImpersonatedAgentId,
      clearImpersonation,
      isImpersonating: agentId !== DEFAULT_BANK_AGENT_ID,
    }}>
      {children}
    </BankImpersonationContext.Provider>
  );
}

export function useBankImpersonation() { return useContext(BankImpersonationContext); }

export function useCurrentBankAgent(): Agent | null {
  const { impersonatedAgentId } = useBankImpersonation();
  return useBankAgentsStore((s) => s.agents.find((a) => a.id === impersonatedAgentId) ?? null);
}

export function visibleLeads<T extends { assignedAgentId?: string }>(agent: Agent, leads: T[]): T[] {
  if (agent.role === "admin") return leads;
  return leads.filter((l) => l.assignedAgentId === agent.id);
}