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
  }>;
  asignaciones: Array<{ id_personal: number; id_proyecto: number; asignacion_pct: number }>;
  rolesReales: Array<{ id: number; nombre: string; participa_comision: boolean }>;
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
      const { data: personal, error } = await (supabase as any)
        .from("personal_organizacional")
        .select("id, nombre, id_rol, costo_nominal, costo_externo, costo_social")
        .eq("activo", true)
        .order("nombre");
      // Tabla inexistente (DDL pendiente) o sin personal: el simulador sigue con lo suyo.
      if (error || !personal?.length) return null;

      const { data: asignaciones } = await (supabase as any)
        .from("personal_proyectos")
        .select("id_personal, id_proyecto, asignacion_pct")
        .eq("activo", true)
        .in("id_personal", personal.map((p: { id: number }) => p.id));

      const { data: rolesReales } = await (supabase as any)
        .from("roles_organizacionales")
        .select("id, nombre, participa_comision");

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

  const asignacionesPorPersona = new Map<number, Array<{ id_proyecto: number; asignacion_pct: number }>>();
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

  const acumular = (roleId: string, projectId: string | null, peso: number, p: EstructuraRealRaw["personal"][number]) => {
    if (peso <= 0) return;
    const clave = `${roleId}|${projectId ?? "central"}`;
    const grupo = grupos.get(clave) ?? { roleId, projectId, fte: 0, base: 0, social: 0 };
    grupo.fte += peso;
    grupo.base += (Number(p.costo_nominal) + Number(p.costo_externo)) * peso;
    grupo.social += Number(p.costo_social) * peso;
    grupos.set(clave, grupo);
  };

  for (const persona of raw.personal) {
    if (persona.id_rol === null) { personasSinRol++; continue; }

    const nombreRol = nombreRolReal.get(persona.id_rol);
    const roleId = nombreRol ? rolSimPorNombre.get(norm(nombreRol)) : undefined;
    if (!roleId) {
      if (nombreRol) rolesNoMapeados.add(nombreRol);
      continue;
    }

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
      acumular(roleId, projectId, peso, persona);
    }

    // Lo no asignado a ningún proyecto es estructura de SOZU Central.
    const restante = 1 - pctAsignado;
    if (restante > 0.0001) acumular(roleId, null, restante, persona);
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
    proyectosNoMapeados: Array.from(proyectosNoMapeados),
    rolesNoMapeados: Array.from(rolesNoMapeados),
  };
}

/** Persona elegible como comisionista, con su rol resuelto al catálogo del simulador. */
export interface ComisionistaReal {
  personalId: string;
  nombre: string;
  rolNombre: string;
  roleId: string;
  belongsTo: "sozu_central" | "project";
  participaComision: boolean;
}

/**
 * Personal activo que puede darse de alta como comisionista en un canal.
 *
 * Solo entra quien tiene rol vinculado y ese rol existe en el catálogo del
 * simulador: la regla de comisión guarda `id_rol` (texto) porque el motor
 * agrupa los pagos por rol, así que sin equivalencia no hay dónde imputarla.
 */
export function comisionistasDisponibles(
  raw: EstructuraRealRaw | null | undefined,
  rolesSimulador: Role[],
): ComisionistaReal[] {
  if (!raw) return [];
  const rolSimPorNombre = new Map(rolesSimulador.map(r => [norm(r.name), r]));
  const rolRealPorId = new Map(raw.rolesReales.map(r => [r.id, r]));

  const lista: ComisionistaReal[] = [];
  for (const persona of raw.personal) {
    if (persona.id_rol === null) continue;
    const rolReal = rolRealPorId.get(persona.id_rol);
    if (!rolReal) continue;
    const rolSim = rolSimPorNombre.get(norm(rolReal.nombre));
    if (!rolSim) continue;
    lista.push({
      personalId: String(persona.id),
      nombre: persona.nombre,
      rolNombre: rolReal.nombre,
      roleId: rolSim.id,
      belongsTo: rolSim.belongsTo,
      participaComision: rolReal.participa_comision,
    });
  }
  return lista;
}
