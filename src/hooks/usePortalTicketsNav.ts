import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import {
  Inbox,
  UserCheck,
  UserX,
  Columns3,
  GitBranch,
  ListOrdered,
  Tags,
  Flag,
  Users,
  Ticket as TicketIcon,
  type LucideIcon,
} from "lucide-react";

export const PORTAL_TICKETS_MENU = "Portal Tickets de Seguimiento";

export interface TicketsNavItem {
  id: number;
  label: string;
  path: string;
  icon: LucideIcon;
  orden: number;
}

const ROUTE_ICON: Record<string, LucideIcon> = {
  "/admin/portal-tickets/todos": Inbox,
  "/admin/portal-tickets/mis-tickets": UserCheck,
  "/admin/portal-tickets/sin-asignar": UserX,
  "/admin/portal-tickets/pipeline": Columns3,
  "/admin/portal-tickets/configuracion/pipelines": GitBranch,
  "/admin/portal-tickets/configuracion/etapas": ListOrdered,
  "/admin/portal-tickets/configuracion/categorias": Tags,
  "/admin/portal-tickets/configuracion/prioridades": Flag,
  "/admin/portal-tickets/configuracion/equipo": Users,
};

/**
 * Nav del Portal Tickets leído 100% desde BD (menus/submenus) y filtrado por los
 * permisos del rol (`useAllowedMenus`). No hay items hardcodeados: si un submenú
 * no existe, está apagado o el rol no tiene permiso de lectura, no se muestra.
 */
export function usePortalTicketsNav() {
  const { isPathAllowed, isLoading } = useAllowedMenus();

  const { data } = useQuery<TicketsNavItem[]>({
    queryKey: ["portal-tickets-nav"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("submenus")
        .select("id, nombre, vista_front_end, orden, menus!inner(nombre, activo)")
        .eq("menus.nombre", PORTAL_TICKETS_MENU)
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
        icon: ROUTE_ICON[s.vista_front_end as string] ?? TicketIcon,
      }));
    },
    staleTime: 5 * 60_000,
  });

  const items = useMemo(
    () => (data ?? []).filter((i) => isPathAllowed(i.path)),
    [data, isPathAllowed],
  );

  const grupos = useMemo(() => {
    const tickets = items.filter((i) => !i.path.includes("/configuracion/"));
    const config = items.filter((i) => i.path.includes("/configuracion/"));
    return [
      { label: "Tickets", items: tickets },
      { label: "Configuración", items: config },
    ].filter((g) => g.items.length > 0);
  }, [items]);

  return { items, grupos, isLoading };
}