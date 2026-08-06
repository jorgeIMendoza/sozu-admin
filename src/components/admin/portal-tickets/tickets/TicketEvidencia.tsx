// Evidencia multimedia de un ticket. Dos usos:
//  • PendingEvidenciaField → al CREAR (colecciona archivos; se suben al guardar el ticket).
//  • EvidenciaSection      → en el DETALLE (sube al instante; borrar solo Super Admin).
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, X, Loader2, Play, Mic } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceRecorderButton } from "./VoiceRecorder";
import {
  MAX_ADJUNTOS,
  toPendingAdjunto,
  fetchTicketAdjuntos,
  saveTicketAdjuntos,
  deleteTicketAdjunto,
  type AdjuntoTipo,
  type PendingAdjunto,
  type TicketAdjunto,
} from "@/lib/portal-tickets/tickets-adjuntos";

const ACCEPT = "image/*,video/*,audio/*";
const HINT = `Fotos ≤ 10 MB · Videos ≤ 50 MB · Audio ≤ 25 MB · Máx. ${MAX_ADJUNTOS}.`;

// Tile de una evidencia (foto o video) con botón opcional de quitar/borrar.
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
  const removeBtn = onRemove ? (
    <button
      type="button"
      onClick={onRemove}
      disabled={busy}
      aria-label="Quitar"
      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </button>
  ) : null;

  // El audio no cabe en el tile cuadrado → tira más ancha con reproductor.
  if (tipo === "audio") {
    return (
      <div className="group relative flex h-24 w-56 shrink-0 flex-col justify-center gap-1 rounded-md border border-border bg-muted/30 p-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Mic className="h-3 w-3 shrink-0" />
          <span className="truncate">{nombre || "Nota de voz"}</span>
        </span>
        <audio controls src={src} className="h-8 w-full" />
        {removeBtn}
      </div>
    );
  }

  return (
    <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30">
      <a href={src} target="_blank" rel="noopener noreferrer" className="block h-full w-full" title={nombre}>
        {tipo === "foto" ? (
          <img src={src} alt={nombre || "foto"} className="h-full w-full object-cover" />
        ) : (
          <>
            <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Play className="h-6 w-6 fill-white/90 text-white drop-shadow" />
            </span>
          </>
        )}
      </a>
      {removeBtn}
    </div>
  );
}

// ── CREAR: campo controlado de evidencia pendiente (se sube al guardar el ticket) ──
export function PendingEvidenciaField({
  value,
  onChange,
  disabled,
}: {
  value: PendingAdjunto[];
  onChange: (next: PendingAdjunto[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

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
      .map(toPendingAdjunto)
      .filter((p): p is PendingAdjunto => !!p);
    if (nuevos.length) onChange([...value, ...nuevos]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => {
    const target = value.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-1.5">
      <Label>Evidencia (fotos, videos, voz)</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <EvidenciaTile key={p.id} src={p.previewUrl} tipo={p.tipo} nombre={p.nombre} onRemove={() => remove(p.id)} />
        ))}
        {value.length < MAX_ADJUNTOS && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-24 w-24 shrink-0 place-items-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <ImagePlus className="h-5 w-5" />
              Agregar
            </span>
          </button>
        )}
      </div>
      {!disabled && value.length < MAX_ADJUNTOS && (
        <VoiceRecorderButton onRecorded={(f) => addArchivos([f])} disabled={value.length >= MAX_ADJUNTOS} />
      )}
      <p className="text-xs text-muted-foreground">{HINT}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => addArchivos(Array.from(e.target.files ?? []))}
      />
    </div>
  );
}

// ── DETALLE: sección de evidencia en vivo (sube al instante; borrar solo Super Admin) ──
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    data: adjuntos = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["ticket-adjuntos", ticketId],
    queryFn: () => fetchTicketAdjuntos(ticketId),
  });

  const addArchivos = async (arr: File[]) => {
    if (!arr.length) return;
    const space = MAX_ADJUNTOS - adjuntos.length;
    if (space <= 0) {
      toast.error(`Máximo ${MAX_ADJUNTOS} archivos por ticket.`);
      return;
    }
    const chosen = arr
      .slice(0, space)
      .map(toPendingAdjunto)
      .filter((p): p is PendingAdjunto => !!p);
    if (inputRef.current) inputRef.current.value = "";
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
      toast.success("Evidencia eliminada");
      await refetch();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Evidencia</Label>
        <span className="text-xs text-muted-foreground">
          {adjuntos.length}/{MAX_ADJUNTOS}
        </span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((a) => (
            <EvidenciaTile
              key={a.id}
              src={a.url}
              tipo={a.tipo}
              nombre={a.nombre}
              onRemove={canDelete ? () => remove(a) : undefined}
              busy={deletingId === a.id}
            />
          ))}
          {!readOnly && adjuntos.length < MAX_ADJUNTOS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="grid h-24 w-24 shrink-0 place-items-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <ImagePlus className="h-5 w-5" />
                  Subir
                </span>
              )}
            </button>
          )}
          {!isLoading && !adjuntos.length && readOnly && (
            <p className="text-xs text-muted-foreground">Sin evidencia.</p>
          )}
        </div>
      )}
      {!readOnly && (
        <VoiceRecorderButton
          onRecorded={(f) => addArchivos([f])}
          disabled={uploading || adjuntos.length >= MAX_ADJUNTOS}
        />
      )}
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          {HINT}
          {canDelete ? "" : " Solo un Super Admin puede eliminar evidencia."}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => addArchivos(Array.from(e.target.files ?? []))}
      />
    </div>
  );
}
