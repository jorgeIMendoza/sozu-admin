import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PUBLISHABLE_KEY } from '@/lib/config';

export type EstadoEnlace = 'idle' | 'enviando' | 'enviado' | 'limitado' | 'error';

/**
 * Pide un enlace NUEVO para definir contraseña (`reset-user-password`, modo público).
 *
 * No confundir con `useReenviarConfirmacion`: esa llama a
 * `reenviar-confirmacion-email`, que responde 400 "El email ya esta confirmado"
 * cuando la cuenta ya está confirmada en Auth. Justo el caso de quien pidió
 * recuperar su contraseña y llegó con el enlace muerto: el correo está
 * confirmado desde hace meses, lo que le falta es la contraseña.
 *
 * El modo público de `reset-user-password` no toca la cuenta (no repone
 * Temporal123! ni des-confirma el correo): solo emite un magiclink nuevo. La
 * respuesta es siempre genérica —exista o no la cuenta— para no permitir
 * enumeración de correos, así que aquí nunca se distingue un caso del otro.
 *
 * Se llama SIN sesión válida, así que va con la anon key explícita: si en
 * localStorage quedó un token de usuario muerto, `invoke` lo mandaría, la edge
 * function lo tomaría por un admin (modo JWT) y respondería 401.
 */
export function useEnlaceCambioPassword(email: string | null | undefined) {
  const [estado, setEstado] = useState<EstadoEnlace>('idle');
  const [mensaje, setMensaje] = useState('');

  const solicitar = useCallback(async () => {
    const destino = email?.toLowerCase().trim();
    if (!destino) {
      setEstado('error');
      setMensaje('No sabemos a qué correo mandar el enlace. Contacta a soporte.');
      return;
    }

    setEstado('enviando');
    setMensaje('');

    const { data, error } = await supabase.functions.invoke<{
      rate_limited?: boolean;
      retry_after_min?: number;
    }>('reset-user-password', {
      body: { email: destino },
      headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    });

    if (error) {
      console.error('reset-user-password error:', error);
      setEstado('error');
      setMensaje('No pudimos enviar el enlace. Intenta de nuevo o contacta a soporte.');
      return;
    }

    // Tras varios intentos seguidos la función deja de mandar correos. Decirlo
    // aquí evita que el usuario siga pulsando el botón viendo siempre el mismo
    // "te enviamos un enlace" mientras su bandeja no recibe nada.
    if (data?.rate_limited) {
      setEstado('limitado');
      setMensaje(
        `Pediste varios enlaces seguidos, así que este no se envió. Abre el correo más reciente que ya recibiste: ese enlace sigue sirviendo. Si ya no lo tienes, espera ${data.retry_after_min ?? 15} minutos.`,
      );
      return;
    }

    setEstado('enviado');
    setMensaje(
      'Te enviamos un enlace nuevo. Revisa tu bandeja de entrada y la carpeta de spam, y ábrelo desde el correo más reciente: los enlaces anteriores dejan de funcionar.',
    );
  }, [email]);

  return { estado, mensaje, solicitar };
}
