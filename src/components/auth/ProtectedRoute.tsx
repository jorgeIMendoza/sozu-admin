import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailNoConfirmado } from './EmailNoConfirmado';
import { PerfilNoDisponible } from './PerfilNoDisponible';

interface ProtectedRouteProps {
  children: ReactNode;
}

const BLOCKED_ROLE_NAMES = ['Cliente', 'Directores'];

const CHANGE_PASSWORD_PATH = '/auth/change-password';

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isProfileLoading, mustChangePassword, profile, refreshProfile } = useAuth();
  const location = useLocation();

  // Allow Cliente role to access portal-cliente routes
  const isPortalClienteRoute = location.pathname.startsWith('/admin/portal-cliente');
  // OJO: hoy esto es siempre false. App.tsx registra /auth/change-password como
  // ruta hermana de /admin, FUERA de este componente, así que ProtectedRoute
  // nunca se monta en esa URL. Se conserva como red de seguridad por si algún
  // día la ruta se anida aquí dentro (evitaría un bucle de redirects contra el
  // guard de mustChangePassword). Los guards reales de esa pantalla —cuenta
  // desactivada y correo sin confirmar— viven en src/pages/auth/ChangePassword.tsx.
  const isChangePasswordRoute = location.pathname === CHANGE_PASSWORD_PATH;

  const handleGoToLogin = () => {
    supabase.auth.signOut().finally(() => {
      window.location.href = '/auth/login';
    });
  };

  // `isProfileLoading` solo cuenta cuando todavía no hay perfil: así el fetch en
  // vuelo tras un SIGNED_IN no cae en la pantalla de error, y un refresco en
  // segundo plano (cambio de rol, realtime) no tapa la app con el spinner.
  if (isLoading || (user && !profile && isProfileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Fail-closed: con sesión pero sin perfil (RPC caída, timeout, o sin fila en
  // usuarios) no sabemos si la cuenta está activa ni qué rol tiene. Antes esto
  // dejaba pasar al contenido protegido.
  if (!profile) {
    return <PerfilNoDisponible onReintentar={refreshProfile} onCerrarSesion={handleGoToLogin} />;
  }

  // Va ANTES del redirect de mustChangePassword: un usuario dado de baja con
  // contraseña temporal se colaba a /auth/change-password y la cambiaba.
  if (profile.activo === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Cuenta Desactivada</h1>
          <p className="text-muted-foreground">
            Tu cuenta ha sido desactivada. Contacta al administrador para más información.
          </p>
          <Button variant="destructive" onClick={handleGoToLogin}>
            <LogIn className="mr-2 h-4 w-4" />
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  // Roles de portal/externos (roles.requiere_confirmacion_email) no entran hasta
  // verificar su correo. La excepción de /auth/change-password no protege nada
  // desde aquí (ver nota arriba: esa ruta no pasa por ProtectedRoute); el mismo
  // gate, con la tolerancia al flujo de confirmación recién completado, está
  // reimplementado en ChangePassword.tsx.
  if (
    profile.requiere_confirmacion_email &&
    !profile.email_confirmado &&
    !isChangePasswordRoute
  ) {
    return (
      <EmailNoConfirmado
        email={profile.email}
        onActualizarEstado={refreshProfile}
        onCerrarSesion={handleGoToLogin}
      />
    );
  }

  if (mustChangePassword && !isChangePasswordRoute) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  if (BLOCKED_ROLE_NAMES.includes(profile.rol_nombre) && !isPortalClienteRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-destructive">
            Acceso No Autorizado
          </h1>
          <p className="text-muted-foreground">
            Tu tipo de usuario no tiene acceso a este sistema.
            Contacta al administrador si crees que esto es un error.
          </p>
          <Button variant="destructive" onClick={handleGoToLogin}>
            <LogIn className="mr-2 h-4 w-4" />
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
