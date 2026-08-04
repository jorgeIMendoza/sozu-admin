import { useDynamicMenus } from './useDynamicMenus';
import { IS_PORTAL_SUBDOMAIN } from '@/lib/portalUrls';

/**
 * Regla unificada para mostrar el botón "Regresar al Admin Panel" dentro de
 * cualquier portal:
 *
 *   - Estando en un subdominio de portal (agentes/inmobiliarias/clientes/
 *     embajadores.sozu.com) → NUNCA se muestra. Esos hosts montan un árbol de
 *     rutas reducido en App.tsx, así que el `navigate("/admin")` del botón lo
 *     absorbe el catch-all del propio portal y rebota al instante: era un botón
 *     visible que no hacía nada. El aislamiento por subdominio es deliberado —
 *     quien entra por el host de un portal solo debe ver ese portal.
 *   - En admin.sozu.com (y localhost / cualquier host no reconocido, que montan
 *     el árbol completo):
 *       · Super Admin → siempre puede regresar.
 *       · Cualquier otro rol → solo si tiene acceso a al menos un menú del admin
 *         panel que NO sea un portal (Inventarios, Finanzas, Personas, Notario,
 *         Legal, Dashboard, etc.). Si sus únicos menús son portales, ir a /admin
 *         no le sirve (lo rebota a su portal), así que no se muestra el botón.
 *
 * En `useDynamicMenus` todos los menús cuyo nombre inicia con "Portal " quedan
 * marcados con `isPortal: true`, por lo que `!item.isPortal` identifica las
 * secciones reales del admin panel.
 */
export function useCanReturnToAdmin() {
  const { menuItems, isLoading, isSuperAdmin } = useDynamicMenus();

  const hasAdminMenus = menuItems.some((item) => !item.isPortal);

  return {
    canReturnToAdmin: !IS_PORTAL_SUBDOMAIN && (isSuperAdmin || hasAdminMenus),
    isLoading,
    isSuperAdmin,
  };
}
