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
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref para evitar mostrar spinner en recargas subsecuentes
  const hasLoadedOnce = useRef(false);

  // Super Admin has access to everything - only check when profile is loaded
  const isSuperAdmin = profile?.rol_nombre === 'Super Administrador';
  
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
      const set = new Set<string>();
      (data ?? []).forEach((s: any) => {
        if (!s.vista_front_end) return;
        const menuActivo = s.menus?.activo !== false;
        if (s.activo === false || !menuActivo) {
          set.add(s.vista_front_end);
        }
      });
      setDisabledPaths(set);
    } catch (err) {
      // Fail-open: si no se pudo cargar, no ocultar nada extra.
      console.error('Error fetching disabled submenu paths:', err);
    }
  }, []);

  const fetchAllowedMenus = useCallback(async () => {
    if (!profile?.rol_id) return;
    
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
        .eq('rol_id', profile.rol_id)
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
  }, [profile?.rol_id]);

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
    if (!profile?.rol_id) {
      setIsLoadingPermissions(false);
      return;
    }

    fetchAllowedMenus();
    fetchDisabledPaths();
  }, [profile?.rol_id, isSuperAdmin, isAuthLoading, user, profile, permissionVersion, fetchAllowedMenus, fetchDisabledPaths]);

  const isPathAllowed = (path: string): boolean => {
    if (isSuperAdmin || allowedPaths.has('*')) {
      // Wildcard no aplica a vistas explícitamente apagadas en BD.
      return !disabledPaths.has(path);
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
  const isLoading = isAuthLoading || isProfileStillLoading || (isLoadingPermissions && !isSuperAdmin);

  return {
    isPathAllowed,
    allowedPaths,
    disabledPaths,
    isLoading,
    isSuperAdmin,
    error,
    refetch: fetchAllowedMenus,
  };
}
