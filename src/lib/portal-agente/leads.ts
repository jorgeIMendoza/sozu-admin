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
  /** true = el lead se cerró/descartó. Lo declara el catálogo, no el front. */
  es_descarte: boolean;
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
  // `es_descarte` marca los estados de cierre (asesor inmobiliario, registro por error…).
  // Si la columna aún no existe se reintenta sin ella: todos quedan como activos.
  const conFlag = await (supabase as any)
    .from("crm_estados_lead")
    .select("id, clave, nombre, color, orden, es_descarte")
    .eq("activo", true)
    .order("orden");

  const res = conFlag.error
    ? await (supabase as any)
        .from("crm_estados_lead")
        .select("id, clave, nombre, color, orden")
        .eq("activo", true)
        .order("orden")
    : conFlag;

  if (!res.error && res.data && res.data.length > 0) {
    return (res.data as any[]).map((e) => ({
      id: e.id,
      clave: e.clave,
      nombre: e.nombre,
      color: e.color ?? null,
      es_descarte: e.es_descarte === true,
    }));
  }

  // Respaldo: ids negativos para no confundirlos con los del catálogo real.
  return META_LEAD_STATUSES.map((e, i) => ({
    id: -(i + 1),
    clave: e.value,
    nombre: e.label,
    color: e.color ?? null,
    es_descarte: false,
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
  /** Texto libre: nombre, correo o teléfono de la persona. Se resuelve en la base. */
  search?: string | null;
  estatus?: number | null;
  proyecto?: number | null;
  /** true = oculta los estados marcados como descarte en el catálogo. */
  soloActivos?: boolean;
  /** Tamaño de página. */
  limit?: number;
  offset?: number;
}

export interface ProspectosPagina {
  rows: ProspectoRow[];
  /** Prospectos que cumplen el filtro **en la base**, no los de esta página. */
  total: number;
  viaRpc: boolean;
  /** false = la RPC de la base todavía no sabe ocultar descartes (migración 06 pendiente). */
  soloActivosSoportado: boolean;
}

/** Desarrollo con prospectos del agente, para poblar el filtro sin depender de la página. */
export interface ProyectoFaceta {
  id_proyecto: number | null;
  proyecto: string;
  prospectos: number;
}

/**
 * Desarrollos en los que el agente tiene prospectos. Va aparte de la página porque el
 * filtro tiene que ofrecer **todos** sus desarrollos, no los de las 25 filas visibles.
 * Devuelve `null` si la RPC aún no existe: la UI cae a lo que trae la página.
 */
export async function fetchAgenteProspectosFacetas(
  authUserId: string | null,
  soloActivos = false,
): Promise<ProyectoFaceta[] | null> {
  if (!authUserId) return [];

  const mapear = (data: any[]): ProyectoFaceta[] =>
    data.map((r) => ({
      id_proyecto: r.id_proyecto ?? null,
      proyecto: r.proyecto ?? "Sin desarrollo",
      prospectos: Number(r.prospectos ?? 0),
    }));

  // Los conteos del filtro tienen que usar el mismo corte que la lista, o no cuadran.
  const conCorte = await (supabase as any).rpc("get_agente_prospectos_facetas", {
    p_auth_user_id: authUserId,
    p_solo_activos: soloActivos,
  });
  if (!conCorte.error && Array.isArray(conCorte.data)) return mapear(conCorte.data);

  // Firma vieja (1 argumento): sin corte, pero mejor eso que un selector vacío.
  const sinCorte = await (supabase as any).rpc("get_agente_prospectos_facetas", {
    p_auth_user_id: authUserId,
  });
  if (!sinCorte.error && Array.isArray(sinCorte.data)) return mapear(sinCorte.data);
  return null;
}

/**
 * Valor centinela para «Sin desarrollo»: 2,587 de 4,225 leads no tienen proyecto, así que
 * es un filtro real y no se puede expresar con `p_proyecto IS NULL` (eso significa «todos»).
 */
export const PROYECTO_SIN_DESARROLLO = -1;

/** Mismos filtros que la RPC, para el camino de transición (que lee sin paginar). */
function aplicarFiltros(
  rows: ProspectoRow[],
  { search, estatus, proyecto, descartes }: {
    search?: string | null;
    estatus?: number | null;
    proyecto?: number | null;
    /** ids de estado a ocultar; vacío = no ocultar nada. */
    descartes?: Set<number>;
  },
): ProspectoRow[] {
  const q = (search ?? "").trim().toLowerCase();
  return rows.filter((p) => {
    if (q && !(
      p.nombre.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.telefono ?? "").toLowerCase().includes(q) ||
      p.proyectos.some((pr) => pr.proyecto.toLowerCase().includes(q))
    )) return false;
    if (estatus != null && !p.proyectos.some((pr) => pr.id_estatus_lead === estatus)) return false;
    if (proyecto != null) {
      const sinDesarrollo = proyecto === PROYECTO_SIN_DESARROLLO;
      const coincide = p.proyectos.some((pr) =>
        sinDesarrollo ? pr.id_proyecto == null : pr.id_proyecto === proyecto);
      if (!coincide) return false;
    }
    // Sin estado = sigue en juego, nunca se oculta.
    if (descartes?.size) {
      const vivo = p.proyectos.some(
        (pr) => pr.id_estatus_lead == null || !descartes.has(pr.id_estatus_lead));
      if (!vivo) return false;
    }
    return true;
  });
}

/**
 * Una página de prospectos del agente, con sus proyectos y, dentro de cada uno, sus unidades.
 *
 * Búsqueda y paginación son **del lado de la base**: la RPC devuelve `total_personas` con el
 * universo filtrado completo. Antes se pedían 500 filas y se filtraba en memoria, así que un
 * agente con más de 500 prospectos no podía encontrar a los de la cola — la búsqueda solo
 * miraba el trozo ya descargado y nada avisaba del corte.
 *
 * Devuelve `viaRpc` para poder avisar en la UI de qué camino se está leyendo.
 */
export async function fetchAgenteProspectos({
  authUserId,
  personaId,
  search = null,
  estatus = null,
  proyecto = null,
  soloActivos = false,
  limit = 25,
  offset = 0,
}: Args): Promise<ProspectosPagina> {
  // Sin identidad efectiva no se lee nada: devolver "todo" sería exponer la cartera
  // ajena (es justo lo que pasaba al impersonar a un usuario sin cuenta auth).
  if (!authUserId && !personaId) return { rows: [], total: 0, viaRpc: false, soloActivosSoportado: true };

  // ── Camino definitivo: la RPC filtra por dueño del lado de la base ──
  // `p_auth_user_id` = agente a consultar. Va SIEMPRE explícito: cuando un admin
  // impersona, `auth.uid()` es el del admin y la RPC devolvía la cartera del CRM
  // del admin dentro del Portal Agente. `fn_agente_actual` valida el permiso de
  // impersonación en la base antes de aceptar un uid distinto al de la sesión.
  const termino = (search ?? "").trim();
  const params: Record<string, unknown> = {
    p_search: termino || null,
    p_estatus: estatus ?? null,
    p_proyecto: proyecto ?? null,
    p_auth_user_id: authUserId ?? null,
    p_limit: limit,
    p_offset: offset,
  };

  // El corte de descartes se resuelve en la base, como la paginación: filtrarlo aquí
  // volvería a mentir en el total y en el número de páginas.
  let soloActivosSoportado = true;
  let rpc = soloActivos
    ? await (supabase as any).rpc("get_agente_prospectos", { ...params, p_solo_activos: true })
    : await (supabase as any).rpc("get_agente_prospectos", params);

  // Firma vieja (6 argumentos, migración 06 sin aplicar): se pide sin el corte y la UI avisa.
  if (soloActivos && rpc.error) {
    soloActivosSoportado = false;
    rpc = await (supabase as any).rpc("get_agente_prospectos", params);
  }

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
    // `total_personas` viene de un count(*) OVER () previo al LIMIT: es el universo, no la página.
    const total = Number((rpc.data as any[])[0]?.total_personas ?? rows.length);
    return { rows, total, viaRpc: true, soloActivosSoportado };
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
  if (ers.size === 0) return { rows: [], total: 0, viaRpc: false, soloActivosSoportado: true };

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

  // Este camino ya trajo todo a memoria, así que filtra y recorta aquí para exponer la
  // misma forma que la RPC: la UI pagina igual con o sin ella.
  const descartes = soloActivos
    ? new Set((catalogo as EstatusLead[]).filter((e) => e.es_descarte).map((e) => e.id))
    : undefined;
  const filtradas = aplicarFiltros(rows, { search, estatus, proyecto, descartes });
  return {
    rows: filtradas.slice(offset, offset + limit),
    total: filtradas.length,
    viaRpc: false,
    soloActivosSoportado: true,
  };
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
