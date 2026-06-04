/**
 * Helper para leer todas las filas que cumplan un query de Supabase,
 * superando el límite implícito de ~1000 filas que aplica PostgREST.
 *
 * Uso:
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase
 *       .from("comisionistas")
 *       .select("...")
 *       .eq("activo", true)
 *       .range(from, to),
 *   );
 *
 * El callback recibe los offsets `from`/`to` y devuelve la promesa de
 * Supabase tal cual (con `.range(from, to)` aplicado). La función itera
 * en páginas de 1000 hasta que un lote regresa menos filas que el
 * tamaño de página o llega al hard cap (`maxPages`).
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 200; // 200 × 1000 = 200k filas máx.
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const from = i * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
