import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface PagoRecord {
  pago_id: number;
  monto: number;
  fecha_pago: string;
  clave_rastreo: string | null;
  url_cep: string | null;
  url_recibo: string | null;
  descripcion: string | null;
  id_cuenta_cobranza: number | null;
  metodo_pago: string | null;
  clabe_stp: string | null;
  cliente: string | null;
  cliente_email: string | null;
  num_propiedad: string | null;
  modelo: string | null;
  estatus_propiedad: string | null;
  producto: string | null;
  // Del acuerdo de pago ligado (vía aplicaciones_pago). Los llena el RPC (pendiente).
  fecha_limite: string | null;
  monto_aplicado: number | null;
  estado_acuerdo: 'pagado' | 'vencido' | 'proximo' | 'pendiente' | null;
  tipo_cuenta: 'propiedad' | 'producto' | null;
  tipo_categoria: 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento' | null;
  estatus: 'valido' | 'invalido' | 'error' | 'sin_revisar';
  atraso: number;
  proyecto: string | null;
  proyecto_id: number | null;
  tiene_cep: boolean;
}

export interface RelacionPagosFilters {
  proyectoId?: number | null;
  clabe?: string;
  cliente?: string;
  unidad?: string;
  cuenta?: string;
  tipos?: string[] | null;
  estatus?: string[] | null;
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
  isLoading: boolean;
  error: string | null;
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

export function useRelacionPagos(filters: RelacionPagosFilters): RelacionPagosResult {
  const clabe = useDebounced(filters.clabe || '');
  const cliente = useDebounced(filters.cliente || '');
  const unidad = useDebounced(filters.unidad || '');
  const cuenta = useDebounced(filters.cuenta || '');

  const tipos = filters.tipos && filters.tipos.length > 0 ? filters.tipos : null;
  const estatus = filters.estatus && filters.estatus.length > 0 ? filters.estatus : null;

  const queryKey = useMemo(() => [
    'relacion-pagos',
    filters.proyectoId, clabe, cliente, unidad, cuenta,
    tipos, estatus, filters.page, filters.pageSize,
  ], [filters.proyectoId, clabe, cliente, unidad, cuenta, tipos, estatus, filters.page, filters.pageSize]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relacion_pagos', {
        p_proyecto_id: filters.proyectoId ?? null,
        p_limit: filters.pageSize,
        p_offset: (filters.page - 1) * filters.pageSize,
        p_clabe: clabe || null,
        p_cliente: cliente || null,
        p_unidad: unidad || null,
        p_cuenta: cuenta || null,
        p_tipos: tipos,
        p_estatus: estatus,
      } as any);
      if (error) throw error;
      return data as unknown as {
        total: number;
        total_monto: number;
        total_validos: number;
        total_sin_validar: number;
        pagos: PagoRecord[];
      };
    },
    staleTime: 30_000,
    enabled: filters.enabled !== false,
    // Mantener resultados previos al cambiar filtros/página (evita parpadeo).
    placeholderData: keepPreviousData,
  });

  return {
    pagos: data?.pagos ?? [],
    total: Number(data?.total ?? 0),
    totalMonto: Number(data?.total_monto ?? 0),
    totalValidos: Number(data?.total_validos ?? 0),
    totalSinValidar: Number(data?.total_sin_validar ?? 0),
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
