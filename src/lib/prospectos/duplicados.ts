import { supabase } from "@/integrations/supabase/client";

/**
 * Búsqueda única de "este prospecto ya existe", compartida por el alta del CRM
 * (`portal-crm/crm.tsx`) y la del Portal Agente (`AddProspectoFloatingDialog`).
 *
 * Por qué existe este archivo: los dos portales buscaban distinto y avisaban distinto.
 * El CRM buscaba por correo `ilike` y por los últimos 10 dígitos del teléfono, pero la
 * tarjeta de duplicado no decía de quién era el lead. El Portal Agente buscaba con
 * `email = <minúsculas>` exacto — no encontraba `Janethwirth@gmail.com` — y no miraba el
 * teléfono, así que dejó entrar a la misma persona dos veces, en el mismo desarrollo, con
 * dos agentes dueños distintos (personas 3058 y 3112, 2026-06-29 y 2026-07-10).
 *
 * Reglas de coincidencia (las mismas para los dos portales):
 *  - correo: comparación **sin distinguir mayúsculas** (`personas_email_key` sí distingue).
 *  - teléfono: **últimos 10 dígitos**, ignorando espacios, guiones y lada.
 *
 * Sobre la visibilidad: `personas` se lee sin restricción, pero
 * `entidades_relacionadas` está bajo RLS — un agente no ve los leads de otro. Por eso la
 * coincidencia distingue dos situaciones y la UI dice la verdad en las dos:
 *  - `leads` con filas → se sabe el desarrollo, el dueño y el estado.
 *  - `sinEntidadesVisibles` → existe, pero desde aquí no se puede saber de quién es.
 *    Para nombrar al dueño sin abrir el registro completo hace falta la RPC
 *    `buscar_prospecto_existente` (documentada en Ejecuciones_manuales).
 */

export interface LeadCoincidencia {
  idEntidadRelacionada: number;
  idProyecto: number | null;
  proyecto: string;
  /** Nombre del agente dueño del lead (persona dueña o propietario de la atribución). */
  dueno: string | null;
  /** `true` si el dueño es quien está capturando. */
  esMio: boolean;
  estatus: string | null;
}

export interface ProspectoCoincidencia {
  idPersona: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  /** Coincidió por correo, por teléfono o por los dos. */
  motivo: "correo" | "teléfono" | "correo y teléfono";
  /** Ya es comprador (entidad tipo 2). */
  esCliente: boolean;
  /** Leads visibles para quien consulta. */
  leads: LeadCoincidencia[];
  /**
   * No hay ninguna entidad visible para quien consulta. Bajo RLS eso NO prueba que
   * nadie la trabaje: lo más probable es que sea de otro asesor. La UI avisa con esa
   * duda explícita en vez de afirmar de más; para nombrar al dueño hace falta la RPC
   * `buscar_prospecto_existente` (ver Ejecuciones_manuales/crm-portal-agente/03).
   */
  sinEntidadesVisibles: boolean;
}

export interface BuscarArgs {
  email?: string | null;
  telefono?: string | null;
  /** `personas.id` del agente que captura, para marcar `esMio`. */
  miPersonaId?: number | null;
  /** `usuarios.auth_user_id` del agente que captura (atribución del CRM). */
  miAuthUserId?: string | null;
  /** Persona que se está editando: no se reporta como duplicado de sí misma. */
  excluirPersonaId?: number | null;
}

const soloDigitos = (v: string) => v.replace(/\D/g, "");
export const ultimos10 = (tel?: string | null) => {
  const d = soloDigitos(tel ?? "");
  return d.length >= 10 ? d.slice(-10) : "";
};

export async function buscarProspectosExistentes({
  email,
  telefono,
  miPersonaId,
  miAuthUserId,
  excluirPersonaId,
}: BuscarArgs): Promise<ProspectoCoincidencia[]> {
  const correo = (email ?? "").trim().toLowerCase();
  const tel10 = ultimos10(telefono);
  if (!correo && !tel10) return [];

  const ors: string[] = [];
  if (correo) ors.push(`email.ilike.${correo}`);
  if (tel10) ors.push(`telefono.ilike.%${tel10}`);

  const { data: personas } = await (supabase as any)
    .from("personas")
    .select("id, nombre_legal, nombre_comercial, email, telefono")
    .eq("activo", true)
    .or(ors.join(","))
    .limit(10);

  const encontradas = ((personas as any[]) ?? []).filter((p) => p.id !== excluirPersonaId);
  if (encontradas.length === 0) return [];

  const personaIds = encontradas.map((p) => p.id);

  // Entidades visibles de esas personas. Bajo RLS un agente solo verá las suyas; esa
  // diferencia es justo la señal de "lo trabaja alguien más".
  const { data: entidades } = await (supabase as any)
    .from("entidades_relacionadas")
    .select("id, id_persona, id_tipo_entidad, id_proyecto, id_persona_duena_lead")
    .in("id_persona", personaIds)
    .in("id_tipo_entidad", [2, 7])
    .eq("activo", true);

  const ents = ((entidades as any[]) ?? []);
  const entIds = ents.map((e) => e.id);
  const proyectoIds = [...new Set(ents.map((e) => e.id_proyecto).filter(Boolean))];
  const duenoIds = [...new Set(ents.map((e) => e.id_persona_duena_lead).filter(Boolean))];

  const [atribRes, proyectosRes, duenosRes] = await Promise.all([
    entIds.length
      ? (supabase as any)
          .from("crm_leads_atribucion")
          .select("id_entidad_relacionada, id_propietario, estatus_lead, id_estatus_lead")
          .in("id_entidad_relacionada", entIds)
          .eq("activo", true)
      : Promise.resolve({ data: [] }),
    proyectoIds.length
      ? (supabase as any).from("proyectos").select("id, nombre").in("id", proyectoIds)
      : Promise.resolve({ data: [] }),
    duenoIds.length
      ? (supabase as any).from("personas").select("id, nombre_legal").in("id", duenoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const atribPorEnt = new Map<number, any>(
    ((atribRes.data as any[]) ?? []).map((a) => [a.id_entidad_relacionada, a]),
  );
  const proyectoNombre = new Map<number, string>(
    ((proyectosRes.data as any[]) ?? []).map((p) => [p.id, p.nombre]),
  );
  const duenoNombre = new Map<number, string>(
    ((duenosRes.data as any[]) ?? []).map((p) => [p.id, p.nombre_legal]),
  );

  // Nombre del propietario de la atribución cuando el dueño no está en la entidad.
  const propietarioIds = [
    ...new Set(
      [...atribPorEnt.values()].map((a) => a.id_propietario).filter(Boolean),
    ),
  ];
  const propietarioNombre = new Map<string, string>();
  if (propietarioIds.length) {
    const { data: usuarios } = await (supabase as any)
      .from("usuarios")
      .select("auth_user_id, nombre, email")
      .in("auth_user_id", propietarioIds);
    for (const u of ((usuarios as any[]) ?? [])) {
      propietarioNombre.set(u.auth_user_id, u.nombre || u.email);
    }
  }

  const estadosPorId = new Map<number, string>();
  const idsEstatus = [
    ...new Set([...atribPorEnt.values()].map((a) => a.id_estatus_lead).filter(Boolean)),
  ];
  if (idsEstatus.length) {
    const { data: estados } = await (supabase as any)
      .from("crm_estados_lead")
      .select("id, nombre")
      .in("id", idsEstatus);
    for (const e of ((estados as any[]) ?? [])) estadosPorId.set(e.id, e.nombre);
  }

  return encontradas.map((p): ProspectoCoincidencia => {
    const suyas = ents.filter((e) => e.id_persona === p.id);
    const leads = suyas
      .filter((e) => e.id_tipo_entidad === 7)
      .map((e): LeadCoincidencia => {
        const atrib = atribPorEnt.get(e.id);
        const dueno =
          (e.id_persona_duena_lead ? duenoNombre.get(e.id_persona_duena_lead) : null) ??
          (atrib?.id_propietario ? propietarioNombre.get(atrib.id_propietario) : null) ??
          null;
        const esMio =
          (!!miPersonaId && e.id_persona_duena_lead === miPersonaId) ||
          (!!miAuthUserId && atrib?.id_propietario === miAuthUserId);
        return {
          idEntidadRelacionada: e.id,
          idProyecto: e.id_proyecto ?? null,
          proyecto: e.id_proyecto ? proyectoNombre.get(e.id_proyecto) ?? `Proyecto ${e.id_proyecto}` : "Sin desarrollo",
          dueno,
          esMio,
          estatus:
            (atrib?.id_estatus_lead ? estadosPorId.get(atrib.id_estatus_lead) : null) ??
            atrib?.estatus_lead ??
            null,
        };
      });

    const coincideCorreo = !!correo && (p.email ?? "").trim().toLowerCase() === correo;
    const coincideTel = !!tel10 && ultimos10(p.telefono) === tel10;

    return {
      idPersona: p.id,
      nombre: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
      email: p.email ?? null,
      telefono: p.telefono ?? null,
      motivo:
        coincideCorreo && coincideTel ? "correo y teléfono" : coincideCorreo ? "correo" : "teléfono",
      esCliente: suyas.some((e) => e.id_tipo_entidad === 2),
      leads,
      sinEntidadesVisibles: suyas.length === 0,
    };
  });
}

/** Texto corto para la UI: quién tiene el prospecto y dónde. */
export function describirCoincidencia(c: ProspectoCoincidencia): string {
  if (c.leads.length > 0) {
    const propios = c.leads.filter((l) => l.esMio);
    if (propios.length === c.leads.length) {
      return `Ya es tu prospecto en ${c.leads.map((l) => l.proyecto).join(", ")}.`;
    }
    const ajenos = c.leads.filter((l) => !l.esMio);
    // `dueno` puede venir vacío a propósito: la RPC solo devuelve el nombre de la persona
    // o del usuario, nunca su correo corporativo. Sin nombre se dice "otro asesor" en vez
    // de dejar el renglón cojo.
    const detalle = ajenos
      .map((l) => `${l.proyecto} · ${l.dueno ?? "otro asesor"}`)
      .join(" · ");
    return `Ya está registrado y tiene dueño: ${detalle}.`;
  }
  if (c.esCliente) {
    return "Esta persona ya es cliente de SOZU.";
  }
  return "Ya está registrada y no aparece en tu cartera: lo más probable es que la trabaje otro asesor. Confírmalo antes de darla de alta otra vez.";
}
