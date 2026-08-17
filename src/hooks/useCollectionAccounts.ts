import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { esSinPermiso, retrySalvoSinPermiso } from '@/lib/rpcErrors';

// Row returned by the get_pcobranza_cuentas_cobranza RPC.
// Field names stay in Spanish snake_case because they mirror the DB/RPC json
// contract (row_to_json); renaming them would require changing the SQL.
export interface CollectionAccount {
  cuenta_id: number;
  // Folio canónico (CC-/CCP-/CM-) que resuelve la RPC v3.
  cuenta_folio?: string | null;
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
  // Días desde el último pago (o desde fecha_compra si no hay pagos). NO es atraso:
  // una cuenta liquidada sigue acumulando días aquí.
  dias_sin_pagar: number;
  // Atraso real: días de la parcialidad vencida más antigua; 0 si no hay vencidas.
  // Lo agrega la RPC v3 (Ejecuciones_manuales/portal-cobranza/02_rpc_cuentas_cobranza_v3.md).
  dias_atraso?: number | null;
  // Suma aplicada a la cuenta y si con eso queda saldada (v3).
  total_aplicado?: number | null;
  liquidada?: boolean | null;
  prioridad: 'purple' | 'red_dark' | 'red' | 'yellow' | 'green' | 'blue' | 'gray';
}

export interface CollectionAccountsKpis {
  total: number;
  overdue: number;
  pending: number;
  in_arrears: number;
}

export interface KpisProyectoCC {
  proyecto_id: number | null;
  proyecto: string | null;
  total: number;
  overdue: number;
  pending: number;
  in_arrears: number;
}

export interface CollectionAccountsResult {
  cuentas: CollectionAccount[];
  total: number;
  kpis: CollectionAccountsKpis;
  /** Universo completo (todos los proyectos). */
  kpisGlobal: CollectionAccountsKpis;
  /** KPIs por proyecto del mismo barrido: cambiar de proyecto no consulta la base. */
  porProyecto: KpisProyectoCC[];
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

  // Igual que Relación de Pagos: los KPIs y catálogos recorren TODAS las cuentas, así que
  // se piden una sola vez por combinación de filtros; la página son 15 filas bajo demanda
  // con `p_incluir_totales: false`.
  // Los totales traen el desglose `por_proyecto`, así que su clave NO incluye el
  // proyecto: cambiar de proyecto se resuelve en memoria, sin consultar.
  const filtroKeySinProyecto = [
    params.search, params.onlyOverdue,
    params.cliente, params.unidad, params.clabe, params.cuenta,
    params.modelos, params.tipos, params.estatus, params.prioridad, params.invalidLevel,
  ];
  const filtroKey = [params.projectId, ...filtroKeySinProyecto];

  const rpcArgs = {
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
  };

  const totalsQuery = useQuery({
    queryKey: ['pcobranza-cuentas-cobranza-totales', ...filtroKeySinProyecto],
    queryFn: async () => {
       
      const { data, error } = await (supabase as any).rpc('get_pcobranza_cuentas_cobranza', {
        ...rpcArgs, p_limit: 0, p_offset: 0, p_incluir_totales: true,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<CollectionAccountsResult> & { por_proyecto?: KpisProyectoCC[] };
      return {
        total: Number(d.total ?? 0),
        kpis: (d.kpis as CollectionAccountsKpis) ?? EMPTY_KPIS,
        modelos: (d.modelos as string[]) ?? [],
        estatus: (d.estatus as string[]) ?? [],
        porProyecto: d.por_proyecto ?? [],
      };
    },
    // KPIs del universo: mismos para todos los usuarios, se cachean más tiempo.
    staleTime: 5 * 60 * 1000,
    enabled: params.enabled !== false,
    retry: retrySalvoSinPermiso,
    placeholderData: keepPreviousData,
  });

  const pageQuery = useQuery({
    queryKey: [
      'pcobranza-cuentas-cobranza',
      ...filtroKey, params.sortKey, params.sortDir, params.page, params.pageSize,
    ],
    queryFn: async (): Promise<CollectionAccount[]> => {
      // Cast to any: the RPC name is not yet in Supabase's generated types.
       
      const { data, error } = await (supabase as any).rpc('get_pcobranza_cuentas_cobranza', {
        ...rpcArgs,
        p_sort_key: params.sortKey || null,
        p_sort_dir: params.sortDir ?? 'asc',
        p_limit: params.pageSize,
        p_offset: (params.page - 1) * params.pageSize,
        p_incluir_totales: false,
      });
      if (error) throw error;
      return ((data ?? {}).cuentas as CollectionAccount[]) ?? [];
    },
    staleTime: 3 * 60 * 1000,
    enabled: params.enabled !== false,
    retry: retrySalvoSinPermiso,
    // Keep previous rows while refetching (filtros/página) to avoid blanking the UI.
    placeholderData: keepPreviousData,
  });

  // KPIs del filtro activo: con proyecto elegido se lee su fila del desglose; sin él,
  // el agregado de todos. Ambos salen del mismo barrido.
  const porProyecto = totalsQuery.data?.porProyecto ?? [];
  const filaProyecto = params.projectId != null
    ? porProyecto.find(x => Number(x.proyecto_id) === params.projectId)
    : undefined;
  const kpisFiltro: CollectionAccountsKpis = params.projectId != null
    ? {
        total: Number(filaProyecto?.total ?? 0),
        overdue: Number(filaProyecto?.overdue ?? 0),
        pending: Number(filaProyecto?.pending ?? 0),
        in_arrears: Number(filaProyecto?.in_arrears ?? 0),
      }
    : (totalsQuery.data?.kpis ?? EMPTY_KPIS);

  // Solo cuando la RPC respondió 403 (ERRCODE 42501). Sin gate previo con usePermissions:
  // su `canView` es asíncrono y muta estado en cada llamada — usarlo en el render rompe la
  // pantalla y encadena re-renders.
  const sinPermiso = esSinPermiso(pageQuery.error) || esSinPermiso(totalsQuery.error);

  return {
    ...pageQuery,
    // Un 403 se reporta como `sinPermiso`, no como falla de carga.
    isError: pageQuery.isError && !sinPermiso,
    sinPermiso,
    // La tabla no espera a los KPIs: se pinta con la página y las tarjetas se llenan
    // cuando llega la consulta de totales.
    isLoadingTotales: totalsQuery.isLoading,
    data: {
      cuentas: pageQuery.data ?? [],
      total: kpisFiltro.total,
      kpis: kpisFiltro,
      // Universo completo, para contrastar cuando hay un proyecto elegido.
      kpisGlobal: totalsQuery.data?.kpis ?? EMPTY_KPIS,
      porProyecto,
      modelos: totalsQuery.data?.modelos ?? [],
      estatus: totalsQuery.data?.estatus ?? [],
    } as CollectionAccountsResult,
  };
}
