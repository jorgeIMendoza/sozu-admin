// Componentes de notas del CRM (editor tiptap: crear / editar / ver / comentar / adjuntar),
// extraídos de crm.tsx. Consumidos por la ficha de contacto, la de negocio y el timeline.

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import { TextStyle as TextStyleExt } from "@tiptap/extension-text-style";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, X, Mic, FileText, Paperclip, Square,
  CalendarClock, Loader2, ChevronDown, ChevronRight, MessageSquare, StickyNote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { fmtDateTime, relTime } from "@/lib/crm-lib";
import { stripHtml } from "@/lib/crm-format";
import { ARow } from "@/components/admin/portal-crm/ui";
import {
  CRM_ATTACH_BUCKET, classifyAttachment, humanFileSize, saveNoteAttachments,
  NoteAttachmentsStrip, type PendingAttachment, type AttachKind,
} from "./crm-adjuntos";

// ─── (componentes extraídos abajo) ──────────────────────────────────────────────
export function RichNoteToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop();
      const path = `crm-notes/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage.from(CRM_ATTACH_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error("Error al subir imagen"); return; }
      const { data: url } = supabase.storage.from(CRM_ATTACH_BUCKET).getPublicUrl(data.path);
      editor.chain().focus().setImage({ src: url.publicUrl }).run();
    };
    input.click();
  };

  const setLink = () => {
    const url = window.prompt("URL del enlace:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  const btnClass = (active?: boolean) =>
    `h-7 w-7 flex items-center justify-center rounded transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="Negrita">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="Cursiva">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))} title="Subrayado">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="Lista">
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="Lista numerada">
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={setLink} className={btnClass(editor.isActive("link"))} title="Enlace">
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={addImage} className={btnClass()} title="Imagen">
        <ImageIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function InlineNoteForm({ contactId, userId, onSaved }: { contactId: string; userId?: string; onSaved: () => void }) {
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[80px] px-3 py-2 text-sm focus:outline-none" },
      // Ctrl+V de imágenes → se adjuntan (no se incrustan en el texto).
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imgs: File[] = [];
        for (const it of Array.from(items)) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            const f = it.getAsFile();
            if (f) imgs.push(f);
          }
        }
        if (!imgs.length) return false;
        setPending((p) => [
          ...p,
          ...imgs.map((file) => ({ id: crypto.randomUUID(), file, tipo: "image" as AttachKind, nombre: file.name || "imagen.png", previewUrl: URL.createObjectURL(file) })),
        ]);
        toast.success(imgs.length > 1 ? `${imgs.length} imágenes adjuntadas` : "Imagen adjuntada");
        return true;
      },
    },
    onUpdate: ({ editor }) => setIsEmpty(editor.isEmpty),
  });

  const addPending = (files: File[]) => {
    if (!files.length) return;
    setPending((p) => [
      ...p,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, tipo: classifyAttachment(file), nombre: file.name, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removePending = (id: string) => {
    setPending((p) => {
      const found = p.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `nota-voz-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`, { type: "audio/webm" });
        addPending([file]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const canSave = !!userId && !!editor && (!isEmpty || pending.length > 0) && !recording;

  const save = async () => {
    if (!canSave || !editor) return;
    setSaving(true);
    const html = editor.getHTML();
    const { data, error } = await (supabase as any).from("crm_notas").insert({
      id_entidad_relacionada: Number(contactId),
      id_usuario: userId,
      contenido: html,
      fecha_actividad: activityDate,
    }).select("id").single();
    if (error) { setSaving(false); toast.error(error.message); return; }
    if (data?.id && pending.length) await saveNoteAttachments(data.id, userId, pending);
    setSaving(false);
    toast.success("Nota guardada");
    editor.commands.clearContent();
    setIsEmpty(true);
    pending.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setPending([]);
    onSaved();
  };

  const btnClass = "h-7 w-7 flex items-center justify-center rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <RichNoteToolbar editor={editor} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { addPending(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {pending.map((a) => (
            <div key={a.id} className="relative group">
              {a.tipo === "image" ? (
                <img src={a.previewUrl} alt={a.nombre} className="h-16 w-16 object-cover rounded-md border border-border" />
              ) : (
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs max-w-[200px]">
                  {a.tipo === "audio" ? <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="truncate">{a.nombre}</span>
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">{humanFileSize(a.file.size)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePending(a.id)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                title="Quitar"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/20 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button type="button" className={btnClass} title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={recording ? "h-7 w-7 flex items-center justify-center rounded bg-destructive/10 text-destructive animate-pulse" : btnClass}
            title={recording ? "Detener grabación" : "Grabar nota de voz"}
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>Fecha</span>
          <Input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            className="h-6 text-xs w-auto px-2 py-0 border border-border rounded shadow-none focus-visible:ring-0"
          />
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !canSave}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar nota"}
        </Button>
      </div>
    </div>
  );
}

export function NoteEditDialog({ open, onOpenChange, noteId, initialHtml, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; noteId: number; initialHtml: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[120px] px-3 py-2 text-sm focus:outline-none" } },
    content: initialHtml || "",
  });

  useEffect(() => {
    if (open && editor) editor.commands.setContent(initialHtml || "");
  }, [open, editor, initialHtml]);

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_notas").update({ contenido: editor.getHTML() }).eq("id", noteId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota actualizada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar nota</DialogTitle></DialogHeader>
        <div className="border border-border rounded-lg overflow-hidden">
          <RichNoteToolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NoteCard({ note, contactName, onEdited, onDelete, defaultExpanded = true }: { note: any; contactName: string; onEdited: () => void; onDelete: (id: number) => void; defaultExpanded?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pinned, setPinned] = useState<boolean>(!!note.anclado);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);

  // Comentarios (persisten en crm_notas_comentarios; tabla puede no existir aún → fallback vacío).
  const { data: comments = [] } = useQuery({
    queryKey: ["nota-comentarios", note.id],
    enabled: showComments,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_notas_comentarios")
        .select("id, contenido, fecha_creacion, id_usuario")
        .eq("id_nota", note.id).eq("activo", true)
        .order("fecha_creacion", { ascending: true });
      if (res.error) return [];
      const rows = res.data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.id_usuario).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ids);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      return rows.map((r: any) => ({ id: r.id, text: r.contenido, ts: r.fecha_creacion, author: r.id_usuario ? (nameMap[r.id_usuario] ?? null) : null }));
    },
  });

  const copyLink = () => {
    try { navigator.clipboard.writeText(window.location.href); toast.success("Enlace copiado"); }
    catch { toast.error("No se pudo copiar el enlace"); }
  };

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    const { error } = await (supabase as any).from("crm_notas").update({ anclado: next }).eq("id", note.id);
    if (error) { setPinned(!next); toast.error(error.message); return; }
    toast.success(next ? "Nota anclada" : "Nota desanclada");
    onEdited();
  };

  const addComment = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_notas_comentarios").insert({ id_nota: note.id, id_usuario: user?.id ?? null, contenido: text });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    qc.invalidateQueries({ queryKey: ["nota-comentarios", note.id] });
  };

  return (
    <div className={`border rounded-lg bg-card shadow-sm ${pinned ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
      <div className="flex items-start gap-2 p-3">
        <button onClick={() => setExpanded((e) => !e)} className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0" aria-label={expanded ? "Colapsar" : "Expandir"}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">
              <span className="font-semibold">Nota</span>
              {note.author ? <span className="text-muted-foreground"> de {note.author}</span> : null}
              {pinned && <span className="ml-2 text-[10px] font-medium text-primary align-middle">📌 Anclada</span>}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-primary hover:underline inline-flex items-center gap-1">Acciones <ChevronDown className="h-3 w-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={togglePin}>{pinned ? "Desanclar" : "Anclar"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.message("El historial estará disponible en una fase posterior")}>Historial</DropdownMenuItem>
                  <DropdownMenuItem onClick={copyLink}>Copiar enlace</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPropsOpen(true)}>Ver todas las propiedades</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-muted-foreground/70 tabular-nums">{fmtDateTime(note.created_at)}</span>
            </div>
          </div>

          {!expanded && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{stripHtml(note.content ?? "").slice(0, 140) || "Nota"}</p>
          )}

          {expanded && (
            <>
              <div
                className="mt-1.5 prose prose-sm max-w-none text-foreground prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-strong:font-semibold prose-a:text-primary prose-img:rounded-md prose-img:my-2"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />
              <NoteAttachmentsStrip attachments={note.attachments ?? []} />
              {/* Footer */}
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
                <button onClick={() => setShowComments((s) => !s)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {showComments ? "Ocultar comentarios" : "Agregar comentario"}{comments.length ? ` (${comments.length})` : ""}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-xs text-primary hover:underline inline-flex items-center gap-1">1 asociación <ChevronDown className="h-3 w-3" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>{contactName}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {showComments && (
                <div className="mt-2 space-y-2">
                  {comments.map((c: any) => (
                    <div key={c.id} className="text-sm bg-muted/40 rounded-md p-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-medium text-foreground">{c.author ?? "Usuario"}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{relTime(c.ts)}</span>
                      </div>
                      <div className="text-foreground">{c.text}</div>
                    </div>
                  ))}
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Deja un comentario…" className="text-sm min-h-[60px]" />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={addComment} disabled={saving || !draft.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">{saving ? "Guardando…" : "Comentar"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDraft(""); setShowComments(false); }}>Cancelar</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ver todas las propiedades */}
      <Dialog open={propsOpen} onOpenChange={setPropsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Propiedades de la nota</DialogTitle></DialogHeader>
          <div className="space-y-1 text-sm">
            <ARow label="ID" v={String(note.id)} mono />
            <ARow label="Autor" v={note.author ?? "—"} />
            <ARow label="Fecha de creación" v={fmtDateTime(note.created_at)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar nota */}
      <NoteEditDialog open={editOpen} onOpenChange={setEditOpen} noteId={note.id} initialHtml={note.content} onSaved={onEdited} />
    </div>
  );
}

export function NoteDialog({ contactId, userId, onSaved, trigger }: { contactId: string; userId?: string; onSaved: () => void; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[120px] px-3 py-2 text-sm focus:outline-none" },
      // Ctrl+V de imágenes → se adjuntan (no se incrustan en el texto).
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imgs: File[] = [];
        for (const it of Array.from(items)) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            const f = it.getAsFile();
            if (f) imgs.push(f);
          }
        }
        if (!imgs.length) return false;
        setPending((p) => [
          ...p,
          ...imgs.map((file) => ({ id: crypto.randomUUID(), file, tipo: "image" as AttachKind, nombre: file.name || "imagen.png", previewUrl: URL.createObjectURL(file) })),
        ]);
        toast.success(imgs.length > 1 ? `${imgs.length} imágenes adjuntadas` : "Imagen adjuntada");
        return true;
      },
    },
    onUpdate: ({ editor }) => setIsEmpty(editor.isEmpty),
  });

  const addPending = (files: File[]) => {
    if (!files.length) return;
    setPending((p) => [
      ...p,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, tipo: classifyAttachment(file), nombre: file.name, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removePending = (id: string) => {
    setPending((p) => {
      const found = p.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  };

  const resetAttachments = () => {
    setPending((p) => { p.forEach((a) => URL.revokeObjectURL(a.previewUrl)); return []; });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `nota-voz-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`, { type: "audio/webm" });
        addPending([file]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) { resetAttachments(); editor?.commands.clearContent(); setIsEmpty(true); if (recording) stopRecording(); }
    setOpen(v);
  };

  const canSave = !!userId && !!editor && (!isEmpty || pending.length > 0) && !recording;

  const save = async () => {
    if (!canSave || !editor) return;
    setSaving(true);
    const html = editor.getHTML();
    const { data, error } = await (supabase as any).from("crm_notas").insert({
      id_entidad_relacionada: Number(contactId),
      id_usuario: userId,
      contenido: html,
    }).select("id").single();
    if (error) { setSaving(false); toast.error(error.message); return; }
    if (data?.id && pending.length) await saveNoteAttachments(data.id, userId, pending);
    setSaving(false);
    toast.success("Nota guardada");
    setOpen(false);
    editor.commands.clearContent();
    setIsEmpty(true);
    resetAttachments();
    onSaved();
  };

  const attachBtn = "h-7 w-7 flex items-center justify-center rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <StickyNote className="h-4 w-4 mr-1.5" />Nota
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva nota</DialogTitle></DialogHeader>
        <div className="border border-border rounded-lg overflow-hidden">
          <RichNoteToolbar editor={editor} />
          <EditorContent editor={editor} />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { addPending(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-2">
              {pending.map((a) => (
                <div key={a.id} className="relative">
                  {a.tipo === "image" ? (
                    <img src={a.previewUrl} alt={a.nombre} className="h-16 w-16 object-cover rounded-md border border-border" />
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs max-w-[200px]">
                      {a.tipo === "audio" ? <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="truncate">{a.nombre}</span>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">{humanFileSize(a.file.size)}</span>
                    </div>
                  )}
                  <button type="button" onClick={() => removePending(a.id)} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center shadow" title="Quitar">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border bg-muted/20">
            <button type="button" className={attachBtn} title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={recording ? "h-7 w-7 flex items-center justify-center rounded bg-destructive/10 text-destructive animate-pulse" : attachBtn}
              title={recording ? "Detener grabación" : "Grabar nota de voz"}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !canSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
