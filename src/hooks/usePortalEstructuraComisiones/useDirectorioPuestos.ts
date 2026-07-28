import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Directorio de Personal — puestos ocupados por usuarios reales
 * (`puestos_organizacionales`): quién ocupa cada puesto, en qué proyecto real
 * y con qué sueldo. Independiente del catálogo `roles` / `usuarios.rol_id` de
 * autenticación y permisos.
 *
 * El catálogo de ROLES (qué puestos existen: nombre, tipo, a qué pertenecen,
 * si participa en comisión) ya no vive aquí — se toma directo de "Puestos y
 * Sueldos" (`useSimulator().roles`, `SimulatorContext`/`localStorage`), la
 * misma fuente que ya usa el Motor de Comisiones y el Organigrama, en vez de
 * mantener un catálogo separado y duplicado en `roles_organizacionales`.
 * `puestos_organizacionales.id_rol` es `text` (id de ese catálogo local), sin
 * FK — mismo patrón ya usado en `comisiones_reglas.id_rol`.
 *
 * Probe graceful: si la tabla aún no existe (DDL pendiente, ver
 * `Ejecuciones_manuales/directorio_personal_estructura_comisiones.md`), las
 * consultas devuelven `[]` en vez de romper la UI.
 */

export interface PuestoOrganizacional {
  id: number;
  id_rol: string;
  id_proyecto: number | null;
  email_usuario: string | null;
  nombre_ocupante: string | null;
  sueldo_base: number;
  bono_fijo: number;
  prestaciones_pct: number;
  fecha_inicio: string | null;
  activo: boolean;
}

const PUESTOS_KEY = "puestos-organizacionales";

export function usePuestosOrganizacionales() {
  return useQuery<PuestoOrganizacional[]>({
    queryKey: [PUESTOS_KEY],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("puestos_organizacionales")
        .select(
          "id, id_rol, id_proyecto, email_usuario, nombre_ocupante, sueldo_base, bono_fijo, prestaciones_pct, fecha_inicio, activo",
        )
        .eq("activo", true)
        .order("fecha_creacion");
      if (error || !data) return [];
      return data as PuestoOrganizacional[];
    },
  });
}

export type NuevoPuestoInput = Omit<PuestoOrganizacional, "id" | "activo">;

export function useCrearPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoPuestoInput) => {
      const { error } = await (supabase as any).from("puestos_organizacionales").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PUESTOS_KEY] }),
  });
}

export function useActualizarPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NuevoPuestoInput> & { id: number }) => {
      const { id, ...rest } = input;
      const { error } = await (supabase as any).from("puestos_organizacionales").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PUESTOS_KEY] }),
  });
}

export function useEliminarPuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("puestos_organizacionales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PUESTOS_KEY] }),
  });
}

export interface ProyectoActivo {
  id: number;
  nombre: string;
}

/** Proyectos activos y publicados, para agrupar el directorio por proyecto. */
export function useProyectosActivosDirectorio() {
  return useQuery<ProyectoActivo[]>({
    queryKey: ["proyectos-activos-directorio"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true)
        .eq("publicar", true)
        .order("nombre");
      if (error || !data) return [];
      return data as ProyectoActivo[];
    },
  });
}

export interface UsuarioBusqueda {
  email: string;
  nombre: string;
}

/** Busca usuarios reales por nombre/email (mismo patrón que AgenteVendedorDialog). */
export function useBuscarUsuarios(search: string) {
  return useQuery<UsuarioBusqueda[]>({
    queryKey: ["directorio-buscar-usuarios", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("email, nombre")
        .eq("activo", true)
        .or(`email.ilike.%${search}%,nombre.ilike.%${search}%`)
        .order("nombre")
        .limit(10);
      if (error || !data) return [];
      return data as UsuarioBusqueda[];
    },
  });
}
