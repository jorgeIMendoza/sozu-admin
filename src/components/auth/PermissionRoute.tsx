import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAllowedMenus } from '@/hooks/useAllowedMenus';
import { useDynamicMenus } from '@/hooks/useDynamicMenus';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const SIMPLIFIED_ROLES = ["Agente Inmobiliario"];

interface PermissionRouteProps {
  children: ReactNode;
}

export function PermissionRoute({ children }: PermissionRouteProps) {
  const { isPathAllowed, isLoading, isSuperAdmin, allowedPaths } = useAllowedMenus();
  const { menuItems, isLoading: isMenuLoading } = useDynamicMenus();
  const { profile } = useAuth();
  const location = useLocation();

  const isSimplifiedRole = SIMPLIFIED_ROLES.includes(profile?.rol_nombre ?? "");

  // Always allow access to the access-denied page to prevent infinite redirects
  if (location.pathname === '/admin/access-denied') {
    return <>{children}</>;
  }

  // Allow agent portal routes for ALL roles
  if (location.pathname.startsWith('/admin/agent')) {
    return <>{children}</>;
  }

  // Allow portal-cliente routes for all roles (Cliente role + Super Admin)
  if (location.pathname.startsWith('/admin/portal-cliente')) {
    return <>{children}</>;
  }

  // Allow portal-cobranza routes only for Super Admin
  if (location.pathname.startsWith('/admin/portal-cobranza')) {
    if (profile?.rol_id === 1 || profile?.rol_id === 2) {
      return <>{children}</>;
    }
    return <Navigate to="/admin/access-denied" replace />;
  }

  // Allow portal-embajador routes para el rol Embajador y para Super Admin / Admin (impersonación)
  if (location.pathname.startsWith('/admin/portal-embajador')) {
    if (profile?.rol_id === 1 || profile?.rol_id === 2 || profile?.rol_nombre === 'Embajador') {
      return <>{children}</>;
    }
    return <Navigate to="/admin/access-denied" replace />;
  }

  // Cliente role should only see portal-cliente, redirect them there
  if (profile?.rol_nombre === 'Cliente') {
    return <Navigate to="/admin/portal-cliente/inicio" replace />;
  }

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

  // Super Admin has access to everything
  if (isSuperAdmin) {
    return <>{children}</>;
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

  // Portal Bancos: mismo patrón coarse — basta tener permiso sobre cualquier
  // submenu del portal para habilitar todas sus rutas. Además permitimos al rol
  // "Banco" entrar directamente (fallback por si los submenús aún no están
  // asignados a su rol en BD para ese ambiente).
  if (location.pathname.startsWith('/admin/portal-bancos')) {
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
  
  // On /admin, respect dynamic menu order and send user to first allowed page
  if (currentPath === '/admin') {
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

// Helper to get the first allowed path from dynamic menus
function getFirstAllowedPath(menuItems: any[]): string | null {
  for (const item of menuItems) {
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
  ];
  
  for (const pattern of nestedPatterns) {
    const match = path.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return path;
}
