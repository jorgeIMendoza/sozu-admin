import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useImpersonationViewMode } from "@/contexts/ImpersonationViewModeContext";
import { resolveFullAccess } from "@/lib/impersonation/effective-identity";

/**
 * ¿El usuario logueado ve el Portal Agente COMPLETO, sin los recortes que
 * aplican al agente dependiente de una inmobiliaria?
 *
 * Regla del portal: las restricciones por dependencia (menú Comisiones, Carta
 * de comercialización) solo aplican al agente dependiente real. Ven todo:
 *   - Super Administrador
 *   - roles con `roles.puede_impersonar` (Admin Soporte, Supervisor de agentes
 *     externos, Admin de cobranza, etc.), que entran al portal a dar soporte.
 *
 * Excepción, **vista fiel**: si se está impersonando a alguien y el modo de
 * vista es `fiel`, el acceso completo se apaga a propósito para que el admin
 * compruebe qué ve realmente ese usuario.
 *
 * La decisión vive en `lib/impersonation/effective-identity` (función pura, con
 * tests); aquí solo se le pasan los datos de la sesión.
 *
 * OJO: esto NO otorga permisos. Cada vista sigue filtrándose por
 * `submenus_permisos` del rol (ver `useAgentPortalPermissions`); esto solo evita
 * que el discriminador "dependiente/independiente" (que se calcula sobre la
 * persona del usuario y suele venir sucio en roles internos) oculte secciones.
 */
export function useAgentPortalFullAccess(): boolean {
  const { profile } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentRolId } =
    useAgentImpersonation();
  const { viewMode } = useImpersonationViewMode();

  return resolveFullAccess({
    profileRolId: profile?.rol_id,
    profileRolNombre: profile?.rol_nombre,
    profilePersonaId: profile?.id_persona,
    puedeImpersonar: profile?.puede_impersonar,
    target: impersonatedAgentEmail
      ? {
          email: impersonatedAgentEmail,
          personaId: impersonatedAgentPersonaId,
          nombre: impersonatedAgentName,
          rolId: impersonatedAgentRolId,
        }
      : null,
    viewMode,
  });
}
