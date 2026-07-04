import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Data for the Portal Cobranza > "Complementos" menu (URL /complementos).
// Fed by a single RPC (get_pcobranza_complementos). Field names stay in Spanish
// snake_case: they mirror the DB/RPC json contract.

export type CollectionExtraType = 'productos' | 'mantenimiento' | 'otros';

export interface OwnerOption {
  nombre: string;
  entidadIds: number[];
}

export interface ExtraCategoryRow {
  categoria: string;
  tipo: CollectionExtraType;
  acuerdos: number;
  monto_total: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
}

export interface ExtraProjectRow {
  proyecto: string;
  proyecto_id: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
}

export interface ExtraOverdueAccount {
  cuenta_id: number;
  cliente: string | null;
  proyecto: string | null;
  numero_propiedad: string | null;
  categoria: string;
  tipo: CollectionExtraType;
  parcialidades_vencidas: number;
  vencido: number;
}

export interface CollectionProductsMaintenanceData {
  cobrado_total: number;
  pendiente_total: number;
  vencido_total: number;
  cuentas_count: number;
  acuerdos_count: number;
  // Sección "por mes" (periodo Año/Mes seleccionado; por defecto el mes actual).
  cobrado_mes: number;
  programado_mes: number;
  por_cobrar_mes: number;
  recovery_rate: number;
  // Series mensuales (año actual + 4 previos) para la gráfica cobrado vs programado.
  cobrado_mensual: { mes: string; cobrado: number }[] | null;
  programado_mensual: { mes: string; programado: number }[] | null;
  aging: { rango: string; monto: number; cantidad: number }[] | null;
  por_categoria: ExtraCategoryRow[] | null;
  por_proyecto: ExtraProjectRow[] | null;
  cuentas_vencidas: ExtraOverdueAccount[] | null;
  duenos: { nombre: string; entidad_ids: number[] }[] | null;
}

export function useCollectionProductsMaintenance(
  projectId?: number | null,
  entityIds?: number[] | null,
  tipo?: CollectionExtraType | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery({
    queryKey: ['pcobranza-complementos', projectId, entityIds, tipo, startDate, endDate],
    queryFn: async (): Promise<CollectionProductsMaintenanceData> => {
      // Cast to any: the RPC name is not yet in Supabase's generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_complementos', {
        p_proyecto_id: projectId ?? null,
        p_entidad_ids: entityIds && entityIds.length > 0 ? entityIds : null,
        p_tipo: tipo ?? null,
        p_fecha_inicio: startDate ?? null,
        p_fecha_fin: endDate ?? null,
      });
      if (error) throw error;
      return data as unknown as CollectionProductsMaintenanceData;
    },
    staleTime: 5 * 60 * 1000,
    // Keep previous data on filter change (avoids full-page spinner flash).
    placeholderData: keepPreviousData,
  });
}
