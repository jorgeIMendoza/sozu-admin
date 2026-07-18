import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bold, Italic, Underline as UnderlineIcon, List, Palette, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** Prefijo de ruta en storage para las imágenes subidas (ej. `crm-notas/123`). */
  storagePrefix: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Editor de texto enriquecido compacto para notas internas del agente.
 *  Soporta negrita/cursiva/subrayado, color (resaltado), listas e imágenes (subida a storage). */
export function NoteEditor({ value, onChange, storagePrefix, placeholder = "Agregar nota o comentario…", autoFocus }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color, Image.configure({ inline: false })],
    content: value,
    autofocus: autoFocus,
    editorProps: { attributes: { class: "tiptap focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync cambios externos del value (ej. limpiar tras guardar).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${storagePrefix}/${Date.now()}_${rand}.${ext}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
      editor.chain().focus().setImage({ src: publicUrl }).run();
    } catch (e: any) {
      toast.error(e.message || "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const COLORS = ["#171A1D", "#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea"];
  const ToolBtn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <Button type="button" variant={active ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={onClick} title={title}>
      {children}
    </Button>
  );

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 focus-within:ring-2 focus-within:ring-primary/25">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-muted/30 p-1">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado"><UnderlineIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista"><List className="h-3.5 w-3.5" /></ToolBtn>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Color / Resaltar"><Palette className="h-3.5 w-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button key={c} type="button" className="h-6 w-6 rounded border transition-transform hover:scale-110" style={{ backgroundColor: c }} onClick={() => editor.chain().focus().setColor(c).run()} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <ToolBtn onClick={() => fileRef.current?.click()} title="Insertar imagen">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        </ToolBtn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
        />
      </div>
      <div className="relative">
        {editor.isEmpty && (
          <span className="pointer-events-none absolute left-3 top-3 text-[12.5px] text-[#9AA3AD]">{placeholder}</span>
        )}
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-3 min-h-[80px] max-h-[260px] overflow-y-auto text-[12.5px]
            [&_.tiptap]:outline-none [&_.tiptap]:min-h-[60px]
            [&_.tiptap_p]:my-1 [&_.tiptap_ul]:my-1 [&_.tiptap_li]:my-0.5
            [&_.tiptap_img]:h-auto [&_.tiptap_img]:max-h-40 [&_.tiptap_img]:w-auto [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded [&_.tiptap_img]:border [&_.tiptap_img]:border-gray-100"
        />
      </div>
    </div>
  );
}
