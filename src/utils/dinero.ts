/**
 * Comparación de dinero en centavos enteros.
 *
 * Los montos salen de PostgreSQL como `numeric` (decimal exacto) pero se suman en
 * JavaScript como IEEE-754. Sumar los tres pagos de la CC-000847
 * (76,045.88 + 76,045.88 + 76,045.89) y restarles el acuerdo de 228,137.64 no da
 * 0.01: da 0.010000000009313226. Cualquier tolerancia escrita como
 * `Math.abs(a - b) > 0.01` cae del lado equivocado justo en el caso más común de
 * todos —la diferencia de un centavo— y el banner de descuadre no se apaga nunca,
 * por más veces que se recalcule.
 *
 * Regla para dinero: se compara en centavos enteros, nunca en flotantes. Y la
 * tolerancia por defecto es CERO: un pago que no cuadra al centavo no cuadra.
 * Misma regla que la BD, donde `fn_reconciliar_acuerdos_cuenta` usa 0.005.
 */

/** Monto (pesos) → centavos enteros. Absorbe el ruido de punto flotante al redondear. */
export function aCentavos(monto: number | string | null | undefined): number {
  const n = Number(monto ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Centavos enteros → pesos. */
export function aPesos(centavos: number): number {
  return centavos / 100;
}

/**
 * Suma una lista de montos sin acumular error: cada monto se pasa a centavos antes
 * de sumar. Devuelve pesos, ya redondeados al centavo.
 */
export function sumarDinero<T>(items: readonly T[] | null | undefined, sel: (item: T) => number | string | null | undefined): number {
  return aPesos((items ?? []).reduce((acc, item) => acc + aCentavos(sel(item)), 0));
}

/** Diferencia `a - b` exacta al centavo (sin residuos de 1e-9). */
export function diferenciaDinero(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return aPesos(aCentavos(a) - aCentavos(b));
}

/**
 * `true` si `a` y `b` no cuadran.
 * `toleranciaCentavos` = 0 por defecto: deben cuadrar exacto. Solo se sube cuando
 * hay una razón de negocio documentada, nunca para tapar ruido de flotante.
 */
export function difiereEnDinero(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  toleranciaCentavos = 0,
): boolean {
  return Math.abs(aCentavos(a) - aCentavos(b)) > toleranciaCentavos;
}

/** `true` si `monto` es dinero real a favor (positivo de al menos un centavo). */
export function esMontoPositivo(monto: number | string | null | undefined): boolean {
  return aCentavos(monto) > 0;
}
