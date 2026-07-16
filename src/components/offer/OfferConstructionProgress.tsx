import { useState, useEffect } from "react";
import { CheckCircle2, Circle, HardHat, Calendar, X, ImageIcon } from "lucide-react";
import SectionCard from "./SectionCard";

interface ConstructionPhoto {
  src: string;
  alt: string;
}

interface Props {
  progress: number;
  milestones: { phase: string; pct: number; done: boolean }[];
  estimatedDelivery: string;
  lastUpdated?: string;
  videoUrl?: string;
  videoTitle?: string;
  photos?: ConstructionPhoto[];
  description?: string;
}

const OfferConstructionProgress = ({
  progress,
  milestones,
  estimatedDelivery,
  lastUpdated,
  videoUrl,
  videoTitle,
  photos = [],
  description,
}: Props) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxIndex(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxIndex]);

  const currentStage =
    milestones.find((m) => !m.done)?.phase ??
    [...milestones].reverse().find((m) => m.done)?.phase ??
    "-";

  return (
    <SectionCard icon={HardHat} title="Avance de obra" bodyClassName="p-5 md:p-6 space-y-5">

      {/* ── Bloque global (arriba del video y las etapas) ── */}
      <div className="rounded-md border border-border bg-muted/20 p-4 md:p-5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-foreground leading-tight">Avance global del proyecto</p>
          <span className="text-2xl font-bold tabular-nums text-success leading-none shrink-0">{progress}%</span>
        </div>
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de obra">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
          <p className="text-[11px] text-muted-foreground">
            Etapa actual: <span className="font-semibold text-foreground">{currentStage}</span>
          </p>
          {lastUpdated && (
            <p className="text-[11px] text-muted-foreground/70">Actualizado: {lastUpdated}</p>
          )}
        </div>
      </div>

      {/* ── 2 columnas: video | etapas (misma altura) ── */}
      <div className="grid gap-5 md:grid-cols-2 md:items-stretch">

        {/* IZQUIERDA: video / material del avance */}
        <div className="flex flex-col gap-3">
          {videoUrl ? (
            <div className="rounded-md overflow-hidden border border-border flex flex-col flex-1">
              <div className="aspect-video w-full bg-black shrink-0">
                <iframe
                  src={videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={videoTitle ?? "Recorrido del avance"}
                />
              </div>
              {videoTitle && (
                <div className="px-4 py-3 bg-card border-t border-border flex-1 flex items-center">
                  <p className="text-sm font-semibold text-foreground">{videoTitle}</p>
                </div>
              )}
            </div>
          ) : photos.length > 0 ? (
            <button
              onClick={() => setLightboxIndex(0)}
              className="relative block w-full rounded-md overflow-hidden border border-border cursor-zoom-in"
            >
              <div className="aspect-video w-full">
                <img src={photos[0].src} alt={photos[0].alt} className="w-full h-full object-cover" />
              </div>
            </button>
          ) : (
            <div className="aspect-video rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Material del avance próximamente</p>
            </div>
          )}
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>

        {/* DERECHA: etapas de obra (todas) */}
        <div className="rounded-md border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Etapas de obra</p>
          <ul className="space-y-2.5">
            {milestones.map((m, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {m.done ? (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`truncate ${m.done ? "text-foreground" : "text-muted-foreground"}`}>{m.phase}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{m.pct}%</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-3 border-t border-border/60">
            <Calendar className="w-3 h-3 shrink-0" />
            Entrega estimada ·{" "}
            {new Date(estimatedDelivery).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Fotos del avance - strip horizontal */}
      {photos.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Fotos del avance · {photos.length}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className="shrink-0 w-20 h-20 rounded-md overflow-hidden group snap-start border border-border"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto de avance de obra"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center motion-safe:animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={photos[lightboxIndex].src}
            alt={photos[lightboxIndex].alt}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
            <button
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.max(0, lightboxIndex - 1));
              }}
              className="h-11 px-4 inline-flex items-center text-white/60 text-sm"
              disabled={lightboxIndex === 0}
            >
              ← Anterior
            </button>
            <span className="text-white/40 text-xs tabular-nums">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button
              aria-label="Foto siguiente"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.min(photos.length - 1, lightboxIndex + 1));
              }}
              className="h-11 px-4 inline-flex items-center text-white/60 text-sm"
              disabled={lightboxIndex === photos.length - 1}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default OfferConstructionProgress;
