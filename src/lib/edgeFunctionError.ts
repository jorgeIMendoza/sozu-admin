/**
 * Extrae el motivo real de un error de `supabase.functions.invoke`.
 *
 * Cuando la Edge Function responde con status != 2xx, supabase-js devuelve un
 * `FunctionsHttpError` cuyo `.message` es siempre el genérico "Edge Function
 * returned a non-2xx status code" y deja `data` en null: el cuerpo JSON con el
 * motivo (`{ error }` o `{ message }`) viaja en `error.context`, que es un
 * `Response`. Sin leerlo, la UI solo puede mostrar el mensaje genérico y el
 * usuario no sabe si faltó un dato, si la cuenta ya estaba confirmada o si el
 * envío del correo fue rechazado.
 */
export async function extractEdgeFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  try {
    if (ctx && typeof ctx.json === "function") {
      // `clone()` para no consumir el cuerpo: quien llame después puede releerlo.
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    }
    if (ctx && typeof ctx.text === "function") {
      const texto = await ctx.clone().text();
      if (texto) return texto;
    }
  } catch {
    /* cuerpo no-JSON o ilegible: se cae al mensaje genérico */
  }
  return (error as { message?: string } | null)?.message ?? "Error desconocido";
}
