import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAllowedMenus } from '@/hooks/useAllowedMenus';
import { useDynamicMenus } from '@/hooks/useDynamicMenus';
import { useAuth } from '@/contexts/AuthContext';
import { useHasEmbajadorRole } from '@/hooks/useHasEmbajadorRole';
import { computePortalHostAccess } from '@/lib/portalHostAccess';
import { decidePortalAccess } from '@/lib/routeAccess';
import { CURRENT_PORTAL_SUBDOMAIN } from '@/lib/portalUrls';
import { PortalSinAcceso } from './PortalSinAcceso';
import { Loader2 } from 'lucide-react';

const SIMPLIFIED_ROLES = ["Agente Inmobiliario"];

interface PermissionRouteProps {
  children: ReactNode;
}

export function PermissionRoute({ children }: PermissionRouteProps) {
  const { isPathAllowed, isPathDisabled, isLoading, isSuperAdmin, allowedPaths } = useAllowedMenus();
  const { menuItems, isLoading: isMenuLoading } = useDynamicMenus();
  const { profile, user } = useAuth();
  const hasEmbajadorRole = useHasEmbajadorRole();
  const location = useLocation();

  const isSimplifiedRole = SIMPLIFIED_ROLES.includes(profile?.rol_nombre ?? "");

  // Always allow access to the access-denied page to prevent infinite redirects
  if (location.pathname === '/admin/access-denied') {
    return <>{children}</>;
  }

  // ---------------------------------------------------------------------------
  // GATE DE SEGURIDAD GLOBAL — debe evaluarse ANTES de cualquier atajo por
  // portal. Los atajos de abajo (/admin/agent, portal-cliente, y el gate de
  // portales) hacían `return children` sin pasar por aquí, así que un submenú
  // apagado en "Administrar Menús" desaparecía del sidebar pero seguía siendo
  // accesible escribiendo la URL directa. Aplica a TODOS los portales y a TODOS
  // los roles, incluido Super Admin.
  // ---------------------------------------------------------------------------
  if (isLoading || isMenuLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  if (isPathDisabled(location.pathname)) {
    return <Navigate to="/admin/access-denied" replace />;
  }

  // ---------------------------------------------------------------------------
  // GATE DE SUBDOMINIO — debe ir ANTES de los bypass de /admin/agent y
  // /admin/portal-cliente de abajo, que están abiertos a cualquier rol
  // autenticado: sin este gate, un embajador puro entraba al portal de agentes
  // con solo abrir agentes.sozu.com.
  //
  // También corta el loop de redirección que se daba cuando un usuario sin
  // acceso caía en un subdominio: PermissionRoute redirigía a
  // getFirstAllowedPath(), esa ruta no existe en el árbol reducido del host, el
  // catch-all la rebotaba, y vuelta a empezar.
  //
  // En admin.sozu.com / localhost CURRENT_PORTAL_SUBDOMAIN es null y nada de
  // esto aplica, así que el comportamiento del panel completo no cambia.
  // ---------------------------------------------------------------------------
  if (CURRENT_PORTAL_SUBDOMAIN) {
    // Sesión sin perfil todavía: NUNCA juzgar el acceso sin saber el rol. El rol
    // es la única señal que distingue a un usuario de portal de otro, así que sin
    // perfil el gate negaría a cuentas que sí tienen acceso.
    // hasEmbajadorRole arranca en null mientras consulta user_roles; esperar a
    // que resuelva evita mostrar "sin acceso" a un embajador por una carrera.
    if ((user && !profile) || hasEmbajadorRole === null) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    const portalAccess = computePortalHostAccess({
      rolId: profile?.rol_id,
      rolNombre: profile?.rol_nombre,
      allowedPaths,
      isSuperAdmin,
      hasEmbajadorRole,
      hasAdminMenus: menuItems.some((item) => !item.isPortal),
    });

    if (!portalAccess.hasAccessToCurrentPortal) {
      return (
        <PortalSinAcceso
          portal={CURRENT_PORTAL_SUBDOMAIN}
          accessiblePortals={portalAccess.accessiblePortals}
          canGoToAdmin={portalAccess.canGoToAdmin}
          email={profile?.email ?? user?.email ?? null}
          rolNombre={profile?.rol_nombre ?? null}
        />
      );
    }
  }

  // Allow agent portal routes for ALL roles.
  // OJO: debe llevar la barra final. Sin ella, '/admin/agentes' (catálogo admin
  // de Agentes) hacía match con startsWith('/admin/agent') y quedaba abierto a
  // cualquier usuario autenticado sin permiso en BD.
  if (location.pathname === '/admin/agent' || location.pathname.startsWith('/admin/agent/')) {
    return <>{children}</>;
  }

  // Allow portal-cliente routes for all roles (Cliente role + Super Admin)
  if (location.pathname.startsWith('/admin/portal-cliente')) {
    return <>{children}</>;
  }

  // ---------------------------------------------------------------------------
  // GATE ÚNICO DE PORTALES — antes había un `if` por portal, cada uno con su
  // propio bucle sobre `allowedPaths`, y el de portal-embajador se quedó sin
  // ese bucle: solo aceptaba rol_id 1/2/23 y el rol Embajador, así que un rol
  // con permiso de lectura en BD (Admin Soporte, rol 30) veía el submenú en el
  // sidebar y recibía 403 al entrar. La tabla vive en `lib/routeAccess.ts` y
  // trata el permiso en BD como condición suficiente para todos los portales;
  // agregar uno nuevo es agregar su prefijo ahí, no copiar un `if`.
  // ---------------------------------------------------------------------------
  const portalDecision = decidePortalAccess(location.pathname, {
    rolId: profile?.rol_id,
    rolNombre: profile?.rol_nombre,
    allowedPaths,
    isSuperAdmin,
    hasEmbajadorRole,
  });

  if (portalDecision === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (portalDecision === 'allow') {
    return <>{children}</>;
  }
  if (portalDecision === 'deny') {
    return <Navigate to="/admin/access-denied" replace />;
  }

  // Cliente role should only see portal-cliente, redirect them there
  if (profile?.rol_nombre === 'Cliente') {
    return <Navigate to="/admin/portal-cliente/inicio" replace />;
  }

  // Super Admin has access to everything (salvo vistas apagadas, ya filtradas arriba)
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check if current path is allowed
  const currentPath = location.pathname;

  // On /admin, respect dynamic menu order and send user to first allowed page.
  //
  // Excepción: si TODOS los menús del rol son portales y hay más de uno (p. ej. un
  // usuario con Portal Embajador y Portal Bancos), redirigir lo encerraba en el
  // primero de la lista sin poder elegir. En ese caso se deja en /admin, donde
  // AdminIndex muestra el selector de portales y el sidebar sigue listando ambos.
  if (currentPath === '/admin') {
    const portalMenus = menuItems.filter((item) => item.isPortal);
    const soloPortales = portalMenus.length > 1 && portalMenus.length === menuItems.length;
    if (soloPortales) {
      // Sin este return, el chequeo de isPathAllowed('/admin') de abajo volvería a
      // redirigir al primer portal (el rol no tiene permiso sobre el Dashboard).
      return <>{children}</>;
    }
    const firstAllowedPath = getFirstAllowedPath(menuItems);
    if (firstAllowedPath && firstAllowedPath !== '/admin') {
      return <Navigate to={firstAllowedPath} replace />;
    }
  }

  // Handle nested routes (e.g., /admin/cuentas-cobranza/:id/detalle)
  const basePath = getBasePath(currentPath);

  if (isPathAllowed(basePath)) {
    return <>{children}</>;
  }

  // User doesn't have permission to this specific route
  // Try to redirect to the first allowed menu item instead of showing access denied
  const firstAllowedPath = getFirstAllowedPath(menuItems);
  if (firstAllowedPath) {
    // Only redirect if the target is different from current path to avoid loops
    if (firstAllowedPath !== currentPath) {
      return <Navigate to={firstAllowedPath} replace />;
    }
  }

  // No allowed paths at all - show access denied
  return <Navigate to="/admin/access-denied" replace />;
}

// Helper to get the first allowed path from dynamic menus.
// Al aterrizar en /admin priorizamos secciones del admin panel (no portales):
// si el primer menú del rol es un portal (ej. "Portal Agente"), devolverlo aquí
// rebotaba al usuario de vuelta a su portal en lugar de dejarlo en el admin panel.
// Solo si el rol no tiene ninguna sección no-portal caemos a sus portales.
function getFirstAllowedPath(menuItems: any[]): string | null {
  const ordered = [
    ...menuItems.filter((item) => !item.isPortal),
    ...menuItems.filter((item) => item.isPortal),
  ];
  for (const item of ordered) {
    if (item.href) return item.href;
    if (item.children?.length > 0) {
      return item.children[0].href;
    }
  }
  return null;
}

// Helper function to get base path for nested routes
function getBasePath(fullPath: string): string {
  // Remove trailing slashes
  const path = fullPath.replace(/\/$/, '');

  // Special cases for nested routes
  const nestedPatterns = [
    /^(\/admin\/cuentas-cobranza)\/\d+\/detalle$/,
    /^(\/admin\/cuentas-mantenimiento)\/\d+\/detalle$/,
    /^(\/admin\/usuarios)\/nuevo$/,
    /^(\/admin\/reportes\/ver)\/\d+$/,
    /^(\/admin\/inmobiliarias\/proyectos)\/\d+$/,
    /^(\/admin\/inmobiliarias\/proyectos)\/\d+\/inventario$/,
    /^(\/admin\/portal-inmobiliaria\/agentes)\/[^/]+$/,
    /^(\/admin\/activos-comerciales)\/nuevo$/,
    /^(\/admin\/activos-comerciales)\/\d+$/,
    /^(\/admin\/activos-comerciales)\/\d+\/editar$/,
  ];

  for (const pattern of nestedPatterns) {
    const match = path.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return path;
}
