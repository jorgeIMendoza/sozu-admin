import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAllowedMenus } from '@/hooks/useAllowedMenus';
import { useDynamicMenus } from '@/hooks/useDynamicMenus';
import { useAuth } from '@/contexts/AuthContext';
import { useHasEmbajadorRole } from '@/hooks/useHasEmbajadorRole';
import { computePortalHostAccess } from '@/lib/portalHostAccess';
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
  const { profile } = useAuth();
  const hasEmbajadorRole = useHasEmbajadorRole();
  const location = useLocation();

  const isSimplifiedRole = SIMPLIFIED_ROLES.includes(profile?.rol_nombre ?? "");

  // Always allow access to the access-denied page to prevent infinite redirects
  if (location.pathname === '/admin/access-denied') {
    return <>{children}</>;
  }

  // ---------------------------------------------------------------------------
  // GATE DE SEGURIDAD GLOBAL — debe evaluarse ANTES de cualquier atajo por
  // portal. Los atajos de abajo (/admin/agent, portal-cliente,
  // portal-estructura-comisiones, portal-productos, portal-embajador, y los
  // shortcuts por rol_id 1/2) hacían `return children` sin pasar por aquí, así
  // que un submenú apagado en "Administrar Menús" desaparecía del sidebar pero
  // seguía siendo accesible escribiendo la URL directa. Aplica a TODOS los
  // portales y a TODOS los roles, incluido Super Admin.
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
    // hasEmbajadorRole arranca en null mientras consulta user_roles; esperar a
    // que resuelva evita mostrar "sin acceso" a un embajador por una carrera.
    if (hasEmbajadorRole === null) {
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

  // Allow portal-estructura-comisiones for Super Admin (1) and Administrador de Proyectos (2),
  // o cualquier rol con permiso explícito en la BD.
  if (location.pathname.startsWith('/admin/portal-estructura-comisiones')) {
    if (profile?.rol_id === 1 || profile?.rol_id === 2) {
      return <>{children}</>;
    }
    let tieneAccesoEC = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-estructura-comisiones')) {
        tieneAccesoEC = true;
        break;
      }
    }
    return tieneAccesoEC
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Allow portal-productos para Super Admin (1) y Administrador de Proyectos (2),
  // o cualquier rol con permiso explícito en la BD.
  if (location.pathname.startsWith('/admin/portal-productos')) {
    if (profile?.rol_id === 1 || profile?.rol_id === 2) {
      return <>{children}</>;
    }
    let tieneAccesoPP = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-productos')) {
        tieneAccesoPP = true;
        break;
      }
    }
    return tieneAccesoPP
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Allow portal-embajador routes para el rol Embajador, Super Admin / Admin, y usuarios con rol dual
  // Portal Tickets de Seguimiento: Super Admin (1) y Administrador de Proyectos (2),
  // o cualquier rol con permiso explícito en la BD.
  if (location.pathname.startsWith('/admin/portal-tickets')) {
    if (profile?.rol_id === 1 || profile?.rol_id === 2) {
      return <>{children}</>;
    }
    let tieneAccesoTk = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-tickets')) {
        tieneAccesoTk = true;
        break;
      }
    }
    return tieneAccesoTk
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  if (location.pathname.startsWith('/admin/portal-embajador')) {
    // El rol Cliente (23) entra al portal de Embajadores por rol, sin fila en
    // user_roles: todo cliente puede referir con su misma cuenta.
    if (
      profile?.rol_id === 1 ||
      profile?.rol_id === 2 ||
      profile?.rol_id === 23 ||
      profile?.rol_nombre === 'Embajador' ||
      profile?.rol_nombre === 'Cliente'
    ) {
      return <>{children}</>;
    }
    if (hasEmbajadorRole === null) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (hasEmbajadorRole) return <>{children}</>;
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

  // Módulo de Precios (Inventarios → Precios): el submenu registrado en BD es el
  // prefijo '/admin/inventario/precios', pero las pestañas reales viven en
  // subrutas (tabla, motor, calibracion, escenarios/*, auditoria/*) que no tienen
  // submenu propio. Patrón coarse: basta tener permiso de lectura sobre el módulo
  // para habilitar todas sus pestañas. Va DESPUÉS del shortcut de Super Admin
  // porque para él allowedPaths es {'*'} y no haría match por prefijo.
  if (location.pathname.startsWith('/admin/inventario/precios')) {
    let tieneAccesoPrecios = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/inventario/precios')) {
        tieneAccesoPrecios = true;
        break;
      }
    }
    return tieneAccesoPrecios
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal de Administración: varias rutas de ejecución (bandeja, ciclo-venta, etc.)
  // pueden no tener un submenu propio y nunca aparecer en allowedPaths, por lo que el
  // landing del portal mandaba a 403 a roles no-superadmin con acceso al portal.
  // Si el rol tiene permiso sobre CUALQUIER submenu del portal, habilitamos sus rutas
  // (coarse, igual que el caso de /reportes/ver).
  if (location.pathname.startsWith('/admin/portal-administracion')) {
    // allowedPaths es un Set<string>: iterar, no usar Array.some
    let tieneAccesoPortalAdmin = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-administracion')) {
        tieneAccesoPortalAdmin = true;
        break;
      }
    }
    return tieneAccesoPortalAdmin
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal Legal Flow: varias rutas (cases/:id, requests/new, templates, etc.)
  // no tienen un submenu propio en allowedPaths. Si el rol tiene permiso sobre
  // CUALQUIER submenu del portal, habilitamos todas sus rutas (coarse, igual
  // que portal-administracion). Antes este gate estaba hardcodeado a rol_id 1/2,
  // lo que daba 403 a roles como Admin Legal pese a tener el permiso en DB.
  if (location.pathname.startsWith('/admin/legal-flow')) {
    let tieneAccesoLegalFlow = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/legal-flow')) {
        tieneAccesoLegalFlow = true;
        break;
      }
    }
    return tieneAccesoLegalFlow
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal Cobranza: patrón coarse — basta tener permiso sobre cualquier submenu
  // del portal para habilitar todas sus rutas (expediente/:id, etc. no tienen submenu propio).
  if (location.pathname.startsWith('/admin/portal-cobranza')) {
    let tieneAccesoCobranza = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-cobranza')) {
        tieneAccesoCobranza = true;
        break;
      }
    }
    return tieneAccesoCobranza
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal de Escrituración: varias rutas (expedientes, unidades, relacion-pagos, etc.)
  // pueden no tener un submenu propio en allowedPaths. Si el rol tiene permiso sobre
  // CUALQUIER submenu del portal, habilitamos todas sus rutas (coarse, igual que
  // portal-administracion y legal-flow). Antes este gate estaba hardcodeado a rol_id 1,
  // lo que daba 403 a roles como Administrador de Finanzas pese a tener el permiso en DB.
  if (location.pathname.startsWith('/admin/portal-escrituracion')) {
    let tieneAccesoEscrituracion = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-escrituracion')) {
        tieneAccesoEscrituracion = true;
        break;
      }
    }
    return tieneAccesoEscrituracion
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal Condominio Administración: mismo patrón coarse — basta tener permiso
  // sobre cualquier submenu del portal para habilitar todas sus rutas.
  if (location.pathname.startsWith('/admin/portal-condominio')) {
    let tieneAccesoCondominio = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-condominio')) {
        tieneAccesoCondominio = true;
        break;
      }
    }
    return tieneAccesoCondominio
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal CRM Sozu: mismo patrón coarse — basta tener permiso sobre cualquier
  // submenu del portal para habilitar todas sus rutas.
  if (location.pathname.startsWith('/admin/portal-crm')) {
    let tieneAccesoCrm = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-crm')) {
        tieneAccesoCrm = true;
        break;
      }
    }
    return tieneAccesoCrm
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal Socio Bancario: mismo patrón coarse — basta tener permiso sobre
  // cualquier submenu del portal para habilitar todas sus rutas.
  if (location.pathname.startsWith('/admin/portal-socio-bancario')) {
    let tieneAccesoSocioBancario = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-socio-bancario')) {
        tieneAccesoSocioBancario = true;
        break;
      }
    }
    return tieneAccesoSocioBancario
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
  }

  // Portal Bancos: mismo patrón coarse — basta tener permiso sobre cualquier
  // submenu del portal para habilitar todas sus rutas. Además permitimos al rol
  // "Banco" entrar directamente (fallback por si los submenús aún no están
  // asignados a su rol en BD para ese ambiente).
  if (location.pathname.startsWith('/admin/portal-bancos')) {
    // Administración del portal (equipo / bancos con convenio): requiere permiso
    // EXPLÍCITO de lectura sobre ESA vista en BD. Antes estaba hardcodeado a
    // rol_id === 1, lo que mandaba a 403 a Supervisor Banco / Operador Banco pese
    // a tener el permiso asignado en `submenus_permisos`.
    const ADMIN_PATHS = [
      '/admin/portal-bancos/equipo',
      '/admin/portal-bancos/bancos',
    ];
    const adminPath = ADMIN_PATHS.find((p) => location.pathname.startsWith(p));
    if (adminPath) {
      return allowedPaths.has(adminPath)
        ? <>{children}</>
        : <Navigate to="/admin/access-denied" replace />;
    }
    if (profile?.rol_nombre === 'Banco') return <>{children}</>;
    let tieneAccesoBancos = false;
    for (const p of allowedPaths) {
      if (p.startsWith('/admin/portal-bancos')) {
        tieneAccesoBancos = true;
        break;
      }
    }
    return tieneAccesoBancos
      ? <>{children}</>
      : <Navigate to="/admin/access-denied" replace />;
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
