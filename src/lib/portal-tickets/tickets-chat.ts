// Portal Tickets — Chat interno de atención (data layer).
// Tablas: tickets_chat_participantes (unión por fila) + tickets_chat_mensajes (log append-only).
// La RLS por pertenencia vive en la BD (solo participantes ven/escriben mensajes; solo
// stakeholders se unen), así que aquí solo hacemos las queries; el servidor filtra.
// Las tablas no están en los tipos generados de Supabase → cast puntual.
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type ChatMensaje = {
  id: string;
  idAutor: string;
  texto: string;
  fecha: string;
};

export type ChatParticipante = {
  idUsuario: string;
  fechaUnion: string;
};

export type ChatData = {
  mensajes: ChatMensaje[];
  participantes: ChatParticipante[];
};

// Carga mensajes + participantes de un ticket (la RLS acota a participantes/stakeholders).
export async function fetchChatData(ticketId: string): Promise<ChatData> {
  const idNum = Number(ticketId);
  const [msjRes, partRes] = await Promise.all([
    sb
      .from("tickets_chat_mensajes")
      .select("id, id_autor, texto, fecha_creacion")
      .eq("id_ticket", idNum)
      .order("fecha_creacion", { ascending: true }),
    sb
      .from("tickets_chat_participantes")
      .select("id_usuario, fecha_union")
      .eq("id_ticket", idNum)
      .order("fecha_union", { ascending: true }),
  ]);

  const mensajes: ChatMensaje[] = (msjRes.data ?? []).map((m: any) => ({
    id: String(m.id),
    idAutor: m.id_autor,
    texto: m.texto,
    fecha: m.fecha_creacion,
  }));
  const participantes: ChatParticipante[] = (partRes.data ?? []).map((p: any) => ({
    idUsuario: p.id_usuario,
    fechaUnion: p.fecha_union,
  }));
  return { mensajes, participantes };
}

// Une al usuario actual al chat (idempotente: UNIQUE(id_ticket,id_usuario) → ON CONFLICT DO NOTHING).
export async function unirseChat(ticketId: string, uid: string): Promise<void> {
  const { error } = await sb
    .from("tickets_chat_participantes")
    .upsert(
      { id_ticket: Number(ticketId), id_usuario: uid },
      { onConflict: "id_ticket,id_usuario", ignoreDuplicates: true },
    );
  if (error) throw error;
}

// Inserta un mensaje (la RLS exige que seas participante y que id_autor seas tú).
export async function enviarMensajeChat(ticketId: string, uid: string, texto: string): Promise<void> {
  const { error } = await sb
    .from("tickets_chat_mensajes")
    .insert({ id_ticket: Number(ticketId), id_autor: uid, texto });
  if (error) throw error;
}
