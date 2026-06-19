import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CONCEPTOS_CANCELACION = [7, 9];

export interface AccesorioSummary {
  precioFinal: number;
  totalPagadoAplicaciones: number;
  totalPagadoReal: number;
  saldoPendiente: number;
}

async function fetchFinancialsByCuentaIds(cuentaIds: number[]): Promise<AccesorioSummary> {
  if (!cuentaIds.length) return { precioFinal: 0, totalPagadoAplicaciones: 0, totalPagadoReal: 0, saldoPendiente: 0 };

  const [{ data: cuentas }, { data: pagos }, { data: acuerdos }] = await Promise.all([
    supabase.from('cuentas_cobranza').select('precio_final').in('id', cuentaIds).eq('activo', true),
    supabase.from('pagos').select('monto').in('id_cuenta_cobranza', cuentaIds).eq('activo', true),
    supabase.from('acuerdos_pago').select('id, id_concepto').in('id_cuenta_cobranza', cuentaIds).eq('activo', true),
  ]);

  const precioFinal = (cuentas ?? []).reduce((s, c) => s + Number(c.precio_final ?? 0), 0);
  const totalPagadoReal = (pagos ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0);

  const acuerdosValidos = (acuerdos ?? []).filter(a => !CONCEPTOS_CANCELACION.includes(a.id_concepto));
  let totalPagadoAplicaciones = 0;
  if (acuerdosValidos.length) {
    const { data: aplicaciones } = await supabase
      .from('aplicaciones_pago')
      .select('monto')
      .in('id_acuerdo_pago', acuerdosValidos.map(a => a.id))
      .eq('activo', true);
    totalPagadoAplicaciones = (aplicaciones ?? []).reduce((s, a) => s + Number(a.monto ?? 0), 0);
  }

  return { precioFinal, totalPagadoAplicaciones, totalPagadoReal, saldoPendiente: precioFinal - totalPagadoReal };
}

export function useAccesoriosFinancials(idPropiedad: number | null) {
  return useQuery({
    queryKey: ['cc-accesorios-financials', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Obtener id_producto de bodegas y estacionamientos de esta propiedad
      const [{ data: bodegas }, { data: estacionamientos }] = await Promise.all([
        supabase.from('bodegas').select('id_producto').eq('id_propiedad', idPropiedad!).eq('activo', true),
        supabase.from('estacionamientos').select('id_producto').eq('id_propiedad', idPropiedad!).eq('activo', true),
      ]);

      const bodegaProductIds = [...new Set((bodegas ?? []).map(b => b.id_producto).filter(Boolean))] as number[];
      const estProductIds = [...new Set((estacionamientos ?? []).map(e => e.id_producto).filter(Boolean))] as number[];
      const allProductIds = [...new Set([...bodegaProductIds, ...estProductIds])];

      if (!allProductIds.length) return { bodega: null, cajon: null };

      // 2. Ofertas scopeadas a la misma propiedad (igual que escrituracion en DetalleCuentaCobranza)
      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id, id_producto')
        .in('id_producto', allProductIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);

      const ofertasByProduct = new Map<number, number[]>();
      (ofertas ?? []).forEach(o => {
        const prev = ofertasByProduct.get(o.id_producto!) ?? [];
        prev.push(o.id);
        ofertasByProduct.set(o.id_producto!, prev);
      });

      // 3. cuentas_cobranza para esas ofertas
      const allOfertaIds = Array.from(ofertasByProduct.values()).flat();
      if (!allOfertaIds.length) return { bodega: null, cajon: null };

      const { data: cuentasRaw } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_oferta')
        .in('id_oferta', allOfertaIds)
        .eq('activo', true);

      const cuentaByOferta = new Map<number, number>();
      (cuentasRaw ?? []).forEach(c => cuentaByOferta.set(c.id_oferta, c.id));

      const cuentaIdsForProducts = (productIds: number[]) =>
        [...new Set(productIds.flatMap(pid =>
          (ofertasByProduct.get(pid) ?? [])
            .map(oid => cuentaByOferta.get(oid))
            .filter((id): id is number => id != null)
        ))];

      const bodegaCuentaIds = cuentaIdsForProducts(bodegaProductIds);
      const estCuentaIds = cuentaIdsForProducts(estProductIds);

      // 4. Financials en paralelo
      const [bodegaFinancials, estFinancials] = await Promise.all([
        fetchFinancialsByCuentaIds(bodegaCuentaIds),
        fetchFinancialsByCuentaIds(estCuentaIds),
      ]);

      return {
        bodega: bodegaCuentaIds.length ? bodegaFinancials : null,
        cajon: estCuentaIds.length ? estFinancials : null,
      };
    },
  });
}
