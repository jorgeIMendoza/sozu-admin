import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CUENTA_CHUNK  = 30;
const ACUERDO_CHUNK = 300;
const PAGO_CHUNK    = 300;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAll<T>(
  chunks: number[][],
  query: (ids: number[]) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const results = await Promise.all(chunks.map(query));
  const out: T[] = [];
  for (const { data, error } of results) {
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

// Regla:
//   invalidos = abonos reales (aplics activas con id_pago) con estado IS DISTINCT FROM 'coincide'
//             + pendientes (acuerdos sin abono) SOLO SI la cuenta es de producto
// Para propiedades, los pendientes (ej. contra-entrega) no cuentan como inválidos.
export function usePagosInvalidosPorCuenta(cuentaIds: number[]) {
  return useQuery({
    queryKey: ['pagos-invalidos-por-cuenta', cuentaIds],
    queryFn: async (): Promise<Record<number, number>> => {
      if (cuentaIds.length === 0) return {};

      // ── 0. Identificar cuáles cuentas son de producto ──────────────────────
      const cuentasInfo = await fetchAll<{ id: number; id_oferta: number }>(
        chunk(cuentaIds, CUENTA_CHUNK),
        ids => (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_oferta')
          .in('id', ids)
          .eq('activo', true)
      );
      const ofertaIds = [...new Set(cuentasInfo.map(c => c.id_oferta).filter(Boolean))];
      const cuentaToOferta: Record<number, number> = {};
      for (const c of cuentasInfo) cuentaToOferta[c.id] = c.id_oferta;

      const ofertasProducto = await fetchAll<{ id: number }>(
        chunk(ofertaIds, CUENTA_CHUNK),
        ids => (supabase as any)
          .from('ofertas')
          .select('id')
          .in('id', ids)
          .not('id_producto', 'is', null)
      );
      const ofertasProductoSet = new Set(ofertasProducto.map(o => o.id));
      const cuentasProducto = new Set(
        cuentasInfo.filter(c => ofertasProductoSet.has(c.id_oferta)).map(c => c.id)
      );

      // ── 1. Acuerdos de todas las cuentas ───────────────────────────────────
      const acuerdos = await fetchAll<{ id: number; id_cuenta_cobranza: number }>(
        chunk(cuentaIds, CUENTA_CHUNK),
        ids => (supabase as any)
          .from('acuerdos_pago')
          .select('id, id_cuenta_cobranza')
          .in('id_cuenta_cobranza', ids)
      );
      if (acuerdos.length === 0) return {};

      const acuerdoToCuenta: Record<number, number> = {};
      for (const a of acuerdos) acuerdoToCuenta[a.id] = a.id_cuenta_cobranza;
      const acuerdoIds = acuerdos.map(a => a.id);

      // ── 2. Abonos reales: aplicaciones activas con id_pago ─────────────────
      const aplics = await fetchAll<{ id_acuerdo_pago: number; id_pago: number }>(
        chunk(acuerdoIds, ACUERDO_CHUNK),
        ids => (supabase as any)
          .from('aplicaciones_pago')
          .select('id_acuerdo_pago, id_pago')
          .in('id_acuerdo_pago', ids)
          .eq('activo', true)
          .not('id_pago', 'is', null)
      );

      // Acuerdos que tienen al menos una aplicación con pago
      const acuerdosConPago = new Set(aplics.map(ap => ap.id_acuerdo_pago));

      // ── 3. Validaciones: última por pago (DISTINCT ON id_pago) ─────────────
      const allPagoIds = [...new Set(aplics.map(ap => ap.id_pago))];

      const validMap: Record<number, string> = {};
      if (allPagoIds.length > 0) {
        const validRows = await fetchAll<{ id_pago: number; estado: string }>(
          chunk(allPagoIds, PAGO_CHUNK),
          ids => (supabase as any)
            .from('pago_validaciones')
            .select('id_pago, estado')
            .in('id_pago', ids)
            .order('fecha_creacion', { ascending: false })
        );
        for (const v of validRows) {
          if (!(v.id_pago in validMap)) validMap[v.id_pago] = v.estado;
        }
      }

      // ── 4. Contar inválidos por cuenta ─────────────────────────────────────
      const result: Record<number, number> = {};

      // Abonos reales con estado != 'coincide'
      for (const ap of aplics) {
        const cuentaId = acuerdoToCuenta[ap.id_acuerdo_pago];
        if (cuentaId == null) continue;
        if (validMap[ap.id_pago] !== 'coincide') {
          result[cuentaId] = (result[cuentaId] ?? 0) + 1;
        }
      }

      // Pendientes (acuerdos sin abono) — solo para productos
      for (const acuerdo of acuerdos) {
        if (acuerdosConPago.has(acuerdo.id)) continue;
        const cuentaId = acuerdo.id_cuenta_cobranza;
        if (cuentasProducto.has(cuentaId)) {
          result[cuentaId] = (result[cuentaId] ?? 0) + 1;
        }
      }

      return result;
    },
    enabled: cuentaIds.length > 0,
    staleTime: 3 * 60 * 1000,
  });
}
