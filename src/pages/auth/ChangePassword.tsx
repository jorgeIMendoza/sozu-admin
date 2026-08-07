import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { activityLoggerService } from '@/services/activityLoggerService';
import { Loader2, KeyRound, AlertCircle, CheckCircle, ShieldAlert, LogOut, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import sozuLogo from '@/assets/sozu-logo-black.png';
import { EmailNoConfirmado } from '@/components/auth/EmailNoConfirmado';
import { PerfilNoDisponible } from '@/components/auth/PerfilNoDisponible';
import { llegoPorEnlaceDeCorreo, vieneDeFlujoConfirmacion } from '@/lib/emailConfirmacion';
import { mensajeErrorPassword } from '@/lib/erroresPassword';

const BLOCKED_ROLE_NAMES = ['Directores'];

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo especial'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCompletingPasswordFlow, setIsCompletingPasswordFlow] = useState(false);
  
  const {
    updatePassword,
    profile,
    signOut,
    session,
    isLoading: authLoading,
    isProfileLoading,
    refreshProfile,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sin sesión no hay contraseña que cambiar. El caso típico no es una navegación
  // manual: es el enlace de correo cuyo token ya no servía (venció, se usó, o lo
  // reemplazó una solicitud posterior), que aterriza aquí sin que verifyOtp haya
  // creado sesión. Rebotar al login mudo dejaba al usuario mirando un formulario
  // cuya contraseña no conoce, así que se le pasa el motivo.
  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/auth/login?reason=link-expirado', { replace: true });
    }
  }, [authLoading, session, navigate]);

  // Quien llega por el enlace de "¿Olvidaste tu contraseña?" viene a definir una nueva
  // aunque `debe_cambiar_password` sea false: el modo público de reset-user-password ya no
  // toca la cuenta (no repone Temporal123! ni levanta esa bandera), justamente para que un
  // anónimo no pueda alterar la cuenta de otro. Sin esta excepción, la página lo expulsaría
  // al portal y el flujo de recuperación no tendría salida.
  //
  // Se mira primero el marcador de la URL y solo después la señal local: esta
  // última vive en sessionStorage, que es por pestaña y por origen, así que se
  // pierde cuando el enlace abre en el navegador embebido del correo o en una
  // pestaña nueva. Cuando se perdía, el enlace terminaba metiendo al usuario al
  // portal con su contraseña vieja intacta en vez de pedirle una nueva.
  const vieneDeEnlaceDeCorreo = llegoPorEnlaceDeCorreo(location.search);

  useEffect(() => {
    if (
      !authLoading &&
      session &&
      profile &&
      !profile.debe_cambiar_password &&
      !isCompletingPasswordFlow &&
      !vieneDeEnlaceDeCorreo &&
      !vieneDeFlujoConfirmacion(profile.email)
    ) {
      navigate(profile.rol_nombre === 'Cliente' ? '/admin/portal-cliente/inicio' : '/admin', { replace: true });
    }
  }, [authLoading, session, profile, navigate, isCompletingPasswordFlow, vieneDeEnlaceDeCorreo]);

  const handleSignOut = () => {
    supabase.auth.signOut().finally(() => {
      window.location.href = '/auth/login';
    });
  };

  if (authLoading) {
    return (
      <div className="login-page">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(145 35% 51%)' }} />
      </div>
    );
  }

  if (!session) return null;

  // ── Guards propios ────────────────────────────────────────────────────────
  // App.tsx registra /auth/change-password como hermana de /admin, FUERA de
  // <ProtectedRoute>: aquí no corre ningún guard previo. Las comprobaciones de
  // cuenta (activa, correo confirmado) se hacen en esta pantalla o no se hacen.

  // Sin perfil no sabemos si la cuenta está activa: fail-closed con reintento,
  // igual que ProtectedRoute. (El spinner cubre el fetch en vuelo, típico de la
  // sesión recién creada por el enlace de confirmación.)
  if (!profile) {
    if (isProfileLoading) {
      return (
        <div className="login-page">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(145 35% 51%)' }} />
        </div>
      );
    }
    return <PerfilNoDisponible onReintentar={refreshProfile} onCerrarSesion={handleSignOut} />;
  }

  // Un usuario dado de baja conserva su sesión hasta que expira: sin esto podía
  // entrar aquí directo y cambiarse la contraseña.
  if (profile.activo === false) {
    return (
      <div className="login-page">
        <div className="login-bg-gradient" />
        <div className="relative w-full max-w-sm text-center z-10">
          <img src={sozuLogo} alt="Sozu" className="h-10 mx-auto mb-10" />
          <ShieldAlert className="h-16 w-16 mx-auto mb-4" style={{ color: 'hsl(0 84% 60%)' }} />
          <h1 className="text-xl font-black text-[hsl(0_0%_5%)] mb-3 tracking-tight">
            Cuenta Desactivada
          </h1>
          <p className="text-sm mb-8" style={{ color: 'hsl(0 0% 45%)' }}>
            Tu cuenta ha sido desactivada, así que no puedes cambiar tu contraseña.
            Contacta al administrador para más información.
          </p>
          <button onClick={handleSignOut} className="login-btn-primary flex items-center justify-center gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Correo sin confirmar en un rol de portal. OJO: esta pantalla es el aterrizaje
  // del flujo legítimo de confirmación — la sesión la acaba de crear el enlace y
  // usuarios.email_confirmado puede tardar en propagarse. Solo se bloquea cuando
  // NO hay rastro de ese flujo en la pestaña (marcado por ConfirmacionEmail.tsx);
  // si el usuario sí viene del enlace se deja pasar, porque romper este camino
  // deja al usuario de portal sin ninguna forma de recuperar su cuenta.
  if (
    profile.requiere_confirmacion_email &&
    !profile.email_confirmado &&
    !vieneDeFlujoConfirmacion(profile.email)
  ) {
    return (
      <EmailNoConfirmado
        email={profile.email}
        onActualizarEstado={refreshProfile}
        onCerrarSesion={handleSignOut}
      />
    );
  }

  if (BLOCKED_ROLE_NAMES.includes(profile.rol_nombre)) {
    return (
      <div className="login-page">
        <div className="login-bg-gradient" />
        <div className="relative w-full max-w-sm text-center z-10">
          <img src={sozuLogo} alt="Sozu" className="h-10 mx-auto mb-10" />
          <ShieldAlert className="h-16 w-16 mx-auto mb-4" style={{ color: 'hsl(0 84% 60%)' }} />
          <h1 className="text-xl font-black text-[hsl(0_0%_5%)] mb-3 tracking-tight">
            Acceso No Autorizado
          </h1>
          <p className="text-sm mb-8" style={{ color: 'hsl(0 0% 45%)' }}>
            Tu tipo de usuario no tiene acceso a este sistema.
            Contacta al administrador si crees que esto es un error.
          </p>
          <button onClick={handleSignOut} className="login-btn-primary flex items-center justify-center gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = passwordSchema.safeParse({ newPassword, confirmPassword });
      if (!result.success) {
        setError(result.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      setIsCompletingPasswordFlow(true);
      const { error } = await updatePassword(newPassword);
      
      if (error) {
        await activityLoggerService.registrarActualizacion(
          profile?.email || session?.user?.email || 'sistema',
          'contraseña',
          null,
          { origen: 'cambio_password_temporal' },
          'cambiar_password_temporal',
          'error',
          // La bitácora se queda con el texto original de Auth (en inglés): es
          // el que sirve para diagnosticar. A la pantalla va la traducción.
          error.message
        );
        setError(mensajeErrorPassword(error));
        setIsCompletingPasswordFlow(false);
        setIsLoading(false);
        return;
      }

      await activityLoggerService.registrarActualizacion(
        profile?.email || session?.user?.email || 'sistema',
        'contraseña',
        null,
        { origen: 'cambio_password_temporal' },
        'cambiar_password_temporal',
        'exito'
      );

      await signOut();
      window.location.href = '/auth/login?reason=password-updated';
      return;
    } catch (err) {
      setIsCompletingPasswordFlow(false);
      setError('Error al cambiar la contraseña. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  const passwordRequirements = [
    { text: 'Al menos 8 caracteres', valid: newPassword.length >= 8 },
    { text: 'Al menos una mayúscula', valid: /[A-Z]/.test(newPassword) },
    { text: 'Al menos una minúscula', valid: /[a-z]/.test(newPassword) },
    { text: 'Al menos un número', valid: /[0-9]/.test(newPassword) },
    { text: 'Al menos un símbolo especial', valid: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  return (
    <div className="login-page">
      <div className="login-bg-gradient" />
      <div className="login-card relative z-10">
        {/* Logo */}
        <div className="text-center mb-7">
          <img src={sozuLogo} alt="Sozu" className="h-10 mx-auto" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-center text-[hsl(0_0%_5%)] mb-1.5" style={{ letterSpacing: '-0.02em' }}>
          Cambiar Contraseña
        </h1>
        {/* A esta pantalla se llega por dos caminos y solo uno reparte una
            contraseña temporal. Quien viene de "olvidé mi contraseña" conserva
            la suya —el modo público de reset-user-password no toca la cuenta—,
            así que hablarle de "tu contraseña temporal" lo empuja a teclear la
            que ya tenía, que es justo lo que Auth rechaza con `same_password`. */}
        <p className="text-sm text-center mb-7" style={{ color: 'hsl(0 0% 45%)' }}>
          Por seguridad, define una contraseña nueva antes de continuar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ color: 'hsl(0 84% 40%)', background: 'hsl(0 84% 97%)' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
                className="login-input w-full pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                style={{ color: 'hsl(0 0% 50%)' }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-[hsl(0_0%_5%)] mb-2">Confirmar Contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
                className="login-input w-full pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                style={{ color: 'hsl(0 0% 50%)' }}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-[hsl(0_0%_35%)]">Requisitos:</p>
            {passwordRequirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                {req.valid ? (
                  <CheckCircle className="h-4 w-4" style={{ color: 'hsl(145 35% 51%)' }} />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2" style={{ borderColor: 'hsl(0 0% 75%)' }} />
                )}
                <span style={{ color: req.valid ? 'hsl(145 35% 51%)' : 'hsl(0 0% 55%)' }}>
                  {req.text}
                </span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="login-btn-primary flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cambiando contraseña...
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Cambiar Contraseña
              </>
            )}
          </button>

          {/* Logout link */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full py-3 text-sm transition-colors"
            style={{ color: 'hsl(0 0% 45%)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(0 0% 25%)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(0 0% 45%)')}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
