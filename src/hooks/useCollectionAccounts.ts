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
  // Clasificación canónica por id_categoria (P27 §E.1). Mientras la RPC no la
  // devuelva, el front cae a la derivación local accountType().
  tipo_categoria?: 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento' | 'Adicional' | null;
  parcialidades_vencidas: number;
  invalidos: number;
  monto_vencido: number;
  saldo_pendiente: number;
  proximo_vencimiento: string | null;
  ultima_fecha_pago: string | null;
  dias_sin_pagar: number;
  prioridad: 'purple' | 'red_dark' | 'red' | 'yellow' | 'green' | 'blue' | 'gray';
}

export interface CollectionAccountsKpis {
  total: number;
  overdue: number;
  pending: number;
  in_arrears: number;
}

export interface CollectionAccountsResult {
  cuentas: CollectionAccount[];
  total: number;
  kpis: CollectionAccountsKpis;
  modelos: string[];
  estatus: string[];
}

interface CollectionAccountsParams {
  projectId?: number | null;
  search?: string;
  onlyOverdue?: boolean;
  // Filtros de la bandeja (todos server-side para poder paginar como RP).
  cliente?: string;
  unidad?: string;
  clabe?: string;
  cuenta?: string;
  modelos?: string[];
  tipos?: string[];
  estatus?: string[];
  prioridad?: string[];
  invalidLevel?: string[];
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
  enabled?: boolean;
}

const EMPTY_KPIS: CollectionAccountsKpis = { total: 0, overdue: 0, pending: 0, in_arrears: 0 };

const arrOrNull = (a?: string[]) => (a && a.length > 0 ? a : null);

export function useCollectionAccounts(params: CollectionAccountsParams) {
  return useQuery({
    queryKey: [
      'pcobranza-cuentas-cobranza',
      params.projectId, params.search, params.onlyOverdue,
      params.cliente, params.unidad, params.clabe, params.cuenta,
      params.modelos, params.tipos, params.estatus, params.prioridad, params.invalidLevel,
      params.sortKey, params.sortDir, params.page, params.pageSize,
    ],
    queryFn: async (): Promise<CollectionAccountsResult> => {
      // Cast to any: the RPC name is not yet in Supabase's generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_cuentas_cobranza', {
        p_proyecto_id: params.projectId ?? null,
        p_search: params.search || null,
        p_solo_vencidas: params.onlyOverdue ?? false,
        p_cliente: params.cliente || null,
        p_unidad: params.unidad || null,
        p_clabe: params.clabe || null,
        p_cuenta: params.cuenta || null,
        p_modelos: arrOrNull(params.modelos),
        p_tipos: arrOrNull(params.tipos),
        p_estatus: arrOrNull(params.estatus),
        p_prioridad: arrOrNull(params.prioridad),
        p_invalid_level: arrOrNull(params.invalidLevel),
        p_sort_key: params.sortKey || null,
        p_sort_dir: params.sortDir ?? 'asc',
        p_limit: params.pageSize,
        p_offset: (params.page - 1) * params.pageSize,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<CollectionAccountsResult>;
      return {
        cuentas: (d.cuentas as CollectionAccount[]) ?? [],
        total: Number(d.total ?? 0),
        kpis: (d.kpis as CollectionAccountsKpis) ?? EMPTY_KPIS,
        modelos: (d.modelos as string[]) ?? [],
        estatus: (d.estatus as string[]) ?? [],
      };
    },
    staleTime: 3 * 60 * 1000,
    enabled: params.enabled !== false,
    // Keep previous rows while refetching (filtros/página) to avoid blanking the UI.
    placeholderData: keepPreviousData,
  });
}
