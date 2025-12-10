import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectAccess {
  proyecto_id: number;
}

export function useProjectAccess() {
  const { session, profile, isLoading: isAuthLoading } = useAuth();
  const userEmail = session?.user?.email;

  // Check if user is Super Admin (has access to all projects)
  const isSuperAdmin = profile?.rol_nombre === 'Super Administrador';
  const isAdminProyecto = profile?.rol_nombre === 'Administrador de Proyecto';
  const hasUnrestrictedAccess = isSuperAdmin || isAdminProyecto;

  // Fetch user's project access (using email as FK, not UUID)
  const { data: projectAccess, isLoading: isLoadingQuery } = useQuery({
    queryKey: ['user-project-access', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      
      const { data, error } = await supabase
        .from('proyectos_acceso')
        .select('proyecto_id')
        .eq('usuario_id', userEmail)
        .eq('activo', true);
      
      if (error) throw error;
      return data as ProjectAccess[];
    },
    enabled: !!userEmail && !hasUnrestrictedAccess && !isAuthLoading,
  });

  // Get list of accessible project IDs
  const accessibleProjectIds = projectAccess?.map(a => a.proyecto_id) || [];

  // Helper function to check if user has access to a specific project
  const hasAccessToProject = (projectId: number): boolean => {
    if (hasUnrestrictedAccess) return true;
    if (!projectAccess || projectAccess.length === 0) return false;
    return accessibleProjectIds.includes(projectId);
  };

  // Helper function to filter an array of items by project ID
  const filterByProjectAccess = <T extends { id_proyecto?: number; proyecto_id?: number }>(
    items: T[]
  ): T[] => {
    if (hasUnrestrictedAccess) return items;
    if (!projectAccess || projectAccess.length === 0) return [];
    
    return items.filter(item => {
      const projectId = item.id_proyecto || item.proyecto_id;
      return projectId && accessibleProjectIds.includes(projectId);
    });
  };

  // Get a filter clause for Supabase queries
  const getProjectFilter = () => {
    if (hasUnrestrictedAccess) return null;
    return accessibleProjectIds;
  };

  // Loading = auth loading OR query loading (but only if we're supposed to query)
  const isLoading = isAuthLoading || (!hasUnrestrictedAccess && isLoadingQuery);

  return {
    accessibleProjectIds,
    hasAccessToProject,
    filterByProjectAccess,
    getProjectFilter,
    hasUnrestrictedAccess,
    isLoading,
    hasNoAccess: !isAuthLoading && !hasUnrestrictedAccess && !isLoadingQuery && accessibleProjectIds.length === 0,
  };
}
