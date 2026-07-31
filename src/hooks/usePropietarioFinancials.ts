import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CONCEPTOS_CANCELACION = [7, 9];
// Mismo tamaño de lote que PldDashboard.tsx: listas .in() más grandes se
// truncan/fallan silenciosamente contra PostgREST (URL demasiado larga).
const BATCH = 30;

export interface PropietarioFinancials {
  precioFinal: number;
  totalPagadoAplicaciones: number;
  totalPagadoReal: number;
  saldoPendiente: number;
  limiteEfectivo: number;
  pagadoEfectivo: number;
  aunPermitidoEfectivo: number;
  /** num_propiedad de las unidades de este dueño — para acotar la tabla/KPIs de Relación de Pagos. */
  numerosPropiedad: Set<string>;
}

const EMPTY: Omit<PropietarioFinancials, 'numerosPropiedad'> = {
  precioFinal: 0,
  totalPagadoAplicaciones: 0,
  totalPagadoReal: 0,
  saldoPendiente: 0,
  limiteEfectivo: 0,
  pagadoEfectivo: 0,
  aunPermitidoEfectivo: 0,
};

/**
 * Financials agregados de las cuentas de propiedad (sin bodega/estacionamiento)
 * de un dueño dentro de un proyecto — misma fórmula que useCuentaCobranzaFinancials
 * pero sumada sobre todas sus cuentas en vez de una sola.
 *
 * Solo se usa cuando hay un propietario seleccionado; sin filtro, el modo proyecto
 * completo sigue usando la RPC get_proyecto_financials (más rápida). El "Pago en
 * efectivo" aquí solo contempla la cuenta de propiedad (no bodega/estacionamiento),
 * simplificación aceptable dado el peso marginal de esos montos frente al total.
 *
 * Todas las consultas .in() con más de ~30 ids van en lotes: con un propietario
 * de cientos de unidades, cuentaIds/acuerdoIds fácilmente superan ese tamaño y
 * PostgREST trunca/falla la lista completa sin lanzar error visible.
 */
export function usePropietarioFinancials(proyectoId: number | null, propietarioId: number | null) {
  return useQuery({
    queryKey: ['propietario-financials', proyectoId, propietarioId],
    enabled: !!proyectoId && propietarioId != null,
    staleTime: 30_000,
    queryFn: async (): Promise<PropietarioFinancials> => {
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id')
        .eq('id_proyecto', proyectoId!)
        .eq('activo', true);
      const edificioIds = (edificios ?? []).map((e) => e.id);
      if (!edificioIds.length) return { ...EMPTY, numerosPropiedad: new Set() };

      const modelos: { id: number }[] = [];
      for (let i = 0; i < edificioIds.length; i += BATCH) {
        const slice = edificioIds.slice(i, i + BATCH);
        const { data, error } = await supabase.from('edificios_modelos').select('id').in('id_edificio', slice);
        if (error) throw error;
        modelos.push(...(data ?? []));
      }
      const modeloIds = modelos.map((m) => m.id);
      if (!modeloIds.length) return { ...EMPTY, numerosPropiedad: new Set() };

      const propiedadesRaw: { id: number; numero_propiedad: string | null }[] = [];
      for (let i = 0; i < modeloIds.length; i += BATCH) {
        const slice = modeloIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('propiedades')
          .select('id, numero_propiedad')
          .in('id_edificio_modelo', slice)
          .eq('id_entidad_relacionada_dueno', propietarioId!)
          .eq('activo', true);
        if (error) throw error;
        propiedadesRaw.push(...(data ?? []));
      }
      const propiedadIds = propiedadesRaw.map((p) => p.id);
      const numerosPropiedad = new Set(propiedadesRaw.map((p) => String(p.numero_propiedad)));
      if (!propiedadIds.length) return { ...EMPTY, numerosPropiedad };

      // Cuentas de propiedad — ofertas sin producto (igual que useCuentaCobranzaFinancials).
      const ofertas: { id: number }[] = [];
      for (let i = 0; i < propiedadIds.length; i += BATCH) {
        const slice = propiedadIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('ofertas')
          .select('id')
          .in('id_propiedad', slice)
          .is('id_producto', null)
          .eq('activo', true);
        if (error) throw error;
        ofertas.push(...(data ?? []));
      }
      const ofertaIds = ofertas.map((o) => o.id);
      if (!ofertaIds.length) return { ...EMPTY, numerosPropiedad };

      const cuentas: { id: number; precio_final: number | null; valor_uma: number | null }[] = [];
      for (let i = 0; i < ofertaIds.length; i += BATCH) {
        const slice = ofertaIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('cuentas_cobranza')
          .select('id, precio_final, valor_uma')
          .in('id_oferta', slice)
          .eq('activo', true);
        if (error) throw error;
        cuentas.push(...(data ?? []));
      }
      const cuentaIds = cuentas.map((c) => c.id);
      if (!cuentaIds.length) return { ...EMPTY, numerosPropiedad };

      const precioFinal = cuentas.reduce((s, c) => s + Number(c.precio_final ?? 0), 0);
      const limiteEfectivo = cuentas.reduce((s, c) => s + Number(c.valor_uma ?? 0) * 8025, 0);

      const pagos: { id: number; monto: number | null; id_metodos_pago: number | null }[] = [];
      const acuerdos: { id: number; id_concepto: number | null }[] = [];
      for (let i = 0; i < cuentaIds.length; i += BATCH) {
        const slice = cuentaIds.slice(i, i + BATCH);
        const [{ data: pagosSlice, error: pagosErr }, { data: acuerdosSlice, error: acuerdosErr }] = await Promise.all([
          supabase.from('pagos').select('id, monto, id_metodos_pago').in('id_cuenta_cobranza', slice).eq('activo', true),
          supabase.from('acuerdos_pago').select('id, id_concepto').in('id_cuenta_cobranza', slice).eq('activo', true),
        ]);
        if (pagosErr) throw pagosErr;
        if (acuerdosErr) throw acuerdosErr;
        pagos.push(...(pagosSlice ?? []));
        acuerdos.push(...(acuerdosSlice ?? []));
      }

      const totalPagadoReal = pagos.reduce((s, p) => s + Number(p.monto ?? 0), 0);
      const pagoEfectivoIds = new Set(pagos.filter((p) => p.id_metodos_pago === 1).map((p) => p.id));

      const acuerdosValidos = acuerdos.filter((a) => !CONCEPTOS_CANCELACION.includes(a.id_concepto as number));
      let totalPagadoAplicaciones = 0;
      let pagadoEfectivo = 0;
      const acuerdoIds = acuerdosValidos.map((a) => a.id);
      for (let i = 0; i < acuerdoIds.length; i += BATCH) {
        const slice = acuerdoIds.slice(i, i + BATCH);
        const { data: aplicaciones, error } = await supabase
          .from('aplicaciones_pago')
          .select('id_pago, monto')
          .in('id_acuerdo_pago', slice)
          .eq('activo', true);
        if (error) throw error;
        totalPagadoAplicaciones += (aplicaciones ?? []).reduce((s, a) => s + Number(a.monto ?? 0), 0);
        pagadoEfectivo += (aplicaciones ?? [])
          .filter((a) => pagoEfectivoIds.has(a.id_pago))
          .reduce((s, a) => s + Number(a.monto ?? 0), 0);
      }

      const saldoPendiente = Math.max(0, precioFinal - totalPagadoReal);

      return {
        precioFinal,
        totalPagadoAplicaciones,
        totalPagadoReal,
        saldoPendiente,
        limiteEfectivo,
        pagadoEfectivo,
        aunPermitidoEfectivo: limiteEfectivo - pagadoEfectivo,
        numerosPropiedad,
      };
    },
  });
}
