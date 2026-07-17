import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import {
  Home,
  ShoppingBag,
  Wallet,
  FileText,
  Bell,
  User,
  CreditCard,
  BarChart2,
  Package,
  type LucideIcon,
} from "lucide-react";

export interface PortalNavItem {
  id: number;
  label: string;
  route: string;
  icon: LucideIcon;
}

const ROUTE_ICON: Record<string, LucideIcon> = {
  "/admin/portal-cliente/inicio":          Home,
  "/admin/portal-cliente/en-adquisicion":  ShoppingBag,
  "/admin/portal-cliente/patrimonio":      Wallet,
  "/admin/portal-cliente/documentos":      FileText,
  "/admin/portal-cliente/notificaciones":  Bell,
  "/admin/portal-cliente/perfil":          User,
  "/admin/portal-cliente/pagos":           CreditCard,
  "/admin/portal-cliente/historial-pagos": CreditCard,
  "/admin/portal-cliente/estado-de-cuenta": BarChart2,
  "/admin/portal-cliente/productos": Package,
};

export function usePortalNavItems() {
  const { disabledPaths } = useAllowedMenus();
  const query = useQuery<PortalNavItem[]>({
    queryKey: ["portal-nav-submenus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submenus")
        .select("id, nombre, vista_front_end, orden")
        .eq("menu_id", 18)
        .eq("activo", true)
        .not("vista_front_end", "is", null)
        .order("orden");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as number,
        label: row.nombre as string,
        route: row.vista_front_end as string,
        icon: ROUTE_ICON[row.vista_front_end as string] ?? Home,
      }));
    },
    staleTime: 5 * 60_000,
  });

  // Ocultar ítems cuyo submenú (o menú padre) está apagado en BD (activo=false).
  // La query ya filtra `submenus.activo=true`; esto cubre el menú padre inactivo.
  const data = useMemo(
    () => query.data?.filter((item) => !disabledPaths.has(item.route)),
    [query.data, disabledPaths],
  );

  return { ...query, data };
}

export function isNavItemActive(route: string, pathname: string): boolean {
  if (route === "/admin/portal-cliente/inicio") return pathname === route;
  return pathname.startsWith(route);
}
