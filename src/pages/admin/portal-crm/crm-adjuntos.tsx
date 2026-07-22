// Adjuntos de notas del CRM (imágenes / archivos / notas de voz), extraído de crm.tsx.
// Tipos + helpers puros + subida a Storage + carga + tira de vista previa.

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, FileText, Download } from "lucide-react";

export const CRM_ATTACH_BUCKET = "documentos";

export type AttachKind = "image" | "file" | "audio";
export type PendingAttachment = { id: string; file: File; tipo: AttachKind; nombre: string; previewUrl: string };
export type NoteAttachment = { id: number; url: string; tipo: string; nombre: string; mime: string | null };

export const classifyAttachment = (file: File): AttachKind => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
};

export const humanFileSize = (bytes?: number | null): string => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Sube un archivo al storage y devuelve su URL pública + metadatos.
export async function uploadCrmNoteFile(file: File): Promise<{ url: string; nombre: string; mime: string | null; tamano: number } | null> {
  const safeExt = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `crm-notes/${crypto.randomUUID()}.${safeExt}`;
  const { data, error } = await supabase.storage
    .from(CRM_ATTACH_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error || !data) return null;
  const { data: pub } = supabase.storage.from(CRM_ATTACH_BUCKET).getPublicUrl(data.path);
  return { url: pub.publicUrl, nombre: file.name, mime: file.type || null, tamano: file.size };
}

// Sube y registra los adjuntos de una nota (best-effort: si la tabla aún no existe,
// no rompe el guardado de la nota).
export async function saveNoteAttachments(noteId: number, userId: string | undefined, pend: PendingAttachment[]): Promise<void> {
  for (const a of pend) {
    const up = await uploadCrmNoteFile(a.file);
    if (!up) { toast.error(`No se pudo subir ${a.nombre}`); continue; }
    const { error } = await (supabase as any).from("crm_notas_adjuntos").insert({
      id_nota: noteId, tipo: a.tipo, url: up.url, nombre: up.nombre,
      mime: up.mime, tamano_bytes: up.tamano, id_usuario: userId ?? null,
    });
    if (error) console.warn("crm_notas_adjuntos no disponible:", error.message);
  }
}

// Chips/vista previa de adjuntos ya guardados en una nota.
export function NoteAttachmentsStrip({ attachments }: { attachments: NoteAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => {
        if (a.tipo === "image") {
          return (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={a.url} alt={a.nombre} className="h-24 w-24 object-cover rounded-md border border-border" />
            </a>
          );
        }
        if (a.tipo === "audio") {
          return (
            <div key={a.id} className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2 max-w-full">
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Mic className="h-3 w-3" />{a.nombre}</span>
              <audio controls src={a.url} className="h-8 max-w-[240px]" />
            </div>
          );
        }
        return (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground hover:bg-muted transition-colors">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[180px]">{a.nombre}</span>
            <Download className="h-3 w-3 text-muted-foreground shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

// Carga los adjuntos de un conjunto de notas → Record<id_nota, NoteAttachment[]>.
// Best-effort: si la tabla no existe en el ambiente, devuelve {} sin romper.
export async function fetchNoteAttachments(noteIds: number[]): Promise<Record<number, NoteAttachment[]>> {
  if (!noteIds.length) return {};
  const res = await (supabase as any).from("crm_notas_adjuntos")
    .select("id, id_nota, url, tipo, nombre, mime")
    .in("id_nota", noteIds).eq("activo", true)
    .order("id", { ascending: true });
  if (res.error) return {};
  const byNote: Record<number, NoteAttachment[]> = {};
  for (const r of (res.data ?? [])) {
    (byNote[r.id_nota] ??= []).push({ id: r.id, url: r.url, tipo: r.tipo, nombre: r.nombre, mime: r.mime ?? null });
  }
  return byNote;
}
