// Evidencia multimedia de un ticket. Dos usos:
//  • PendingEvidenciaField → al CREAR (colecciona archivos; se suben al guardar el ticket).
//  • EvidenciaSection      → en el DETALLE (sube al instante; borrar solo Super Admin).
// UI: dropzone (clic o arrastrar) + miniaturas uniformes (foto, video con ▶, audio con play).
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, X, Loader2, Play, Pause, Mic, FileText } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { VoiceRecorderButton } from "./VoiceRecorder";
import {
  MAX_ADJUNTOS,
  MEDIA_TIPOS,
  DOC_TIPOS,
  ACCEPT_MEDIA,
  ACCEPT_DOCS,
  toPendingAdjunto,
  fetchTicketAdjuntos,
  saveTicketAdjuntos,
  deleteTicketAdjunto,
  type AdjuntoTipo,
  type PendingAdjunto,
  type TicketAdjunto,
} from "@/lib/portal-tickets/tickets-adjuntos";

// Config por variante de campo: evidencia multimedia (fotos/video/voz) vs documentos (PDF/Word/…).
export type AdjuntoVariant = "evidencia" | "documentos";
const VARIANTES: Record<
  AdjuntoVariant,
  { label: string; permitidos: AdjuntoTipo[]; accept: string; dropText: string; hint: string; voz: boolean }
> = {
  evidencia: {
    label: "Evidencia",
    permitidos: MEDIA_TIPOS,
    accept: ACCEPT_MEDIA,
    dropText: "fotos, videos o audio",
    hint: `Fotos ≤ 10 MB · Videos ≤ 50 MB · Audio ≤ 25 MB · Máx. ${MAX_ADJUNTOS}.`,
    voz: true,
  },
  documentos: {
    label: "Documentos",
    permitidos: DOC_TIPOS,
    accept: ACCEPT_DOCS,
    dropText: "PDF, Word, Excel, etc.",
    hint: `PDF, Word, Excel, PowerPoint… ≤ 25 MB · Máx. ${MAX_ADJUNTOS}.`,
    voz: false,
  },
};

// Tile uniforme (96×96) de una evidencia, con botón de quitar/borrar al hover.
function EvidenciaTile({
  src,
  tipo,
  nombre,
  onRemove,
  busy,
}: {
  src: string;
  tipo: AdjuntoTipo;
  nombre?: string;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggleAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
      {tipo === "foto" && (
        <a href={src} target="_blank" rel="noopener noreferrer" className="block size-full" title={nombre}>
          <img src={src} alt={nombre || "foto"} className="size-full object-cover" />
        </a>
      )}

      {tipo === "video" && (
        <a href={src} target="_blank" rel="noopener noreferrer" className="block size-full" title={nombre}>
          <video src={src} className="size-full object-cover" muted playsInline preload="metadata" />
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </span>
        </a>
      )}

      {tipo === "audio" && (
        <button
          type="button"
          onClick={toggleAudio}
          title={nombre || "Nota de voz"}
          className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px fill-current" />}
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <Mic className="size-3" /> Voz
          </span>
          <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
        </button>
      )}

      {tipo === "documento" && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title={nombre}
          className="flex size-full flex-col items-center justify-center gap-1 p-1.5 text-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileText className="size-7" />
          <span className="line-clamp-2 break-all text-[9px] leading-tight">{nombre || "Documento"}</span>
        </a>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="Quitar"
          className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
        </button>
      )}
    </div>
  );
}

// Zona de arrastrar/soltar o clic para subir. Reutilizada al crear y en el detalle.
function Dropzone({
  onFiles,
  accept,
  texto,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  texto: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
        )}
      >
        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
          <Upload className="size-4" />
        </span>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Haz clic</span> o arrastra {texto}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </>
  );
}

// ── CREAR: campo controlado de evidencia pendiente (se sube al guardar el ticket) ──
export function PendingEvidenciaField({
  value,
  onChange,
  disabled,
  variant = "evidencia",
}: {
  value: PendingAdjunto[];
  onChange: (next: PendingAdjunto[]) => void;
  disabled?: boolean;
  variant?: AdjuntoVariant;
}) {
  const cfg = VARIANTES[variant];
  const lleno = value.length >= MAX_ADJUNTOS;

  const addArchivos = (arr: File[]) => {
    if (!arr.length) return;
    const space = MAX_ADJUNTOS - value.length;
    if (space <= 0) {
      toast.error(`Máximo ${MAX_ADJUNTOS} archivos por ticket.`);
      return;
    }
    if (arr.length > space) toast.error(`Solo se agregaron ${space}; el máximo es ${MAX_ADJUNTOS}.`);
    const nuevos = arr
      .slice(0, space)
      .map((f) => toPendingAdjunto(f, cfg.permitidos))
      .filter((p): p is PendingAdjunto => !!p);
    if (nuevos.length) onChange([...value, ...nuevos]);
  };

  const remove = (id: string) => {
    const target = value.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-2">
      <Label>{cfg.label} (opcional)</Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((p) => (
            <EvidenciaTile key={p.id} src={p.previewUrl} tipo={p.tipo} nombre={p.nombre} onRemove={() => remove(p.id)} />
          ))}
        </div>
      )}

      {!disabled && !lleno && <Dropzone onFiles={addArchivos} accept={cfg.accept} texto={cfg.dropText} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!disabled && !lleno && cfg.voz ? <VoiceRecorderButton onRecorded={(f) => addArchivos([f])} /> : <span />}
        <p className="text-[11px] text-muted-foreground">{cfg.hint}</p>
      </div>
    </div>
  );
}

// ── DETALLE: sección de evidencia en vivo (sube al instante; borrar solo Super Admin) ──
export function EvidenciaSection({
  ticketId,
  canDelete,
  readOnly,
  variant = "evidencia",
}: {
  ticketId: string;
  canDelete: boolean;
  readOnly?: boolean;
  variant?: AdjuntoVariant;
}) {
  const { user } = useAuth();
  const cfg = VARIANTES[variant];
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    data: todos = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["ticket-adjuntos", ticketId],
    queryFn: () => fetchTicketAdjuntos(ticketId),
  });

  // La tabla guarda evidencia y documentos juntos; cada sección muestra solo su tipo.
  const items = todos.filter((a) => cfg.permitidos.includes(a.tipo));
  const lleno = items.length >= MAX_ADJUNTOS;

  const addArchivos = async (arr: File[]) => {
    if (!arr.length) return;
    const space = MAX_ADJUNTOS - items.length;
    if (space <= 0) {
      toast.error(`Máximo ${MAX_ADJUNTOS} archivos por ticket.`);
      return;
    }
    const chosen = arr
      .slice(0, space)
      .map((f) => toPendingAdjunto(f, cfg.permitidos))
      .filter((p): p is PendingAdjunto => !!p);
    if (!chosen.length) return;
    setUploading(true);
    await saveTicketAdjuntos(ticketId, user?.id, chosen);
    chosen.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setUploading(false);
    await refetch();
  };

  const remove = async (adj: TicketAdjunto) => {
    setDeletingId(adj.id);
    const ok = await deleteTicketAdjunto(adj);
    setDeletingId(null);
    if (ok) {
      toast.success(`${cfg.label} eliminado`);
      await refetch();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{cfg.label}</Label>
        <span className="text-xs text-muted-foreground">
          {items.length}/{MAX_ADJUNTOS}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((a) => (
                <EvidenciaTile
                  key={a.id}
                  src={a.url}
                  tipo={a.tipo}
                  nombre={a.nombre}
                  onRemove={canDelete ? () => remove(a) : undefined}
                  busy={deletingId === a.id}
                />
              ))}
            </div>
          )}

          {!readOnly &&
            !lleno &&
            (uploading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Subiendo…
              </div>
            ) : (
              <Dropzone onFiles={addArchivos} accept={cfg.accept} texto={cfg.dropText} />
            ))}

          {!items.length && readOnly && (
            <p className="text-xs text-muted-foreground">Sin {cfg.label.toLowerCase()}.</p>
          )}
        </>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!lleno && cfg.voz ? (
            <VoiceRecorderButton onRecorded={(f) => addArchivos([f])} disabled={uploading} />
          ) : (
            <span />
          )}
          <p className="text-[11px] text-muted-foreground">
            {cfg.hint}
            {canDelete ? "" : " Solo un Super Admin puede eliminar."}
          </p>
        </div>
      )}
    </div>
  );
}
