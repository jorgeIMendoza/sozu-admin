import { supabase } from "@/integrations/supabase/client";

/**
 * Proyectos que aceptan citas.
 *
 * Regla: solo un proyecto activo (`activo = true`) y publicado (`publicar = true`)
 * ofrece horarios. Un desarrollo dado de baja o despublicado deja de aparecer al
 * agendar aunque su configuración de cita siga viva en
 * `configuracion_citas_usuarios` (segundo check: `activo` de la configuración).
 */
export async function fetchProyectosConCitasHabilitadas(ids: number[]): Promise<Set<number>> {
  const unicos = [...new Set(ids)].filter((id) => Number.isFinite(id));
  if (unicos.length === 0) return new Set();

  const { data, error } = await supabase
    .from("proyectos")
    .select("id")
    .in("id", unicos)
    .eq("activo", true)
    .eq("publicar", true);

  if (error) throw error;
  return new Set((data || []).map((p: any) => p.id as number));
}
