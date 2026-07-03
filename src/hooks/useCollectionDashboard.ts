import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Data for the Portal Cobranza > Dashboard menu.
// The whole dashboard is fed by a single RPC call (get_pcobranza_dashboard).
// Field names stay in Spanish snake_case: they mirror the DB/RPC json contract.

export interface OwnerOption {
  nombre: string;
  entidadIds: number[];
}

export interface CriticalClient {
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

export interface EscriturationPipeline {
  vendidas: number;
  listas_escrituracion: number;
  en_escrituracion: number;
  entregadas: number;
  pagadas_completamente: number;
}

export interface CollectionDashboardData {
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
  pipeline: EscriturationPipeline | null;
  ceps_sin_validar: number | null;
  clientes_criticos: CriticalClient[] | null;
  // SOZU owners for the filter (not filtered by p_entidad_ids). entidad_ids from the RPC.
  duenos: { nombre: string; entidad_ids: number[] }[] | null;
}

export function useCollectionDashboard(
  projectId?: number | null,
  startDate?: string | null,
  endDate?: string | null,
  entityIds?: number[] | null,
) {
  return useQuery({
    queryKey: ['pcobranza-dashboard', projectId, startDate, endDate, entityIds],
    queryFn: async (): Promise<CollectionDashboardData> => {
      // Cast to any: the RPC name is not yet in Supabase's generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_dashboard', {
        p_proyecto_id: projectId ?? null,
        p_fecha_inicio: startDate ?? null,
        p_fecha_fin: endDate ?? null,
        p_entidad_ids: entityIds && entityIds.length > 0 ? entityIds : null,
      });
      if (error) throw error;
      return data as unknown as CollectionDashboardData;
    },
    staleTime: 5 * 60 * 1000,
    // Keep previous data on filter change (avoids full-page spinner flash).
    placeholderData: keepPreviousData,
  });
}
