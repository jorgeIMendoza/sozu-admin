import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCobranzaImpersonation } from '@/contexts/CobranzaImpersonationContext';

export interface DuenoOption {
  nombre: string;
  entidadIds: number[];
}

export interface ClienteCritico {
  cuenta_id: number;
  cliente_nombre: string | null;
  proyecto: string | null;
  numero_propiedad: string | null;
  producto_nombre: string | null;
  tipo_cuenta: 'Propiedad' | 'Producto';
  parcialidades_vencidas: number;
  monto_vencido: number;
  dias_sin_pagar: number;
}

export interface DashboardPipeline {
  vendidas: number;
  listas_escrituracion: number;
  en_escrituracion: number;
  entregadas: number;
  pagadas_completamente: number;
}

export interface DashboardKPIs {
  cobrado_total: number;
  vencido_total: number;
  vencido_total_sin_ce: number;
  pendiente_total: number;
  cobrado_mes: number;
  programado_mes: number;
  programado_mes_sin_ce: number;
  por_cobrar_mes: number;
  por_cobrar_mes_sin_ce: number;
  recovery_rate: number;
  aging: { rango: string; monto: number; monto_sin_ce: number; cantidad: number }[] | null;
  morosidad: { grupo: string; cuentas: number }[] | null;
  por_proyecto: { proyecto: string; proyecto_id: number; cobrado: number; vencido: number; pendiente: number }[] | null;
  cobrado_mensual: { mes: string; cobrado: number }[] | null;
  programado_mensual: { mes: string; programado: number; programado_sin_ce: number }[] | null;
  // Secciones unificadas (el RPC alimenta TODO el dashboard en una sola llamada)
  pipeline: DashboardPipeline | null;
  ceps_sin_validar: number | null;
  clientes_criticos: ClienteCritico[] | null;
  // Dueños SOZU para el filtro (no se filtran por p_entidad_ids). entidad_ids del RPC.
  duenos: { nombre: string; entidad_ids: number[] }[] | null;
}

export function useCobranzaDashboard(
  proyectoId?: number | null,
  fechaInicio?: string | null,
  fechaFin?: string | null,
  entidadIds?: number[] | null,
) {
  return useQuery({
    queryKey: ['cobranza-dashboard-kpis', proyectoId, fechaInicio, fechaFin, entidadIds],
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data, error } = await supabase.rpc('get_dashboard_cobranza_kpis', {
        p_proyecto_id: proyectoId ?? null,
        p_fecha_inicio: fechaInicio ?? null,
        p_fecha_fin: fechaFin ?? null,
        p_entidad_ids: entidadIds && entidadIds.length > 0 ? entidadIds : null,
      } as any);
      if (error) throw error;
      return data as unknown as DashboardKPIs;
    },
    staleTime: 5 * 60 * 1000,
    // Mantener datos previos al cambiar filtros (evita flash de spinner full-page).
    placeholderData: keepPreviousData,
  });
}

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
