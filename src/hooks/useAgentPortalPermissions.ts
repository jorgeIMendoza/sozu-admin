import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentImpersonation } from '@/contexts/AgentImpersonationContext';
import { useImpersonationViewMode } from '@/contexts/ImpersonationViewModeContext';
import { resolveEffectiveRolId, resolveIsSuperAdminView } from '@/lib/impersonation/effective-identity';

/**
 * Permisos por vista del Portal Agente.
 * Mapeo:
 *   Inicio:      canRead (ver tab), canCreate (crear cita/prospecto), canUpdate (editar)
 *   Inventario:  canRead (ver tab), canGenerateOffer (generar oferta)
 *   Pipeline:    canRead (ver tab), canUpdate (editar)
 *   Comisiones:  canRead (ver tab), canUpdate (editar)
 *   Perfil:      canRead (ver tab), canUpdate (editar)
 */

interface ViewPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canGenerateOffer: boolean;
  canGenerateDigitalOffer: boolean;
}

const DEFAULT: ViewPermissions = {
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canGenerateOffer: false,
  canGenerateDigitalOffer: false,
};

const ALL_TRUE: ViewPermissions = {
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canGenerateOffer: true,
  canGenerateDigitalOffer: true,
};

const AGENT_PATHS = [
  '/admin/agent/inicio',
  '/admin/agent/inventario',
  '/admin/agent/prospectos',
  '/admin/agent/pipeline',
  '/admin/agent/comisiones',
  '/admin/agent/perfil',
  // El Portal del Personal reutiliza las vistas de Inventario del Portal Agente,
  // pero con su propio submenú: cada portal define sus permisos por separado.
  '/admin/portal-personal/inventario',
] as const;

export type AgentPath = typeof AGENT_PATHS[number];

export type AgentPortalPermissions = Record<AgentPath, ViewPermissions>;

const DEFAULT_MAP: AgentPortalPermissions = Object.fromEntries(
  AGENT_PATHS.map(p => [p, { ...DEFAULT }])
) as AgentPortalPermissions;

const ALL_MAP: AgentPortalPermissions = Object.fromEntries(
  AGENT_PATHS.map(p => [p, { ...ALL_TRUE }])
) as AgentPortalPermissions;

export function useAgentPortalPermissions() {
  const { profile, permissionVersion } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentRolId } =
    useAgentImpersonation();
  const { viewMode } = useImpersonationViewMode();
  const [permissions, setPermissions] = useState<AgentPortalPermissions>(DEFAULT_MAP);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  // "Vista fiel": los permisos se resuelven con el rol del usuario IMPERSONADO,
  // no con el del admin logueado. Sin impersonación (o en "Vista completa") todo
  // sigue igual que antes. La decisión vive en funciones puras con tests.
  const identity = {
    profileRolId: profile?.rol_id,
    profileRolNombre: profile?.rol_nombre,
    profilePersonaId: profile?.id_persona,
    puedeImpersonar: profile?.puede_impersonar,
    target: impersonatedAgentEmail
      ? {
          email: impersonatedAgentEmail,
          personaId: impersonatedAgentPersonaId,
          nombre: impersonatedAgentName,
          rolId: impersonatedAgentRolId,
        }
      : null,
    viewMode,
  };
  const effectiveRolId = resolveEffectiveRolId(identity);
  const isSuperAdmin = resolveIsSuperAdminView(identity);

  const fetchPermissions = useCallback(async () => {
    if (isSuperAdmin) {
      setPermissions(ALL_MAP);
      setIsLoading(false);
      hasLoadedOnce.current = true;
      return;
    }

    if (!effectiveRolId) {
      setIsLoading(false);
      return;
    }

    try {
      if (!hasLoadedOnce.current) setIsLoading(true);

      // Get submenu ids for agent paths
      const { data: submenus, error: subErr } = await (supabase as any)
        .from('submenus')
        .select('id, vista_front_end')
        .in('vista_front_end', AGENT_PATHS as unknown as string[])
        .eq('activo', true);

      if (subErr || !submenus?.length) {
        setIsLoading(false);
        return;
      }

      const submenuIds = submenus.map((s: any) => s.id);

      // Get all permissions for these submenus and the user's role
      const { data: permsData, error: permErr } = await (supabase as any)
        .from('submenus_permisos')
        .select(`
          submenu_id,
          permisos!inner ( nombre )
        `)
        .in('submenu_id', submenuIds)
        .eq('rol_id', effectiveRolId)
        .eq('activo', true);

      if (permErr) {
        setIsLoading(false);
        return;
      }

      // Build a map submenu_id -> Set<permiso_nombre>
      const submenuPerms = new Map<number, Set<string>>();
      (permsData || []).forEach((p: any) => {
        const set = submenuPerms.get(p.submenu_id) || new Set();
        set.add(p.permisos?.nombre);
        submenuPerms.set(p.submenu_id, set);
      });

      // Map paths to permissions
      const result = { ...DEFAULT_MAP };
      submenus.forEach((s: any) => {
        const names = submenuPerms.get(s.id) || new Set();
        result[s.vista_front_end as AgentPath] = {
          canRead: names.has('leer'),
          canCreate: names.has('crear'),
          canUpdate: names.has('actualizar'),
          canGenerateOffer: names.has('generar_oferta'),
          canGenerateDigitalOffer: names.has('generar_oferta_digital'),
        };
      });

      setPermissions(result);
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error('Error fetching agent portal permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveRolId, isSuperAdmin]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions, permissionVersion]);

  // Visibility change: re-fetch when tab becomes visible (throttled 30s)
  const lastFetchRef = useRef<number>(0);
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchRef.current > 30000) {
          lastFetchRef.current = now;
          fetchPermissions();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchPermissions]);

  return { permissions, isLoading, isSuperAdmin };
}
