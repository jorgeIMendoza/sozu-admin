import { useDynamicMenus } from './useDynamicMenus';

/**
 * Regla unificada para mostrar el botón "Regresar al Admin Panel" dentro de
 * cualquier portal:
 *
 *   - Super Admin → siempre puede regresar.
 *   - Cualquier otro rol → solo si tiene acceso a al menos un menú del admin
 *     panel que NO sea un portal (Inventarios, Finanzas, Personas, Notario,
 *     Legal, Dashboard, etc.). Si sus únicos menús son portales, ir a /admin no
 *     le sirve (lo rebota a su portal), así que no se muestra el botón.
 *
 * En `useDynamicMenus` todos los menús cuyo nombre inicia con "Portal " quedan
 * marcados con `isPortal: true`, por lo que `!item.isPortal` identifica las
 * secciones reales del admin panel.
 */
export function useCanReturnToAdmin() {
  const { menuItems, isLoading, isSuperAdmin } = useDynamicMenus();

  const hasAdminMenus = menuItems.some((item) => !item.isPortal);

  return {
    canReturnToAdmin: isSuperAdmin || hasAdminMenus,
    isLoading,
    isSuperAdmin,
  };
}
