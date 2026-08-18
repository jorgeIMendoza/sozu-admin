import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";
import { useImpersonationViewMode } from "@/contexts/ImpersonationViewModeContext";
import {
  resolveEffectiveRolId,
  resolveIsSuperAdminView,
  usesTargetRole,
} from "@/lib/impersonation/effective-identity";
import {
  Home,
  Building2,
  Calculator,
  Users,
  Briefcase,
  Wallet,
  Megaphone,
  UserCircle,
  ScrollText,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export const PORTAL_PERSONAL_MENU = "Portal del Personal";

export interface PersonalNavItem {
  id: number;
  label: string;
  path: string;
  icon: LucideIcon;
  orden: number;
}

const ROUTE_ICON: Record<string, LucideIcon> = {
  "/admin/portal-personal": Home,
  "/admin/portal-personal/inventario": Building2,
  "/admin/portal-personal/simulador": Calculator,
  "/admin/portal-personal/referidos": Users,
  "/admin/portal-personal/negocios": Briefcase,
  "/admin/portal-personal/ganancias": Wallet,
  "/admin/portal-personal/kit": Megaphone,
  "/admin/portal-personal/perfil": UserCircle,
  "/admin/portal-personal/reglas": ScrollText,
};

/**
 * Nav del Portal del Personal leído 100% desde BD (menus/submenus) y filtrado
 * por permisos de rol. Nada hardcodeado: si el submenú no existe, está apagado o
 * el rol no tiene lectura, no aparece.
 *
 * Con "Vista del usuario" activa (ver `ImpersonationViewModeContext`) el menú se
 * resuelve con el rol del usuario SUPLANTADO, que es justo para lo que sirve:
 * comprobar qué vería él. La AUTORIZACIÓN de rutas (`PermissionRoute` vía
 * `useAllowedMenus`) sigue usando el rol real de la sesión a propósito — si no,
 * el admin perdería el acceso a la ruta y quedaría atrapado fuera del portal.
 */
export function usePortalPersonalNav() {
  const { isPathAllowed, isPathDisabled, isLoading: cargandoMenus } = useAllowedMenus();
  const { profile } = useAuth();
  const { impersonatedUser } = usePortalPersonalImpersonation();
  const { viewMode } = useImpersonationViewMode();

  const identity = {
    profileRolId: profile?.rol_id,
    profileRolNombre: profile?.rol_nombre,
    profilePersonaId: profile?.id_persona,
    puedeImpersonar: profile?.puede_impersonar,
    target: impersonatedUser
      ? {
          email: impersonatedUser.email,
          personaId: impersonatedUser.id_persona ?? null,
          nombre: impersonatedUser.nombre,
          rolId: impersonatedUser.rol_id,
          rolNombre: impersonatedUser.rol_nombre,
        }
      : null,
    viewMode,
  };

  const simulaOtroRol = usesTargetRole(identity.target, viewMode);
  const rolSimulado = resolveEffectiveRolId(identity);
  const simulaSuperAdmin = simulaOtroRol && resolveIsSuperAdminView(identity);

  const { data } = useQuery<PersonalNavItem[]>({
    queryKey: ["portal-personal-nav"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("submenus")
        .select("id, nombre, vista_front_end, orden, menus!inner(nombre, activo)")
        .eq("menus.nombre", PORTAL_PERSONAL_MENU)
        .eq("menus.activo", true)
        .eq("activo", true)
        .not("vista_front_end", "is", null)
        .order("orden");
      if (error || !data) return [];
      return (data as any[]).map((s) => ({
        id: s.id as number,
        label: s.nombre as string,
        path: s.vista_front_end as string,
        orden: (s.orden as number) ?? 0,
        icon: ROUTE_ICON[s.vista_front_end as string] ?? LayoutGrid,
      }));
    },
    staleTime: 5 * 60_000,
  });

  // Submenús que el rol suplantado puede LEER. Sólo se consulta en vista fiel:
  // sin suplantación el filtro sigue siendo el de `useAllowedMenus`.
  const necesitaPermisosDelOtro = simulaOtroRol && !simulaSuperAdmin && rolSimulado != null;
  const { data: leiblesPorRol, isLoading: cargandoPermisosDelOtro } = useQuery<number[]>({
    queryKey: ["portal-personal-nav-permisos", rolSimulado],
    enabled: necesitaPermisosDelOtro,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: permiso } = await (supabase as any)
        .from("permisos")
        .select("id")
        .eq("nombre", "leer")
        .single();
      if (!permiso) return [];
      const { data } = await (supabase as any)
        .from("submenus_permisos")
        .select("submenu_id")
        .eq("rol_id", rolSimulado)
        .eq("permiso_id", permiso.id)
        .eq("activo", true);
      return ((data as any[]) ?? []).map((r) => r.submenu_id as number);
    },
  });

  const isLoading = cargandoMenus || (necesitaPermisosDelOtro && cargandoPermisosDelOtro);

  const items = useMemo(() => {
    const todos = data ?? [];
    const leibles = new Set(leiblesPorRol ?? []);
    return todos.filter((i) => {
      // Una vista apagada en BD no se pinta para nadie, ni simulando.
      if (isPathDisabled(i.path)) return false;
      if (!simulaOtroRol) return isPathAllowed(i.path);
      if (simulaSuperAdmin) return true;
      return leibles.has(i.id);
    });
  }, [data, leiblesPorRol, simulaOtroRol, simulaSuperAdmin, isPathAllowed, isPathDisabled]);

  return { items, isLoading };
}
