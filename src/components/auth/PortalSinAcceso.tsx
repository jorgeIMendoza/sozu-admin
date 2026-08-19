import { useEffect, useRef } from 'react';
import { ShieldAlert, ExternalLink, LogOut, UserRoundCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { activityLoggerService } from '@/services/activityLoggerService';
import { getPortalHost, PORTAL_LABELS, type PortalSubdomain } from '@/lib/portalUrls';

interface PortalSinAccesoProps {
  /** Portal cuyo subdominio está abierto y al que el usuario no tiene acceso. */
  portal: PortalSubdomain;
  /** Portales a los que sí puede entrar (incluye el actual; se filtra abajo). */
  accessiblePortals: PortalSubdomain[];
  canGoToAdmin: boolean;
  /** Cuenta con la que se está evaluando el acceso (la sesión viva, no la que el usuario cree). */
  email?: string | null;
  /** Rol de esa cuenta; junto con el correo es lo que hace diagnosticable un ticket. */
  rolNombre?: string | null;
}

/**
 * Pantalla que se muestra cuando el usuario abre el subdominio de un portal al
 * que su cuenta no tiene acceso (p. ej. un embajador entrando a
 * agentes.sozu.com).
 *
 * Es un componente y no un <Navigate>: los subdominios de portal montan un
 * árbol de rutas reducido en App.tsx, así que /admin/access-denied no existe en
 * varios de ellos y redirigir ahí caería en el catch-all.
 *
 * Los enlaces son <a href> a otro host, nunca navigate(): cambiar de portal
 * significa cambiar de dominio, y una navegación client-side rebotaría por el
 * catch-all del portal actual.
 *
 * Muestra SIEMPRE el correo de la sesión: el rechazo se decide con la cuenta
 * viva, que no siempre es la que el usuario cree haber usado (autocompletado del
 * navegador, huella, o una sesión anterior en esa misma pestaña). Sin ese dato un
 * ticket no se puede diagnosticar, y por eso además se registra en
 * `logs_actividad` con workflow `portal_denegado`.
 */
export function PortalSinAcceso({
  portal,
  accessiblePortals,
  canGoToAdmin,
  email,
  rolNombre,
}: PortalSinAccesoProps) {
  const { signOut } = useAuth();

  const otrosPortales = accessiblePortals.filter((p) => p !== portal);

  // Un solo registro por pantalla: el gate puede re-renderizar varias veces
  // mientras el usuario sigue ahí y no queremos inflar la bitácora.
  // `logs_actividad.usuario_id` es FK contra `usuarios(email)`: sin correo el
  // INSERT se rechazaría, así que en ese caso no se registra nada.
  const yaRegistrado = useRef(false);
  useEffect(() => {
    if (yaRegistrado.current || !email) return;
    yaRegistrado.current = true;
    activityLoggerService.registrarPortalDenegado(email, portal, {
      rol: rolNombre ?? null,
      ruta: typeof window !== 'undefined' ? window.location.pathname : null,
      portales_disponibles: otrosPortales,
      puede_admin: canGoToAdmin,
    });
    // Intencionalmente sin deps: el evento es "se mostró esta pantalla", una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Cierra la sesión y vuelve al login del portal actual. Va con recarga
   * completa a propósito: deja el estado de auth limpio, sin restos del usuario
   * anterior que puedan volver a decidir permisos.
   */
  const entrarConOtraCuenta = async () => {
    try {
      await signOut();
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md w-full space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-destructive">Sin acceso a este portal</h1>
        <p className="text-muted-foreground">
          Tu cuenta no tiene acceso al <strong>{PORTAL_LABELS[portal]}</strong>.
          {(otrosPortales.length > 0 || canGoToAdmin) && ' Puedes entrar desde:'}
        </p>

        {email && (
          <p className="text-sm text-muted-foreground">
            Sesión iniciada como <strong className="break-all">{email}</strong>
            {rolNombre ? ` (${rolNombre})` : ''}.
          </p>
        )}

        {(otrosPortales.length > 0 || canGoToAdmin) && (
          <div className="flex flex-col gap-2 pt-1">
            {canGoToAdmin && (
              <Button variant="outline" asChild className="justify-between">
                <a href={getPortalHost('admin')}>
                  Panel de administración
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {otrosPortales.map((p) => (
              <Button key={p} variant="outline" asChild className="justify-between">
                <a href={getPortalHost(p)}>
                  {PORTAL_LABELS[p]}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground pt-1">
          Si crees que esto es un error, contacta al administrador.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={entrarConOtraCuenta} className="gap-2">
            <UserRoundCog className="h-4 w-4" />
            Entrar con otra cuenta
          </Button>
          <Button variant="ghost" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
