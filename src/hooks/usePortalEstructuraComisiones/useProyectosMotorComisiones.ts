import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Catálogo de proyectos que configura el Motor de Comisiones — no es la lista
 * completa de `proyectos` ni el catálogo mock del tab "Proyectos": son los
 * desarrollos reales cuyo dueño (`entidades_relacionadas.id_tipo_entidad = 4`,
 * "Dueño Vendedor") es Tallwood o Hevi Holding. Cualquier desarrollo nuevo que
 * se dé de alta con el mismo dueño aparece aquí automáticamente, sin tocar código.
 *
 * Se excluyen los "proyectos" catálogo interno (Productos/Servicios,
 * `id_tipo_uso` 9/10) que comparten dueño pero no son desarrollos reales.
 */

export interface ProyectoMotor {
  id: number;
  nombre: string;
}

const PROPIETARIOS = ["Tallwood", "Hevi Holding"];
const TIPO_ENTIDAD_DUENO_VENDEDOR = 4;
const TIPOS_USO_EXCLUIDOS = [9, 10]; // Productos, Servicios — no son desarrollos

export function useProyectosMotorComisiones() {
  return useQuery({
    queryKey: ["proyectos-motor-comisiones"],
    staleTime: 5 * 60_000,
    queryFn: fetchProyectosMotorComisiones,
  });
}

async function fetchProyectosMotorComisiones(): Promise<ProyectoMotor[]> {
  const { data: personas, error: pErr } = await supabase
    .from("personas")
    .select("id")
    .in("nombre_legal", PROPIETARIOS)
    .eq("activo", true);
  if (pErr || !personas?.length) return [];

  const { data: entidades, error: eErr } = await supabase
    .from("entidades_relacionadas")
    .select("id_proyecto")
    .in("id_persona", personas.map((p) => p.id))
    .eq("id_tipo_entidad", TIPO_ENTIDAD_DUENO_VENDEDOR)
    .eq("activo", true)
    .not("id_proyecto", "is", null);
  if (eErr || !entidades?.length) return [];

  const proyectoIds = Array.from(new Set(entidades.map((e) => e.id_proyecto as number)));

  const { data: proyectos, error: prErr } = await supabase
    .from("proyectos")
    .select("id, nombre, id_tipo_uso")
    .in("id", proyectoIds)
    .eq("activo", true)
    .order("nombre");
  if (prErr || !proyectos) return [];

  return proyectos
    .filter((p) => !TIPOS_USO_EXCLUIDOS.includes(p.id_tipo_uso as number))
    .map((p) => ({ id: p.id as number, nombre: p.nombre as string }));
}
