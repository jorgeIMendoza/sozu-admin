/**
 * Utilidades compartidas para los hooks del Portal Alta Dirección que
 * consumen las RPCs definidas en
 * `Ejecuciones_manuales/2026-06-01-rpcs-analisis-portal-direccion.md`.
 *
 * Mientras Ramón no ejecute ese SQL, las RPCs no existen en BD y
 * PostgREST devuelve el código `42883` ("function ... does not exist").
 * Los hooks usan `isRpcMissing(error)` para señalar a la UI que falta
 * la migración y poder mostrar un estado vacío amable con CTA.
 */

import { PostgrestError } from "@supabase/supabase-js";

export const POSTGREST_FUNCTION_NOT_FOUND = "42883";
export const POSTGREST_VIEW_OR_TABLE_NOT_FOUND = "42P01";

export function isRpcMissing(error: unknown): boolean {
  if (!error) return false;
  const code = (error as PostgrestError)?.code ?? "";
  const message = (error as PostgrestError)?.message ?? "";
  return (
    code === POSTGREST_FUNCTION_NOT_FOUND ||
    code === POSTGREST_VIEW_OR_TABLE_NOT_FOUND ||
    /does not exist/i.test(message)
  );
}

export const MISSING_RPC_MESSAGE =
  "Esta vista requiere ejecutar el SQL en Ejecuciones_manuales/2026-06-01-rpcs-analisis-portal-direccion.md";
