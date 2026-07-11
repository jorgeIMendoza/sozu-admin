// PostgREST corta respuestas en 1000 filas (db-max-rows) y el gateway de
// Supabase rechaza con 400 las URLs mayores a ~32KB, así que un
// .in('col', [miles de valores]) falla o trunca silenciosamente.
// Se consulta por lotes de valores y se pagina cada lote hasta recibir
// página vacía (una página parcial no garantiza fin).
const IN_CHUNK_SIZE = 200;
const PAGE_SIZE = 1000;

export async function fetchAllChunked<T, K extends string | number>(
  keys: K[],
  buildQuery: (chunk: K[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < keys.length; i += IN_CHUNK_SIZE) {
    const chunk = keys.slice(i, i + IN_CHUNK_SIZE);
    for (let page = 0; ; page++) {
      const { data, error } = await buildQuery(chunk, page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length === 0) break;
    }
  }
  return rows;
}
