import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Project, Role, RoleAssignment } from "@/lib/portal-estructura-comisiones/types/simulator";

/**
 * Puente entre el Directorio real de personal ("Roles y Sueldos") y el simulador.
 *
 * Antes había dos capturas de la misma estructura: `personal_organizacional`
 * (real, en BD) y los `roleAssignments` del simulador (tecleados aparte en el
 * menú "Puestos y Sueldos" y guardados en localStorage). Se unificaron: la
 * captura real es la única fuente, y de ella se **derivan** los
 * `roleAssignments` que consumen Organigrama, Escenarios, Financieros, etc.
 *
 * El puente es por **nombre**, no por id, porque los ids del simulador
 * (`role-asesor`, `proj-daiku`) están persistidos en `comisiones_reglas.id_rol`
 * y cambiarlos rompería la matriz de comisiones ya capturada.
 *
 * Si el esquema RRHH todavía no existe o aún no hay personal activo, devuelve
 * `null` y el simulador conserva su estructura previa: nada se rompe.
 */

export interface EstructuraRealRaw {
  personal: Array<{
    id: number;
    nombre: string;
    id_rol: number | null;
    costo_nominal: number;
    costo_externo: number;
    costo_social: number;
    /**
     * `colaborador_investimento` = su sueldo lo paga Investimento, no SOZU, así
     * que su costo NO entra en la estructura del simulador. Sigue pudiendo
     * comisionar.
     */
    tipo_personal: string;
  }>;
  /** `id_rol` es el rol que la persona asume en ese proyecto; `null` = su rol base. */
  asignaciones: Array<{
    id_personal: number;
    id_proyecto: number;
    id_rol: number | null;
    asignacion_pct: number;
  }>;
  rolesReales: Array<{
    id: number;
    nombre: string;
    tipo: string;
    pertenece_a: string;
    participa_comision: boolean;
    activo: boolean;
  }>;
  proyectosReales: Array<{ id: number; nombre: string }>;
}

/** Normaliza para comparar nombres: sin acentos, sin espacios extra, en minúsculas. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function useEstructuraRealRaw() {
  return useQuery<EstructuraRealRaw | null>({
    queryKey: ["estructura-real-simulador"],
    staleTime: 30_000,
    queryFn: async () => {
      const COLS_BASE = "id, nombre, id_rol, costo_nominal, costo_externo, costo_social";
      const consultarPersonal = (cols: string) =>
        (supabase as any)
          .from("personal_organizacional")
          .select(cols)
          .eq("activo", true)
          .order("nombre");

      let { data: personal, error } = await consultarPersonal(`${COLS_BASE}, tipo_personal`);

      // Sin `tipo_personal` (DDL pendiente) se relee sin ella y todos cuentan
      // como empleados de SOZU: la estructura queda igual que antes.
      if (error && ["42703", "PGRST204"].includes(error.code)) {
        const fallback = await consultarPersonal(COLS_BASE);
        personal = (fallback.data ?? []).map((p: Record<string, unknown>) => ({
          ...p, tipo_personal: "empleado_sozu",
        }));
        error = fallback.error;
      }

      // Tabla inexistente (DDL pendiente) o sin personal: el simulador sigue con lo suyo.
      if (error || !personal?.length) return null;

      const idsPersonal = personal.map((p: { id: number }) => p.id);
      let asignaciones = (await (supabase as any)
        .from("personal_proyectos")
        .select("id_personal, id_proyecto, id_rol, asignacion_pct")
        .eq("activo", true)
        .in("id_personal", idsPersonal)).data;

      // Sin la columna `id_rol` (DDL pendiente) se relee sin ella: todos
      // resuelven a su rol base, igual que antes de que existiera el override.
      if (!asignaciones) {
        const { data } = await (supabase as any)
          .from("personal_proyectos")
          .select("id_personal, id_proyecto, asignacion_pct")
          .eq("activo", true)
          .in("id_personal", idsPersonal);
        asignaciones = (data ?? []).map((a: Record<string, unknown>) => ({ ...a, id_rol: null }));
      }

      const { data: rolesReales } = await (supabase as any)
        .from("roles_organizacionales")
        .select("id, nombre, tipo, pertenece_a, participa_comision, activo")
        .order("nombre");

      const idsProyecto = Array.from(
        new Set(((asignaciones ?? []) as Array<{ id_proyecto: number }>).map(a => a.id_proyecto)),
      );
      const { data: proyectosReales } = idsProyecto.length
        ? await supabase.from("proyectos").select("id, nombre").in("id", idsProyecto)
        : { data: [] };

      return {
        personal,
        asignaciones: asignaciones ?? [],
        rolesReales: rolesReales ?? [],
        proyectosReales: (proyectosReales ?? []) as Array<{ id: number; nombre: string }>,
      } as EstructuraRealRaw;
    },
  });
}

export interface EstructuraDerivada {
  roleAssignments: RoleAssignment[];
  /** Personas activas sin rol vinculado: no pueden entrar al simulador. */
  personasSinRol: number;
  /** Colaboradores de Investimento excluidos: su costo no es de SOZU. */
  colaboradoresInvestimento: number;
  /** Proyectos reales con personal cuyo nombre no existe en el catálogo del simulador. */
  proyectosNoMapeados: string[];
  /** Roles reales con personal cuyo nombre no existe en el catálogo del simulador. */
  rolesNoMapeados: string[];
}

/**
 * Convierte la estructura real en `RoleAssignment[]`, agrupando por rol × proyecto.
 *
 * El costo se conserva exacto: para cada grupo,
 * `headcount × (baseSalary × (1 + benefitsPct/100) + fixedBonus)` da la misma
 * cifra que sumar el `costo_total` prorrateado de cada persona.
 *
 * - `headcount` es FTE: una persona al 60% en un proyecto cuenta 0.6 ahí.
 * - `baseSalary` = (nominal + externo) promedio por FTE del grupo.
 * - `benefitsPct` = social / (nominal + externo) del grupo.
 * - `fixedBonus` = 0: el bono ya está dentro del concepto de costo que le toque.
 */
export function derivarEstructura(
  raw: EstructuraRealRaw | null | undefined,
  rolesSimulador: Role[],
  proyectosSimulador: Project[],
): EstructuraDerivada | null {
  if (!raw || raw.personal.length === 0) return null;

  const rolSimPorNombre = new Map(rolesSimulador.map(r => [norm(r.name), r.id]));
  const proySimPorNombre = new Map(proyectosSimulador.map(p => [norm(p.name), p.id]));
  const nombreRolReal = new Map(raw.rolesReales.map(r => [r.id, r.nombre]));
  const nombreProyReal = new Map(raw.proyectosReales.map(p => [p.id, p.nombre]));

  const asignacionesPorPersona = new Map<number, Array<{ id_proyecto: number; id_rol: number | null; asignacion_pct: number }>>();
  for (const a of raw.asignaciones) {
    const lista = asignacionesPorPersona.get(a.id_personal);
    if (lista) lista.push(a);
    else asignacionesPorPersona.set(a.id_personal, [a]);
  }

  // Acumulador por rol × proyecto: FTE, base (nominal + externo) y carga social.
  const grupos = new Map<string, { roleId: string; projectId: string | null; fte: number; base: number; social: number }>();
  const rolesNoMapeados = new Set<string>();
  const proyectosNoMapeados = new Set<string>();
  let personasSinRol = 0;
  let colaboradoresInvestimento = 0;

  const acumular = (roleId: string, projectId: string | null, peso: number, p: EstructuraRealRaw["personal"][number]) => {
    if (peso <= 0) return;
    const clave = `${roleId}|${projectId ?? "central"}`;
    const grupo = grupos.get(clave) ?? { roleId, projectId, fte: 0, base: 0, social: 0 };
    grupo.fte += peso;
    grupo.base += (Number(p.costo_nominal) + Number(p.costo_externo)) * peso;
    grupo.social += Number(p.costo_social) * peso;
    grupos.set(clave, grupo);
  };

  /** Resuelve un id de rol real al id del catálogo del simulador, reportando lo que no cruza. */
  const resolverRol = (idRolReal: number | null): string | undefined => {
    if (idRolReal === null) return undefined;
    const nombreRol = nombreRolReal.get(idRolReal);
    const roleId = nombreRol ? rolSimPorNombre.get(norm(nombreRol)) : undefined;
    if (!roleId && nombreRol) rolesNoMapeados.add(nombreRol);
    return roleId;
  };

  for (const persona of raw.personal) {
    // El colaborador de Investimento no es costo de SOZU: su sueldo lo paga
    // Investimento. Queda fuera de la estructura que consumen Organigrama,
    // Financieros y el costo por proyecto. Sigue pudiendo comisionar.
    if (persona.tipo_personal === "colaborador_investimento") { colaboradoresInvestimento++; continue; }

    if (persona.id_rol === null) { personasSinRol++; continue; }

    const rolBase = resolverRol(persona.id_rol);
    const links = asignacionesPorPersona.get(persona.id) ?? [];
    let pctAsignado = 0;

    for (const link of links) {
      const nombreProy = nombreProyReal.get(link.id_proyecto);
      const projectId = nombreProy ? proySimPorNombre.get(norm(nombreProy)) : undefined;
      const peso = Number(link.asignacion_pct) / 100;
      // El % cuenta como asignado aunque el proyecto no cruce: así ese costo
      // queda fuera del simulador y se reporta, en vez de caer por descarte
      // en SOZU Central y desvirtuar la estructura central.
      pctAsignado += peso;
      if (!projectId) {
        if (nombreProy) proyectosNoMapeados.add(nombreProy);
        continue;
      }
      // Rol efectivo: manda el del proyecto; si no hay, el rol base.
      const roleId = resolverRol(link.id_rol) ?? rolBase;
      if (!roleId) continue;
      acumular(roleId, projectId, peso, persona);
    }

    // Lo no asignado a ningún proyecto es estructura de SOZU Central, y ahí
    // siempre aplica el rol base.
    const restante = 1 - pctAsignado;
    if (restante > 0.0001 && rolBase) acumular(rolBase, null, restante, persona);
  }

  const roleAssignments: RoleAssignment[] = Array.from(grupos.entries()).map(([clave, g]) => ({
    id: `real-${clave}`,
    roleId: g.roleId,
    projectId: g.projectId,
    headcount: Number(g.fte.toFixed(4)),
    baseSalary: g.fte > 0 ? g.base / g.fte : 0,
    fixedBonus: 0,
    benefitsPct: g.base > 0 ? (g.social / g.base) * 100 : 0,
  }));

  return {
    roleAssignments,
    personasSinRol,
    colaboradoresInvestimento,
    proyectosNoMapeados: Array.from(proyectosNoMapeados),
    rolesNoMapeados: Array.from(rolesNoMapeados),
  };
}


/* ------------------------------------------------------------------ */
/* Catálogo de roles del simulador, derivado del catálogo real         */
/* ------------------------------------------------------------------ */

const TIPOS_ROL = ["strategic", "operative", "support"] as const;

/** Id estable para un rol real que no existe en el catálogo semilla. */
const idSimuladorDerivado = (idRolReal: number) => `rol-org-${idRolReal}`;

/**
 * Catálogo de roles del simulador **derivado de `roles_organizacionales`**.
 *
 * Antes el simulador se quedaba con su semilla local de 7 roles y el puente por
 * nombre descartaba a todo el personal cuyo rol real no coincidiera. Con 11
 * roles reales de los que solo uno coincidía, en Comisiones aparecía una sola
 * persona elegible.
 *
 * Los ids se asignan así:
 * - Si el nombre del rol real coincide con uno de la semilla, **se conserva el
 *   id semilla** (`role-asesor`, …). Es imprescindible: `comisiones_reglas.id_rol`
 *   guarda esos ids como texto y ya hay reglas capturadas apuntando a ellos.
 * - Si no coincide, se genera `rol-org-<id_real>`, estable en el tiempo.
 */
export function derivarRolesSimulador(
  raw: EstructuraRealRaw | null | undefined,
  rolesSemilla: Role[],
): Role[] | null {
  if (!raw || raw.rolesReales.length === 0) return null;

  const semillaPorNombre = new Map(rolesSemilla.map(r => [norm(r.name), r]));

  return raw.rolesReales
    .filter(r => r.activo)
    .map(r => {
      const semilla = semillaPorNombre.get(norm(r.nombre));
      const tipo = (TIPOS_ROL as readonly string[]).includes(r.tipo)
        ? (r.tipo as Role["type"])
        : "operative";
      return {
        id: semilla?.id ?? idSimuladorDerivado(r.id),
        name: r.nombre,
        type: tipo,
        belongsTo: r.pertenece_a === "sozu_central" ? "sozu_central" : "project",
        participatesInCommission: r.participa_comision,
      } as Role;
    });
}

/** Rol real (`id` numérico) → id del catálogo del simulador. */
export function mapaRolRealASimulador(
  raw: EstructuraRealRaw | null | undefined,
  rolesSimulador: Role[],
): Map<number, string> {
  const mapa = new Map<number, string>();
  if (!raw) return mapa;
  const simPorNombre = new Map(rolesSimulador.map(r => [norm(r.name), r.id]));
  for (const r of raw.rolesReales) {
    mapa.set(r.id, simPorNombre.get(norm(r.nombre)) ?? idSimuladorDerivado(r.id));
  }
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Comisionistas                                                       */
/* ------------------------------------------------------------------ */

/** Un rol que la persona puede ejercer, ya resuelto al catálogo del simulador. */
export interface RolComisionista {
  roleId: string;
  rolNombre: string;
  belongsTo: "sozu_central" | "project";
  participaComision: boolean;
  /** De dónde sale: su rol base o el que asume en un proyecto concreto. */
  origen: "base" | "proyecto";
  /** Nombre del proyecto cuando `origen === 'proyecto'`. */
  proyectoNombre?: string;
}

export interface ComisionistaReal {
  personalId: string;
  nombre: string;
  /** Todos los roles que la persona puede ejercer. Nunca vacío. */
  roles: RolComisionista[];
}

/**
 * Personal activo elegible como comisionista, **sin filtrar por catálogo**: con
 * los roles derivados del real, todo rol tiene equivalencia, así que aparece
 * toda la organización.
 *
 * Cada persona trae **todos** los roles que puede ejercer — su rol base y los
 * que asume en cada proyecto — para poder elegir con cuál comisiona. `idProyecto`
 * (el desarrollo del motor) solo ordena la lista: el rol de ese proyecto va
 * primero, porque es el que aplica por defecto ahí.
 */
export function comisionistasDisponibles(
  raw: EstructuraRealRaw | null | undefined,
  rolesSimulador: Role[],
  idProyecto?: number | null,
): ComisionistaReal[] {
  if (!raw) return [];
  const mapaRol = mapaRolRealASimulador(raw, rolesSimulador);
  const rolRealPorId = new Map(raw.rolesReales.map(r => [r.id, r]));
  const nombreProyecto = new Map(raw.proyectosReales.map(p => [p.id, p.nombre]));

  const asignacionesPorPersona = new Map<number, EstructuraRealRaw["asignaciones"]>();
  for (const a of raw.asignaciones) {
    const lista = asignacionesPorPersona.get(a.id_personal);
    if (lista) lista.push(a);
    else asignacionesPorPersona.set(a.id_personal, [a]);
  }

  const lista: ComisionistaReal[] = [];
  for (const persona of raw.personal) {
    const roles: RolComisionista[] = [];
    const vistos = new Set<string>();

    const agregar = (idRolReal: number, origen: "base" | "proyecto", proyectoNombre?: string) => {
      const rolReal = rolRealPorId.get(idRolReal);
      const roleId = mapaRol.get(idRolReal);
      if (!rolReal || !roleId || vistos.has(roleId)) return;
      vistos.add(roleId);
      roles.push({
        roleId,
        rolNombre: rolReal.nombre,
        belongsTo: rolReal.pertenece_a === "sozu_central" ? "sozu_central" : "project",
        participaComision: rolReal.participa_comision,
        origen,
        proyectoNombre,
      });
    };

    const links = asignacionesPorPersona.get(persona.id) ?? [];
    // El rol del proyecto que el motor está configurando va primero.
    for (const link of links) {
      if (link.id_proyecto === idProyecto && link.id_rol != null) {
        agregar(link.id_rol, "proyecto", nombreProyecto.get(link.id_proyecto));
      }
    }
    if (persona.id_rol !== null) agregar(persona.id_rol, "base");
    for (const link of links) {
      if (link.id_rol != null) agregar(link.id_rol, "proyecto", nombreProyecto.get(link.id_proyecto));
    }

    // Sin rol vinculado no hay nada que imputar: la regla guarda un rol.
    if (roles.length === 0) continue;
    lista.push({ personalId: String(persona.id), nombre: persona.nombre, roles });
  }
  return lista;
}
