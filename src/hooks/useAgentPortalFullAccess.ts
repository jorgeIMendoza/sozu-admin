import { useAuth } from "@/contexts/AuthContext";

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
 * OJO: esto NO otorga permisos. Cada vista sigue filtrándose por
 * `submenus_permisos` del rol (ver `useAgentPortalPermissions`); esto solo evita
 * que el discriminador "dependiente/independiente" — que se calcula sobre la
 * persona del usuario y suele venir sucio en roles internos — oculte secciones.
 */
export function useAgentPortalFullAccess(): boolean {
  const { profile } = useAuth();
  return profile?.rol_nombre === 'Super Administrador' || profile?.puede_impersonar === true;
}
