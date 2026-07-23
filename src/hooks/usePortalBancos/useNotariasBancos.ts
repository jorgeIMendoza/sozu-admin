import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Notarías con las que SOZU trabaja, para el directorio del Portal Bancos.
 *
 * Lee `public.notarios` filtrando `activo = true` y `trabaja_con_sozu = true`
 * (las "habilitadas SOZU" activas del Dashboard de Notarías de Escrituración).
 * Solo datos de contacto (lectura). En error/vacío devuelve `[]`.
 */

export interface NotariaContacto {
  id: number;
  /** Nombre de la notaría, p.ej. "Notaría 51, Guadalajara". */
  notaria: string;
  /** Titular / persona de contacto. */
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
}

export function useNotariasBancos() {
  return useQuery({
    queryKey: ["notarias-bancos"],
    queryFn: async (): Promise<NotariaContacto[]> => {
      const { data, error } = await (supabase as any)
        .from("notarios")
        .select("id, notaria, nombre, email, telefono, direccion")
        .eq("activo", true)
        .eq("trabaja_con_sozu", true)
        .order("notaria", { ascending: true });
      if (error || !data) return [];
      return data as NotariaContacto[];
    },
    staleTime: 5 * 60_000,
  });
}
