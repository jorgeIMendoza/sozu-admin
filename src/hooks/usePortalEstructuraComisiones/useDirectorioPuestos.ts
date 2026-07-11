import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Directorio de Personal — catálogo real de roles de empresa (Director, Asesor,
 * etc., tabla `roles_organizacionales`) y de los puestos ocupados por usuarios
 * reales (`puestos_organizacionales`), independiente del catálogo `roles` /
 * `usuarios.rol_id` de autenticación y permisos, y también independiente del
 * simulador abstracto de "Roles y Sueldos" (`SimulatorContext`/`localStorage`),
 * que sigue funcionando igual.
 *
 * Probe graceful: si las tablas aún no existen (DDL pendiente, ver
 * `Ejecuciones_manuales/directorio_personal_estructura_comisiones.md`), las
 * consultas devuelven `[]` en vez de romper la UI.
 */

export type RoleType = "strategic" | "operative" | "support";
export type RoleBelongsTo = "sozu_central" | "project";

export interface RolOrganizacional {
  id: number;
  nombre: string;
  tipo: RoleType;
  pertenece_a: RoleBelongsTo;
  participa_comision: boolean;
  activo: boolean;
}

export interface PuestoOrganizacional {
  id: number;
  id_rol: number;
  id_proyecto: number | null;
  email_usuario: string | null;
  nombre_ocupante: string | null;
  sueldo_base: number;
  bono_fijo: number;
  prestaciones_pct: number;
  fecha_inicio: string | null;
  activo: boolean;
}

const ROLES_KEY = "roles-organizacionales";
const PUESTOS_KEY = "puestos-organizacionales";

export function useRolesOrganizacionales() {
  return useQuery<RolOrganizacional[]>({
    queryKey: [ROLES_KEY],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("roles_organizacionales")
        .select("id, nombre, tipo, pertenece_a, participa_comision, activo")
        .eq("activo", true)
        .order("nombre");
      if (error || !data) return [];
      return data as RolOrganizacional[];
    },
  });
}

export interface NuevoRolInput {
  nombre: string;
  tipo: RoleType;
  pertenece_a: RoleBelongsTo;
  participa_comision: boolean;
}

export function useCrearRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoRolInput) => {
      const { error } = await (supabase as any).from("roles_organizacionales").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useDesactivarRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("roles_organizacionales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

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
