import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Directorio de Personal — administración de recurso humano del Portal Estructura
 * de Comisiones, en tres pasos:
 *
 *   1. Alta / baja / modificación de la PERSONA        → `personal_organizacional`
 *   2. Vinculación de la persona con un ROL            → `personal_organizacional.id_rol`
 *      sobre el catálogo `roles_organizacionales`
 *   3. Vinculación con los PROYECTOS que atiende       → `personal_proyectos`
 *
 * La compensación es atributo de la persona; el costo por proyecto se deriva del
 * `asignacion_pct` de cada vinculación.
 *
 * Este catálogo es independiente del catálogo `roles` / `usuarios.rol_id` de
 * autenticación y permisos, y también del simulador abstracto de "Puestos y Sueldos"
 * (`SimulatorContext` / localStorage), que sigue funcionando igual.
 *
 * Probe graceful: si las tablas aún no existen (DDL pendiente, ver
 * `Ejecuciones_manuales/20260809_directorio_personal_rrhh.md`), las consultas devuelven
 * `[]` y `useDirectorioSchemaReady()` reporta `false` para que la UI avise en vez de
 * romperse.
 */

export type RoleType = "strategic" | "operative" | "support";
export type RoleBelongsTo = "sozu_central" | "project";

export interface RolOrganizacional {
  id: number;
  nombre: string;
  tipo: RoleType;
  pertenece_a: RoleBelongsTo;
  participa_comision: boolean;
  /** Para qué existe el rol: el resultado que debe producir. */
  objetivo: string | null;
  /** Actividades concretas y responsabilidades. */
  descripcion_labores: string | null;
  activo: boolean;
}

/**
 * Perfil del personal. Solo el empleado directo representa costo para SOZU:
 * el colaborador del Grupo Investimento da servicio y soporte (administrativo,
 * fiscal, financiero, legal) y su sueldo lo paga Investimento. Ambos pueden
 * comisionar — al colaborador la comisión le llega como bono por ese soporte.
 */
export type TipoPersonal = "empleado_sozu" | "colaborador_investimento";

export const ETIQUETA_TIPO_PERSONAL: Record<TipoPersonal, string> = {
  empleado_sozu: "Empleado SOZU",
  colaborador_investimento: "Colaborador Investimento",
};

/** Solo el costo de los empleados directos es costo fijo de SOZU. */
export const esCostoDeSozu = (p: Pick<PersonalOrganizacional, "tipo_personal">) =>
  p.tipo_personal === "empleado_sozu";

export interface PersonalOrganizacional {
  id: number;
  nombre: string;
  tipo_personal: TipoPersonal;
  email_usuario: string | null;
  email_contacto: string | null;
  telefono: string | null;
  id_rol: number | null;
  /** Parte del costo que va en nómina formal. */
  costo_nominal: number;
  /** Parte pagada fuera de nómina (asimilados, honorarios, facturación). */
  costo_externo: number;
  /** Cargas patronales: IMSS, INFONAVIT, SAR, impuesto sobre nómina. */
  costo_social: number;
  /** Columna generada en BD = nominal + externo + social. Solo lectura. */
  costo_total: number;
  /** Neto que recibe la persona. Capturado; `null` = aún no capturado. */
  sueldo_base_recibido: number | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  motivo_baja: string | null;
  activo: boolean;
}

export interface AsignacionProyecto {
  id: number;
  id_personal: number;
  id_proyecto: number;
  /**
   * Rol que la persona asume **en este proyecto**. `null` = asume su rol base
   * (`PersonalOrganizacional.id_rol`). Permite roles distintos por desarrollo.
   */
  id_rol: number | null;
  asignacion_pct: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
}

/**
 * Regla de resolución del rol, única en todo el sistema: manda el rol del
 * proyecto y, si no hay, el rol base de la persona.
 */
export function rolEfectivo(
  persona: Pick<PersonalOrganizacional, "id_rol">,
  asignacion?: Pick<AsignacionProyecto, "id_rol"> | null,
): number | null {
  return asignacion?.id_rol ?? persona.id_rol;
}

/**
 * La columna existe en el código pero no en la BD: falta ejecutar el DDL.
 * `42703` lo devuelve Postgres; `PGRST204`, PostgREST desde su schema cache.
 */
const COLUMN_MISSING_CODES = ["42703", "PGRST204"];

const ROLES_KEY = "roles-organizacionales";
const PERSONAL_KEY = "personal-organizacional";
const ASIGNACIONES_KEY = "personal-proyectos";
const SCHEMA_KEY = "directorio-personal-schema";

const PERSONAL_COLS_BASE =
  "id, nombre, email_usuario, email_contacto, telefono, id_rol, costo_nominal, " +
  "costo_externo, costo_social, costo_total, sueldo_base_recibido, fecha_ingreso, " +
  "fecha_baja, motivo_baja, activo";

const PERSONAL_COLS = `${PERSONAL_COLS_BASE}, tipo_personal`;

const ASIGNACION_COLS =
  "id, id_personal, id_proyecto, id_rol, asignacion_pct, fecha_inicio, fecha_fin, activo";

/**
 * Costo real total de la persona para la empresa.
 *
 * En BD `costo_total` es una columna generada, así que basta leerla. Esta función
 * existe para calcular el total en formularios, donde el usuario aún está tecleando
 * las partes y no hay fila que consultar.
 */
export function costoTotal(p: Pick<PersonalOrganizacional, "costo_nominal" | "costo_externo" | "costo_social">): number {
  return Number(p.costo_nominal) + Number(p.costo_externo) + Number(p.costo_social);
}

/** ¿Ya existe el esquema RRHH en la BD? (patrón DDL probe de CLAUDE.md) */
export function useDirectorioSchemaReady() {
  return useQuery<boolean>({
    queryKey: [SCHEMA_KEY],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const probe = await (supabase as any).from("personal_organizacional").select("id").limit(0);
      return !probe.error;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Catálogo de roles de la empresa                                     */
/* ------------------------------------------------------------------ */

const ROL_COLS =
  "id, nombre, tipo, pertenece_a, participa_comision, objetivo, descripcion_labores, activo";

/** Catálogo de roles. `incluirInactivos` trae también los dados de baja. */
export function useRolesOrganizacionales(incluirInactivos = false) {
  return useQuery<RolOrganizacional[]>({
    queryKey: [ROLES_KEY, incluirInactivos],
    staleTime: 30_000,
    queryFn: async () => {
      let query = (supabase as any)
        .from("roles_organizacionales")
        .select(ROL_COLS)
        .order("nombre");
      if (!incluirInactivos) query = query.eq("activo", true);
      const { data, error } = await query;
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
  objetivo?: string | null;
  descripcion_labores?: string | null;
}

/** Traduce la violación del índice único de nombre a un mensaje entendible. */
function traducirErrorRol(error: { code?: string; message?: string }, nombre: string): Error {
  if (error.code === "23505") {
    return new Error(`Ya existe un rol activo llamado "${nombre}".`);
  }
  if (error.code === "23514") {
    return new Error("El nombre del rol no puede estar vacío.");
  }
  return new Error(error.message ?? "No se pudo guardar el rol");
}

export function useCrearRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoRolInput) => {
      const { error } = await (supabase as any).from("roles_organizacionales").insert(input);
      if (error) throw traducirErrorRol(error, input.nombre);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useActualizarRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NuevoRolInput> & { id: number }) => {
      const { id, ...rest } = input;
      const { error } = await (supabase as any)
        .from("roles_organizacionales")
        .update(rest)
        .eq("id", id);
      if (error) throw traducirErrorRol(error, rest.nombre ?? "");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useDesactivarRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // Un rol en uso no puede darse de baja: primero se reasigna al personal.
      // Hay que mirar las DOS formas de uso — si solo se contara el rol base,
      // un rol usado únicamente como override por proyecto podría darse de baja
      // y dejar vinculaciones apuntando a un rol inactivo.
      // Si las tablas aún no existen (DDL pendiente) no hay nada que proteger.
      const [base, override] = await Promise.all([
        (supabase as any)
          .from("personal_organizacional")
          .select("id", { count: "exact", head: true })
          .eq("id_rol", id)
          .eq("activo", true),
        (supabase as any)
          .from("personal_proyectos")
          .select("id", { count: "exact", head: true })
          .eq("id_rol", id)
          .eq("activo", true),
      ]);

      const usosBase = base.error ? 0 : base.count ?? 0;
      const usosOverride = override.error ? 0 : override.count ?? 0;

      if (usosBase > 0 || usosOverride > 0) {
        const partes = [
          usosBase > 0 ? `${usosBase} persona(s) con este rol base` : null,
          usosOverride > 0 ? `${usosOverride} asignación(es) a proyecto con este rol` : null,
        ].filter(Boolean).join(' y ');
        throw new Error(`El rol está en uso: ${partes}. Reasígnalos antes de darlo de baja.`);
      }
      const { error } = await (supabase as any)
        .from("roles_organizacionales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useReactivarRolOrganizacional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: number; nombre: string }) => {
      const { error } = await (supabase as any)
        .from("roles_organizacionales")
        .update({ activo: true })
        .eq("id", id);
      // El índice único es parcial sobre activos: reactivar puede chocar con
      // un rol creado con el mismo nombre mientras este estaba de baja.
      if (error) throw traducirErrorRol(error, nombre);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

/* ------------------------------------------------------------------ */
/* Paso 1 — Personal: alta, baja y modificación                        */
/* ------------------------------------------------------------------ */

/** Personal de la organización. `incluirBajas` agrega a quienes ya no están activos. */
export function usePersonal(incluirBajas = false) {
  return useQuery<PersonalOrganizacional[]>({
    queryKey: [PERSONAL_KEY, incluirBajas],
    staleTime: 30_000,
    queryFn: async () => {
      const consultar = (cols: string) => {
        let q = (supabase as any).from("personal_organizacional").select(cols).order("nombre");
        if (!incluirBajas) q = q.eq("activo", true);
        return q;
      };

      const { data, error } = await consultar(PERSONAL_COLS);
      if (!error && data) return data as PersonalOrganizacional[];

      // Sin `tipo_personal` (DDL pendiente) se relee sin ella y todos se tratan
      // como empleados de SOZU: el costo fijo queda igual que antes.
      if (!error || !COLUMN_MISSING_CODES.includes(error.code)) return [];
      const fallback = await consultar(PERSONAL_COLS_BASE);
      if (fallback.error || !fallback.data) return [];
      return (fallback.data as Omit<PersonalOrganizacional, "tipo_personal">[])
        .map(p => ({ ...p, tipo_personal: "empleado_sozu" as TipoPersonal }));
    },
  });
}

/**
 * Campos escribibles de una persona. `costo_total` queda deliberadamente fuera:
 * es una columna generada y PostgreSQL rechaza escribirla (SQLSTATE 428C9).
 */
export interface NuevaPersonaInput {
  nombre: string;
  tipo_personal?: TipoPersonal;
  email_usuario?: string | null;
  email_contacto?: string | null;
  telefono?: string | null;
  id_rol?: number | null;
  costo_nominal?: number;
  costo_externo?: number;
  costo_social?: number;
  sueldo_base_recibido?: number | null;
  fecha_ingreso?: string | null;
}

/** Alta de persona. `proyectos` la vincula de una vez con los proyectos que atiende. */
export function useCrearPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyectos = [], ...persona }: NuevaPersonaInput & { proyectos?: number[] }) => {
      const { data, error } = await (supabase as any)
        .from("personal_organizacional")
        .insert(persona)
        .select("id")
        .single();
      if (error) throw error;

      if (proyectos.length > 0) {
        const { error: linkError } = await (supabase as any).from("personal_proyectos").insert(
          proyectos.map(id_proyecto => ({ id_personal: data.id, id_proyecto, asignacion_pct: 100 })),
        );
        if (linkError) throw linkError;
      }
      return data.id as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PERSONAL_KEY] });
      qc.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] });
    },
  });
}

export function useActualizarPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NuevaPersonaInput> & { id: number }) => {
      const { id, ...rest } = input;
      const { error } = await (supabase as any)
        .from("personal_organizacional")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PERSONAL_KEY] }),
  });
}

/** Baja lógica: conserva la ficha y su histórico de costo. */
export function useDarBajaPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fecha_baja, motivo_baja }: { id: number; fecha_baja: string; motivo_baja: string | null }) => {
      const { error } = await (supabase as any)
        .from("personal_organizacional")
        .update({ activo: false, fecha_baja, motivo_baja })
        .eq("id", id);
      if (error) throw error;
      // Sus vinculaciones a proyectos dejan de estar vigentes.
      const { error: linkError } = await (supabase as any)
        .from("personal_proyectos")
        .update({ activo: false, fecha_fin: fecha_baja })
        .eq("id_personal", id)
        .eq("activo", true);
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PERSONAL_KEY] });
      qc.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] });
    },
  });
}

export function useReactivarPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("personal_organizacional")
        .update({ activo: true, fecha_baja: null, motivo_baja: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PERSONAL_KEY] }),
  });
}

/* ------------------------------------------------------------------ */
/* Paso 3 — Vinculación con proyectos                                  */
/* ------------------------------------------------------------------ */

export function useAsignacionesProyecto() {
  return useQuery<AsignacionProyecto[]>({
    queryKey: [ASIGNACIONES_KEY],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("personal_proyectos")
        .select(ASIGNACION_COLS)
        .eq("activo", true);
      if (!error && data) return data as AsignacionProyecto[];

      // Sin la columna `id_rol` (DDL del rol por proyecto pendiente) se relee
      // sin ella: todos resuelven a su rol base, como antes.
      const fallback = await (supabase as any)
        .from("personal_proyectos")
        .select("id, id_personal, id_proyecto, asignacion_pct, fecha_inicio, fecha_fin, activo")
        .eq("activo", true);
      if (fallback.error || !fallback.data) return [];
      return (fallback.data as Omit<AsignacionProyecto, "id_rol">[]).map(a => ({ ...a, id_rol: null }));
    },
  });
}

export function useVincularProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_personal, id_proyecto, asignacion_pct = 100 }: {
      id_personal: number;
      id_proyecto: number;
      asignacion_pct?: number;
    }) => {
      // Reutiliza la vinculación previa si la persona ya había atendido el proyecto.
      const { data: previa, error: findError } = await (supabase as any)
        .from("personal_proyectos")
        .select("id")
        .eq("id_personal", id_personal)
        .eq("id_proyecto", id_proyecto)
        .eq("activo", false)
        .limit(1);
      if (findError) throw findError;

      if (previa && previa.length > 0) {
        const { error } = await (supabase as any)
          .from("personal_proyectos")
          .update({ activo: true, fecha_fin: null, asignacion_pct })
          .eq("id", previa[0].id);
        if (error) throw error;
        return;
      }

      const { error } = await (supabase as any)
        .from("personal_proyectos")
        .insert({ id_personal, id_proyecto, asignacion_pct });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] }),
  });
}

export function useDesvincularProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("personal_proyectos")
        .update({ activo: false, fecha_fin: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] }),
  });
}

export function useActualizarAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campos }: { id: number; asignacion_pct?: number; id_rol?: number | null }) => {
      const { error } = await (supabase as any)
        .from("personal_proyectos")
        .update(campos)
        .eq("id", id);
      if (error) {
        if (COLUMN_MISSING_CODES.includes(error.code)) {
          throw new Error(
            'La base de datos aún no tiene la columna de rol por proyecto. ' +
            'Ejecuta el DDL "Rol distinto por proyecto" en Ejecuciones_manuales.',
          );
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] }),
  });
}

/* ------------------------------------------------------------------ */
/* Catálogos de apoyo                                                  */
/* ------------------------------------------------------------------ */

export interface ProyectoActivo {
  id: number;
  nombre: string;
}

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;

/**
 * Proyectos a los que el personal puede dar servicio: los **comercializados por
 * SOZU** — existe una `entidades_relacionadas` de tipo 5 apuntando al proyecto —
 * y activos. Misma definición que `usePortalAltaDireccion/proyectosSozu.ts`.
 *
 * Waterfall explícito en dos pasos (patrón #1 de CLAUDE.md): el triple join de
 * PostgREST falla en silencio.
 */
export function useProyectosActivosDirectorio() {
  return useQuery<ProyectoActivo[]>({
    queryKey: ["proyectos-sozu-directorio"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rels, error: relError } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
        .eq("activo", true)
        .not("id_proyecto", "is", null);
      if (relError || !rels?.length) return [];

      const ids = Array.from(new Set(rels.map(r => r.id_proyecto as number)));

      const { data, error } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .in("id", ids)
        .eq("activo", true)
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
