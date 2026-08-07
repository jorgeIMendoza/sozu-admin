import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PUBLISHABLE_KEY } from '@/lib/config';
import { extractEdgeFunctionError } from '@/lib/edgeFunctionError';

export type EstadoReenvio = 'idle' | 'enviando' | 'enviado' | 'error';

interface OpcionesReenvio {
  /**
   * Para pantallas SIN sesión válida (login rechazado por "Email not
   * confirmed", enlace vencido): `invoke` mandaría el token muerto que quedó en
   * localStorage y el gateway responde 401 antes de entrar a la función. Con
   * esto se fuerza la anon key en Authorization.
   */
  sinSesion?: boolean;
}

/**
 * Reenvío del correo de confirmación (`reenviar-confirmacion-email`).
 *
 * Única implementación del flujo: la usan `EmailNoConfirmado` (con sesión) y
 * `Login` (sin sesión, tras el rechazo de GoTrue). Incluye la extracción del
 * motivo real del rechazo — la edge function contesta 400/404 con
 * `{ success:false, message }` y supabase-js esconde ese cuerpo en
 * `error.context`.
 */
export function useReenviarConfirmacion(
  email: string | null | undefined,
  { sinSesion = false }: OpcionesReenvio = {},
) {
  const [estado, setEstado] = useState<EstadoReenvio>('idle');
  const [mensaje, setMensaje] = useState('');

  const reenviar = useCallback(async () => {
    const destino = email?.toLowerCase().trim();
    if (!destino) {
      setEstado('error');
      setMensaje('No sabemos a qué correo reenviar la confirmación.');
      return;
    }

    setEstado('enviando');
    setMensaje('');

    const { data, error } = await supabase.functions.invoke<{ success?: boolean; message?: string }>(
      'reenviar-confirmacion-email',
      {
        body: { email: destino },
        ...(sinSesion
          ? { headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` } }
          : {}),
      },
    );

    if (error || data?.success === false) {
      console.error('reenviar-confirmacion-email error:', error, data);
      let motivo = data?.message ?? '';
      if (!motivo && error) {
        motivo = await extractEdgeFunctionError(error);
        // El fallback del helper es el mensaje genérico de supabase-js, que no
        // le dice nada al usuario: mejor el texto de soporte de abajo.
        if (/non-2xx status code/i.test(motivo)) motivo = '';
      }
      setEstado('error');
      setMensaje(motivo || 'No pudimos reenviar el correo. Contacta a soporte.');
      return;
    }

    setEstado('enviado');
    // GoTrue guarda UN solo token por usuario: cada enlace que se emite pisa al
    // anterior. Si el usuario abre un correo viejo el token ya no existe y acaba
    // en una pantalla de error que no sabe explicar por qué. Se avisa aquí.
    setMensaje(
      'Te enviamos un correo nuevo. Revisa tu bandeja de entrada y la carpeta de spam, y ábrelo desde el correo más reciente: los enlaces anteriores dejan de funcionar.',
    );
  }, [email, sinSesion]);

  const reiniciar = useCallback(() => {
    setEstado('idle');
    setMensaje('');
  }, []);

  return { estado, mensaje, reenviar, reiniciar };
}
