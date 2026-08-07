import type { AuthError } from '@supabase/supabase-js';

/**
 * Traduce el rechazo de `supabase.auth.updateUser({ password })`.
 *
 * Los 422 de Auth tienen causa concreta y el usuario no puede adivinarla desde
 * el formulario: la checklist de requisitos no conoce la contraseña actual de
 * la cuenta ni la política del proyecto de Supabase. Sin esta traducción, quien
 * teclea la contraseña que ya tenía ve un "no se pudo" genérico con las cinco
 * palomitas en verde, y reintenta lo mismo sin salida.
 *
 * Se mira `code` y también el texto del mensaje, porque no toda versión del
 * backend puebla el código.
 *
 * El texto original nunca se pierde: los llamadores siguen registrando
 * `error.message` crudo en la bitácora, que es lo que sirve para diagnosticar.
 */
export function mensajeErrorPassword(error: unknown): string {
  const e = error as Partial<AuthError> & { message?: string };
  const code = e?.code ?? '';
  const status = Number(e?.status ?? 0);
  const message = (e?.message ?? '').toLowerCase();

  if (status === 429 || code === 'over_request_rate_limit') {
    return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  }
  if (code === 'same_password' || message.includes('should be different from the old password')) {
    return 'Esa ya es tu contraseña actual. Elige una distinta.';
  }
  if (code === 'weak_password' || message.includes('password is known')) {
    return 'Esa contraseña es fácil de adivinar (aparece en filtraciones conocidas). Cumple las reglas, pero elige otra menos común.';
  }
  if (code === 'session_not_found' || status === 401 || status === 403) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.';
  }
  return 'No pudimos actualizar la contraseña. Revisa que cumpla los requisitos e intenta de nuevo.';
}
