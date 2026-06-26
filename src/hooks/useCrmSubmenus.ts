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
        .select("id, nombre, vista_front_end, orden")
        .eq("menu_id", CRM_MENU_ID)
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as CrmSubmenu[];
    },
  });
}
