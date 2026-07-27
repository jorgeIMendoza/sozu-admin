import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CRM_MENU_ID = 31;

export interface CrmSubmenu {
  id: number;
  nombre: string;
  vista_front_end: string;
  orden: number;
}

export function useCrmSubmenus() {
  return useQuery<CrmSubmenu[]>({
    queryKey: ["crm-submenus", CRM_MENU_ID],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("submenus")
        // `menus!inner(activo)`: si se apaga el menú padre, se apagan sus vistas
        // aunque el submenú siga activo=true.
        .select("id, nombre, vista_front_end, orden, menus!inner(activo)")
        .eq("menu_id", CRM_MENU_ID)
        .eq("activo", true)
        .eq("menus.activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as CrmSubmenu[];
    },
  });
}
