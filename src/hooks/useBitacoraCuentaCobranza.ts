import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BitacoraEntry,
  BitacoraEntryInput,
  BitacoraScope,
} from "@/types/bitacora";

export type ValidationStatus = "pendiente" | "validado" | "rechazado";

export interface ValidationState {
  status: ValidationStatus;
  lastEntry?: BitacoraEntry;
}

/**
 * Resuelve el estatus actual de una pieza validable: documento, sección
 * del comprador, o el expediente completo. La regla: la última entrada
 * con tipo `validacion` o `rechazo` que coincida en scope/refs manda.
 */
export function getValidationState(
  entries: BitacoraEntry[],
  scope: BitacoraScope,
  refs: { idPersona?: number; idDocumento?: number } = {},
): ValidationState {
  const matches = entries.filter((e) => {
    if (!e.referencia || e.referencia.scope !== scope) return false;
    if (e.tipo !== "validacion" && e.tipo !== "rechazo") return false;
    if (refs.idPersona != null && e.referencia.idPersona !== refs.idPersona) return false;
    if (refs.idDocumento != null && e.referencia.idDocumento !== refs.idDocumento) return false;
    return true;
  });
  if (matches.length === 0) return { status: "pendiente" };
  const last = matches.reduce((a, b) =>
    new Date(a.timestamp).getTime() >= new Date(b.timestamp).getTime() ? a : b,
  );
  return {
    status: last.tipo === "validacion" ? "validado" : "rechazado",
    lastEntry: last,
  };
}

/**
 * Lee la bitácora de una cuenta de cobranza desde la columna jsonb
 * `cuentas_cobranza.bitacora`. Si la columna aún no existe en BD
 * (DDL pendiente — ver `Ejecuciones_manuales/bitacora_cuenta_cobranza.md`)
 * el hook devuelve `[]` sin romper.
 */

export interface UseBitacoraResult {
  entries: BitacoraEntry[];
  isLoading: boolean;
  error: Error | null;
  columnaFaltante: boolean;
}

const POSTGREST_COL_NOT_FOUND = "42703";

export function useBitacoraCuentaCobranza(
  idCuentaCobranza: number | null | undefined,
) {
  const query = useQuery({
    queryKey: ["bitacora_cuenta_cobranza", idCuentaCobranza],
    enabled: !!idCuentaCobranza,
    staleTime: 30_000,
    queryFn: async (): Promise<{ entries: BitacoraEntry[]; columnaFaltante: boolean }> => {
      if (!idCuentaCobranza) return { entries: [], columnaFaltante: false };
      const { data, error } = (await (supabase as any)
        .from("cuentas_cobranza")
        .select("bitacora")
        .eq("id", idCuentaCobranza)
        .maybeSingle()) as any;
      if (error) {
        if (error.code === POSTGREST_COL_NOT_FOUND) {
          // DDL pendiente — devolvemos vacío, la UI lo señaliza.
          return { entries: [], columnaFaltante: true };
        }
        throw error;
      }
      const arr = Array.isArray(data?.bitacora) ? (data.bitacora as BitacoraEntry[]) : [];
      return { entries: arr, columnaFaltante: false };
    },
  });

  return {
    entries: query.data?.entries ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    columnaFaltante: query.data?.columnaFaltante ?? false,
  } as UseBitacoraResult;
}

/**
 * Mutación: append de una entrada a la bitácora.
 * Lee el array actual, le concatena la entrada nueva con id + timestamp
 * + autor (del AuthContext) y reescribe la columna.
 *
 * No es transaccional contra ediciones concurrentes — si dos usuarios
 * escriben simultáneamente el último gana. Para volumen real conviene
 * mover a una stored procedure con `||` directo en SQL.
 */
export function useAppendBitacoraEntry(idCuentaCobranza: number | null | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: BitacoraEntryInput): Promise<BitacoraEntry> => {
      if (!idCuentaCobranza) throw new Error("idCuentaCobranza requerido");
      // 1) Leer bitácora actual.
      const { data: row, error: readErr } = (await (supabase as any)
        .from("cuentas_cobranza")
        .select("bitacora")
        .eq("id", idCuentaCobranza)
        .maybeSingle()) as any;
      if (readErr) {
        if (readErr.code === POSTGREST_COL_NOT_FOUND) {
          throw new Error(
            "La columna `bitacora` no existe en cuentas_cobranza. Aplica el DDL de Ejecuciones_manuales/bitacora_cuenta_cobranza.md.",
          );
        }
        throw readErr;
      }
      const current = (Array.isArray(row?.bitacora) ? row.bitacora : []) as BitacoraEntry[];

      // 2) Construir entrada.
      const entry: BitacoraEntry = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        autorEmail: profile?.email ?? "desconocido",
        autorNombre: profile?.nombre ?? undefined,
        tipo: input.tipo,
        mensaje: input.mensaje,
        referencia: input.referencia,
      };

      // 3) Escribir.
      const next = [...current, entry];
      const { error: writeErr } = (await (supabase as any)
        .from("cuentas_cobranza")
        .update({ bitacora: next })
        .eq("id", idCuentaCobranza)) as any;
      if (writeErr) throw writeErr;
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bitacora_cuenta_cobranza", idCuentaCobranza],
      });
    },
  });
}
