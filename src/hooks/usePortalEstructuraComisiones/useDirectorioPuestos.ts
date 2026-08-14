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
  /**
   * Plaza presupuestada sin ocupante. Tiene rol, proyectos y costo, y participa
   * en la estructura de comisiones; solo le falta la persona.
   */
  es_vacante: boolean;
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

const PERSONAL_COLS = `${PERSONAL_COLS_BASE}, tipo_personal, es_vacante`;

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

/**
 * ¿Existe ya la columna `es_vacante`?
 *
 * Se prueba aparte del resto del esquema porque llegó después: sin ella todas
 * las filas se leen como plazas ocupadas y la UI debe avisar del DDL pendiente
 * en lugar de ofrecer un alta de vacante que no guardaría la condición.
 * Ver `Ejecuciones_manuales/20260814_vacantes_en_roles_y_sueldos.md`.
 */
export function useVacantesSchemaReady() {
  return useQuery<boolean>({
    queryKey: ["directorio-vacantes-schema"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const probe = await (supabase as any)
        .from("personal_organizacional")
        .select("es_vacante")
        .limit(0);
      return !probe.error;
    },
  });
}

/** Una vacante es una plaza vigente sin ocupante. */
export const esVacante = (p: Pick<PersonalOrganizacional, "es_vacante" | "activo">) =>
  p.es_vacante && p.activo;

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
      if (!error || !COLUMN_MISSING_CODES.includes(error.code)) return [];

      // Sin `es_vacante` (DDL pendiente) se relee sin ella: todas las filas se
      // tratan como plazas ocupadas, que es el comportamiento previo.
      const sinVacante = await consultar(`${PERSONAL_COLS_BASE}, tipo_personal`);
      if (!sinVacante.error && sinVacante.data) {
        return (sinVacante.data as Omit<PersonalOrganizacional, "es_vacante">[])
          .map(p => ({ ...p, es_vacante: false }));
      }

      // Sin `tipo_personal` tampoco: todos como empleados de SOZU, igual que antes.
      const fallback = await consultar(PERSONAL_COLS_BASE);
      if (fallback.error || !fallback.data) return [];
      return (fallback.data as Omit<PersonalOrganizacional, "tipo_personal" | "es_vacante">[])
        .map(p => ({ ...p, tipo_personal: "empleado_sozu" as TipoPersonal, es_vacante: false }));
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
  es_vacante?: boolean;
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
  /** Llave primaria de `usuarios`. */
  email: string;
  nombre: string;
  /** Rol de acceso al sistema. Un usuario tiene exactamente uno. */
  rol_id: number | null;
  rol_nombre: string | null;
  /** `usuarios.id_persona` → `personas.id`. Muchas cuentas internas no lo tienen. */
  id_persona: number | null;
}

/**
 * Busca cuentas del sistema por nombre o email.
 *
 * Waterfall en dos pasos (patrón #1 de CLAUDE.md): primero las cuentas, después
 * el nombre de su rol. El embed de PostgREST sobre `roles` falla en silencio y
 * dejaría la columna del rol vacía sin ningún error visible.
 */
export function useBuscarUsuarios(search: string) {
  return useQuery<UsuarioBusqueda[]>({
    queryKey: ["directorio-buscar-usuarios", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("email, nombre, rol_id, id_persona")
        .eq("activo", true)
        .or(`email.ilike.%${search}%,nombre.ilike.%${search}%`)
        .order("nombre")
        .limit(10);
      if (error || !data) return [];

      const nombrePorRol = await nombresDeRolesSistema(
        data.map(u => u.rol_id as number | null),
      );

      return data.map(u => ({
        email: u.email as string,
        nombre: u.nombre as string,
        rol_id: (u.rol_id as number | null) ?? null,
        rol_nombre: u.rol_id != null ? nombrePorRol.get(u.rol_id as number) ?? null : null,
        id_persona: (u.id_persona as number | null) ?? null,
      }));
    },
  });
}

/** Nombres del catálogo `roles` (acceso al sistema) para los ids dados. */
async function nombresDeRolesSistema(ids: Array<number | null>): Promise<Map<number, string>> {
  const unicos = Array.from(new Set(ids.filter((id): id is number => id != null)));
  if (!unicos.length) return new Map();

  const { data, error } = await supabase.from("roles").select("id, nombre").in("id", unicos);
  if (error || !data) return new Map();
  return new Map(data.map(r => [r.id as number, r.nombre as string]));
}

/**
 * Datos de la persona detrás de una cuenta del sistema.
 *
 * Son de `personas`, la tabla central del sistema: aquí se leen, no se editan.
 * Cualquier corrección se hace en el expediente de la persona, no en RRHH.
 */
export interface PersonaVinculada {
  id: number;
  /** `pf` = persona física, `pm` = moral. */
  tipo_persona: string;
  nombre_legal: string;
  nombre_comercial: string | null;
  email: string | null;
  telefono: string | null;
  clave_pais_telefono: string | null;
  rfc: string | null;
  curp: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  ocupacion: string | null;
  regimen: string | null;
}

export interface CuentaSistema {
  email: string;
  nombre: string;
  telefono: string | null;
  /** Rol de acceso: uno solo, definido en `usuarios.rol_id`. */
  rol: { id: number; nombre: string } | null;
  /**
   * `null` cuando la cuenta no tiene `id_persona`, o cuando lo tiene pero la
   * fila de `personas` no está accesible. Se distingue con `motivoSinPersona`.
   */
  persona: PersonaVinculada | null;
  motivoSinPersona: "sin_vinculo" | "no_encontrada" | null;
}

const PERSONA_COLS =
  "id, tipo_persona, nombre_legal, nombre_comercial, email, telefono, " +
  "clave_pais_telefono, rfc, curp, fecha_nacimiento, sexo, ocupacion, regimen";

/**
 * Resuelve una cuenta del sistema y la persona que hay detrás.
 *
 * Cadena `usuarios.email` → `usuarios.id_persona` → `personas.id`, en waterfall
 * explícito. Se consulta por separado porque el join anidado de PostgREST sobre
 * dos niveles devuelve `null` sin error y aquí eso se leería como "esta persona
 * no tiene expediente", que es una conclusión distinta y falsa.
 *
 * Ojo con el caso vacío: hoy 47 cuentas activas no tienen `id_persona`, y se
 * concentran justamente en los roles internos que este módulo da de alta
 * (dirección, finanzas, cobranza, jurídico). No es una rareza a ignorar.
 */
export function useCuentaSistema(email: string | null) {
  return useQuery<CuentaSistema | null>({
    queryKey: ["directorio-cuenta-sistema", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      if (!email) return null;

      const { data: usuario, error } = await supabase
        .from("usuarios")
        .select("email, nombre, telefono, rol_id, id_persona")
        .eq("email", email)
        .maybeSingle();
      if (error || !usuario) return null;

      const idRol = usuario.rol_id as number | null;
      const idPersona = usuario.id_persona as number | null;

      const [nombrePorRol, persona] = await Promise.all([
        nombresDeRolesSistema([idRol]),
        buscarPersona(idPersona),
      ]);

      return {
        email: usuario.email as string,
        nombre: usuario.nombre as string,
        telefono: (usuario.telefono as string | null) ?? null,
        rol: idRol != null ? { id: idRol, nombre: nombrePorRol.get(idRol) ?? `Rol ${idRol}` } : null,
        persona,
        motivoSinPersona: idPersona == null ? "sin_vinculo" : persona ? null : "no_encontrada",
      };
    },
  });
}

async function buscarPersona(id: number | null): Promise<PersonaVinculada | null> {
  if (id == null) return null;
  const { data, error } = await supabase
    .from("personas")
    .select(PERSONA_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as PersonaVinculada;
}

/* ------------------------------------------------------------------ */
/* Roles base adicionales — una persona puede tener más de uno         */
/* ------------------------------------------------------------------ */

/**
 * Rol base **adicional** de una persona.
 *
 * El rol principal sigue viviendo en `personal_organizacional.id_rol` y es el
 * único que rige costo, comisión y organigrama; estos son informativos. Ver
 * `Ejecuciones_manuales/20260812_roles_base_multiples.md`.
 */
export interface RolAdicional {
  id: number;
  id_personal: number;
  id_rol: number;
  activo: boolean;
}

const ROLES_ADICIONALES_KEY = "personal-roles-adicionales";

/**
 * Roles base adicionales de todo el personal.
 *
 * `null` —no `[]`— cuando la tabla aún no existe: son estados distintos y la UI
 * necesita distinguirlos para avisar del DDL pendiente en vez de mostrar un
 * editor vacío que no guarda nada (patrón #6 de CLAUDE.md).
 */
export function useRolesAdicionales() {
  return useQuery<RolAdicional[] | null>({
    queryKey: [ROLES_ADICIONALES_KEY],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("personal_roles")
        .select("id, id_personal, id_rol, activo")
        .eq("activo", true);
      if (error) return null;
      return (data ?? []) as RolAdicional[];
    },
  });
}

/** Reemplaza el juego de roles adicionales de una persona por el que se indique. */
export function useGuardarRolesAdicionales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_personal, roles }: { id_personal: number; roles: number[] }) => {
      const { data: actuales, error: leerError } = await (supabase as any)
        .from("personal_roles")
        .select("id, id_rol")
        .eq("id_personal", id_personal)
        .eq("activo", true);
      if (leerError) throw leerError;

      const vigentes = new Map<number, number>(
        ((actuales ?? []) as Array<{ id: number; id_rol: number }>).map(r => [r.id_rol, r.id]),
      );
      const deseados = new Set(roles);

      const aQuitar = [...vigentes.entries()].filter(([rol]) => !deseados.has(rol)).map(([, id]) => id);
      const aAgregar = roles.filter(rol => !vigentes.has(rol));

      // Baja lógica, no DELETE: conserva el histórico de qué rol tuvo la persona.
      if (aQuitar.length) {
        const { error } = await (supabase as any)
          .from("personal_roles")
          .update({ activo: false, fecha_fin: new Date().toISOString().slice(0, 10) })
          .in("id", aQuitar);
        if (error) throw error;
      }

      if (aAgregar.length) {
        const { error } = await (supabase as any)
          .from("personal_roles")
          .insert(aAgregar.map(id_rol => ({ id_personal, id_rol })));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROLES_ADICIONALES_KEY] }),
  });
}

/** Un rol que la persona ejerce dentro de la empresa, y dónde lo ejerce. */
export interface RolEnLaEmpresa {
  idRol: number;
  nombre: string;
  /** `null` = rol base (principal o adicional); si no, el proyecto donde aplica. */
  idProyecto: number | null;
  proyecto: string | null;
  /** El que rige costo, comisión y organigrama. Solo uno lo es. */
  principal: boolean;
}

/**
 * Roles que la persona tiene **dentro de la empresa**, que pueden ser varios:
 * el principal, los base adicionales y el que asume en cada proyecto donde se le
 * asignó uno distinto. Es lo opuesto al rol del sistema, que siempre es uno.
 *
 * Un proyecto sin rol propio no aparece: ahí rige el rol principal, y listarlo
 * otra vez por proyecto sugeriría una asignación que no existe. Un rol adicional
 * que además sea el rol de algún proyecto tampoco se repite.
 */
export function rolesEnLaEmpresa(
  persona: Pick<PersonalOrganizacional, "id_rol">,
  asignaciones: AsignacionProyecto[],
  roles: RolOrganizacional[],
  nombreProyecto: (id: number) => string,
  rolesBaseAdicionales: number[] = [],
): RolEnLaEmpresa[] {
  const nombreRol = new Map(roles.map(r => [r.id, r.nombre]));
  const nombreDe = (id: number) => nombreRol.get(id) ?? `Rol ${id}`;
  const salida: RolEnLaEmpresa[] = [];

  if (persona.id_rol != null) {
    salida.push({
      idRol: persona.id_rol,
      nombre: nombreDe(persona.id_rol),
      idProyecto: null,
      proyecto: null,
      principal: true,
    });
  }

  for (const idRol of rolesBaseAdicionales) {
    if (idRol === persona.id_rol) continue;
    salida.push({ idRol, nombre: nombreDe(idRol), idProyecto: null, proyecto: null, principal: false });
  }

  for (const a of asignaciones) {
    if (!a.activo || a.id_rol == null || a.id_rol === persona.id_rol) continue;
    salida.push({
      idRol: a.id_rol,
      nombre: nombreDe(a.id_rol),
      idProyecto: a.id_proyecto,
      proyecto: nombreProyecto(a.id_proyecto),
      principal: false,
    });
  }

  return salida;
}
