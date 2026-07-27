import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Proyectos ACTIVOS comercializados por SOZU.
 *
 * "Comercializado por SOZU" = existe una `entidades_relacionadas` con
 * `id_tipo_entidad = 5` (SOZU) apuntando al proyecto. "Activo" =
 * `proyectos.activo = true`.
 *
 * Devuelve el set de `id` de proyecto que cumplen ambas condiciones, para
 * restringir los resúmenes del Dashboard General a ese universo.
 */

const TIPO_ENTIDAD_SOZU = 5;

export async function fetchProyectosSozuIds(): Promise<Set<number>> {
  // 1) Proyectos asignados a SOZU (relación tipo 5).
  const { data: rels, error: relErr } = (await (supabase as any)
    .from("entidades_relacionadas")
    .select("id_proyecto")
    .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
    .eq("activo", true)
    .not("id_proyecto", "is", null)) as any;
  if (relErr) throw relErr;
  const projIds = Array.from(
    new Set(((rels || []) as Array<any>).map((r) => r.id_proyecto as number)),
  );
  if (projIds.length === 0) return new Set<number>();

  // 2) Conservar sólo los proyectos activos.
  const { data: projs, error: projErr } = (await (supabase as any)
    .from("proyectos")
    .select("id")
    .in("id", projIds)
    .eq("activo", true)) as any;
  if (projErr) throw projErr;
  return new Set<number>(((projs || []) as Array<any>).map((p) => p.id as number));
}

export function useProyectosSozuIds() {
  return useQuery<Set<number>>({
    queryKey: ["proyectos-sozu-ids"],
    staleTime: 10 * 60_000,
    queryFn: fetchProyectosSozuIds,
  });
}
