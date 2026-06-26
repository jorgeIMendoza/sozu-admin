/**
 * Calculates the number of monthly payments between two dates.
 * Counts whole calendar months from the next month after `desde` up to and
 * including the month of `hasta`.
 *
 * Example: desde = 2026-05-07, hasta = 2028-12-31
 *   first payment month = June 2026, last = December 2028 → 31 months.
 */
export function mesesEntreFechas(desde: Date | string, hasta: Date | string): number {
  const d = typeof desde === 'string' ? new Date(desde) : desde;
  const h = typeof hasta === 'string' ? new Date(hasta) : hasta;
  if (isNaN(d.getTime()) || isNaN(h.getTime())) return 0;
  const months = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
  return Math.max(0, months);
}

/**
 * Returns a copy of `tramos` with `numero_mensualidades` resolved.
 * If a tramo has `fecha_limite` set, its number of payments is recalculated
 * from `fechaReferencia` (defaults to today) to that date using
 * `mesesEntreFechas`. Otherwise the existing `numero_mensualidades` is kept.
 */
export function expandirTramos(
  tramos: any[] | null | undefined,
  fechaReferencia: Date | string = new Date()
): any[] {
  if (!Array.isArray(tramos)) return [];
  return tramos.map((t) => {
    let numero = Number(t.numero_mensualidades) || 0;
    if (t.fecha_limite) {
      numero = mesesEntreFechas(fechaReferencia, t.fecha_limite);
    }
    return { ...t, numero_mensualidades: numero };
  });
}

/**
 * Calculates the entrega (delivery) amount for a fixed-amount escalonado scheme.
 * entrega = precioFinal - enganche - totalMensualidades
 */
export function calcEntregaEscalonado(
  precioBase: number,
  porcentajeEnganche: number,
  tramos: any[],
  porcentajeDescuento?: number,
  fechaReferencia: Date | string = new Date()
): number {
  const precioFinal = precioBase * (1 + (porcentajeDescuento || 0) / 100);
  const enganche = precioFinal * (porcentajeEnganche / 100);
  const tramosResueltos = expandirTramos(tramos, fechaReferencia);
  const totalMensualidades = tramosResueltos.reduce((sum: number, t: any) => {
    const monto = (t.monto_mensualidad || 0) / 100; // centavos a pesos
    const numMens = t.numero_mensualidades || 0;
    return sum + (monto * numMens);
  }, 0);
  return Math.max(0, precioFinal - enganche - totalMensualidades);
}

/**
 * Calculates dynamic payment scheme amounts and percentages.
 *
 * The monthly payment AMOUNT stays fixed (original % / original months).
 * As fewer months remain, the mensualidades % decreases and entrega % absorbs the difference.
 *
 * When mesesEfectivos >= scheme.numero_mensualidades (or no fecha_entrega available),
 * pass 0 for mesesEfectivos and the function falls back to DB values unchanged.
 */
export interface DynamicSchemeResult {
  enganche: number;
  mensualidad: number;
  mensualidadesTotal: number;
  entrega: number;
  precioFinal: number;
  adjustment: number;
  meses: number;
  porcentajeMensualidades: number;
  porcentajeEntrega: number;
}

export function calcDynamicScheme(
  scheme: {
    porcentaje_enganche: number;
    porcentaje_mensualidades: number;
    porcentaje_entrega: number;
    porcentaje_descuento_aumento: number;
    numero_mensualidades: number;
  },
  precioLista: number,
  mesesEfectivos: number
): DynamicSchemeResult {
  const adjustment = precioLista * (scheme.porcentaje_descuento_aumento / 100);
  const precioFinal = precioLista + adjustment;

  const mesesOriginales = scheme.numero_mensualidades || 0;
  // Cap at original months; if no effective months passed, use original
  const meses = mesesEfectivos > 0 ? Math.min(mesesEfectivos, mesesOriginales) : mesesOriginales;

  // Monthly payment stays fixed (original rate / original months)
  const mensualidad =
    mesesOriginales > 0
      ? (precioFinal * (scheme.porcentaje_mensualidades / 100)) / mesesOriginales
      : 0;

  // Dynamic percentages
  const porcentajeMensualidades =
    mesesOriginales > 0
      ? scheme.porcentaje_mensualidades * (meses / mesesOriginales)
      : scheme.porcentaje_mensualidades;

  const porcentajeEntrega =
    scheme.porcentaje_entrega + (scheme.porcentaje_mensualidades - porcentajeMensualidades);

  return {
    enganche: precioFinal * (scheme.porcentaje_enganche / 100),
    mensualidad,
    mensualidadesTotal: mensualidad * meses,
    entrega: precioFinal * (porcentajeEntrega / 100),
    precioFinal,
    adjustment,
    meses,
    porcentajeMensualidades,
    porcentajeEntrega,
  };
}

/**
 * Formats a number as MXN currency string (e.g. "$1,234.56")
 */
export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates the label for an escalonado scheme in selectors/dropdowns.
 * For fixed-amount: "Eng: X% | Mensualidades: $A / $B | Ent: $C"
 * For percentage-based: "Eng: X% | Escalonado (N tramos) | Ent: Y%"
 * Requires precioBase to calculate entrega as dollar amount for fixed-amount schemes.
 */
export function formatEscalonadoLabel(
  scheme: { porcentaje_enganche?: number; porcentaje_entrega?: number; porcentaje_descuento_aumento?: number },
  tramos: any[],
  precioBase?: number,
  fechaReferencia: Date | string = new Date()
): string {
  const tramosResueltos = expandirTramos(tramos, fechaReferencia);
  const hasFixedAmount = tramosResueltos.some((t: any) => t.monto_mensualidad && t.monto_mensualidad > 0);
  const engPart = `Eng: ${scheme.porcentaje_enganche || 0}%`;
  const totalMeses = tramosResueltos.reduce((s, t) => s + (t.numero_mensualidades || 0), 0);

  if (hasFixedAmount) {
    const montoStr = tramosResueltos
      .map((t: any) => `$${((t.monto_mensualidad || 0) / 100).toLocaleString('es-MX')}`)
      .join(' / ');

    let entPart: string;
    if (precioBase && precioBase > 0) {
      const entrega = calcEntregaEscalonado(
        precioBase,
        scheme.porcentaje_enganche || 0,
        tramosResueltos,
        scheme.porcentaje_descuento_aumento || 0,
        fechaReferencia
      );
      entPart = `Ent: ${formatMXN(entrega)}`;
    } else {
      entPart = `Ent: ${scheme.porcentaje_entrega || 0}%`;
    }

    return `${engPart} | ${totalMeses} mens. ${montoStr} | ${entPart}`;
  }

  return `${engPart} | Escalonado (${tramosResueltos.length} tramos, ${totalMeses} mens.) | Ent: ${scheme.porcentaje_entrega || 0}%`;
}
