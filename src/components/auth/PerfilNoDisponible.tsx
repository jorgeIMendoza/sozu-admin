import { useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import sozuLogo from '@/assets/sozu-logo-black.png';

interface PerfilNoDisponibleProps {
  /** Reintenta get_current_user_profile. */
  onReintentar: () => void | Promise<void>;
  /** Cierra la sesión y devuelve al login. */
  onCerrarSesion: () => void;
}

/**
 * Hay sesión de Auth pero no se pudo resolver el perfil (RPC caída, timeout de
 * 15s, o el usuario no existe en public.usuarios). Sin perfil no hay `activo`,
 * ni rol, ni permisos: se bloquea el contenido protegido en lugar de dejar
 * pasar (fail-closed).
 */
export function PerfilNoDisponible({ onReintentar, onCerrarSesion }: PerfilNoDisponibleProps) {
  const [reintentando, setReintentando] = useState(false);

  const reintentar = async () => {
    setReintentando(true);
    try {
      await onReintentar();
    } finally {
      setReintentando(false);
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
          style={{ background: 'hsl(0 70% 95%)' }}
        >
          <AlertCircle className="h-8 w-8" style={{ color: 'hsl(0 70% 50%)' }} />
        </div>

        <h1
          className="text-2xl font-black text-[hsl(0_0%_5%)] mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          No pudimos cargar tu perfil
        </h1>

        <p className="text-sm mb-7" style={{ color: 'hsl(0 0% 45%)' }}>
          Tu sesión está activa pero no logramos leer tus datos de usuario, así que no podemos
          mostrarte el sistema. Reintenta en unos segundos; si sigue igual, cierra sesión y
          contacta al administrador.
        </p>

        <button
          type="button"
          onClick={reintentar}
          disabled={reintentando}
          className="login-btn-primary flex items-center justify-center gap-2 w-full mb-3 disabled:opacity-60"
        >
          {reintentando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {reintentando ? 'Reintentando…' : 'Reintentar'}
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
