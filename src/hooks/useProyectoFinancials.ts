import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProyectoFinancials {
  total_unidades: number;
  total_cuentas: number;
  total_pagos: number;
  total_con_comprobante: number;
  precio_final: number;
  total_pagado: number;
  saldo_pendiente: number;
  efectivo_pagado: number;
  limite_efectivo: number;
  efectivo_aun_permitido: number;
  valor_escrituracion: number;
  total_pagado_todas_cuentas: number;
}

/**
 * Llama a get_proyecto_financials(p_proyecto_id) para obtener KPIs financieros
 * reales del proyecto completo. Solo se activa en modo global (sin unidad específica).
 * No reemplaza useCuentaCobranzaFinancials — ese hook sigue siendo la fuente
 * para el modo rpMode (cuenta individual).
 */
export function useProyectoFinancials(proyectoId: number | null): {
  data: ProyectoFinancials | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['proyecto-financials', proyectoId],
    enabled: !!proyectoId,
    staleTime: 30_000,
    queryFn: async () => {
      // get_proyecto_financials aún no está en los tipos generados por Supabase.
      // Cast a any para evitar error de TypeScript hasta que se regeneren tipos.
      const { data: rows, error } = await (supabase as any).rpc(
        'get_proyecto_financials',
        { p_proyecto_id: proyectoId! },
      ) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

      if (error) {
        console.error('[useProyectoFinancials] RPC error:', error.message);
        throw new Error(error.message);
      }

      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;

      return {
        total_unidades:              Number(row.total_unidades              ?? 0),
        total_cuentas:               Number(row.total_cuentas               ?? 0),
        total_pagos:                 Number(row.total_pagos                 ?? 0),
        total_con_comprobante:       Number(row.total_con_comprobante       ?? 0),
        precio_final:                Number(row.precio_final                ?? 0),
        total_pagado:                Number(row.total_pagado                ?? 0),
        saldo_pendiente:             Number(row.saldo_pendiente             ?? 0),
        efectivo_pagado:             Number(row.efectivo_pagado             ?? 0),
        limite_efectivo:             Number(row.limite_efectivo             ?? 0),
        efectivo_aun_permitido:      Number(row.efectivo_aun_permitido      ?? 0),
        valor_escrituracion:         Number(row.valor_escrituracion         ?? 0),
        total_pagado_todas_cuentas:  Number(row.total_pagado_todas_cuentas  ?? 0),
      } satisfies ProyectoFinancials;
    },
  });

  return { data: data ?? null, isLoading, isError };
}
