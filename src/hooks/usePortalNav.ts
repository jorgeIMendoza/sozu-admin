import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/**
 * Nav de un portal leído desde la BD (fuente de verdad).
 *
 * Lee `submenus` filtrando por `menu_id` + `activo`, ordenado por `orden`, y mapea
 * cada submenu a un item de navegación. El ícono no vive en BD: se resuelve por ruta
 * vía `iconMap`, con `fallbackIcon` para rutas no mapeadas.
 *
 * En error o resultado vacío devuelve `[]` (nav vacío, nunca tabs obsoletos):
 * si la BD falla, el portal no debe mostrar navegación desactualizada.
 *
 * Nota: `submenus` es una tabla chica (cientos de filas) → no requiere `.range()`.
 * El límite de 1000 de PostgREST sólo afecta a `submenus_permisos*`.
 */
export function usePortalNav(
  menuId: number,
  iconMap: Record<string, LucideIcon>,
  fallbackIcon: LucideIcon,
): PortalNavItem[] {
  const { data } = useQuery({
    queryKey: ["portal-nav", menuId],
    queryFn: async () => {
      // menus!inner: un menú padre apagado (menus.activo=false) apaga
      // también todos sus submenús aunque estos sigan activo=true.
      const { data, error } = await (supabase as any)
        .from("submenus")
        .select("nombre, vista_front_end, orden, menus!inner(activo)")
        .eq("menu_id", menuId)
        .eq("activo", true)
        .eq("menus.activo", true)
        .not("vista_front_end", "is", null)
        .order("orden");
      if (error || !data) return [];
      return (data as any[]).map((s) => ({
        path: s.vista_front_end as string,
        label: s.nombre as string,
        icon: iconMap[s.vista_front_end as string] ?? fallbackIcon,
      }));
    },
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}
