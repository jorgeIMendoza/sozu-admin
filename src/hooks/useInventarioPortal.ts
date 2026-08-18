import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAgentPortalPermissions, type AgentPath } from "@/hooks/useAgentPortalPermissions";

export const AGENT_INVENTARIO_BASE = "/admin/agent/inventario";
export const PERSONAL_INVENTARIO_BASE = "/admin/portal-personal/inventario";

/**
 * Las vistas de Inventario (listado, detalle de desarrollo y unidades) son las
 * mismas para el Portal Agente y para el Portal del Personal: misma lógica,
 * mismos datos y mismas funcionalidades. Lo único que cambia es el portal desde
 * el que se entra, y eso se resuelve aquí:
 *
 *  - `basePath`: prefijo con el que se navega para no salirse del portal actual.
 *  - `permisos`: se leen del submenú del portal actual (no de uno fijo), para que
 *    cada portal configure su propio acceso en Roles y Permisos.
 *  - `portalPrefix`: separa analítica (cta_events) y filtros guardados por portal.
 */
export function useInventarioPortal() {
  const { pathname } = useLocation();
  const { permissions, isLoading } = useAgentPortalPermissions();

  const isPersonal = pathname.startsWith("/admin/portal-personal");
  const basePath: AgentPath = isPersonal ? PERSONAL_INVENTARIO_BASE : AGENT_INVENTARIO_BASE;

  return useMemo(
    () => ({
      isPersonal,
      basePath,
      portalPrefix: isPersonal ? "personal" : "agent",
      permisos: permissions[basePath],
      isLoadingPermisos: isLoading,
      /** El header del Portal del Personal mide h-14; el del Portal Agente, h-16. */
      stickyTopCls: isPersonal ? "top-14" : "top-16",
    }),
    [isPersonal, basePath, permissions, isLoading],
  );
}
