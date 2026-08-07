// Store del Portal Tickets de Seguimiento conectado a Supabase (tablas tickets_*).
// Mantiene el MISMO contrato que consumía la UI con datos mock (useTickets()), pero por
// debajo lee/escribe con React Query. Los ids se exponen como string al front y se
// convierten a integer al escribir en BD. La asignación (propietarioId) usa auth_user_id.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { toast } from "sonner";
import type {
  Agente,
  Categoria,
  ContactoRef,
  Etapa,
  Pipeline,
  Ticket,
} from "./tickets-data";
import { saveTicketAdjuntos, uploadTicketFile, type PendingAdjunto } from "./tickets-adjuntos";

// Las tablas tickets_* no están en los tipos generados de Supabase → cast puntual.
const sb = supabase as any;

// ─── Correos de tickets (fire-and-forget) ───────────────────────────────────────
// Estándar del ecosistema SOZU: enviar-notificacion (proxy n8n) + template Postmark
// 41353048 — mismo patrón que crm-recordatorios-tareas. Nunca bloquea ni hace fallar
// la operación. Reutilizados por el store (Portal Tickets) y por la ficha del CRM.
export type CorreoTicketInfo = {
  folio: number | string;
  nombre: string;
  pipeline?: string | null;
  proyecto?: string | null;
  descripcion?: string | null;
  por?: string | null; // quién asignó / cerró
};

type Destinatario = { email?: string | null; nombre?: string | null; telefono?: string | null };

const escHtml = (s?: string | number | null) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Tabla del cuerpo del correo: Ticket, Nombre, Pipeline, (Asignado/Resuelto) por, Proyecto, Descripción.
function detallesHtml(info: CorreoTicketInfo, porLabel: string): string {
  const row = (label: string, val: string) =>
    `<tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td>` +
    `<td style="padding:6px 12px;">${val}</td></tr>`;
  return [
    row("Ticket", `#${escHtml(info.folio)}`),
    row("Nombre del ticket", escHtml(info.nombre) || "—"),
    info.pipeline ? row("Pipeline", escHtml(info.pipeline)) : "",
    info.por ? row(porLabel, escHtml(info.por)) : "",
    row("Proyecto", info.proyecto ? escHtml(info.proyecto) : "Sin proyecto"),
    info.descripcion ? row("Descripción", escHtml(info.descripcion)) : "",
  ].join("");
}

function enviarCorreoTicket(
  destinatarios: Destinatario[],
  asunto: string,
  actividad: string,
  detalles: string,
  mensajeWA: string,
) {
  for (const dest of destinatarios) {
    if (!dest?.email && !dest?.telefono) continue;
    // El template dice "Hola {nombre}, se ha realizado la {actividad}." → actividad = frase nominal
    // (ej. "resolución del ticket #1006: …"), NO una oración completa.
    const modelo = { nombre: dest.nombre || "Equipo", actividad, detalles };
    const conWA = !!dest.telefono;
    sb.functions
      .invoke("enviar-notificacion", {
        body: {
          // "ambos" = correo + WhatsApp (Evolution vía n8n); sin teléfono, solo correo.
          tipo: conWA ? "ambos" : "email",
          from: "Notificaciones Sozu <notificaciones@sozu.com>",
          email: dest.email,
          ...(conWA ? { telefono: dest.telefono, mensajeWA } : {}),
          asunto,
          mensaje: modelo,
          templateId: 41353048,
          templateModel: modelo,
        },
      })
      .catch(() => {
        /* fire-and-forget: la notificación no debe romper el flujo */
      });
  }
}

// Cuerpo del mensaje de WhatsApp (texto plano; admite *negritas*).
function textoWa(info: CorreoTicketInfo, encabezado: string, porLabel: string): string {
  return [
    `*${encabezado} #${info.folio}*`,
    info.nombre || "",
    info.pipeline ? `Pipeline: ${info.pipeline}` : "",
    info.por ? `${porLabel}: ${info.por}` : "",
    info.proyecto ? `Proyecto: ${info.proyecto}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Correo (+ WhatsApp si el destinatario tiene teléfono) "ticket asignado" a un usuario.
export function enviarCorreoAsignacion(destinatarios: Destinatario[], info: CorreoTicketInfo) {
  const asunto = `Ticket #${info.folio} asignado: ${info.nombre}`;
  enviarCorreoTicket(
    destinatarios,
    asunto,
    `Asignación del ticket #${info.folio}: ${info.nombre}`,
    detallesHtml(info, "Asignado por"),
    textoWa(info, "Ticket asignado", "Asignado por"),
  );
}

// Correo (+ WhatsApp si hay teléfono) "ticket cerrado" a propietarios + creador.
export function enviarCorreoCierre(destinatarios: Destinatario[], info: CorreoTicketInfo) {
  const asunto = `Ticket #${info.folio} resuelto: ${info.nombre}`;
  enviarCorreoTicket(
    destinatarios,
    asunto,
    `Resolución del ticket #${info.folio}: ${info.nombre}`,
    detallesHtml(info, "Resuelto por"),
    textoWa(info, "Ticket resuelto", "Resuelto por"),
  );
}

type NuevoTicket = {
  nombre: string;
  pipelineId: string;
  etapaId: string;
  prioridad: Ticket["prioridad"];
  categoriaId: string;
  propietarios: string[];
  solicitante: string;
  solicitantes?: ContactoRef[];
  inmueble: string;
  descripcion: string;
  fuente?: string;
  fechaCreacion?: string;
  entidadRelacionadaId?: string | null;
  propiedadId?: string | null;
  adjuntos?: PendingAdjunto[];
};

type Store = {
  tickets: Ticket[];
  pipelines: Pipeline[];
  etapas: Etapa[];
  categorias: Categoria[];
  agentes: Agente[];
  autor: string;
  cargando: boolean;
  crearTicket: (t: NuevoTicket) => void;
  actualizarTicket: (id: string, cambios: Partial<Ticket>, nota?: string) => void;
  moverEtapa: (id: string, etapaId: string) => void;
  eliminarTickets: (ids: string[]) => void;
  agregarNota: (id: string, texto: string, audioFile?: File) => void;
  guardarPipeline: (p: Pipeline) => void;
  eliminarPipeline: (id: string) => void;
  guardarEtapa: (e: Etapa) => void;
  eliminarEtapa: (id: string) => void;
  guardarCategoria: (c: Categoria) => void;
  eliminarCategoria: (id: string) => void;
  guardarAgente: (a: Agente) => void;
  eliminarAgente: (id: string) => void;
};

const TicketsContext = createContext<Store | null>(null);

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchPipelines(): Promise<Pipeline[]> {
  const { data } = await sb
    .from("tickets_pipelines")
    .select("id, nombre, descripcion, orden")
    .eq("activo", true)
    .order("orden");
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    nombre: r.nombre,
    descripcion: r.descripcion ?? "",
  }));
}

async function fetchEtapas(): Promise<Etapa[]> {
  const { data } = await sb
    .from("tickets_etapas")
    .select("id, id_pipeline, nombre, orden, cerrada")
    .eq("activo", true)
    .order("id_pipeline")
    .order("orden");
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    pipelineId: String(r.id_pipeline),
    nombre: r.nombre,
    orden: r.orden,
    cerrada: r.cerrada,
  }));
}

async function fetchCategorias(): Promise<Categoria[]> {
  const { data } = await sb
    .from("tickets_categorias")
    .select("id, nombre, orden, id_pipeline")
    .eq("activo", true)
    .order("orden");
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    nombre: r.nombre,
    pipelineId: r.id_pipeline != null ? String(r.id_pipeline) : null,
  }));
}

// Pool de asignables = usuarios activos cuyo rol tiene acceso a alguna ruta del portal
// de tickets (mismo criterio que fetchCrmOwners; se deriva de BD para no hardcodear roles).
// Exportada para reusarla en el selector "Ver como" (impersonación).
export async function fetchAgentes(): Promise<Agente[]> {
  let rolIds: number[] = [];
  const { data: subs } = await sb
    .from("submenus")
    .select("id")
    .like("vista_front_end", "/admin/portal-tickets/%");
  const submenuIds = (subs ?? []).map((s: any) => s.id);
  if (submenuIds.length) {
    const { data: perms } = await sb
      .from("submenus_permisos")
      .select("rol_id")
      .in("submenu_id", submenuIds)
      .eq("activo", true);
    rolIds = Array.from(new Set((perms ?? []).map((p: any) => p.rol_id)));
  }
  if (!rolIds.length) rolIds = [1]; // fallback: Super Admin

  const [{ data: us }, { data: roles }] = await Promise.all([
    sb.from("usuarios").select("auth_user_id, nombre, email, rol_id, telefono, clave_pais_telefono").eq("activo", true).in("rol_id", rolIds),
    sb.from("roles").select("id, nombre"),
  ]);
  const rolMap = new Map((roles ?? []).map((r: any) => [r.id, r.nombre]));
  // Número para WhatsApp = lada de país + teléfono (solo dígitos). `clave_pais_telefono` puede
  // venir como número ("+52"/"52") o como ISO ("MX"); si es ISO se mapea a lada (default México=52).
  // Sin esto, "MX" perdía la lada al quitar los no-dígitos y el WhatsApp no se entregaba.
  const LADA_POR_ISO: Record<string, string> = {
    MX: "52", US: "1", CA: "1", ES: "34", CO: "57", AR: "54", PE: "51", CL: "56", GT: "502",
  };
  const numeroWA = (u: any): string | null => {
    const tel = String(u.telefono ?? "").replace(/\D/g, "");
    if (!tel) return null;
    const claveRaw = String(u.clave_pais_telefono ?? "").trim().toUpperCase();
    let lada = claveRaw.replace(/\D/g, ""); // "+52" → "52"
    if (!lada) lada = LADA_POR_ISO[claveRaw] ?? "52"; // "MX" → "52"; default México
    return `${lada}${tel}`;
  };
  return (us ?? [])
    .filter((u: any) => u.auth_user_id)
    .map((u: any) => ({
      id: u.auth_user_id,
      nombre: u.nombre,
      email: u.email,
      rol: rolMap.get(u.rol_id) ?? "",
      telefono: numeroWA(u),
    }))
    .sort((a: Agente, b: Agente) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
}

// Teléfono legible para el popover de solicitantes: prefija la lada solo si clave_pais_telefono
// parece número (+52), no cuando es un ISO ("MX"). Devuelve null si no hay teléfono.
function telefonoDisplay(p: { telefono?: string | null; clave_pais_telefono?: string | null }): string | null {
  const tel = String(p.telefono ?? "").trim();
  if (!tel) return null;
  const clave = String(p.clave_pais_telefono ?? "").trim();
  const lada = /^\+?\d+$/.test(clave) ? `+${clave.replace(/^\+/, "")} ` : "";
  return `${lada}${tel}`;
}

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await sb
    .from("tickets")
    .select(
      "id, numero, nombre, id_pipeline, id_etapa, prioridad, id_categoria, id_usuario_creador, id_entidad_relacionada, id_propiedad, solicitante, inmueble, descripcion, fuente, fecha_creacion, fecha_cierre, tickets_propietarios(id_usuario), tickets_actividad(id, texto, id_usuario_autor, fecha_creacion, audio_url, audio_nombre, audio_mime)",
    )
    .eq("activo", true)
    .order("fecha_creacion", { ascending: false });
  const rows = data ?? [];

  // Resolver nombres de autores de actividad (uuid → nombre) en un solo fetch.
  const uuids = new Set<string>();
  for (const r of rows) {
    for (const a of r.tickets_actividad ?? []) if (a.id_usuario_autor) uuids.add(a.id_usuario_autor);
  }
  let nameMap: Record<string, string> = {};
  if (uuids.size) {
    const { data: us } = await sb
      .from("usuarios")
      .select("auth_user_id, nombre")
      .in("auth_user_id", Array.from(uuids));
    nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
  }

  // Solicitantes (multi): la tabla de unión tickets_solicitantes puede no existir aún en dev
  // (migración pendiente) → se consulta aparte con fallback. Si un ticket no tiene filas en la
  // unión, se usa el solicitante legacy (tickets.id_entidad_relacionada) para no perder el dato.
  const ticketIds = rows.map((r: any) => r.id);
  const solByTicket: Record<string, number[]> = {};
  if (ticketIds.length) {
    const { data: solRows, error: solErr } = await sb
      .from("tickets_solicitantes")
      .select("id_ticket, id_entidad_relacionada")
      .in("id_ticket", ticketIds);
    if (!solErr) {
      for (const s of solRows ?? []) (solByTicket[String(s.id_ticket)] ||= []).push(s.id_entidad_relacionada);
    }
  }
  const entIdsByTicket: Record<string, number[]> = {};
  const entIds = new Set<number>();
  for (const r of rows) {
    const fromJoin = solByTicket[String(r.id)];
    const list =
      fromJoin && fromJoin.length
        ? fromJoin
        : r.id_entidad_relacionada != null
          ? [r.id_entidad_relacionada]
          : [];
    entIdsByTicket[String(r.id)] = list;
    for (const id of list) entIds.add(id);
  }
  let contactoMap: Record<string, ContactoRef> = {};
  if (entIds.size) {
    const { data: ents } = await sb
      .from("entidades_relacionadas")
      .select("id, id_persona")
      .in("id", Array.from(entIds));
    const personaIds = Array.from(new Set((ents ?? []).map((e: any) => e.id_persona).filter(Boolean)));
    let personaMap: Record<string, { nombre: string; email: string; telefono: string | null }> = {};
    if (personaIds.length) {
      const { data: personas } = await sb
        .from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono, clave_pais_telefono")
        .in("id", personaIds);
      personaMap = Object.fromEntries(
        (personas ?? []).map((p: any) => [
          String(p.id),
          {
            nombre: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? "",
            telefono: telefonoDisplay(p),
          },
        ]),
      );
    }
    contactoMap = Object.fromEntries(
      (ents ?? []).map((e: any): [string, ContactoRef] => {
        const p = personaMap[String(e.id_persona)];
        return [
          String(e.id),
          { id: String(e.id), nombre: p?.nombre ?? "Contacto", email: p?.email ?? "", telefono: p?.telefono ?? null },
        ];
      }),
    );
  }

  return rows.map((r: any) => ({
    id: String(r.id),
    numero: r.numero,
    nombre: r.nombre,
    pipelineId: String(r.id_pipeline),
    etapaId: String(r.id_etapa),
    prioridad: r.prioridad,
    categoriaId: r.id_categoria != null ? String(r.id_categoria) : "",
    propietarios: (r.tickets_propietarios ?? []).map((p: any) => p.id_usuario),
    creadoPorId: r.id_usuario_creador ?? null,
    solicitante: r.solicitante ?? "",
    solicitantes: (entIdsByTicket[String(r.id)] ?? [])
      .map((eid) => contactoMap[String(eid)])
      .filter(Boolean) as ContactoRef[],
    inmueble: r.inmueble ?? "",
    descripcion: r.descripcion ?? "",
    fechaCreacion: r.fecha_creacion,
    fechaCierre: r.fecha_cierre ?? null,
    fuente: r.fuente ?? "Portal",
    entidadRelacionadaId: r.id_entidad_relacionada != null ? String(r.id_entidad_relacionada) : null,
    propiedadId: r.id_propiedad != null ? String(r.id_propiedad) : null,
    actividad: (r.tickets_actividad ?? [])
      .map((a: any) => ({
        id: String(a.id),
        fecha: a.fecha_creacion,
        autor: a.id_usuario_autor ? nameMap[a.id_usuario_autor] ?? "Usuario" : "Sistema",
        texto: a.texto,
        audioUrl: a.audio_url ?? null,
      }))
      .sort((x: any, y: any) => new Date(x.fecha).getTime() - new Date(y.fecha).getTime()),
  }));
}

export function TicketsProvider({ children }: { children: ReactNode; autor?: string }) {
  const { user, profile } = useAuth();
  const logger = useActivityLogger();
  const qc = useQueryClient();
  const uid: string | null = user?.id ?? null;
  const autor = (profile as any)?.nombre || user?.email || "Sistema";

  const pipelinesQ = useQuery({ queryKey: ["tickets-pipelines"], queryFn: fetchPipelines });
  const etapasQ = useQuery({ queryKey: ["tickets-etapas"], queryFn: fetchEtapas });
  const categoriasQ = useQuery({ queryKey: ["tickets-categorias"], queryFn: fetchCategorias });
  const agentesQ = useQuery({ queryKey: ["tickets-agentes"], queryFn: fetchAgentes });
  const ticketsQ = useQuery({ queryKey: ["tickets-list"], queryFn: fetchTickets });

  const pipelines = pipelinesQ.data ?? [];
  const etapas = etapasQ.data ?? [];
  const categorias = categoriasQ.data ?? [];
  const agentes = agentesQ.data ?? [];
  const tickets = ticketsQ.data ?? [];

  const invalidate = useCallback(
    (key: string) => qc.invalidateQueries({ queryKey: [key] }),
    [qc],
  );

  const registrarActividad = useCallback(
    async (
      idTicket: string,
      texto: string,
      tipo = "sistema",
      audio?: { url: string; nombre: string | null; mime: string | null } | null,
    ) => {
      await sb.from("tickets_actividad").insert({
        id_ticket: Number(idTicket),
        texto,
        tipo,
        id_usuario_autor: uid,
        audio_url: audio?.url ?? null,
        audio_nombre: audio?.nombre ?? null,
        audio_mime: audio?.mime ?? null,
      });
    },
    [uid],
  );

  // Nombre del pipeline (para el cuerpo de los correos).
  const pipelineNombre = useCallback(
    (pipelineId?: string | null) => pipelines.find((p) => p.id === pipelineId)?.nombre ?? "",
    [pipelines],
  );

  // Resuelve el email de cada propietario NUEVO (por auth_user_id) y dispara el correo de
  // asignación. `autor` = quién está asignando.
  const notificarAsignacion = useCallback(
    (idsNuevos: string[], info: Omit<CorreoTicketInfo, "por">) => {
      const destinatarios = idsNuevos
        .map((id) => agentes.find((a) => a.id === id))
        .filter((a): a is Agente => !!a?.email);
      enviarCorreoAsignacion(destinatarios, { ...info, por: autor });
    },
    [agentes, autor],
  );

  // Al cerrar un ticket (etapa final) avisa por correo a los propietarios + el creador.
  const notificarCierre = useCallback(
    (tk: Ticket) => {
      const ids = Array.from(
        new Set([...(tk.propietarios ?? []), tk.creadoPorId].filter(Boolean) as string[]),
      );
      const destinatarios = ids
        .map((id) => agentes.find((a) => a.id === id))
        .filter((a): a is Agente => !!a?.email);
      enviarCorreoCierre(destinatarios, {
        folio: tk.numero,
        nombre: tk.nombre,
        pipeline: pipelineNombre(tk.pipelineId),
        proyecto: tk.inmueble,
        descripcion: tk.descripcion,
        por: autor,
      });
    },
    [agentes, autor, pipelineNombre],
  );

  const crearTicket = useCallback(
    async (data: NuevoTicket) => {
      const sols = (data.solicitantes ?? []).filter(Boolean);
      const principal = sols[0] ?? null;
      const { data: ins, error } = await sb
        .from("tickets")
        .insert({
          nombre: data.nombre.trim(),
          id_pipeline: Number(data.pipelineId),
          id_etapa: Number(data.etapaId),
          prioridad: data.prioridad,
          id_categoria: data.categoriaId ? Number(data.categoriaId) : null,
          id_usuario_propietario: data.propietarios?.[0] || null,
          id_usuario_creador: uid,
          id_entidad_relacionada: principal
            ? Number(principal.id)
            : data.entidadRelacionadaId
              ? Number(data.entidadRelacionadaId)
              : null,
          id_propiedad: data.propiedadId ? Number(data.propiedadId) : null,
          solicitante: (principal ? principal.nombre : data.solicitante)?.trim() || null,
          inmueble: data.inmueble?.trim() || null,
          descripcion: data.descripcion?.trim() || null,
          fuente: data.fuente || "Portal",
          fecha_creacion: data.fechaCreacion ?? undefined,
        })
        .select("id, numero")
        .single();
      if (error) {
        toast.error(`No se pudo crear el ticket: ${error.message}`);
        return;
      }
      if (ins?.id) {
        if (sols.length) {
          await sb
            .from("tickets_solicitantes")
            .insert(sols.map((s: ContactoRef) => ({ id_ticket: ins.id, id_entidad_relacionada: Number(s.id) })));
        }
        const props = (data.propietarios ?? []).filter(Boolean);
        if (props.length) {
          await sb
            .from("tickets_propietarios")
            .insert(props.map((u: string) => ({ id_ticket: ins.id, id_usuario: u })));
          notificarAsignacion(props, {
            folio: ins.numero,
            nombre: data.nombre.trim(),
            pipeline: pipelineNombre(data.pipelineId),
            proyecto: data.inmueble,
            descripcion: data.descripcion,
          });
        }
        if (data.adjuntos?.length) {
          await saveTicketAdjuntos(ins.id, uid, data.adjuntos);
        }
        await registrarActividad(String(ins.id), "Ticket creado desde el Portal Tickets de Seguimiento.");
        logger.registrarCreacion(
          "ticket",
          {
            id_ticket: ins.id,
            nombre: data.nombre.trim(),
            id_pipeline: Number(data.pipelineId),
            prioridad: data.prioridad,
          },
          "crear_ticket",
        );
      }
      invalidate("tickets-list");
    },
    [uid, registrarActividad, invalidate, logger, notificarAsignacion, pipelineNombre],
  );

  const actualizarTicket = useCallback(
    async (id: string, cambios: Partial<Ticket>, nota?: string) => {
      const patch: Record<string, unknown> = {};
      if ("prioridad" in cambios) patch.prioridad = cambios.prioridad;
      if ("propietarios" in cambios) {
        const props = (cambios.propietarios ?? []).filter(Boolean);
        const tk = tickets.find((t) => t.id === id);
        const previos = tk?.propietarios ?? [];
        const nuevos = props.filter((p) => !previos.includes(p));
        await sb.from("tickets_propietarios").delete().eq("id_ticket", Number(id));
        if (props.length) {
          await sb
            .from("tickets_propietarios")
            .insert(props.map((u: string) => ({ id_ticket: Number(id), id_usuario: u })));
        }
        patch.id_usuario_propietario = props[0] || null;
        // Notificar SOLO a los propietarios recién agregados.
        if (nuevos.length)
          notificarAsignacion(nuevos, {
            folio: tk?.numero ?? "",
            nombre: tk?.nombre ?? "Ticket",
            pipeline: pipelineNombre(tk?.pipelineId),
            proyecto: tk?.inmueble,
            descripcion: tk?.descripcion,
          });
      }
      if ("solicitantes" in cambios) {
        const sols = (cambios.solicitantes ?? []).filter(Boolean);
        await sb.from("tickets_solicitantes").delete().eq("id_ticket", Number(id));
        if (sols.length) {
          await sb
            .from("tickets_solicitantes")
            .insert(sols.map((s) => ({ id_ticket: Number(id), id_entidad_relacionada: Number(s.id) })));
        }
        // Mantener el "principal" en las columnas legacy (primer solicitante).
        patch.id_entidad_relacionada = sols[0] ? Number(sols[0].id) : null;
        patch.solicitante = sols[0]?.nombre?.trim() || null;
      }
      if ("categoriaId" in cambios) patch.id_categoria = cambios.categoriaId ? Number(cambios.categoriaId) : null;
      if ("solicitante" in cambios) patch.solicitante = cambios.solicitante || null;
      if ("inmueble" in cambios) patch.inmueble = cambios.inmueble || null;
      if ("descripcion" in cambios) patch.descripcion = cambios.descripcion || null;
      if ("nombre" in cambios && cambios.nombre?.trim()) patch.nombre = cambios.nombre.trim();
      if ("fuente" in cambios) patch.fuente = cambios.fuente || "Portal";
      if ("entidadRelacionadaId" in cambios)
        patch.id_entidad_relacionada = cambios.entidadRelacionadaId ? Number(cambios.entidadRelacionadaId) : null;
      if ("propiedadId" in cambios)
        patch.id_propiedad = cambios.propiedadId ? Number(cambios.propiedadId) : null;

      if (Object.keys(patch).length) {
        const { error } = await sb.from("tickets").update(patch).eq("id", Number(id));
        if (error) {
          toast.error(`No se pudo actualizar: ${error.message}`);
          return;
        }
      }
      if (nota) await registrarActividad(id, nota, "cambio_estado");
      if ("propietarios" in cambios) {
        logger.registrarAsignacion(
          "ticket",
          { id_ticket: Number(id), propietarios: cambios.propietarios },
          "asignar_ticket",
        );
      } else {
        logger.registrarActualizacion(
          "ticket",
          { id_ticket: Number(id) },
          { id_ticket: Number(id), ...cambios },
          "actualizar_ticket",
        );
      }
      invalidate("tickets-list");
    },
    [tickets, registrarActividad, invalidate, logger, notificarAsignacion, pipelineNombre],
  );

  const moverEtapa = useCallback(
    async (id: string, etapaId: string) => {
      const etapa = etapas.find((e) => e.id === etapaId);
      if (!etapa) return;
      const { error } = await sb
        .from("tickets")
        .update({
          id_etapa: Number(etapaId),
          id_pipeline: Number(etapa.pipelineId),
          fecha_cierre: etapa.cerrada ? new Date().toISOString() : null,
        })
        .eq("id", Number(id));
      if (error) {
        toast.error(`No se pudo mover el ticket: ${error.message}`);
        return;
      }
      await registrarActividad(id, `Etapa actualizada a "${etapa.nombre}".`, "cambio_estado");
      logger.registrarActualizacion(
        "ticket",
        { id_ticket: Number(id) },
        { id_ticket: Number(id), id_etapa: Number(etapaId), etapa: etapa.nombre },
        etapa.cerrada ? "cerrar_ticket" : "mover_etapa_ticket",
      );
      // Etapa final → avisar por correo a propietarios + creador.
      if (etapa.cerrada) {
        const tk = tickets.find((t) => t.id === id);
        if (tk) notificarCierre(tk);
      }
      invalidate("tickets-list");
    },
    [etapas, tickets, registrarActividad, invalidate, logger, notificarCierre],
  );

  const eliminarTickets = useCallback(
    async (ids: string[]) => {
      const { error } = await sb
        .from("tickets")
        .update({ activo: false })
        .in("id", ids.map((i) => Number(i)));
      if (error) {
        toast.error(`No se pudo eliminar: ${error.message}`);
        return;
      }
      ids.forEach((id) =>
        logger.registrarEliminacion("ticket", { id_ticket: Number(id) }, "eliminar_ticket"),
      );
      invalidate("tickets-list");
    },
    [invalidate, logger],
  );

  const agregarNota = useCallback(
    async (id: string, texto: string, audioFile?: File) => {
      let audio: { url: string; nombre: string | null; mime: string | null } | undefined;
      if (audioFile) {
        const up = await uploadTicketFile(id, audioFile);
        if (up) audio = { url: up.url, nombre: up.nombre, mime: up.mime };
      }
      await registrarActividad(id, texto || "Nota de voz", "nota", audio);
      invalidate("tickets-list");
    },
    [registrarActividad, invalidate],
  );

  // ─── Catálogos (upsert por id vacío = insert / id existente = update) ─────────
  const guardarPipeline = useCallback(
    async (p: Pipeline) => {
      const payload = { nombre: p.nombre.trim(), descripcion: p.descripcion?.trim() || null };
      const { error } = p.id
        ? await sb.from("tickets_pipelines").update(payload).eq("id", Number(p.id))
        : await sb.from("tickets_pipelines").insert(payload);
      if (error) return toast.error(error.message);
      invalidate("tickets-pipelines");
    },
    [invalidate],
  );

  const eliminarPipeline = useCallback(
    async (id: string) => {
      const { error } = await sb.from("tickets_pipelines").update({ activo: false }).eq("id", Number(id));
      if (error) return toast.error(error.message);
      invalidate("tickets-pipelines");
      invalidate("tickets-etapas");
    },
    [invalidate],
  );

  const guardarEtapa = useCallback(
    async (e: Etapa) => {
      const payload = {
        id_pipeline: Number(e.pipelineId),
        nombre: e.nombre.trim(),
        orden: Number(e.orden) || 100,
        cerrada: !!e.cerrada,
      };
      const { error } = e.id
        ? await sb.from("tickets_etapas").update(payload).eq("id", Number(e.id))
        : await sb.from("tickets_etapas").insert(payload);
      if (error) return toast.error(error.message);
      invalidate("tickets-etapas");
    },
    [invalidate],
  );

  const eliminarEtapa = useCallback(
    async (id: string) => {
      const { error } = await sb.from("tickets_etapas").update({ activo: false }).eq("id", Number(id));
      if (error) return toast.error(error.message);
      invalidate("tickets-etapas");
    },
    [invalidate],
  );

  const guardarCategoria = useCallback(
    async (c: Categoria) => {
      const payload = { nombre: c.nombre.trim() };
      const { error } = c.id
        ? await sb.from("tickets_categorias").update(payload).eq("id", Number(c.id))
        : await sb.from("tickets_categorias").insert(payload);
      if (error) return toast.error(error.message);
      invalidate("tickets-categorias");
    },
    [invalidate],
  );

  const eliminarCategoria = useCallback(
    async (id: string) => {
      const { error } = await sb.from("tickets_categorias").update({ activo: false }).eq("id", Number(id));
      if (error) return toast.error(error.message);
      invalidate("tickets-categorias");
    },
    [invalidate],
  );

  // El "Equipo" son usuarios reales de la plataforma: no se crean/eliminan desde aquí.
  const avisoUsuarios = useCallback(
    () => toast.info("El equipo se administra desde el módulo de Usuarios de la plataforma."),
    [],
  );

  const value = useMemo<Store>(
    () => ({
      tickets,
      pipelines,
      etapas,
      categorias,
      agentes,
      autor,
      cargando:
        pipelinesQ.isLoading || etapasQ.isLoading || categoriasQ.isLoading || ticketsQ.isLoading,
      crearTicket,
      actualizarTicket,
      moverEtapa,
      eliminarTickets,
      agregarNota,
      guardarPipeline,
      eliminarPipeline,
      guardarEtapa,
      eliminarEtapa,
      guardarCategoria,
      eliminarCategoria,
      guardarAgente: avisoUsuarios,
      eliminarAgente: avisoUsuarios,
    }),
    [
      tickets,
      pipelines,
      etapas,
      categorias,
      agentes,
      autor,
      pipelinesQ.isLoading,
      etapasQ.isLoading,
      categoriasQ.isLoading,
      ticketsQ.isLoading,
      crearTicket,
      actualizarTicket,
      moverEtapa,
      eliminarTickets,
      agregarNota,
      guardarPipeline,
      eliminarPipeline,
      guardarEtapa,
      eliminarEtapa,
      guardarCategoria,
      eliminarCategoria,
      avisoUsuarios,
    ],
  );

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets debe usarse dentro de TicketsProvider");
  return ctx;
}
