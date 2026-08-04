import { ShieldAlert, ExternalLink, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getPortalHost, PORTAL_LABELS, type PortalSubdomain } from '@/lib/portalUrls';

interface PortalSinAccesoProps {
  /** Portal cuyo subdominio está abierto y al que el usuario no tiene acceso. */
  portal: PortalSubdomain;
  /** Portales a los que sí puede entrar (incluye el actual; se filtra abajo). */
  accessiblePortals: PortalSubdomain[];
  canGoToAdmin: boolean;
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
 */
export function PortalSinAcceso({ portal, accessiblePortals, canGoToAdmin }: PortalSinAccesoProps) {
  const { signOut } = useAuth();

  const otrosPortales = accessiblePortals.filter((p) => p !== portal);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md w-full space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-destructive">Sin acceso a este portal</h1>
        <p className="text-muted-foreground">
          Tu cuenta no tiene acceso al <strong>{PORTAL_LABELS[portal]}</strong>.
          {(otrosPortales.length > 0 || canGoToAdmin) && ' Puedes entrar desde:'}
        </p>

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

        <Button variant="ghost" onClick={() => signOut()} className="gap-2">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
