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
 *  3) `esquemas_pago` → nombre del esquema y porcentajes de la plantilla
 *  4) `acuerdos_pago` por id_cuenta_cobranza → cronograma de pagos
 *  5) `conceptos_pago` para traducir id_concepto a nombre legible
 *
 * IMPORTANTE — los porcentajes de `esquemas_pago` describen la PLANTILLA, no la
 * operación: los esquemas escalonados/manuales suelen guardar
 * `porcentaje_mensualidades = 0` y cargar todo el resto en `porcentaje_entrega`
 * aunque el cronograma sí tenga parcialidades mensuales (p. ej. esquema
 * "Escalonado" 6/0/94 con 35 parcialidades de $25,000 → el real es 6/16.97/77.03).
 * Por eso el desglose que se muestra se DERIVA sumando `acuerdos_pago` por
 * concepto (`desglose`); la plantilla solo se usa de respaldo cuando la cuenta
 * todavía no tiene cronograma.
 */

export interface AcuerdoPagoRow {
  id: number;
  idConcepto: number | null;
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

/**
 * Agrupación de conceptos de `acuerdos_pago` para el desglose
 * enganche / mensualidades / contra entrega. Ids de `conceptos_pago`.
 */
const CONCEPTOS_ENGANCHE = [1, 2]; // Apartado, Enganche
const CONCEPTOS_MENSUALIDADES = [5]; // Parcialidad
const CONCEPTOS_ENTREGA = [3]; // Pago a contra entrega

/**
 * Desglose real de la operación. Los montos se derivan del cronograma y los
 * porcentajes se calculan sobre `base` (precio final; si no hay, la suma del
 * cronograma). El monto de contra entrega se toma del acuerdo de concepto 3 y,
 * si la cuenta aún no lo tiene, se obtiene como residual:
 * `base - enganche - mensualidades - otros`.
 */
export interface DesgloseFormaPago {
  base: number;
  montoEnganche: number;
  montoMensualidades: number;
  montoEntrega: number;
  /** Conceptos fuera del plan de venta (pago especial, cesión, asignación…). */
  montoOtros: number;
  porcentajeEnganche: number;
  porcentajeMensualidades: number;
  porcentajeEntrega: number;
  porcentajeOtros: number;
  pagosEnganche: number;
  numeroMensualidades: number;
  /** true = calculado del cronograma; false = tomado de la plantilla del esquema. */
  derivadoDeCronograma: boolean;
  /** true = no hay acuerdo de contra entrega y el monto es el residual del precio. */
  entregaEsResidual: boolean;
}

export interface FormaPagoOferta {
  idCuentaCobranza: number;
  idOferta: number | null;
  precioFinal: number;
  ivaIncluido: boolean;
  esquema: EsquemaPagoInfo | null;
  /** Desglose a mostrar. Derivado del cronograma; respaldo = plantilla del esquema. */
  desglose: DesgloseFormaPago | null;
  acuerdos: AcuerdoPagoRow[];
  // Sumatorias calculadas para mostrar avance.
  totalAcuerdos: number;
  totalPagado: number;
  totalPendiente: number;
}

export function useOfferPaymentMethod(idCuentaCobranza: number | null | undefined) {
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
    idConcepto: a.id_concepto != null ? Number(a.id_concepto) : null,
    conceptoNombre: conceptoMap.get(a.id_concepto) ?? `Concepto ${a.id_concepto}`,
    monto: Number(a.monto ?? 0),
    orden: Number(a.orden ?? 0),
    fechaPago: (a.fecha_pago as string | null) ?? null,
    pagoCompletado: !!a.pago_completado,
  }));

  const totalAcuerdos = acuerdos.reduce((s, a) => s + a.monto, 0);
  const totalPagado = acuerdos.filter((a) => a.pagoCompletado).reduce((s, a) => s + a.monto, 0);
  const totalPendiente = totalAcuerdos - totalPagado;
  const precioFinal = Number(cc.precio_final ?? 0);

  return {
    idCuentaCobranza,
    idOferta: cc.id_oferta ?? null,
    precioFinal,
    ivaIncluido: !!cc.iva_incluido,
    esquema,
    desglose: calcularDesglose(acuerdos, precioFinal, totalAcuerdos, esquema),
    acuerdos,
    totalAcuerdos,
    totalPagado,
    totalPendiente,
  };
}

/**
 * Desglose enganche / mensualidades / contra entrega a partir del cronograma.
 *
 * Los porcentajes de `esquemas_pago` no sirven para esto: la plantilla del
 * esquema puede traer `porcentaje_mensualidades = 0` con todo el resto en
 * `porcentaje_entrega` mientras el cronograma tiene N parcialidades. Aquí se
 * suman los `acuerdos_pago` por concepto y se saca el porcentaje sobre el
 * precio final (o sobre la suma del cronograma si no hay precio capturado).
 *
 * Solo se cae a la plantilla del esquema cuando la cuenta todavía no tiene
 * cronograma (o el cronograma no tiene monto), porque ahí no hay nada que sumar.
 */
function calcularDesglose(
  acuerdos: AcuerdoPagoRow[],
  precioFinal: number,
  totalAcuerdos: number,
  esquema: EsquemaPagoInfo | null,
): DesgloseFormaPago | null {
  const base = precioFinal > 0 ? precioFinal : totalAcuerdos;

  // Sin cronograma con montos no hay nada que derivar: se muestra la plantilla.
  if (totalAcuerdos <= 0) {
    if (!esquema) return null;
    const pct = (p: number) => (base > 0 ? (base * p) / 100 : 0);
    return {
      base,
      montoEnganche: pct(esquema.porcentajeEnganche),
      montoMensualidades: pct(esquema.porcentajeMensualidades),
      montoEntrega: pct(esquema.porcentajeEntrega),
      montoOtros: 0,
      porcentajeEnganche: esquema.porcentajeEnganche,
      porcentajeMensualidades: esquema.porcentajeMensualidades,
      porcentajeEntrega: esquema.porcentajeEntrega,
      porcentajeOtros: 0,
      pagosEnganche: esquema.numeroPagosEnganche,
      numeroMensualidades: esquema.numeroMensualidades,
      derivadoDeCronograma: false,
      entregaEsResidual: false,
    };
  }

  const enGrupo = (a: AcuerdoPagoRow, ids: number[]) =>
    a.idConcepto != null && ids.includes(a.idConcepto);
  const sumar = (ids: number[]) =>
    acuerdos.filter((a) => enGrupo(a, ids)).reduce((s, a) => s + a.monto, 0);
  const contar = (ids: number[]) => acuerdos.filter((a) => enGrupo(a, ids)).length;

  const montoEnganche = sumar(CONCEPTOS_ENGANCHE);
  const montoMensualidades = sumar(CONCEPTOS_MENSUALIDADES);
  const acuerdosEntrega = acuerdos.filter((a) => enGrupo(a, CONCEPTOS_ENTREGA));
  const montoOtros = acuerdos
    .filter(
      (a) =>
        !enGrupo(a, CONCEPTOS_ENGANCHE) &&
        !enGrupo(a, CONCEPTOS_MENSUALIDADES) &&
        !enGrupo(a, CONCEPTOS_ENTREGA),
    )
    .reduce((s, a) => s + a.monto, 0);

  // Contra entrega = lo que queda del precio una vez descontado enganche,
  // mensualidades y otros. Si ya existe el acuerdo de concepto 3 se usa su
  // monto (es el dato firme); si no, se muestra el residual.
  const entregaEsResidual = acuerdosEntrega.length === 0;
  const residual = Math.max(0, base - montoEnganche - montoMensualidades - montoOtros);
  const montoEntrega = entregaEsResidual
    ? residual
    : acuerdosEntrega.reduce((s, a) => s + a.monto, 0);

  const pctDe = (monto: number) => (base > 0 ? (monto / base) * 100 : 0);

  return {
    base,
    montoEnganche,
    montoMensualidades,
    montoEntrega,
    montoOtros,
    porcentajeEnganche: pctDe(montoEnganche),
    porcentajeMensualidades: pctDe(montoMensualidades),
    porcentajeEntrega: pctDe(montoEntrega),
    porcentajeOtros: pctDe(montoOtros),
    pagosEnganche: contar(CONCEPTOS_ENGANCHE),
    numeroMensualidades: contar(CONCEPTOS_MENSUALIDADES),
    derivadoDeCronograma: true,
    entregaEsResidual,
  };
}
