import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AllowedMenu {
  path: string;
  canRead: boolean;
}

export function useAllowedMenus() {
  const { profile, isLoading: isAuthLoading, user, permissionVersion } = useAuth();
  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [disabledPaths, setDisabledPaths] = useState<Set<string>>(new Set());
  const [enabledPaths, setEnabledPaths] = useState<Set<string>>(new Set());
  // El catálogo de rutas apagadas se carga aparte de los permisos del rol y es
  // un gate de seguridad: hasta que llegue no se puede decidir si una vista está
  // apagada, así que forma parte del estado de carga (antes no lo era y la vista
  // se alcanzaba a renderizar antes del redirect).
  const [isLoadingDisabled, setIsLoadingDisabled] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref para evitar mostrar spinner en recargas subsecuentes
  const hasLoadedOnce = useRef(false);

  // OJO: este hook resuelve AUTORIZACIÓN de rutas (lo consume `PermissionRoute`),
  // no solo el pintado del menú. Por eso usa SIEMPRE el rol de la sesión real y
  // nunca el del impersonado: con el rol ajeno, un admin en "Vista del usuario"
  // perdía el acceso a la ruta, caía en `/admin/access-denied` —que vive fuera
  // del layout del portal— y se quedaba sin forma de dejar de impersonar.
  // La simulación de la vista fiel se hace en los hooks de menú de cada portal.
  const isSuperAdmin = profile?.rol_nombre === 'Super Administrador';
  const effectiveRolId = profile?.rol_id ?? null;
  
  // Profile is still loading if we have a user but no profile yet
  const isProfileStillLoading = !!user && !profile && !isAuthLoading;

  // Rutas cuyo submenú está apagado (submenus.activo=false) o cuyo menú padre
  // está apagado (menus.activo=false). Un submenú apagado NO debe mostrarse a
  // ningún rol — incluido Super Admin, cuyo wildcard antes lo ignoraba.
  const fetchDisabledPaths = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('submenus')
        .select('vista_front_end, activo, menus!inner(activo)')
        .range(0, 4999);
      // Una misma ruta puede tener VARIOS submenús (p. ej. duplicados en un menú
      // viejo desactivado). La ruta solo debe apagarse si NINGÚN submenú activo
      // (con menú activo) la provee; si al menos uno la sirve, se muestra —incluido
      // Super Admin—. Antes bastaba un duplicado apagado para ocultar la ruta real.
      const enabled = new Set<string>();
      const disabled = new Set<string>();
      (data ?? []).forEach((s: any) => {
        if (!s.vista_front_end) return;
        const menuActivo = s.menus?.activo !== false;
        if (s.activo !== false && menuActivo) {
          enabled.add(s.vista_front_end);
        } else {
          disabled.add(s.vista_front_end);
        }
      });
      enabled.forEach((p) => disabled.delete(p));
      setDisabledPaths(disabled);
      setEnabledPaths(enabled);
    } catch (err) {
      // Fail-open: si no se pudo cargar, no ocultar nada extra.
      console.error('Error fetching disabled submenu paths:', err);
    } finally {
      setIsLoadingDisabled(false);
    }
  }, []);

  const fetchAllowedMenus = useCallback(async () => {
    if (!effectiveRolId) return;
    
    try {
      // Solo mostrar spinner la primera vez, recargas son silenciosas
      if (!hasLoadedOnce.current) {
        setIsLoadingPermissions(true);
      }
      setError(null);
      // Get all submenus where user has 'leer' permission
      // First get the 'leer' permission id
      const { data: permisoData } = await supabase
        .from('permisos')
        .select('id')
        .eq('nombre', 'leer')
        .single();

      if (!permisoData) {
        setAllowedPaths(new Set());
        return;
      }

      // Get submenus_permisos for this role and permission
      const { data: permisosData, error: permisosError } = await supabase
        .from('submenus_permisos')
        .select('submenu_id')
        .eq('rol_id', effectiveRolId)
        .eq('permiso_id', permisoData.id)
        .eq('activo', true);

      if (permisosError) {
        console.error('Error fetching permissions:', permisosError);
        setError(permisosError.message || 'No se pudieron cargar los permisos');
        setAllowedPaths(new Set());
        return;
      }

      // Get the submenu paths
      const submenuIds = permisosData?.map(p => p.submenu_id) || [];
      
      if (submenuIds.length === 0) {
        setAllowedPaths(new Set());
        return;
      }

      // Solo submenús activos cuyo menú padre también está activo: un menú
      // apagado apaga todas sus vistas aunque el submenú siga activo=true.
      const { data: submenusData, error: submenusError } = await supabase
        .from('submenus')
        .select('vista_front_end, menus!inner(activo)')
        .in('id', submenuIds)
        .eq('activo', true)
        .eq('menus.activo', true);

      if (submenusError) {
        console.error('Error fetching submenus:', submenusError);
        setError(submenusError.message || 'No se pudieron cargar los submenús');
        setAllowedPaths(new Set());
        return;
      }

      const paths = new Set<string>();
      submenusData?.forEach((item: any) => {
        if (item.vista_front_end) {
          paths.add(item.vista_front_end);
        }
      });

      setAllowedPaths(paths);
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error('Error in fetchAllowedMenus:', err);
      setError((err as Error)?.message || 'Error inesperado al cargar permisos');
      // Solo limpiar paths si nunca hemos cargado exitosamente
      if (!hasLoadedOnce.current) {
        setAllowedPaths(new Set());
      }
    } finally {
      setIsLoadingPermissions(false);
    }
  }, [effectiveRolId]);

  useEffect(() => {
    // Wait for auth to finish loading
    if (isAuthLoading) {
      return;
    }

    // If we have a user but profile hasn't loaded yet, wait
    if (user && !profile) {
      return;
    }

    // If Super Admin, skip fetching permissions — but still load the disabled
    // paths so toggled-off submenus/menus stay hidden for everyone.
    if (isSuperAdmin) {
      setAllowedPaths(new Set(['*']));
      setIsLoadingPermissions(false);
      setError(null);
      fetchDisabledPaths();
      return;
    }

    // If no profile (not logged in), stop loading
    if (!effectiveRolId) {
      setIsLoadingPermissions(false);
      setIsLoadingDisabled(false);
      return;
    }

    fetchAllowedMenus();
    fetchDisabledPaths();
  }, [effectiveRolId, isSuperAdmin, isAuthLoading, user, profile, permissionVersion, fetchAllowedMenus, fetchDisabledPaths]);

  // ¿La ruta está apagada en BD? Se resuelve con el submenú REGISTRADO más
  // específico que cubra la ruta (match exacto o prefijo con frontera "/"), para
  // que las subrutas hereden el apagado del padre (ej. /admin/usuarios apagado
  // también bloquea /admin/usuarios/nuevo) sin que un padre apagado tumbe a un
  // hijo que sí tiene su propio submenú activo.
  const isPathDisabled = useCallback((path: string): boolean => {
    const clean = path.replace(/\/+$/, '') || path;
    let bestLength = -1;
    let bestDisabled = false;
    const consider = (known: string, disabled: boolean) => {
      if (!known) return;
      const isExact = clean === known;
      // `/admin` (submenú Dashboard) es prefijo de TODA la app: nunca debe
      // heredar su estado a las demás rutas, solo aplicar al match exacto.
      if (!isExact && (known === '/admin' || !clean.startsWith(`${known}/`))) return;
      if (known.length > bestLength) {
        bestLength = known.length;
        bestDisabled = disabled;
      }
    };
    enabledPaths.forEach((p) => consider(p, false));
    disabledPaths.forEach((p) => consider(p, true));
    return bestDisabled;
  }, [enabledPaths, disabledPaths]);

  const isPathAllowed = (path: string): boolean => {
    // Vistas explícitamente apagadas en BD no son accesibles para nadie.
    if (isPathDisabled(path)) return false;

    if (isSuperAdmin || allowedPaths.has('*')) {
      return true;
    }

    // Caso especial: /admin/reportes/ver requiere acceso a cualquier submenu de reportes
    if (path === '/admin/reportes/ver' || path.startsWith('/admin/reportes/ver/')) {
      for (const allowedPath of allowedPaths) {
        if (allowedPath.includes('/reportes/') || allowedPath.includes('/configuracion-reportes')) {
          return true;
        }
      }
      return false;
    }
    
    return allowedPaths.has(path);
  };

  // Loading = auth loading OR profile still loading OR permissions loading (but not if super admin)
  // OR catálogo de rutas apagadas aún sin cargar (aplica también a Super Admin).
  const isLoading =
    isAuthLoading ||
    isProfileStillLoading ||
    isLoadingDisabled ||
    (isLoadingPermissions && !isSuperAdmin);

  return {
    isPathAllowed,
    isPathDisabled,
    allowedPaths,
    disabledPaths,
    enabledPaths,
    isLoading,
    isSuperAdmin,
    error,
    refetch: fetchAllowedMenus,
  };
}
