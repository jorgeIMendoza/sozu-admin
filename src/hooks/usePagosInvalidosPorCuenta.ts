import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePagosInvalidosPorCuenta(cuentaIds: number[]) {
  return useQuery({
    queryKey: ['pagos-invalidos-por-cuenta', cuentaIds],
    queryFn: async (): Promise<Record<number, number>> => {
      if (cuentaIds.length === 0) return {};

      const { data: pagos, error: pe } = await (supabase as any)
        .from('pagos')
        .select('id, id_cuenta_cobranza')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);
      if (pe) throw pe;

      const pagoRows: Array<{ id: number; id_cuenta_cobranza: number }> = pagos ?? [];
      if (pagoRows.length === 0) return {};

      const pagoIds = pagoRows.map(p => p.id);
      const { data: validaciones, error: ve } = await (supabase as any)
        .from('pago_validaciones')
        .select('id_pago, estado')
        .in('id_pago', pagoIds);
      if (ve) throw ve;

      const validMap: Record<number, string> = {};
      for (const v of (validaciones ?? [])) validMap[v.id_pago] = v.estado;

      const result: Record<number, number> = {};
      for (const p of pagoRows) {
        const estado = validMap[p.id];
        if (estado === 'no_coincide' || estado === 'error') {
          result[p.id_cuenta_cobranza] = (result[p.id_cuenta_cobranza] ?? 0) + 1;
        }
      }
      return result;
    },
    enabled: cuentaIds.length > 0,
    staleTime: 3 * 60 * 1000,
  });
}
