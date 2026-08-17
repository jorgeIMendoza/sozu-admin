/**
 * Etiquetas de los conceptos de pago para pantalla.
 *
 * En BD el concepto 3 sigue llamándose `"Pago a contra entrega"`. El nombre confunde:
 * la unidad tiene que estar liquidada **antes** de escriturar, no se paga contra la
 * entrega física. Comercial pidió que en pantalla se lea "Pago a escrituración".
 *
 * La fila de `conceptos_pago` NO se renombra a propósito: hay ~13 lugares en el admin
 * y varias Edge Functions que comparan ese texto (`=== 'pago a contra entrega'`) y se
 * romperían en silencio. Aquí solo se traduce lo que ve el usuario.
 */
const ETIQUETAS: Record<string, string> = {
  "pago a contra entrega": "Pago a escrituración",
};

/** Traduce el nombre de un concepto de BD a su etiqueta de pantalla. */
export function etiquetaConcepto(nombre: string | null | undefined): string {
  if (!nombre) return "";
  return ETIQUETAS[nombre.trim().toLowerCase()] ?? nombre;
}
