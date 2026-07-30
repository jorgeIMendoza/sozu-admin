import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { esSinPermiso, retrySalvoSinPermiso } from '@/lib/rpcErrors';

export interface PagoRecord {
  pago_id: number;
  monto: number;
  fecha_pago: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  id_cuenta_cobranza: number | null;
  // Folio canónico que resuelve la RPC: CC- / CCP- / CM-.
  cuenta_folio?: string | null;
  metodo_pago: string | null;
  clabe_stp: string | null;
  cliente: string | null;
  cliente_email: string | null;
  num_propiedad: string | null;
  modelo: string | null;
  edificio?: string | null;
  estatus_propiedad: string | null;
  producto: string | null;
  tipo_cuenta: 'propiedad' | 'producto' | 'mantenimiento' | 'Propiedad' | 'Producto' | 'Mantenimiento' | null;
  tipo_categoria: 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento' | 'Adicional' | null;
  // Agrupación de validación (valido/invalido/error/sin_revisar).
  estatus?: 'valido' | 'invalido' | 'error' | 'sin_revisar';
  // Estado de validación crudo (6 estados).
  estado_validacion?: 'coincide' | 'no_coincide' | 'error' | 'sin_evidencia' | 'monto_ilegible' | 'monto_ausente_db' | null;
  // Estado del PAGO según lo aplicado de él. No es el estado del acuerdo: un pago cobrado
  // no puede salir "Vencido" porque su acuerdo siga abierto.
  estado_pago?: 'pagado' | 'parcial' | 'sin_aplicar';
  monto_aplicado?: number;
  atraso?: number;
  proyecto: string | null;
  proyecto_id: number | null;
  tiene_cep: boolean;
}

export interface KpisProyecto {
  proyecto_id: number | null;
  proyecto: string | null;
  total: number;
  total_monto: number;
  total_validos: number;
  total_sin_validar: number;
  total_coincide: number;
  total_con_obs: number;
}

export interface RelacionPagosFilters {
  proyectoId?: number | null;
  clabe?: string;
  cliente?: string;
  unidad?: string;
  cuenta?: string;
  tipos?: string[] | null;
  // 6 estados crudos de validación (+ 'sin_validar').
  estadoValidacion?: string[] | null;
  metodos?: string[] | null;
  estatusProp?: string[] | null;
  estadoPago?: string[] | null;
  modelos?: string[] | null;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
  enabled?: boolean;
}

export interface RelacionPagosResult {
  pagos: PagoRecord[];
  total: number;
  totalMonto: number;
  totalValidos: number;
  totalSinValidar: number;
  totalPorEstado: Record<string, number> | null;
  /** Conteo por estado del pago (`pagado`/`parcial`/`sin_aplicar`) del universo filtrado. */
  totalPorEstadoPago: Record<string, number> | null;
  /** Universo completo (todos los proyectos), para contrastar con el filtro activo. */
  totalGlobal: number;
  totalMontoGlobal: number;
  /** KPIs por proyecto, del mismo barrido: cambiar de proyecto no consulta la base. */
  porProyecto: KpisProyecto[];
  /** Los KPIs llegan en una segunda consulta; la tabla no los espera. */
  isLoadingTotales: boolean;
  metodos: string[];
  modelos: string[];
  estatusProp: string[];
  isLoading: boolean;
  error: string | null;
  /** La RPC respondió 403 (ERRCODE 42501): el rol no tiene `leer` en este submenú. */
  sinPermiso: boolean;
}

// Debounce de los campos de texto (CLABE, Cliente, Unidad, Cuenta).
function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const arrOrNull = (a?: string[] | null) => (a && a.length > 0 ? a : null);

export function useRelacionPagos(filters: RelacionPagosFilters): RelacionPagosResult {
  // La RPC valida permisos por dentro y responde 403. Se comprueba antes para no disparar
  // dos llamadas condenadas al abrir la pantalla.
  const { canView } = usePermissions();
  const puedeVer = canView('/admin/portal-cobranza/relacion-pagos')
    || canView('/admin/portal-escrituracion/relacion-pagos')
    || canView('/admin/validacion-pagos');

  const clabe = useDebounced(filters.clabe || '');
  const cliente = useDebounced(filters.cliente || '');
  const unidad = useDebounced(filters.unidad || '');
  const cuenta = useDebounced(filters.cuenta || '');

  const tipos = arrOrNull(filters.tipos);
  const estadoValidacion = arrOrNull(filters.estadoValidacion);
  const metodos = arrOrNull(filters.metodos);
  const estatusProp = arrOrNull(filters.estatusProp);
  const estadoPago = arrOrNull(filters.estadoPago);
  const modelos = arrOrNull(filters.modelos);

  // Dos consultas separadas a propósito:
  //  · TOTALES/catálogos: recorren todo el universo del filtro → se piden una vez por
  //    combinación de filtros (p_limit 0, sin filas).
  //  · PÁGINA: 15 filas bajo demanda, con p_incluir_totales=false, así navegar no vuelve
  //    a recorrer el universo.
  // Clave de los filtros SIN proyecto: la consulta de totales devuelve el desglose
  // `por_proyecto`, así que cambiar de proyecto no dispara una consulta nueva.
  const filtroKeySinProyecto = [
    clabe, cliente, unidad, cuenta,
    tipos, estadoValidacion, metodos, estatusProp, estadoPago, modelos,
  ];
  const filtroKey = [filters.proyectoId, ...filtroKeySinProyecto];

  const rpcArgs = {
    p_proyecto_id: filters.proyectoId ?? null,
    p_clabe: clabe || null,
    p_cliente: cliente || null,
    p_unidad: unidad || null,
    p_cuenta: cuenta || null,
    p_tipos: tipos,
    p_estatus: null,
    p_metodos: metodos,
    p_estatus_prop: estatusProp,
    p_estado_validacion: estadoValidacion,
    p_estado_pago: estadoPago,
    p_modelos: modelos,
  };

  const { data: totals, isLoading: loadingTotals, error: errorTotales } = useQuery({
    queryKey: ['relacion-pagos-totales', ...filtroKeySinProyecto],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_relacion_pagos', {
        ...rpcArgs, p_limit: 0, p_offset: 0, p_incluir_totales: true,
      } as any);
      if (error) throw error;
      return data as unknown as {
        total: number; total_monto: number; total_validos: number; total_sin_validar: number;
        total_por_estado?: Record<string, number> | null;
        total_por_estado_pago?: Record<string, number> | null;
        por_proyecto?: KpisProyecto[] | null;
        metodos?: string[] | null; modelos?: string[] | null; estatus_prop?: string[] | null;
      };
    },
    // Los KPIs del universo son iguales para todos: se cachean más tiempo.
    staleTime: 5 * 60_000,
    enabled: filters.enabled !== false && puedeVer,
    retry: retrySalvoSinPermiso,
    placeholderData: keepPreviousData,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['relacion-pagos', ...filtroKey, filters.sortKey, filters.sortDir, filters.page, filters.pageSize],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pcobranza_relacion_pagos', {
        ...rpcArgs,
        p_limit: filters.pageSize,
        p_offset: (filters.page - 1) * filters.pageSize,
        p_sort_key: filters.sortKey || null,
        p_sort_dir: filters.sortDir ?? 'asc',
        p_incluir_totales: false,
      } as any);
      if (error) throw error;
      return data as unknown as { pagos: PagoRecord[] };
    },
    staleTime: 30_000,
    enabled: filters.enabled !== false && puedeVer,
    retry: retrySalvoSinPermiso,
    // Mantener resultados previos al cambiar filtros/página (evita parpadeo).
    placeholderData: keepPreviousData,
  });

  // KPIs del filtro activo: si hay proyecto seleccionado se lee su fila del desglose
  // (sin ir a la base); si no, se usa el agregado de todos los proyectos.
  const porProyecto = totals?.por_proyecto ?? [];
  const fila = filters.proyectoId != null
    ? porProyecto.find(x => Number(x.proyecto_id) === filters.proyectoId)
    : undefined;
  const kpis = filters.proyectoId != null
    ? {
        total: Number(fila?.total ?? 0),
        monto: Number(fila?.total_monto ?? 0),
        validos: Number(fila?.total_validos ?? 0),
        sinValidar: Number(fila?.total_sin_validar ?? 0),
      }
    : {
        total: Number(totals?.total ?? 0),
        monto: Number(totals?.total_monto ?? 0),
        validos: Number(totals?.total_validos ?? 0),
        sinValidar: Number(totals?.total_sin_validar ?? 0),
      };

  return {
    pagos: data?.pagos ?? [],
    total: kpis.total,
    totalMonto: kpis.monto,
    totalValidos: kpis.validos,
    totalSinValidar: kpis.sinValidar,
    // Universo completo, para mostrar "de X global" cuando hay un proyecto elegido.
    totalGlobal: Number(totals?.total ?? 0),
    totalMontoGlobal: Number(totals?.total_monto ?? 0),
    porProyecto,
    totalPorEstado: (totals?.total_por_estado ?? null) as Record<string, number> | null,
    // pagado / parcial / sin_aplicar sobre el universo del filtro.
    totalPorEstadoPago: (totals?.total_por_estado_pago ?? null) as Record<string, number> | null,
    metodos: totals?.metodos ?? [],
    modelos: totals?.modelos ?? [],
    estatusProp: totals?.estatus_prop ?? [],
    // La tabla NO espera a los totales: se pinta con la página (ms) y las tarjetas
    // de KPI se llenan cuando llega la otra consulta.
    isLoading,
    isLoadingTotales: loadingTotals,
    // Un 403 no es un error a mostrar como falla: la pantalla enseña "sin permiso".
    error: error && !esSinPermiso(error) ? (error as Error).message : null,
    sinPermiso: !puedeVer || esSinPermiso(error) || esSinPermiso(errorTotales),
  };
}
