/**
 * Monto del apartado — configurable por proyecto.
 *
 * Vive en `proyectos.monto_apartado` y lo resuelve la RPC `get_oferta_financials`,
 * que es la fuente de verdad: el mismo número que ve el cliente en la oferta pública
 * es el que se le cobra en el flujo de pago. El front NO vuelve a calcularlo.
 *
 * El valor de abajo es solo la red de seguridad para los casos en que el monto no
 * viajó con la oferta (oferta mock, RPC caída, proyecto sin columna todavía). Era el
 * monto único que estuvo hardcodeado en todo el flujo hasta 2026-08-11.
 */
export const APARTADO_DEFAULT_MXN = 20000;

/** Monto de apartado de una oferta, con el default como último recurso. */
export function apartadoDeOferta(
  offer?: { apartadoAmount?: number | null } | null,
): number {
  const monto = Number(offer?.apartadoAmount);
  return Number.isFinite(monto) && monto > 0 ? monto : APARTADO_DEFAULT_MXN;
}
