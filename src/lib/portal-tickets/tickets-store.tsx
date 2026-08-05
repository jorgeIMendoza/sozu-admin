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
  Etapa,
  Pipeline,
  Ticket,
} from "./tickets-data";
import { saveTicketAdjuntos, type PendingAdjunto } from "./tickets-adjuntos";

// Las tablas tickets_* no están en los tipos generados de Supabase → cast puntual.
const sb = supabase as any;

// Correo "ticket asignado" (fire-and-forget). Estándar del ecosistema SOZU: enviar-notificacion
// (proxy n8n) + template Postmark 41353048 — mismo patrón que crm-recordatorios-tareas
// (recordatorio de tarea al asesor asignado). Nunca bloquea ni hace fallar la operación.
// Reutilizada por el store (Portal Tickets) y por la ficha de contacto del CRM.
export function enviarCorreoAsignacion(
  destinatarios: { email?: string | null; nombre?: string | null }[],
  folio: number | string,
  nombreTicket: string,
  asignadoPor: string,
) {
  for (const dest of destinatarios) {
    if (!dest?.email) continue;
    const actividad = `Se te asignó el ticket #${folio}: ${nombreTicket}`;
    const detalles =
      `<tr><td style="padding:6px 12px;color:#6b7280;">Ticket</td>` +
      `<td style="padding:6px 12px;font-weight:600;">#${folio} — ${nombreTicket}</td></tr>` +
      `<tr><td style="padding:6px 12px;color:#6b7280;">Asignado por</td>` +
      `<td style="padding:6px 12px;">${asignadoPor}</td></tr>`;
    const modelo = { nombre: dest.nombre || "Equipo", actividad, detalles };
    sb.functions
      .invoke("enviar-notificacion", {
        body: {
          tipo: "email",
          from: "Notificaciones Sozu <notificaciones@sozu.com>",
          email: dest.email,
          asunto: actividad,
          mensaje: modelo,
          templateId: 41353048,
          templateModel: modelo,
        },
      })
      .catch(() => {
        /* fire-and-forget: el correo no debe romper el flujo */
      });
  }
}

type NuevoTicket = {
  nombre: string;
  pipelineId: string;
  etapaId: string;
  prioridad: Ticket["prioridad"];
  categoriaId: string;
  propietarios: string[];
  solicitante: string;
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
  agregarNota: (id: string, texto: string) => void;
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
    sb.from("usuarios").select("auth_user_id, nombre, email, rol_id").eq("activo", true).in("rol_id", rolIds),
    sb.from("roles").select("id, nombre"),
  ]);
  const rolMap = new Map((roles ?? []).map((r: any) => [r.id, r.nombre]));
  return (us ?? [])
    .filter((u: any) => u.auth_user_id)
    .map((u: any) => ({
      id: u.auth_user_id,
      nombre: u.nombre,
      email: u.email,
      rol: rolMap.get(u.rol_id) ?? "",
    }))
    .sort((a: Agente, b: Agente) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
}

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await sb
    .from("tickets")
    .select(
      "id, numero, nombre, id_pipeline, id_etapa, prioridad, id_categoria, id_usuario_creador, id_entidad_relacionada, id_propiedad, solicitante, inmueble, descripcion, fuente, fecha_creacion, fecha_cierre, tickets_propietarios(id_usuario), tickets_actividad(id, texto, id_usuario_autor, fecha_creacion)",
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
    async (idTicket: string, texto: string, tipo = "sistema") => {
      await sb.from("tickets_actividad").insert({
        id_ticket: Number(idTicket),
        texto,
        tipo,
        id_usuario_autor: uid,
      });
    },
    [uid],
  );

  // Resuelve el email de cada propietario NUEVO (por auth_user_id) y dispara el correo estándar
  // (ver enviarCorreoAsignacion). `autor` = quién está asignando.
  const notificarAsignacion = useCallback(
    (idsNuevos: string[], folio: number | string, nombreTicket: string) => {
      const destinatarios = idsNuevos
        .map((id) => agentes.find((a) => a.id === id))
        .filter((a): a is Agente => !!a?.email);
      enviarCorreoAsignacion(destinatarios, folio, nombreTicket, autor);
    },
    [agentes, autor],
  );

  const crearTicket = useCallback(
    async (data: NuevoTicket) => {
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
          id_entidad_relacionada: data.entidadRelacionadaId ? Number(data.entidadRelacionadaId) : null,
          id_propiedad: data.propiedadId ? Number(data.propiedadId) : null,
          solicitante: data.solicitante?.trim() || null,
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
        const props = (data.propietarios ?? []).filter(Boolean);
        if (props.length) {
          await sb
            .from("tickets_propietarios")
            .insert(props.map((u: string) => ({ id_ticket: ins.id, id_usuario: u })));
          notificarAsignacion(props, ins.numero, data.nombre.trim());
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
    [uid, registrarActividad, invalidate, logger, notificarAsignacion],
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
        if (nuevos.length) notificarAsignacion(nuevos, tk?.numero ?? "", tk?.nombre ?? "Ticket");
      }
      if ("categoriaId" in cambios) patch.id_categoria = cambios.categoriaId ? Number(cambios.categoriaId) : null;
      if ("solicitante" in cambios) patch.solicitante = cambios.solicitante || null;
      if ("inmueble" in cambios) patch.inmueble = cambios.inmueble || null;
      if ("descripcion" in cambios) patch.descripcion = cambios.descripcion || null;
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
    [tickets, registrarActividad, invalidate, logger, notificarAsignacion],
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
      invalidate("tickets-list");
    },
    [etapas, registrarActividad, invalidate, logger],
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
    async (id: string, texto: string) => {
      await registrarActividad(id, texto, "nota");
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
