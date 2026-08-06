// Evidencia multimedia (fotos / videos) de los tickets del Portal de Tickets de
// Seguimiento. Espejo del patrón de adjuntos del CRM (crm-adjuntos.tsx): reusa el
// bucket público `documentos` con prefijo `tickets/<id_ticket>/...` y registra
// cada archivo en la tabla `tickets_adjuntos`.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// La tabla tickets_adjuntos no está en los tipos generados de Supabase → cast puntual.
const sb = supabase as any;

export const TICKETS_ATTACH_BUCKET = "documentos";

// Límites de negocio (se validan en el front; el bucket `documentos` no tiene límite).
export const MAX_FOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_ADJUNTOS = 10; // por ticket

export type AdjuntoTipo = "foto" | "video" | "audio";

// Archivo elegido pero aún NO subido (usado al CREAR el ticket, que todavía no tiene id).
export type PendingAdjunto = {
  id: string;
  file: File;
  tipo: AdjuntoTipo;
  nombre: string;
  previewUrl: string;
};

// Archivo ya subido y registrado.
export type TicketAdjunto = {
  id: number;
  url: string;
  tipo: AdjuntoTipo;
  nombre: string;
  mime: string | null;
  tamano: number | null;
};

export function humanFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Clasifica un File como foto/video; null si no es ninguno (no permitido).
export function classifyTicketFile(file: File): AdjuntoTipo | null {
  if (file.type.startsWith("image/")) return "foto";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

// Valida tipo y tamaño. Devuelve el mensaje de error, o null si es válido.
export function validateTicketFile(file: File): string | null {
  const tipo = classifyTicketFile(file);
  if (!tipo) return `"${file.name}" no es una foto, video ni audio.`;
  const max = tipo === "foto" ? MAX_FOTO_BYTES : tipo === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
  if (file.size > max) {
    const lim = tipo === "foto" ? "10 MB" : tipo === "video" ? "50 MB" : "25 MB";
    const cual = tipo === "foto" ? "fotos" : tipo === "video" ? "videos" : "audios";
    return `"${file.name}" pesa ${humanFileSize(file.size)}; el máximo para ${cual} es ${lim}.`;
  }
  return null;
}

// Convierte un File en PendingAdjunto (con preview local) o null si es inválido (avisa con toast).
export function toPendingAdjunto(file: File): PendingAdjunto | null {
  const err = validateTicketFile(file);
  if (err) {
    toast.error(err);
    return null;
  }
  const tipo = classifyTicketFile(file)!;
  return { id: crypto.randomUUID(), file, tipo, nombre: file.name, previewUrl: URL.createObjectURL(file) };
}

// Sube un archivo al bucket y devuelve sus metadatos, o null (con toast) si falla.
export async function uploadTicketFile(
  idTicket: number | string,
  file: File,
): Promise<{ url: string; tipo: AdjuntoTipo; nombre: string; mime: string | null; tamano: number } | null> {
  const tipo = classifyTicketFile(file);
  if (!tipo) return null;
  const safeExt = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `tickets/${idTicket}/${crypto.randomUUID()}.${safeExt}`;
  const { data, error } = await sb.storage
    .from(TICKETS_ATTACH_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error || !data) {
    toast.error(`No se pudo subir "${file.name}": ${error?.message ?? "error desconocido"}`);
    return null;
  }
  const { data: pub } = sb.storage.from(TICKETS_ATTACH_BUCKET).getPublicUrl(data.path);
  return { url: pub.publicUrl, tipo, nombre: file.name, mime: file.type || null, tamano: file.size };
}

// Sube y registra una lista de adjuntos pendientes para un ticket ya creado.
// Best-effort: si la tabla no existe aún (migración no aplicada), avisa pero no rompe.
export async function saveTicketAdjuntos(
  idTicket: number | string,
  userId: string | undefined | null,
  pendientes: PendingAdjunto[],
): Promise<void> {
  for (const a of pendientes) {
    const up = await uploadTicketFile(idTicket, a.file);
    if (!up) continue; // uploadTicketFile ya mostró el motivo exacto
    const { error } = await sb.from("tickets_adjuntos").insert({
      id_ticket: Number(idTicket),
      tipo: up.tipo,
      url: up.url,
      nombre: up.nombre,
      mime: up.mime,
      tamano_bytes: up.tamano,
      id_usuario_autor: userId ?? null,
    });
    if (error) {
      console.warn("tickets_adjuntos insert:", error.message);
      toast.error(`Se subió "${up.nombre}" pero no se registró: ${error.message}`);
    }
  }
}

// Carga los adjuntos activos de un ticket. Best-effort: si la tabla no existe, devuelve [].
export async function fetchTicketAdjuntos(idTicket: number | string): Promise<TicketAdjunto[]> {
  const res = await sb
    .from("tickets_adjuntos")
    .select("id, url, tipo, nombre, mime, tamano_bytes")
    .eq("id_ticket", Number(idTicket))
    .eq("activo", true)
    .order("id", { ascending: true });
  if (res.error) return [];
  return (res.data ?? []).map((r: any) => ({
    id: r.id,
    url: r.url,
    tipo: r.tipo,
    nombre: r.nombre,
    mime: r.mime ?? null,
    tamano: r.tamano_bytes ?? null,
  }));
}

// Soft-delete de un adjunto (la RLS solo lo permite a Super Admin, rol 1). Best-effort
// intenta también quitar el archivo físico del bucket.
export async function deleteTicketAdjunto(adj: TicketAdjunto): Promise<boolean> {
  const { error } = await sb.from("tickets_adjuntos").update({ activo: false }).eq("id", adj.id);
  if (error) {
    toast.error(`No se pudo borrar la evidencia: ${error.message}`);
    return false;
  }
  try {
    const marker = `/object/public/${TICKETS_ATTACH_BUCKET}/`;
    const idx = adj.url.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(adj.url.slice(idx + marker.length));
      await sb.storage.from(TICKETS_ATTACH_BUCKET).remove([path]);
    }
  } catch {
    /* si no hay permiso de storage, el registro ya quedó oculto (activo=false) */
  }
  return true;
}
