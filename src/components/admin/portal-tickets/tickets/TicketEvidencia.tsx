// Archivos de un ticket: evidencia multimedia (fotos/video/voz) Y documentos (PDF/Word/Excel…),
// TODO en un mismo campo. Dos usos:
//  • PendingEvidenciaField → al CREAR (colecciona archivos; se suben al guardar el ticket).
//  • EvidenciaSection      → en el DETALLE (sube al instante; borrar solo Super Admin).
// UI: dropzone (clic o arrastrar) + miniaturas uniformes (foto, video con ▶, audio con play,
// documento con ícono). Las fotos y videos se ven en un VISOR (lightbox) en la misma pantalla.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Upload, X, Loader2, Play, Pause, Mic, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { VoiceRecorderButton } from "./VoiceRecorder";
import {
  MAX_ADJUNTOS,
  ACCEPT_ALL,
  toPendingAdjunto,
  fetchTicketAdjuntos,
  saveTicketAdjuntos,
  deleteTicketAdjunto,
  type AdjuntoTipo,
  type PendingAdjunto,
  type TicketAdjunto,
} from "@/lib/portal-tickets/tickets-adjuntos";

const HINT = `Fotos ≤ 10 MB · Videos ≤ 50 MB · Audio/Documentos ≤ 25 MB · Máx. ${MAX_ADJUNTOS}.`;

// Solo foto/video se ven en el visor (lightbox); audio se reproduce en el tile y los documentos abren aparte.
function esVisible(tipo: AdjuntoTipo) {
  return tipo === "foto" || tipo === "video";
}

// ── Visor (lightbox) de fotos/videos en la MISMA pantalla, con ‹ ›, Esc y clic-afuera para cerrar ──
type VisorItem = { src: string; tipo: AdjuntoTipo; nombre?: string };

function MediaLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: VisorItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const total = items.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % total);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onIndex]);

  const it = items[index];
  if (!it) return null;
  const varios = total > 1;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Visor de evidencia"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar visor"
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {varios && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + total) % total);
            }}
            className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % total);
            }}
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <figure className="flex max-h-full max-w-full flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {it.tipo === "foto" ? (
          <img src={it.src} alt={it.nombre || "foto"} className="max-h-[82vh] max-w-full rounded-lg object-contain" />
        ) : (
          <video src={it.src} controls autoPlay className="max-h-[82vh] max-w-full rounded-lg" />
        )}
        {(it.nombre || varios) && (
          <figcaption className="text-xs text-white/80">
            {it.nombre}
            {varios ? ` · ${index + 1}/${total}` : ""}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body,
  );
}

// Tile uniforme (96×96). Foto/video abren el visor (onOpen); audio se reproduce en el tile;
// documento abre/descarga en pestaña nueva. Botón de quitar/borrar al hover.
function EvidenciaTile({
  src,
  tipo,
  nombre,
  onRemove,
  onOpen,
  busy,
}: {
  src: string;
  tipo: AdjuntoTipo;
  nombre?: string;
  onRemove?: () => void;
  onOpen?: () => void;
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
        <button type="button" onClick={onOpen} title={nombre} className="block size-full">
          <img src={src} alt={nombre || "foto"} className="size-full object-cover" />
        </button>
      )}

      {tipo === "video" && (
        <button type="button" onClick={onOpen} title={nombre} className="block size-full">
          <video src={src} className="size-full object-cover" muted playsInline preload="metadata" />
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </span>
        </button>
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

// Zona de arrastrar/soltar o clic para subir (multimedia + documentos, mismo campo).
function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
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
          <span className="font-medium text-foreground">Haz clic</span> o arrastra fotos, videos, audio o documentos
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ALL}
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

// ── CREAR: campo controlado de archivos pendientes (se suben al guardar el ticket) ──
export function PendingEvidenciaField({
  value,
  onChange,
  disabled,
}: {
  value: PendingAdjunto[];
  onChange: (next: PendingAdjunto[]) => void;
  disabled?: boolean;
}) {
  const lleno = value.length >= MAX_ADJUNTOS;
  const [viewer, setViewer] = useState<number | null>(null);
  const visor: VisorItem[] = value
    .filter((p) => esVisible(p.tipo))
    .map((p) => ({ src: p.previewUrl, tipo: p.tipo, nombre: p.nombre }));

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
      .map((f) => toPendingAdjunto(f))
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
      <Label>Evidencia y documentos (opcional)</Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((p) => (
            <EvidenciaTile
              key={p.id}
              src={p.previewUrl}
              tipo={p.tipo}
              nombre={p.nombre}
              onRemove={() => remove(p.id)}
              onOpen={esVisible(p.tipo) ? () => setViewer(visor.findIndex((v) => v.src === p.previewUrl)) : undefined}
            />
          ))}
        </div>
      )}

      {!disabled && !lleno && <Dropzone onFiles={addArchivos} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!disabled && !lleno ? <VoiceRecorderButton onRecorded={(f) => addArchivos([f])} /> : <span />}
        <p className="text-[11px] text-muted-foreground">{HINT}</p>
      </div>

      {viewer !== null && visor[viewer] && (
        <MediaLightbox items={visor} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />
      )}
    </div>
  );
}

// ── DETALLE: sección en vivo (sube al instante; borrar solo Super Admin) ──
export function EvidenciaSection({
  ticketId,
  canDelete,
  readOnly,
}: {
  ticketId: string;
  canDelete: boolean;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const {
    data: adjuntos = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["ticket-adjuntos", ticketId],
    queryFn: () => fetchTicketAdjuntos(ticketId),
  });

  const lleno = adjuntos.length >= MAX_ADJUNTOS;
  const visor: VisorItem[] = adjuntos
    .filter((a) => esVisible(a.tipo))
    .map((a) => ({ src: a.url, tipo: a.tipo, nombre: a.nombre }));

  const addArchivos = async (arr: File[]) => {
    if (!arr.length) return;
    const space = MAX_ADJUNTOS - adjuntos.length;
    if (space <= 0) {
      toast.error(`Máximo ${MAX_ADJUNTOS} archivos por ticket.`);
      return;
    }
    const chosen = arr
      .slice(0, space)
      .map((f) => toPendingAdjunto(f))
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
      toast.success("Archivo eliminado");
      await refetch();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Evidencia y documentos</Label>
        <span className="text-xs text-muted-foreground">
          {adjuntos.length}/{MAX_ADJUNTOS}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {adjuntos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {adjuntos.map((a) => (
                <EvidenciaTile
                  key={a.id}
                  src={a.url}
                  tipo={a.tipo}
                  nombre={a.nombre}
                  onRemove={canDelete ? () => remove(a) : undefined}
                  onOpen={esVisible(a.tipo) ? () => setViewer(visor.findIndex((v) => v.src === a.url)) : undefined}
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
              <Dropzone onFiles={addArchivos} />
            ))}

          {!adjuntos.length && readOnly && <p className="text-xs text-muted-foreground">Sin archivos.</p>}
        </>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!lleno ? <VoiceRecorderButton onRecorded={(f) => addArchivos([f])} disabled={uploading} /> : <span />}
          <p className="text-[11px] text-muted-foreground">
            {HINT}
            {canDelete ? "" : " Solo un Super Admin puede eliminar."}
          </p>
        </div>
      )}

      {viewer !== null && visor[viewer] && (
        <MediaLightbox items={visor} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />
      )}
    </div>
  );
}
