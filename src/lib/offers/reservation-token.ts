/**
 * Token de la reservación de una oferta digital.
 *
 * El link que recibe el cliente es `/oferta/O-XXXXXX/<token>`, donde `<token>` es
 * `reservaciones.token` (uuid). Ese token es la credencial que autoriza consultar el
 * estado del pago (`get_apartado_status`) y guardar sus datos (`update_lead_datos`)
 * desde páginas públicas: sin él ambas RPC fallan cerradas.
 *
 * Los links viejos traen `RES-000028` (el id secuencial). No sirven como credencial —
 * se detectan aquí y se tratan como "sin token".
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devuelve el token si el segmento de la URL es un uuid; si no, null. */
export function parseReservationToken(raw?: string | null): string | null {
  const value = (raw ?? "").trim();
  return UUID_RE.test(value) ? value.toLowerCase() : null;
}

/** Nombre del query param con el que el token viaja entre las pantallas del flujo. */
export const RESERVATION_TOKEN_PARAM = "res";

/** Agrega `?res=<token>` a una ruta interna, si hay token. */
export function withReservationToken(path: string, token?: string | null): string {
  if (!token) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${RESERVATION_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

/** Mensaje único para los links que ya no pueden operar. */
export const LINK_NO_VIGENTE =
  "Este link ya no está vigente. Pide a tu asesor que te comparta uno actualizado.";

/** Datos públicos de una reservación (lo que devuelve `get_reservacion_publica`). */
export type ReservacionPublica = {
  id: number;
  id_oferta: number | null;
  email: string;
  nombre: string | null;
  telefono: string | null;
  estatus: string;
  activo: boolean;
  fecha_activacion?: string | null;
  fecha_expiracion?: string | null;
  nombre_persona?: string | null;
  telefono_persona?: string | null;
};

/**
 * Carga la reservación de una página pública por su token, vía la RPC
 * `get_reservacion_publica` (SECURITY DEFINER).
 *
 * No hay camino alterno: `anon` no tiene ningún privilegio sobre `reservaciones`,
 * así que un link sin token (los viejos, con el id secuencial) no puede resolverse
 * y la página muestra `LINK_NO_VIGENTE`.
 */
export async function cargarReservacionPublica(
  supabaseClient: { rpc: Function },
  token?: string | null
): Promise<ReservacionPublica | null> {
  if (!token) return null;

  const { data, error } = await (supabaseClient as any).rpc("get_reservacion_publica", {
    p_token: token,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ReservacionPublica) ?? null;
}
