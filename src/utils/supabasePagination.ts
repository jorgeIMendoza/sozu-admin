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

/**
 * Helper para ejecutar un query con `.in(...)` partiendo la lista de IDs en
 * lotes para no exceder el límite de longitud del URL en PostgREST
 * (~8 KB). Con IDs como bigint, ~500 IDs son seguros (~3-4 KB en el
 * querystring incluso URL-encoded).
 *
 * Cada batch ejecuta el query en paralelo y los resultados se concatenan
 * preservando el orden de aparición.
 *
 * Uso:
 *
 *   const rows = await fetchInBatches(ids, (batch) =>
 *     supabase.from("ofertas").select("id, id_propiedad").in("id", batch),
 *   );
 *
 * Si el caller necesita un `.in(...)` sobre una columna distinta del primary
 * key (ej. `id_cuenta_cobranza`), el builder hace todo el query — el helper
 * sólo provee el slice de IDs.
 */
/**
 * Como `fetchInBatches`, pero además pagina las FILAS dentro de cada lote.
 * Necesario cuando la tabla tiene muchas filas por cada id del `.in(...)`
 * (ej. `documentos` por cuenta, `acuerdos_pago` por cuenta): un solo lote
 * puede devolver más de 1000 filas y PostgREST las cortaría silenciosamente.
 *
 * El builder recibe `(batch, from, to)` y debe aplicar `.in(...)`, `.range(from, to)`
 * y un `.order(...)` estable (por una columna única, ej. `id`) para que la
 * paginación no repita ni omita filas entre páginas.
 *
 * Los lotes se procesan en serie (cada uno pagina hasta agotar). Usa un
 * `batchSize` menor (~300) para acotar el número de páginas por lote.
 */
export async function fetchInBatchesPaged<T = any>(
  ids: ReadonlyArray<number | string>,
  build: (batch: Array<number | string>, from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  options: { batchSize?: number; pageSize?: number } = {},
): Promise<T[]> {
  const batchSize = options.batchSize ?? 300;
  const pageSize = options.pageSize ?? 1000;
  if (!ids.length) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize) as Array<number | string>;
    for (let page = 0; ; page++) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await build(batch, from, to);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < pageSize) break;
    }
  }
  return out;
}

export async function fetchInBatches<T = any>(
  ids: ReadonlyArray<number | string>,
  build: (batch: Array<number | string>) => PromiseLike<{ data: T[] | null; error: any }>,
  options: { batchSize?: number } = {},
): Promise<T[]> {
  const batchSize = options.batchSize ?? 500;
  if (!ids.length) return [];
  const batches: Array<Array<number | string>> = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize) as Array<number | string>);
  }
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await build(batch);
      if (error) throw error;
      return (data ?? []) as T[];
    }),
  );
  return results.flat();
}
