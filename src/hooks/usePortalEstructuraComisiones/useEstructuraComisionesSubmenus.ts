import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EC_MENU_ID = 35;

export interface EstructuraComisionesSubmenu {
  id: number;
  nombre: string;
  vista_front_end: string;
  orden: number;
}

/** Submenus reales del Portal Operación Comercial e Incentivos (menu_id=35), para armar el sidebar desde BD en vez de un array hardcodeado. */
export function useEstructuraComisionesSubmenus() {
  return useQuery<EstructuraComisionesSubmenu[]>({
    queryKey: ["estructura-comisiones-submenus", EC_MENU_ID],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("submenus")
        .select("id, nombre, vista_front_end, orden")
        .eq("menu_id", EC_MENU_ID)
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as EstructuraComisionesSubmenu[];
    },
  });
}
