/**
 * Señal local del flujo de confirmación de correo.
 *
 * `src/pages/auth/ConfirmacionEmail.tsx` la siembra en cuanto `verifyOtp`
 * confirma el correo, ANTES de mandar al usuario a `/auth/change-password`.
 * Sirve para distinguir dos situaciones que en el cliente se ven idénticas
 * (sesión válida + `usuarios.email_confirmado = false`):
 *
 *  1. El usuario acaba de confirmar por enlace y la bandera todavía no se
 *     propagó (la escribe `post-confirmacion-registro` / `mark_email_confirmed`
 *     unos instantes después). Aquí NO hay que bloquear: es el único camino por
 *     el que un usuario de portal recupera su cuenta.
 *  2. El correo está realmente sin confirmar (o fue des-confirmado a mano).
 *     Aquí sí aplica el gate.
 *
 * Es `sessionStorage`, o sea: por pestaña y se pierde al cerrarla. Solo se usa
 * para *no* bloquear; nunca para conceder acceso a datos.
 */
const PREFIJO_CONFIRMACION = 'sozu-email-confirmado';

const normalizarEmail = (email: string) => email.toLowerCase().trim();

export const claveConfirmacionLocal = (email: string) =>
  `${PREFIJO_CONFIRMACION}:${normalizarEmail(email)}`;

/** Marca que ESTA pestaña acaba de completar la confirmación de `email`. */
export function marcarConfirmacionLocal(email: string): void {
  try {
    sessionStorage.setItem(claveConfirmacionLocal(email), '1');
  } catch {
    // sessionStorage puede no estar disponible (modo privado); no es crítico.
  }
}

/** True si esta pestaña vio confirmarse `email` en el flujo del enlace. */
export function vieneDeFlujoConfirmacion(email: string | null | undefined): boolean {
  if (!email) return false;
  try {
    return sessionStorage.getItem(claveConfirmacionLocal(email)) === '1';
  } catch {
    return false;
  }
}

/**
 * Marcador en la URL de que se llegó a `/auth/change-password` desde el enlace
 * de un correo (alta de cuenta o "olvidé mi contraseña").
 *
 * Cumple el mismo papel que la señal de arriba, pero sobrevive donde aquella no:
 * `sessionStorage` es por pestaña y por origen, así que se pierde cuando el
 * enlace abre en el navegador embebido del correo, en una pestaña nueva, o tras
 * un salto de host. Cuando se perdía, `/auth/change-password` veía una sesión
 * normal con `debe_cambiar_password = false` y mandaba al usuario al portal —
 * dentro de su cuenta, sin haber definido contraseña.
 */
export const MOTIVO_PARAM = 'motivo';
export const MOTIVO_ENLACE_CORREO = 'enlace-correo';

/** True si la query string trae el marcador de llegada por enlace de correo. */
export function llegoPorEnlaceDeCorreo(search: string): boolean {
  return new URLSearchParams(search).get(MOTIVO_PARAM) === MOTIVO_ENLACE_CORREO;
}
