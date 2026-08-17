import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
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
 * por los permisos del rol (`useAllowedMenus`). Nada hardcodeado: si el submenú
 * no existe, está apagado o el rol no tiene lectura, no aparece.
 */
export function usePortalPersonalNav() {
  const { isPathAllowed, isLoading } = useAllowedMenus();

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

  const items = useMemo(
    () => (data ?? []).filter((i) => isPathAllowed(i.path)),
    [data, isPathAllowed],
  );

  return { items, isLoading };
}
