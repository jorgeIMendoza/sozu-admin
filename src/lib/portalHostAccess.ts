import {
  CURRENT_PORTAL_SUBDOMAIN,
  PORTAL_ROUTE_PREFIX,
  PORTAL_SUBDOMAIN_KEYS,
  type PortalSubdomain,
} from './portalUrls';

// Roles con acceso real al Portal Agente. Misma lista que usa
// AgentPortalImpersonationSelector: 1 Super Admin, 2 Admin Proyecto,
// 3 Agente Inmobiliario, 9 Agente Interno, 30 Super Admin "fake" de prod.
const AGENT_PORTAL_ROLE_IDS = [1, 2, 3, 9, 30];
const ROL_INMOBILIARIA = 4;
const ROL_CLIENTE = 23;

// Los roles de banco se detectan por NOMBRE, no por id: sus ids difieren entre
// ambientes (ver useBancoRoles en hooks/usePortalBancos/useBancoEquipo.ts).
// Tolerante a singular/plural, igual que allí: "Operador Banco" / "Operador Bancos".
// 'Banco' a secas es el fallback que ya usa PermissionRoute para el portal.
const isRolDeBanco = (rolNombre: string | null | undefined): boolean => {
  const n = (rolNombre ?? '').trim().toLowerCase();
  return n === 'banco' || n.startsWith('operador banco') || n.startsWith('supervisor banco');
};

export interface PortalHostAccessInput {
  rolId: number | null | undefined;
  rolNombre: string | null | undefined;
  /** allowedPaths de useAllowedMenus. Para Super Admin es el wildcard {'*'}, por eso isSuperAdmin va aparte. */
  allowedPaths: Set<string>;
  isSuperAdmin: boolean;
  /** useHasEmbajadorRole: null mientras consulta user_roles. */
  hasEmbajadorRole: boolean | null;
  /** ¿Tiene algún menú que NO sea portal? Misma señal que useCanReturnToAdmin. */
  hasAdminMenus: boolean;
}

export interface PortalHostAccess {
  /** Subdominio de portal abierto, o null en admin.sozu.com / localhost. */
  currentPortal: PortalSubdomain | null;
  /** true si no hay subdominio que restringir, o si el usuario sí tiene acceso a él. */
  hasAccessToCurrentPortal: boolean;
  /** Portales con subdominio propio a los que el usuario sí puede entrar (para ofrecerle salida). */
  accessiblePortals: PortalSubdomain[];
  /** Señal para ofrecer el link cross-host al admin, sin el corte por subdominio de useCanReturnToAdmin. */
  canGoToAdmin: boolean;
}

/**
 * ¿El usuario tiene acceso al portal cuyo subdominio está abierto?
 *
 * Existe porque el aislamiento por subdominio de App.tsx es de *router*, no de
 * autorización: en agentes.sozu.com solo se montan las rutas /admin/agent/*, y
 * cualquier otra la absorbe el catch-all. Eso deja dos huecos que esta función
 * cierra junto con el gate de PermissionRoute:
 *
 *   1. Si PermissionRoute redirige a getFirstAllowedPath() y esa ruta pertenece
 *      a otro portal, no existe en este host → el catch-all la rebota →
 *      PermissionRoute vuelve a redirigir: loop de redirección.
 *   2. PermissionRoute abre /admin/agent/* y /admin/portal-cliente* a cualquier
 *      rol autenticado, así que un embajador puro entraba al portal de agentes
 *      con solo abrir agentes.sozu.com.
 *
 * El criterio de acceso es una UNIÓN PERMISIVA de las señales que el código ya
 * usaba en otros lados (permiso en BD bajo el prefijo del portal, o el rol_id
 * asociado a ese portal). La intención es rechazar a quien claramente no
 * pertenece sin dejar fuera a nadie que hoy sí entra — varios roles de portal
 * dependían del bypass de PermissionRoute y pueden no tener filas propias en
 * submenus_permisos.
 *
 * Es función pura y no hook a propósito: useAllowedMenus / useDynamicMenus
 * hacen sus fetches con useState+useEffect (sin react-query), así que volver a
 * invocarlos desde otro hook duplicaría las consultas. Quien la llama ya tiene
 * esos datos y se los pasa.
 */
export function computePortalHostAccess(input: PortalHostAccessInput): PortalHostAccess {
  const { rolId, rolNombre, allowedPaths, isSuperAdmin, hasEmbajadorRole, hasAdminMenus } = input;

  // allowedPaths es un Set<string>: iterar, no usar Array.some.
  const hasPathUnder = (prefix: string): boolean => {
    for (const p of allowedPaths) {
      if (p.startsWith(prefix)) return true;
    }
    return false;
  };

  const canAccessPortal = (portal: PortalSubdomain): boolean => {
    if (isSuperAdmin) return true;
    if (hasPathUnder(PORTAL_ROUTE_PREFIX[portal])) return true;

    switch (portal) {
      case 'agentes':
        return AGENT_PORTAL_ROLE_IDS.includes(rolId ?? -1);
      case 'inmobiliarias':
        return rolId === ROL_INMOBILIARIA;
      case 'clientes':
        return rolId === ROL_CLIENTE || rolNombre === 'Cliente';
      case 'embajadores':
        // Mismas condiciones que el gate de portal-embajador en PermissionRoute.
        return rolId === 1 || rolId === 2 || rolNombre === 'Embajador' || hasEmbajadorRole === true;
      case 'bancos':
        return isRolDeBanco(rolNombre);
      default:
        return false;
    }
  };

  return {
    currentPortal: CURRENT_PORTAL_SUBDOMAIN,
    hasAccessToCurrentPortal:
      CURRENT_PORTAL_SUBDOMAIN === null || canAccessPortal(CURRENT_PORTAL_SUBDOMAIN),
    accessiblePortals: PORTAL_SUBDOMAIN_KEYS.filter((p) => canAccessPortal(p)),
    canGoToAdmin: isSuperAdmin || hasAdminMenus,
  };
}
