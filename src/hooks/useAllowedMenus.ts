import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AllowedMenu {
  path: string;
  canRead: boolean;
}

export function useAllowedMenus() {
  const { profile } = useAuth();
  const [allowedPaths, setAllowedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Super Admin has access to everything
  const isSuperAdmin = profile?.rol_nombre === 'Super Administrador';

  useEffect(() => {
    const fetchAllowedMenus = async () => {
      if (isSuperAdmin) {
        // Super Admin can access everything
        setAllowedPaths(new Set(['*']));
        setIsLoading(false);
        return;
      }

      try {
        // Get all submenus where user has 'leer' permission
        // First get the 'leer' permission id
        const { data: permisoData } = await supabase
          .from('permisos')
          .select('id')
          .eq('nombre', 'leer')
          .single();

        if (!permisoData) {
          setAllowedPaths(new Set());
          setIsLoading(false);
          return;
        }

        // Get submenus_permisos for this role and permission
        const { data: permisosData, error: permisosError } = await supabase
          .from('submenus_permisos')
          .select('submenu_id')
          .eq('rol_id', profile?.rol_id)
          .eq('permiso_id', permisoData.id)
          .eq('activo', true);

        if (permisosError) {
          console.error('Error fetching permissions:', permisosError);
          setAllowedPaths(new Set());
          setIsLoading(false);
          return;
        }

        // Get the submenu paths
        const submenuIds = permisosData?.map(p => p.submenu_id) || [];
        
        if (submenuIds.length === 0) {
          setAllowedPaths(new Set());
          setIsLoading(false);
          return;
        }

        const { data: submenusData, error: submenusError } = await supabase
          .from('submenus')
          .select('vista_front_end')
          .in('id', submenuIds)
          .eq('activo', true);

        if (submenusError) {
          console.error('Error fetching submenus:', submenusError);
          setAllowedPaths(new Set());
          setIsLoading(false);
          return;
        }

        const paths = new Set<string>();
        submenusData?.forEach((item: any) => {
          if (item.vista_front_end) {
            paths.add(item.vista_front_end);
          }
        });

        setAllowedPaths(paths);
      } catch (err) {
        console.error('Error in fetchAllowedMenus:', err);
        setAllowedPaths(new Set());
      } finally {
        setIsLoading(false);
      }
    };

    if (profile?.rol_id) {
      fetchAllowedMenus();
    } else {
      setIsLoading(false);
    }
  }, [profile?.rol_id, isSuperAdmin]);

  const isPathAllowed = (path: string): boolean => {
    if (isSuperAdmin || allowedPaths.has('*')) {
      return true;
    }
    return allowedPaths.has(path);
  };

  return {
    isPathAllowed,
    allowedPaths,
    isLoading,
    isSuperAdmin,
  };
}
