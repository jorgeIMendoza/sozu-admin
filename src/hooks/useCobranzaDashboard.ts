import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCobranzaImpersonation } from '@/contexts/CobranzaImpersonationContext';

// NOTA: el hook y tipos del Dashboard se movieron a `useCollectionDashboard.ts`
// (migración del menú a inglés). Este archivo compartido conserva solo
// `useProyectosCobranza`, usado por varios menús del portal de cobranza.

/**
 * Returns only projects the current user has access to via proyectos_acceso.
 * Super Admins (rol_id 1) and Admins (rol_id 2) see all active projects.
 */
export function useProyectosCobranza() {
  const { user, profile } = useAuth();
  const { impersonatedEmail, impersonatedRoleId, isImpersonating } = useCobranzaImpersonation();
  const effectiveEmail = isImpersonating ? impersonatedEmail : user?.email;
  const effectiveRoleId = isImpersonating ? impersonatedRoleId : profile?.rol_id;
  const hasFullProjectAccess = effectiveRoleId === 1 || effectiveRoleId === 2;

  return useQuery({
    queryKey: ['cobranza-proyectos-filtro', effectiveEmail, effectiveRoleId, isImpersonating],
    queryFn: async () => {
      if (!effectiveEmail && !hasFullProjectAccess) return [];

      if (hasFullProjectAccess) {
        // Step 1: proyectos con cuenta_madre_stp configurada (operan con SOZU)
        const { data: erData, error: erErr } = await (supabase as any)
          .from('entidades_relacionadas')
          .select('id_proyecto')
          .not('cuenta_madre_stp', 'is', null)
          .eq('activo', true);
        if (erErr) throw erErr;
        const erpIds = [...new Set(((erData ?? []) as any[]).map((r) => r.id_proyecto as number))];
        if (!erpIds.length) return [];

        // Step 2: solo proyectos con edificios (desarrollos reales, no cubetas)
        const { data: edifData, error: edifErr } = await (supabase as any)
          .from('edificios')
          .select('id_proyecto')
          .in('id_proyecto', erpIds);
        if (edifErr) throw edifErr;
        const validIds = [...new Set(((edifData ?? []) as any[]).map((e) => e.id_proyecto as number))];
        if (!validIds.length) return [];

        // Step 3: datos del proyecto
        const { data, error } = await supabase
          .from('proyectos')
          .select('id, nombre')
          .in('id', validIds)
          .order('nombre');
        if (error) throw error;
        return data ?? [];
      }

      // Other roles: filter by proyectos_acceso
      const { data: accesos, error: accError } = await supabase
        .from('proyectos_acceso')
        .select('proyecto_id, proyectos!proyectos_acceso_proyecto_id_fkey(id, nombre)')
        .eq('usuario_id', effectiveEmail)
        .eq('activo', true) as any;

      if (accError) throw accError;
      if (!accesos) return [];

      return accesos
        .filter((a: any) => a.proyectos)
        .map((a: any) => ({ id: a.proyectos.id, nombre: a.proyectos.nombre }))
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: hasFullProjectAccess || !!effectiveEmail,
    staleTime: 30 * 60 * 1000,
  });
}
