import { createContext, useContext, useState, ReactNode } from "react";

interface AgentImpersonationContextType {
  /** The email of the agent being impersonated (used for proyectos_acceso lookups) */
  impersonatedAgentEmail: string | null;
  /** The persona ID of the agent being impersonated */
  impersonatedAgentPersonaId: number | null;
  /** The display name of the agent being impersonated */
  impersonatedAgentName: string | null;
  /** `usuarios.rol_id` del impersonado. Lo consume la "vista fiel" para resolver
   *  menús y permisos con SU rol en vez del rol del admin logueado. */
  impersonatedAgentRolId: number | null;
  /** `usuarios.auth_user_id` del impersonado. Sin esto, toda consulta que filtre por
   *  `auth.uid()` (RPC `get_agente_prospectos`, `crm_leads_atribucion.id_propietario`,
   *  notas del CRM) devuelve los datos del admin logueado y no los del agente: el
   *  Portal Agente terminaba mostrando la cartera completa del CRM. */
  impersonatedAgentAuthUserId: string | null;
  /** Set the impersonated agent */
  setImpersonatedAgent: (
    email: string | null,
    personaId: number | null,
    name: string | null,
    rolId?: number | null,
    authUserId?: string | null
  ) => void;
  /** Clear impersonation */
  clearImpersonation: () => void;
  /** Whether an agent is being impersonated */
  isImpersonating: boolean;
}

const AgentImpersonationContext = createContext<AgentImpersonationContextType>({
  impersonatedAgentEmail: null,
  impersonatedAgentPersonaId: null,
  impersonatedAgentName: null,
  impersonatedAgentRolId: null,
  impersonatedAgentAuthUserId: null,
  setImpersonatedAgent: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

export function AgentImpersonationProvider({ children }: { children: ReactNode }) {
  const [agentEmail, setAgentEmail] = useState<string | null>(null);
  const [agentPersonaId, setAgentPersonaId] = useState<number | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentRolId, setAgentRolId] = useState<number | null>(null);
  const [agentAuthUserId, setAgentAuthUserId] = useState<string | null>(null);

  const setImpersonatedAgent = (
    email: string | null,
    personaId: number | null,
    name: string | null,
    rolId: number | null = null,
    authUserId: string | null = null
  ) => {
    setAgentEmail(email);
    setAgentPersonaId(personaId);
    setAgentName(name);
    setAgentRolId(rolId);
    setAgentAuthUserId(authUserId);
  };

  const clearImpersonation = () => {
    setAgentEmail(null);
    setAgentPersonaId(null);
    setAgentName(null);
    setAgentRolId(null);
    setAgentAuthUserId(null);
  };

  return (
    <AgentImpersonationContext.Provider
      value={{
        impersonatedAgentEmail: agentEmail,
        impersonatedAgentPersonaId: agentPersonaId,
        impersonatedAgentName: agentName,
        impersonatedAgentRolId: agentRolId,
        impersonatedAgentAuthUserId: agentAuthUserId,
        setImpersonatedAgent,
        clearImpersonation,
        isImpersonating: !!agentEmail,
      }}
    >
      {children}
    </AgentImpersonationContext.Provider>
  );
}

export function useAgentImpersonation() {
  return useContext(AgentImpersonationContext);
}
