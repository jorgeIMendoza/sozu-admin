import { useState } from 'react';
import { Loader2, MailWarning, RefreshCw } from 'lucide-react';
import sozuLogo from '@/assets/sozu-logo-black.png';
import { useReenviarConfirmacion } from './useReenviarConfirmacion';

interface EmailNoConfirmadoProps {
  /** Correo del perfil autenticado; es el que recibe el reenvío. */
  email: string;
  /** Vuelve a leer get_current_user_profile para detectar la confirmación. */
  onActualizarEstado: () => void | Promise<void>;
  /** Cierra la sesión y devuelve al login. */
  onCerrarSesion: () => void;
}

/**
 * Pantalla de bloqueo para roles de portal (roles.requiere_confirmacion_email)
 * cuyo correo todavía no está verificado. Sigue el lenguaje visual de
 * src/pages/auth/ConfirmacionEmail.tsx.
 */
export function EmailNoConfirmado({
  email,
  onActualizarEstado,
  onCerrarSesion,
}: EmailNoConfirmadoProps) {
  // Aquí sí hay sesión (el gate corre con el perfil ya cargado), así que el
  // reenvío viaja con el token del propio usuario.
  const {
    estado: reenvio,
    mensaje: reenvioMsg,
    reenviar: reenviarConfirmacion,
  } = useReenviarConfirmacion(email);
  const [actualizando, setActualizando] = useState(false);

  const actualizarEstado = async () => {
    setActualizando(true);
    try {
      await onActualizarEstado();
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-gradient" />
      <div className="login-card relative z-10 text-center">
        <div className="mb-7">
          <img src={sozuLogo} alt="Sozu" className="h-10 mx-auto" />
        </div>

        <div
          className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full"
          style={{ background: 'hsl(38 92% 95%)' }}
        >
          <MailWarning className="h-8 w-8" style={{ color: 'hsl(38 92% 45%)' }} />
        </div>

        <h1
          className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          Confirma tu correo
        </h1>

        <p className="text-sm mb-6" style={{ color: 'hsl(0 0% 45%)' }}>
          Para entrar necesitas verificar <strong>{email}</strong>. Abre el enlace que te enviamos
          por correo; si ya no lo tienes, pide uno nuevo aquí.
        </p>

        {reenvioMsg && (
          <p
            className="text-sm mb-5 px-4 py-3 rounded-xl"
            style={
              reenvio === 'error'
                ? { background: 'hsl(0 70% 97%)', color: 'hsl(0 70% 40%)' }
                : { background: 'hsl(145 35% 96%)', color: 'hsl(145 35% 30%)' }
            }
          >
            {reenvioMsg}
          </p>
        )}

        {reenvio !== 'enviado' && (
          <button
            type="button"
            onClick={reenviarConfirmacion}
            disabled={reenvio === 'enviando'}
            className="login-btn-primary flex items-center justify-center gap-2 w-full mb-3 disabled:opacity-60"
          >
            {reenvio === 'enviando' && <Loader2 className="h-4 w-4 animate-spin" />}
            {reenvio === 'enviando' ? 'Enviando…' : 'Reenviar correo de confirmación'}
          </button>
        )}

        <button
          type="button"
          onClick={actualizarEstado}
          disabled={actualizando}
          className="login-btn-outline flex items-center justify-center gap-2 w-full mb-4 disabled:opacity-60"
        >
          {actualizando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {actualizando ? 'Verificando…' : 'Ya confirmé mi correo'}
        </button>

        <button
          type="button"
          onClick={onCerrarSesion}
          className="text-sm font-semibold hover:underline"
          style={{ color: 'hsl(0 0% 35%)' }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
