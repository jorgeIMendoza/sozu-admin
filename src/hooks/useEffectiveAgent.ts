import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";

/**
 * Identidad con la que debe leer el Portal Agente.
 *
 * Regla: impersonar es una **vista fiel**. Si hay impersonación, todas las lecturas
 * usan la identidad del agente impersonado — persona, email **y `auth_user_id`**.
 * El último es el que faltaba: las vistas que filtran por `auth.uid()`
 * (`get_agente_prospectos`, `crm_leads_atribucion.id_propietario`, notas del CRM)
 * seguían resolviendo con el admin logueado, así que el Portal Agente mostraba su
 * cartera completa del CRM (p. ej. 1,680 leads de un Agente Interno o 759 de un
 * Super Admin) en vez de los prospectos del agente.
 *
 * `realAuthUserId` se mantiene aparte a propósito: las **escrituras** (crear una nota,
 * registrar actividad) se siguen firmando con el usuario real, nunca con el impersonado.
 */
export interface EffectiveAgent {
  /** `personas.id` con el que se leen dueño de lead, comisiones y expediente. */
  personaId: number | null;
  /** `usuarios.auth_user_id` con el que se leen atribución y RPC del portal. */
  authUserId: string | null;
  /** Email efectivo (ofertas se scopean por `ofertas.email_creador`). */
  email: string | null;
  /** Nombre a mostrar. */
  nombre: string | null;
  /** `usuarios.auth_user_id` de quien está realmente logueado (para escrituras). */
  realAuthUserId: string | null;
  isImpersonating: boolean;
  /** true cuando falta el `auth_user_id` del impersonado (usuario sin cuenta auth). */
  impersonationIncomplete: boolean;
}

export function useEffectiveAgent(): EffectiveAgent {
  const { profile, user } = useAuth();
  const {
    impersonatedAgentEmail,
    impersonatedAgentPersonaId,
    impersonatedAgentName,
    impersonatedAgentAuthUserId,
    isImpersonating,
  } = useAgentImpersonation();

  const realAuthUserId = user?.id ?? null;

  if (!isImpersonating) {
    return {
      personaId: profile?.id_persona ?? null,
      authUserId: realAuthUserId,
      email: user?.email ?? profile?.email ?? null,
      nombre: profile?.nombre ?? null,
      realAuthUserId,
      isImpersonating: false,
      impersonationIncomplete: false,
    };
  }

  return {
    personaId: impersonatedAgentPersonaId ?? null,
    // Nunca cae al usuario real: si el impersonado no tiene cuenta auth, la vista
    // se queda vacía en lugar de mezclar la cartera del admin con la del agente.
    authUserId: impersonatedAgentAuthUserId ?? null,
    email: impersonatedAgentEmail ?? null,
    nombre: impersonatedAgentName ?? null,
    realAuthUserId,
    isImpersonating: true,
    impersonationIncomplete: !impersonatedAgentAuthUserId,
  };
}
