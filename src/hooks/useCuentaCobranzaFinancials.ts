import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CONCEPTOS_CANCELACION = [7, 9];

export interface CuentaCobranzaFinancials {
  precioFinal: number;
  totalPagadoAplicaciones: number;
  totalPagadoReal: number;
  saldoPendiente: number;
  haySobrepago: boolean;
  montoSobrepago: number;
  limiteEfectivo: number;
  pagadoEfectivo: number;
  aunPermitidoEfectivo: number;
  valorEscrituracion: number | null;
  idPropiedad: number | null;
}

/**
 * Replica la lógica financiera exacta de DetalleCuentaCobranza para una cuenta dada.
 * Usar tanto en /cuentas-cobranza/:id/detalle como en /relacion-pagos.
 */
export function useCuentaCobranzaFinancials(cuentaId: number | null): {
  data: CuentaCobranzaFinancials | null;
  isLoading: boolean;
} {
  // ── 1. Base: precio_final, valor_uma, id_propiedad ─────────────────────────
  const { data: base, isLoading: baseLoading } = useQuery({
    queryKey: ['cc-financials-base', cuentaId],
    enabled: !!cuentaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: cuenta } = await supabase
        .from('cuentas_cobranza')
        .select('id, precio_final, valor_uma, id_oferta')
        .eq('id', cuentaId!)
        .maybeSingle();
      if (!cuenta) return null;

      const { data: oferta } = await supabase
        .from('ofertas')
        .select('id_propiedad, id_producto')
        .eq('id', cuenta.id_oferta)
        .maybeSingle();

      const idPropiedad: number | null = oferta?.id_propiedad ?? null;
      const esPropiedad = !oferta?.id_producto;

      return {
        precio_final: Number(cuenta.precio_final ?? 0),
        valor_uma: Number(cuenta.valor_uma ?? 0),
        id_propiedad: idPropiedad,
        es_propiedad: esPropiedad,
      };
    },
  });

  // ── 2. Total Pagado (aplicaciones) — excluye conceptos 7 y 9 ──────────────
  // Fuente: acuerdos_pago → aplicaciones_pago (igual que DetalleCuentaCobranza)
  const { data: pagadoAplicaciones, isLoading: pagadoAplicacionesLoading } = useQuery({
    queryKey: ['cc-financials-pagado-aplicaciones', cuentaId],
    enabled: !!cuentaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: acuerdos } = await supabase
        .from('acuerdos_pago')
        .select('id, id_concepto')
        .eq('id_cuenta_cobranza', cuentaId!)
        .eq('activo', true);

      if (!acuerdos?.length) {
        console.warn('[useCuentaCobranzaFinancials] cuentaId=' + cuentaId + ': sin acuerdos_pago');
        return 0;
      }

      const acuerdosValidos = acuerdos.filter(
        (a) => !CONCEPTOS_CANCELACION.includes(a.id_concepto),
      );
      if (!acuerdosValidos.length) {
        console.warn('[useCuentaCobranzaFinancials] cuentaId=' + cuentaId + ': todos los acuerdos son cancelación');
        return 0;
      }

      const { data: aplicaciones } = await supabase
        .from('aplicaciones_pago')
        .select('monto')
        .in('id_acuerdo_pago', acuerdosValidos.map((a) => a.id))
        .eq('activo', true);

      if (!aplicaciones?.length) {
        console.warn('[useCuentaCobranzaFinancials] cuentaId=' + cuentaId + ': sin aplicaciones_pago para acuerdos válidos');
      }

      const total = (aplicaciones ?? []).reduce((s, a) => s + Number(a.monto ?? 0), 0);
      console.log('[useCuentaCobranzaFinancials] cuentaId=' + cuentaId + ' → totalPagadoAplicaciones=' + total);
      return total;
    },
  });

  // ── 3. Total Pagado Real (pagos.monto) — fuente para Saldo Pendiente ───────
  // Fuente: SUM(pagos.monto) WHERE id_cuenta_cobranza=X AND activo=true
  // Usa key propio para no colisionar con el query de DetalleCuentaCobranza que
  // selecciona más campos (fecha_pago, clave_rastreo, metodos_pago, etc.)
  const { data: pagadoReal, isLoading: pagadoRealLoading } = useQuery({
    queryKey: ['cc-financials-pagos-real', cuentaId],
    enabled: !!cuentaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('pagos')
        .select('monto')
        .eq('id_cuenta_cobranza', cuentaId!)
        .eq('activo', true);
      const total = (data ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0);
      console.log('[useCuentaCobranzaFinancials] cuentaId=' + cuentaId + ' → totalPagadoReal=' + total + ' (' + (data?.length ?? 0) + ' pagos)');
      return total;
    },
  });

  // ── 4. Pago en efectivo — waterfall propiedad + bodegas + estacionamientos ─
  // Réplica exacta de cashPaymentsData en DetalleCuentaCobranza
  const idPropiedad = base?.id_propiedad ?? null;
  const esPropiedad = base?.es_propiedad ?? false;

  const { data: cashData, isLoading: cashLoading } = useQuery({
    queryKey: ['cc-financials-cash', cuentaId, idPropiedad],
    enabled: !!cuentaId && esPropiedad && !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      // ── Waterfall para la propiedad ────────────────────────────────────────
      async function sumEfectivoForCuentas(ids: number[]): Promise<number> {
        if (!ids.length) return 0;
        const { data: acuerdos } = await supabase
          .from('acuerdos_pago')
          .select('id')
          .in('id_cuenta_cobranza', ids)
          .eq('activo', true);
        const acuerdoIds = (acuerdos ?? []).map((a) => a.id);
        if (!acuerdoIds.length) return 0;

        const { data: aplicaciones } = await supabase
          .from('aplicaciones_pago')
          .select('id_pago, monto')
          .in('id_acuerdo_pago', acuerdoIds)
          .eq('activo', true);
        if (!aplicaciones?.length) return 0;

        const pagoIds = aplicaciones.map((a) => a.id_pago).filter(Boolean);
        if (!pagoIds.length) return 0;

        const { data: pagosEfectivo } = await supabase
          .from('pagos')
          .select('id')
          .in('id', pagoIds)
          .eq('id_metodos_pago', 1) // Efectivo
          .eq('activo', true);
        const efectivoIds = new Set((pagosEfectivo ?? []).map((p) => p.id));

        return aplicaciones
          .filter((a) => efectivoIds.has(a.id_pago))
          .reduce((s, a) => s + Number(a.monto ?? 0), 0);
      }

      // Propiedad principal
      const pagosPropiedadEfectivo = await sumEfectivoForCuentas([cuentaId!]);

      // Bodegas no incluidas → ofertas → cuentas
      const { data: bodegas } = await supabase
        .from('bodegas')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('es_incluido', false)
        .eq('activo', true);

      let pagosBodegasEfectivo = 0;
      const bodegaProductIds = (bodegas ?? []).map((b) => b.id_producto).filter(Boolean) as number[];
      if (bodegaProductIds.length) {
        const { data: ofertasBodegas } = await supabase
          .from('ofertas').select('id').in('id_producto', bodegaProductIds).eq('activo', true);
        const ofertaBodegaIds = (ofertasBodegas ?? []).map((o) => o.id);
        if (ofertaBodegaIds.length) {
          const { data: cuentasBodegas } = await supabase
            .from('cuentas_cobranza').select('id').in('id_oferta', ofertaBodegaIds).eq('activo', true);
          pagosBodegasEfectivo = await sumEfectivoForCuentas(
            (cuentasBodegas ?? []).map((c) => c.id),
          );
        }
      }

      // Estacionamientos no incluidos → ofertas → cuentas
      const { data: estacionamientos } = await supabase
        .from('estacionamientos')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('es_incluido', false)
        .eq('activo', true);

      let pagosEstacionamientosEfectivo = 0;
      const estProductIds = (estacionamientos ?? []).map((e) => e.id_producto).filter(Boolean) as number[];
      if (estProductIds.length) {
        const { data: ofertasEst } = await supabase
          .from('ofertas').select('id').in('id_producto', estProductIds).eq('activo', true);
        const ofertaEstIds = (ofertasEst ?? []).map((o) => o.id);
        if (ofertaEstIds.length) {
          const { data: cuentasEst } = await supabase
            .from('cuentas_cobranza').select('id').in('id_oferta', ofertaEstIds).eq('activo', true);
          pagosEstacionamientosEfectivo = await sumEfectivoForCuentas(
            (cuentasEst ?? []).map((c) => c.id),
          );
        }
      }

      return {
        pagadoEfectivo: pagosPropiedadEfectivo + pagosBodegasEfectivo + pagosEstacionamientosEfectivo,
      };
    },
  });

  // ── 5. Valor de escrituración — waterfall bodegas/estac/ofertas/cuentas ───
  // Réplica exacta de escrituracionData en DetalleCuentaCobranza
  const { data: escrituracionData, isLoading: escrituracionLoading } = useQuery({
    queryKey: ['cc-financials-escrituracion', cuentaId, idPropiedad],
    enabled: !!cuentaId && esPropiedad && !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const precioPropiedad = base?.precio_final ?? 0;

      const [{ data: allBodegas }, { data: allEstacionamientos }] = await Promise.all([
        supabase.from('bodegas').select('id, id_producto').eq('id_propiedad', idPropiedad!).eq('activo', true),
        supabase.from('estacionamientos').select('id, id_producto').eq('id_propiedad', idPropiedad!).eq('activo', true),
      ]);

      const bodegaProductIds = [...new Set((allBodegas ?? []).map((b) => b.id_producto).filter(Boolean))] as number[];
      const estProductIds = [...new Set((allEstacionamientos ?? []).map((e) => e.id_producto).filter(Boolean))] as number[];
      const allProductIds = [...new Set([...bodegaProductIds, ...estProductIds])];

      if (!allProductIds.length) return precioPropiedad;

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id, id_producto')
        .in('id_producto', allProductIds)
        .eq('id_propiedad', idPropiedad!) // scoped a la misma propiedad
        .eq('activo', true);

      const allOfertaIds = (ofertas ?? []).map((o) => o.id);
      if (!allOfertaIds.length) return precioPropiedad;

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id_oferta, precio_final')
        .in('id_oferta', allOfertaIds)
        .eq('activo', true);

      const extra = (cuentas ?? []).reduce((s, c) => s + Number(c.precio_final ?? 0), 0);
      return precioPropiedad + extra;
    },
  });

  // ── Derivaciones finales ───────────────────────────────────────────────────
  const isLoading =
    baseLoading || pagadoAplicacionesLoading || pagadoRealLoading ||
    (esPropiedad && (cashLoading || escrituracionLoading));

  if (!cuentaId || !base) return { data: null, isLoading };

  const precioFinal = base.precio_final;
  const totalPagadoAplicaciones = pagadoAplicaciones ?? 0;
  const totalPagadoReal = pagadoReal ?? 0;
  const diferenciaReal = precioFinal - totalPagadoReal;
  const haySobrepago = diferenciaReal < -0.01;
  const saldoPendiente = Math.max(0, diferenciaReal);
  const montoSobrepago = haySobrepago ? Math.abs(diferenciaReal) : 0;
  const limiteEfectivo = base.valor_uma * 8025;
  const pagadoEfectivo = cashData?.pagadoEfectivo ?? 0;
  const aunPermitidoEfectivo = limiteEfectivo - pagadoEfectivo;

  return {
    data: {
      precioFinal,
      totalPagadoAplicaciones,
      totalPagadoReal,
      saldoPendiente,
      haySobrepago,
      montoSobrepago,
      limiteEfectivo,
      pagadoEfectivo,
      aunPermitidoEfectivo,
      valorEscrituracion: esPropiedad ? (escrituracionData ?? null) : null,
      idPropiedad,
    },
    isLoading,
  };
}
