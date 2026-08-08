/**
 * Prospectos del agente (capa 1 del modelo: persona x proyecto).
 *
 * Fuente única del dueño del lead: `crm_leads_atribucion.id_propietario` (auth_user_id).
 * Mientras la migración 04 no esté aplicada, la mitad de los leads solo tiene
 * `entidades_relacionadas.id_persona_duena_lead`, así que aquí se leen **los dos** y se
 * unen. Cuando el trigger de sincronía exista, la unión devolverá lo mismo por ambos lados.
 *
 * Estado del lead: `crm_leads_atribucion.id_estatus_lead`, catálogo `crm_estados_lead` (el
 * mismo que administra el CRM en Configuración > Estados de lead, con color y orden).
 * Mientras esa columna FK no exista, se lee y escribe el texto `estatus_lead`, que usa
 * exactamente las mismas claves. Una sola fuente en los dos escenarios.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchUnidadesPorPersona, type UnidadNegocio } from "./negocios";
import { META_LEAD_STATUSES } from "@/hooks/useCrmCatalogos";

export interface EstatusLead {
  id: number;
  clave: string;
  nombre: string;
  color: string | null;
}

export interface ProyectoLead {
  id_entidad_relacionada: number;
  id_proyecto: number | null;
  proyecto: string;
  id_estatus_lead: number | null;
  estatus: string | null;
  estatus_color: string | null;
  unidades: UnidadNegocio[];
}

export interface ProspectoRow {
  id_persona: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  clave_pais_telefono: string | null;
  origen: string | null;
  proyectos: ProyectoLead[];
  /** true si alguna unidad ya llegó a apartado pagado o más. */
  es_cliente: boolean;
  total_unidades: number;
}

/**
 * Catálogo de estados de lead: el mismo que administra el CRM, con color y orden.
 * Si la tabla falla o viene vacía cae al catálogo fijo `META_LEAD_STATUSES`, igual que el CRM
 * (`useCrmCatalogos.fetchLeadStates`). Sin este respaldo el portal se quedaba sin estados y con
 * los selects vacíos mientras el CRM sí los mostraba.
 */
export async function fetchEstatusLead(): Promise<EstatusLead[]> {
  const { data, error } = await (supabase as any)
    .from("crm_estados_lead")
    .select("id, clave, nombre, color, orden")
    .eq("activo", true)
    .order("orden");

  if (!error && data && data.length > 0) return data as EstatusLead[];

  // Respaldo: ids negativos para no confundirlos con los del catálogo real.
  return META_LEAD_STATUSES.map((e, i) => ({
    id: -(i + 1),
    clave: e.value,
    nombre: e.label,
    color: e.color ?? null,
  }));
}

/** Etiqueta legible para una clave que ya no está en el catálogo (estado desactivado). */
function humanizarClave(clave: string): string {
  const fijo = META_LEAD_STATUSES.find((e) => e.value === clave);
  if (fijo) return fijo.label;
  const t = clave.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Cambia el estado del lead. Prioridad:
 *   1. RPC `set_lead_estatus` (valida dueño y catálogo en la base).
 *   2. UPDATE de `id_estatus_lead` si la columna FK ya existe.
 *   3. UPDATE del texto `estatus_lead` con la misma clave (lo que escribe el CRM hoy).
 * La policy de UPDATE de crm_leads_atribucion deja pasar al propietario del lead.
 */
export async function setLeadEstatus(
  idEntidadRelacionada: number,
  idEstatusLead: number,
  clave?: string,
): Promise<void> {
  const rpc = await (supabase as any).rpc("set_lead_estatus", {
    p_id_entidad_relacionada: idEntidadRelacionada,
    p_id_estatus_lead: idEstatusLead,
  });
  if (!rpc.error) return;

  const faltaFuncion = /function .* does not exist|schema cache/i.test(rpc.error.message ?? "");
  if (!faltaFuncion) throw new Error(rpc.error.message);

  const porFk = await (supabase as any)
    .from("crm_leads_atribucion")
    .update({ id_estatus_lead: idEstatusLead })
    .eq("id_entidad_relacionada", idEntidadRelacionada)
    .eq("activo", true);
  if (!porFk.error) return;

  if (!clave) throw new Error(porFk.error.message);

  const porTexto = await (supabase as any)
    .from("crm_leads_atribucion")
    .update({ estatus_lead: clave })
    .eq("id_entidad_relacionada", idEntidadRelacionada)
    .eq("activo", true);
  if (porTexto.error) throw new Error(porTexto.error.message);
}

/**
 * Atribuciones de un conjunto de entidades. Pide `id_estatus_lead` y, si la columna todavía
 * no existe (migración del CRM pendiente), reintenta sin ella.
 */
async function fetchAtribuciones(erIds: number[]): Promise<{ data: any[] }> {
  const conFk = await (supabase as any)
    .from("crm_leads_atribucion")
    .select("id_entidad_relacionada, estatus_lead, id_estatus_lead, origen")
    .in("id_entidad_relacionada", erIds)
    .eq("activo", true);
  if (!conFk.error) return { data: conFk.data ?? [] };

  const sinFk = await (supabase as any)
    .from("crm_leads_atribucion")
    .select("id_entidad_relacionada, estatus_lead, origen")
    .in("id_entidad_relacionada", erIds)
    .eq("activo", true);
  return { data: sinFk.data ?? [] };
}

interface Args {
  authUserId?: string | null;
  personaId?: number | null;
}

/**
 * Prospectos del agente con sus proyectos y, dentro de cada uno, sus unidades.
 * Devuelve `viaRpc` para poder avisar en la UI de qué camino se está leyendo.
 */
export async function fetchAgenteProspectos({ authUserId, personaId }: Args): Promise<{
  rows: ProspectoRow[];
  viaRpc: boolean;
}> {
  // ── Camino definitivo: la RPC filtra por auth.uid() del lado de la base ──
  const rpc = await (supabase as any).rpc("get_agente_prospectos", {
    p_search: null,
    p_estatus: null,
    p_proyecto: null,
    p_auth_user_id: null,
    p_limit: 500,
    p_offset: 0,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    const rows: ProspectoRow[] = (rpc.data as any[]).map((r) => {
      const proyectos: ProyectoLead[] = (r.proyectos ?? []).map((p: any) => ({
        id_entidad_relacionada: p.id_entidad_relacionada,
        id_proyecto: p.id_proyecto ?? null,
        proyecto: p.proyecto ?? "Sin desarrollo",
        id_estatus_lead: p.id_estatus_lead ?? null,
        estatus: p.estatus ?? null,
        estatus_color: p.estatus_color ?? null,
        unidades: (p.unidades ?? []).map((u: any) => ({
          id_negocio: u.id_negocio ?? null,
          id_oferta: u.id_oferta ?? null,
          id_proyecto: p.id_proyecto ?? null,
          proyecto: p.proyecto ?? "",
          unidad: u.unidad ?? "—",
          tipo: u.tipo ?? "Propiedad",
          valor: u.valor ?? null,
          etapa: u.etapa_clave,
          es_cliente: !!u.es_cliente,
          ofertas_count: u.ofertas_count ?? 1,
        })),
      }));
      const unidades = proyectos.flatMap((p) => p.unidades);
      return {
        id_persona: r.id_persona,
        nombre: r.nombre ?? "Sin nombre",
        email: r.email ?? null,
        telefono: r.telefono ?? null,
        clave_pais_telefono: null,
        origen: null,
        proyectos,
        es_cliente: unidades.some((u) => u.es_cliente),
        total_unidades: unidades.length,
      };
    });
    return { rows, viaRpc: true };
  }

  // ── Camino de transición: unión de los dos modelos de propiedad del lead ──
  const porDuenaLead = personaId
    ? await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona, id_proyecto")
        .eq("id_tipo_entidad", 7)
        .eq("activo", true)
        .eq("id_persona_duena_lead", personaId)
    : { data: [] as any[] };

  let porAtribucion: any[] = [];
  if (authUserId) {
    const { data: atribuciones } = await (supabase as any)
      .from("crm_leads_atribucion")
      .select("id_entidad_relacionada")
      .eq("id_propietario", authUserId)
      .eq("activo", true);
    const erIds = (atribuciones ?? []).map((a: any) => a.id_entidad_relacionada).filter(Boolean);
    if (erIds.length) {
      const { data } = await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona, id_proyecto")
        .in("id", erIds)
        .eq("id_tipo_entidad", 7)
        .eq("activo", true);
      porAtribucion = data ?? [];
    }
  }

  const ers = new Map<number, any>();
  [...(porDuenaLead.data ?? []), ...porAtribucion].forEach((er: any) => ers.set(er.id, er));
  if (ers.size === 0) return { rows: [], viaRpc: false };

  const lista = [...ers.values()];
  const personaIds = [...new Set(lista.map((e) => e.id_persona).filter(Boolean))] as number[];
  const proyectoIds = [...new Set(lista.map((e) => e.id_proyecto).filter(Boolean))] as number[];
  const erIds = lista.map((e) => e.id);

  const [personasRes, proyectosRes, catalogo, atribRes, unidadesRes] = await Promise.all([
    (supabase as any).from("personas")
      .select("id, nombre_legal, nombre_comercial, email, telefono, clave_pais_telefono")
      .in("id", personaIds),
    proyectoIds.length
      ? (supabase as any).from("proyectos").select("id, nombre").in("id", proyectoIds)
      : Promise.resolve({ data: [] }),
    fetchEstatusLead(),
    fetchAtribuciones(erIds),
    fetchUnidadesPorPersona(personaIds),
  ]);

  const personaMap = new Map<number, any>((personasRes.data ?? []).map((p: any) => [p.id, p]));
  const proyectoMap = new Map<number, string>((proyectosRes.data ?? []).map((p: any) => [p.id, p.nombre]));
  const catalogoPorId = new Map<number, EstatusLead>((catalogo as EstatusLead[]).map((e) => [e.id, e]));
  const catalogoPorClave = new Map<string, EstatusLead>((catalogo as EstatusLead[]).map((e) => [e.clave, e]));
  const atribMap = new Map<number, any>(
    (atribRes.data ?? []).map((a: any) => [a.id_entidad_relacionada, a]),
  );

  const porPersona = new Map<number, ProspectoRow>();
  for (const er of lista) {
    const persona = personaMap.get(er.id_persona);
    if (!persona) continue;

    if (!porPersona.has(er.id_persona)) {
      porPersona.set(er.id_persona, {
        id_persona: er.id_persona,
        nombre: (persona.nombre_legal || persona.nombre_comercial || "Sin nombre").trim(),
        email: persona.email ?? null,
        telefono: persona.telefono ?? null,
        clave_pais_telefono: persona.clave_pais_telefono ?? "MX",
        origen: atribMap.get(er.id)?.origen ?? null,
        proyectos: [],
        es_cliente: false,
        total_unidades: 0,
      });
    }

    const fila = porPersona.get(er.id_persona)!;
    const atribucion = atribMap.get(er.id);
    const unidadesDePersona = unidadesRes.porPersona.get(er.id_persona) ?? [];
    const unidades = unidadesDePersona.filter(
      (u) => u.id_proyecto === er.id_proyecto || (u.id_proyecto == null && er.id_proyecto == null),
    );

    const estado =
      (atribucion?.id_estatus_lead ? catalogoPorId.get(atribucion.id_estatus_lead) : null) ??
      (atribucion?.estatus_lead ? catalogoPorClave.get(atribucion.estatus_lead) : null) ??
      null;

    fila.proyectos.push({
      id_entidad_relacionada: er.id,
      id_proyecto: er.id_proyecto ?? null,
      proyecto: er.id_proyecto ? (proyectoMap.get(er.id_proyecto) ?? `Proyecto ${er.id_proyecto}`) : "Sin desarrollo",
      id_estatus_lead: estado?.id ?? null,
      // Si el estado se desactivó en Configuración, se muestra legible en vez del slug crudo.
      estatus: estado?.nombre ?? (atribucion?.estatus_lead ? humanizarClave(atribucion.estatus_lead) : null),
      estatus_color: estado?.color ?? null,
      unidades,
    });
  }

  const rows = [...porPersona.values()].map((fila) => {
    const unidades = fila.proyectos.flatMap((p) => p.unidades);
    fila.proyectos.sort((a, b) => a.proyecto.localeCompare(b.proyecto));
    return { ...fila, total_unidades: unidades.length, es_cliente: unidades.some((u) => u.es_cliente) };
  });
  rows.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { rows, viaRpc: false };
}

/* ─────────────────────────── Reasignación de leads ─────────────────────────── */

export interface AgenteAsignable {
  auth_user_id: string;
  nombre: string;
  email: string | null;
  rol: string | null;
}

/** Agentes a los que se puede transferir un lead. */
export async function fetchAgentesAsignables(): Promise<AgenteAsignable[]> {
  const rpc = await (supabase as any).rpc("get_agentes_asignables");
  if (!rpc.error && Array.isArray(rpc.data)) return rpc.data as AgenteAsignable[];

  // Camino de transición: mismos roles que la RPC (Super Admin, Agente Inmobiliario,
  // Inmobiliaria, Agente Interno, Supervisor de agentes externos, Agente Externo).
  const { data } = await (supabase as any)
    .from("usuarios")
    .select("auth_user_id, nombre, email, rol_id")
    .eq("activo", true)
    .not("auth_user_id", "is", null)
    .in("rol_id", [1, 3, 4, 9, 31, 40])
    .order("nombre");
  return (data ?? []).map((u: any) => ({
    auth_user_id: u.auth_user_id,
    nombre: u.nombre ?? u.email ?? "Sin nombre",
    email: u.email ?? null,
    rol: null,
  }));
}

/**
 * Transfiere el lead a otro agente: quien lo tenía lo pierde. La RPC valida el permiso,
 * sincroniza `id_persona_duena_lead` y deja bitácora en `crm_leads_reasignaciones`.
 */
export async function reasignarLead(
  idEntidadRelacionada: number,
  nuevoPropietario: string,
  motivo?: string,
): Promise<void> {
  const rpc = await (supabase as any).rpc("reasignar_lead", {
    p_id_entidad_relacionada: idEntidadRelacionada,
    p_nuevo_propietario: nuevoPropietario,
    p_motivo: motivo ?? null,
  });
  if (!rpc.error) return;

  const faltaFuncion = /function .* does not exist|schema cache/i.test(rpc.error.message ?? "");
  throw new Error(
    faltaFuncion
      ? "Reasignar prospectos requiere las migraciones 04 y 07 aplicadas en la base."
      : rpc.error.message,
  );
}
