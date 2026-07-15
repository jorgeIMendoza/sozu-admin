// PostgREST corta respuestas en 1000 filas (db-max-rows) y los gateways
// rechazan URLs largas: Supabase cloud ~32KB (400), pero el Kong/nginx del
// VPS de desarrollo falla desde ~3.5KB (502/414). Un .in('col', [muchos
// valores]) falla o trunca silenciosamente. Se trocea por conteo Y por
// longitud codificada (supabase-js URL-encodea cada valor: '@' → '%40'),
// se consulta por lotes en paralelo y se pagina cada lote hasta recibir
// página vacía: RLS filtra después del range, por lo que una página
// parcial no garantiza fin.
const IN_CHUNK_SIZE = 200;
// Presupuesto de caracteres (ya codificados) para la lista de valores del
// in.(). Deja margen para base URL + select + filtros bajo el límite ~3.4KB
// observado en el gateway de dev.
const IN_CHUNK_CHAR_BUDGET = 2600;
const PAGE_SIZE = 1000;

export async function fetchAllChunked<T, K extends string | number>(
  keys: K[],
  buildQuery: (chunk: K[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const chunks: K[][] = [];
  let current: K[] = [];
  let currentLen = 0;
  for (const key of keys) {
    // +3 por la coma separadora codificada (%2C)
    const encodedLen = encodeURIComponent(String(key)).length + 3;
    if (current.length > 0 && (current.length >= IN_CHUNK_SIZE || currentLen + encodedLen > IN_CHUNK_CHAR_BUDGET)) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(key);
    currentLen += encodedLen;
  }
  if (current.length > 0) chunks.push(current);

  const perChunk = await Promise.all(
    chunks.map(async (chunk) => {
      const rows: T[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await buildQuery(chunk, page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        const batch = data ?? [];
        rows.push(...batch);
        if (batch.length === 0) break;
      }
      return rows;
    })
  );

  return perChunk.flat();
}
