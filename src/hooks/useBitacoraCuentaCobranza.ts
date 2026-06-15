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
 * Lee la bitácora de una cuenta de cobranza desde la tabla dedicada
 * `legal_flow_bitacora` (una fila por entrada). Si la tabla aún no existe
 * en BD (migración pendiente — ver
 * `sozu-supabase-migrations/.../20260601000002_legal_flow_bitacora.sql`)
 * el hook devuelve `[]` sin romper y marca `columnaFaltante`.
 */

export interface UseBitacoraResult {
  entries: BitacoraEntry[];
  isLoading: boolean;
  error: Error | null;
  columnaFaltante: boolean;
}

// PostgREST: relación (tabla/vista) inexistente. Antes se detectaba 42703
// (columna inexistente) con el enfoque jsonb; ahora es 42P01 (tabla faltante).
const POSTGREST_TABLE_NOT_FOUND = "42P01";

// Shape de una fila de legal_flow_bitacora.
// `titulo` aún no existe en BD (DDL incremental pendiente). Una vez que
// se agregue la columna, sumarla aquí y en el SELECT/INSERT más abajo;
// el shape de `BitacoraEntry` en types ya lo soporta.
interface BitacoraRow {
  id: string;
  tipo: BitacoraEntry["tipo"];
  mensaje: string;
  scope: BitacoraScope | null;
  id_persona: number | null;
  id_documento: number | null;
  autor_email: string | null;
  autor_nombre: string | null;
  fecha_creacion: string;
}

// Mensajes con encabezado se escriben como "Título\n\nDescripción".
// Se separa al renderizar para mostrar título prominente.
function splitTituloMensaje(raw: string): { titulo?: string; mensaje: string } {
  const idx = raw.indexOf("\n\n");
  if (idx <= 0) return { mensaje: raw };
  const titulo = raw.slice(0, idx).trim();
  const mensaje = raw.slice(idx + 2);
  return titulo ? { titulo, mensaje } : { mensaje: raw };
}

function joinTituloMensaje(titulo: string | undefined, mensaje: string): string {
  const t = (titulo ?? "").trim();
  const m = (mensaje ?? "").trim();
  if (!t) return m;
  if (!m) return t;
  return `${t}\n\n${m}`;
}

function mapRow(row: BitacoraRow): BitacoraEntry {
  const { titulo, mensaje } = splitTituloMensaje(row.mensaje);
  return {
    id: row.id,
    timestamp: row.fecha_creacion,
    autorEmail: row.autor_email ?? "desconocido",
    autorNombre: row.autor_nombre ?? undefined,
    tipo: row.tipo,
    titulo,
    mensaje,
    referencia: row.scope
      ? {
          scope: row.scope,
          idPersona: row.id_persona ?? undefined,
          idDocumento: row.id_documento ?? undefined,
        }
      : undefined,
  };
}

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
        .from("legal_flow_bitacora")
        .select(
          "id, tipo, mensaje, scope, id_persona, id_documento, autor_email, autor_nombre, fecha_creacion",
        )
        .eq("id_cuenta_cobranza", idCuentaCobranza)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: true })) as any;
      if (error) {
        if (error.code === POSTGREST_TABLE_NOT_FOUND) {
          // Migración pendiente — devolvemos vacío, la UI lo señaliza.
          return { entries: [], columnaFaltante: true };
        }
        throw error;
      }
      const rows = (Array.isArray(data) ? data : []) as BitacoraRow[];
      return { entries: rows.map(mapRow), columnaFaltante: false };
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
 * Es un único INSERT atómico en `legal_flow_bitacora` (sin read-modify-write),
 * por lo que escrituras concurrentes ya no se pisan. El autor se firma desde
 * el AuthContext.
 */
export function useAppendBitacoraEntry(idCuentaCobranza: number | null | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: BitacoraEntryInput): Promise<BitacoraEntry> => {
      if (!idCuentaCobranza) throw new Error("idCuentaCobranza requerido");

      // BD aún no acepta `tipo: 'informacion_faltante'` (CHECK constraint
      // sólo permite nota/validacion/rechazo/sistema). Mapeamos al tipo
      // aceptado más cercano hasta que se aplique el DDL incremental.
      const tipoDb = input.tipo === "informacion_faltante" ? "rechazo" : input.tipo;
      const mensajeDb = joinTituloMensaje(input.titulo, input.mensaje);

      const { data, error } = (await (supabase as any)
        .from("legal_flow_bitacora")
        .insert({
          id_cuenta_cobranza: idCuentaCobranza,
          tipo: tipoDb,
          mensaje: mensajeDb,
          scope: input.referencia?.scope ?? null,
          id_persona: input.referencia?.idPersona ?? null,
          id_documento: input.referencia?.idDocumento ?? null,
          autor_email: profile?.email ?? "desconocido",
          autor_nombre: profile?.nombre ?? null,
        })
        .select(
          "id, tipo, mensaje, scope, id_persona, id_documento, autor_email, autor_nombre, fecha_creacion",
        )
        .single()) as any;

      if (error) {
        if (error.code === POSTGREST_TABLE_NOT_FOUND) {
          throw new Error(
            "La tabla `legal_flow_bitacora` no existe. Aplica la migración 20260601000002_legal_flow_bitacora.sql.",
          );
        }
        throw error;
      }
      return mapRow(data as BitacoraRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bitacora_cuenta_cobranza", idCuentaCobranza],
      });
      // Las entradas de bitácora pueden cambiar la etapa del expediente
      // (p.ej. asignar abogado + validación inicial completa promueven a
      // "En revisión legal"; aprobar generación o enviar a firma de cliente
      // mueven a las etapas 3 y 4). Invalidamos los listados del pipeline
      // que dependen de la bitácora.
      queryClient.invalidateQueries({
        queryKey: ["legal_flow_solicitudes_recibidas"],
      });
      queryClient.invalidateQueries({
        queryKey: ["legal_flow_aprobado_firma_cliente"],
      });
    },
  });
}
