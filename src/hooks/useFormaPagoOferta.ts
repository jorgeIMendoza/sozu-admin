import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detalle de forma de pago de la oferta comercial asociada a una cuenta
 * de cobranza. Se usa en el drawer "Valor estimado" del expediente del
 * SOZU Legal Flow para que el abogado entienda cómo está estructurada
 * la operación (enganche, mensualidades, contra entrega, etc.) sin tener
 * que cambiar de pantalla.
 *
 * Pipeline:
 *  1) `cuentas_cobranza` → id_oferta, precio_final, iva_incluido
 *  2) `ofertas` → id_esquema_pago_seleccionado
 *  3) `esquemas_pago` → porcentajes + número de mensualidades
 *  4) `acuerdos_pago` por id_cuenta_cobranza → cronograma de pagos
 *  5) `conceptos_pago` para traducir id_concepto a nombre legible
 */

export interface AcuerdoPagoRow {
  id: number;
  conceptoNombre: string;
  monto: number;
  orden: number;
  fechaPago: string | null;
  pagoCompletado: boolean;
}

export interface EsquemaPagoInfo {
  id: number;
  nombre: string;
  porcentajeEnganche: number;
  porcentajeEntrega: number;
  porcentajeMensualidades: number;
  numeroPagosEnganche: number;
  numeroMensualidades: number;
  porcentajeDescuentoAumento: number;
  esManual: boolean;
}

export interface FormaPagoOferta {
  idCuentaCobranza: number;
  idOferta: number | null;
  precioFinal: number;
  ivaIncluido: boolean;
  esquema: EsquemaPagoInfo | null;
  acuerdos: AcuerdoPagoRow[];
  // Sumatorias calculadas para mostrar avance.
  totalAcuerdos: number;
  totalPagado: number;
  totalPendiente: number;
}

export function useFormaPagoOferta(idCuentaCobranza: number | null | undefined) {
  return useQuery<FormaPagoOferta | null>({
    queryKey: ["forma_pago_oferta", idCuentaCobranza],
    enabled: !!idCuentaCobranza,
    staleTime: 60_000,
    queryFn: () => fetchFormaPago(idCuentaCobranza!),
  });
}

async function fetchFormaPago(idCuentaCobranza: number): Promise<FormaPagoOferta | null> {
  // 1) Cuenta de cobranza con su oferta y precio.
  const { data: cc, error: ccErr } = (await (supabase as any)
    .from("cuentas_cobranza")
    .select("id, id_oferta, precio_final, iva_incluido")
    .eq("id", idCuentaCobranza)
    .maybeSingle()) as any;
  if (ccErr) throw ccErr;
  if (!cc) return null;

  // 2) Oferta → id_esquema_pago_seleccionado.
  let idEsquema: number | null = null;
  if (cc.id_oferta) {
    const { data: of, error: ofErr } = (await (supabase as any)
      .from("ofertas")
      .select("id, id_esquema_pago_seleccionado")
      .eq("id", cc.id_oferta)
      .maybeSingle()) as any;
    if (ofErr) throw ofErr;
    idEsquema = of?.id_esquema_pago_seleccionado ?? null;
  }

  // 3) Esquema de pago.
  let esquema: EsquemaPagoInfo | null = null;
  if (idEsquema) {
    const { data: eq, error: eqErr } = (await (supabase as any)
      .from("esquemas_pago")
      .select(
        "id, nombre, porcentaje_enganche, porcentaje_entrega, porcentaje_mensualidades, numero_pagos_enganche, numero_mensualidades, porcentaje_descuento_aumento, es_manual",
      )
      .eq("id", idEsquema)
      .maybeSingle()) as any;
    if (eqErr) throw eqErr;
    if (eq) {
      esquema = {
        id: eq.id,
        nombre: eq.nombre ?? "Esquema sin nombre",
        porcentajeEnganche: Number(eq.porcentaje_enganche ?? 0),
        porcentajeEntrega: Number(eq.porcentaje_entrega ?? 0),
        porcentajeMensualidades: Number(eq.porcentaje_mensualidades ?? 0),
        numeroPagosEnganche: Number(eq.numero_pagos_enganche ?? 0),
        numeroMensualidades: Number(eq.numero_mensualidades ?? 0),
        porcentajeDescuentoAumento: Number(eq.porcentaje_descuento_aumento ?? 0),
        esManual: !!eq.es_manual,
      };
    }
  }

  // 4) Acuerdos de pago (cronograma) ordenados.
  const { data: acs, error: acErr } = (await (supabase as any)
    .from("acuerdos_pago")
    .select("id, id_concepto, monto, orden, fecha_pago, pago_completado, activo")
    .eq("id_cuenta_cobranza", idCuentaCobranza)
    .eq("activo", true)
    .order("orden", { ascending: true })) as any;
  if (acErr) throw acErr;
  const acuerdosRaw = (acs || []) as Array<any>;

  // 5) Conceptos de pago.
  const conceptoIds = Array.from(
    new Set(acuerdosRaw.map((a) => a.id_concepto).filter((v): v is number => !!v)),
  );
  const { data: concRows } = conceptoIds.length
    ? ((await (supabase as any)
        .from("conceptos_pago")
        .select("id, nombre")
        .in("id", conceptoIds)) as any)
    : { data: [] };
  const conceptoMap = new Map<number, string>(
    (concRows || []).map((c: any) => [c.id, c.nombre as string]),
  );

  const acuerdos: AcuerdoPagoRow[] = acuerdosRaw.map((a) => ({
    id: a.id as number,
    conceptoNombre: conceptoMap.get(a.id_concepto) ?? `Concepto ${a.id_concepto}`,
    monto: Number(a.monto ?? 0),
    orden: Number(a.orden ?? 0),
    fechaPago: (a.fecha_pago as string | null) ?? null,
    pagoCompletado: !!a.pago_completado,
  }));

  const totalAcuerdos = acuerdos.reduce((s, a) => s + a.monto, 0);
  const totalPagado = acuerdos.filter((a) => a.pagoCompletado).reduce((s, a) => s + a.monto, 0);
  const totalPendiente = totalAcuerdos - totalPagado;

  return {
    idCuentaCobranza,
    idOferta: cc.id_oferta ?? null,
    precioFinal: Number(cc.precio_final ?? 0),
    ivaIncluido: !!cc.iva_incluido,
    esquema,
    acuerdos,
    totalAcuerdos,
    totalPagado,
    totalPendiente,
  };
}
