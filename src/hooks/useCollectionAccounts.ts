import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Row returned by the get_pcobranza_cuentas_cobranza RPC.
// Field names stay in Spanish snake_case because they mirror the DB/RPC json
// contract (row_to_json); renaming them would require changing the SQL.
export interface CollectionAccount {
  cuenta_id: number;
  clabe_stp: string | null;
  precio_final: number | null;
  fecha_compra: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  proyecto: string | null;
  proyecto_id: number | null;
  edificio: string | null;
  numero_propiedad: string | null;
  modelo: string | null;
  id_estatus_disponibilidad: number | null;
  estatus_propiedad: string | null;
  producto_nombre: string | null;
  tipo_cuenta: 'Propiedad' | 'Producto' | 'Servicio' | 'Mantenimiento';
  parcialidades_vencidas: number;
  invalidos: number;
  monto_vencido: number;
  saldo_pendiente: number;
  proximo_vencimiento: string | null;
  ultima_fecha_pago: string | null;
  dias_sin_pagar: number;
  prioridad: 'purple' | 'red_dark' | 'red' | 'yellow' | 'green' | 'blue' | 'gray';
}

interface CollectionAccountsParams {
  projectId?: number | null;
  search?: string;
  onlyOverdue?: boolean;
}

export function useCollectionAccounts(params: CollectionAccountsParams = {}) {
  return useQuery({
    queryKey: ['pcobranza-cuentas-cobranza', params.projectId, params.search, params.onlyOverdue],
    queryFn: async (): Promise<CollectionAccount[]> => {
      // Cast to any: the RPC name is not yet in Supabase's generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_cuentas_cobranza', {
        p_proyecto_id: params.projectId ?? null,
        p_search: params.search || null,
        p_solo_vencidas: params.onlyOverdue ?? false,
      });
      if (error) throw error;
      return (data as unknown as CollectionAccount[]) ?? [];
    },
    staleTime: 3 * 60 * 1000,
    // Keep previous rows while refetching (project change) to avoid blanking the UI.
    placeholderData: keepPreviousData,
  });
}
