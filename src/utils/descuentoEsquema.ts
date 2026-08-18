/**
 * Desglose del descuento del esquema de pago sobre el Precio Final de la cuenta.
 *
 * El descuento vive en `esquemas_pago.porcentaje_descuento_aumento` (negativo =
 * descuento, positivo = aumento) y YA viene aplicado dentro de
 * `cuentas_cobranza.precio_final`. La base ("precio de lista") se deriva del
 * precio final para que el desglose siempre cuadre: lista − descuento = final.
 *
 * No se usa `propiedades.precio_lista` como base porque esa columna sigue los
 * repricings del proyecto y se despega del contrato ya firmado (en dev, ~1,023
 * cuentas activas tienen precio_lista distinto de su precio_final).
 */
export interface DesgloseDescuento {
  /** Porcentaje en positivo para mostrar, ej. 3 = 3% de descuento. */
  porcentaje: number;
  /** Base antes del descuento (derivada del precio final). */
  precioLista: number;
  /** Monto descontado, en positivo. */
  montoDescuento: number;
  /** Precio final de la cuenta, tal cual está en BD. */
  precioFinal: number;
}

/**
 * Devuelve el desglose solo cuando hay descuento real. `null` cuando el esquema
 * no tiene ajuste, cuando es un aumento (pct > 0) o cuando la base no se puede
 * derivar (pct ≤ −100 %, precio final en cero).
 */
export function calcularDesgloseDescuento(
  precioFinal: number | null | undefined,
  porcentajeEsquema: number | null | undefined,
): DesgloseDescuento | null {
  const pct = Number(porcentajeEsquema ?? 0);
  if (!Number.isFinite(pct) || pct >= 0) return null;

  const factor = 1 + pct / 100;
  if (factor <= 0) return null;

  const final = Number(precioFinal ?? 0);
  if (!Number.isFinite(final) || final <= 0) return null;

  const precioLista = final / factor;
  return {
    porcentaje: Math.abs(pct),
    precioLista,
    montoDescuento: precioLista - final,
    precioFinal: final,
  };
}

/** Formatea el porcentaje sin decimales inútiles: 3 → "3%", 1.5 → "1.5%". */
export function formatPorcentajeDescuento(pct: number): string {
  return `${Number(pct.toFixed(2))}%`;
}
