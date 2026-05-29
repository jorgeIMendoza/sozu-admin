import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  CheckCircle2,
  Circle,
  HardHat,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useConstructionProgress } from "@/lib/portal-cliente/construction-progress-data";

interface ConstructionProgressProps {
  cuentaId: string;
  activeStageId?: string; // "post_entrega" → simplified mode
}

const ConstructionProgress = ({ cuentaId, activeStageId }: ConstructionProgressProps) => {
  const { data, isLoading } = useConstructionProgress(cuentaId);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photosCountRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setLightboxIndex((i) => Math.min(photosCountRef.current - 1, i + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="aspect-video rounded-xl bg-muted animate-pulse" />
      </section>
    );
  }

  if (!data) return null;

  const isCompleted = activeStageId === "post_entrega";
  const photos = data.photos;
  photosCountRef.current = photos.length;
  const featuredVideoUrl = data.featuredVideoUrl;
  const featuredVideoTitle = data.featuredVideoTitle ?? data.updates[0]?.videoTitle ?? "Recorrido del avance";
  const featuredDate = data.updates[0]?.date;

  const currentStage =
    data.milestones.find((m) => !m.done)?.phase ??
    [...data.milestones].reverse().find((m) => m.done)?.phase ??
    "";

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <section className="rounded-2xl bg-card border border-border overflow-hidden animate-fade-in">
        {/* Header / toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              {isCompleted ? "Proyecto entregado" : "Avance de obra"}
            </h2>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border">
            {/* Video embed — active projects only, not post_entrega */}
            {!isCompleted && featuredVideoUrl && (
              <div className="min-w-0">
                <div className="aspect-video w-full max-w-full bg-black overflow-hidden">
                  <iframe
                    src={featuredVideoUrl}
                    className="w-full h-full"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title={featuredVideoTitle}
                  />
                </div>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-[12px] font-semibold text-foreground leading-snug">
                    {featuredVideoTitle}
                  </p>
                  {featuredDate && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{featuredDate}</p>
                  )}
                </div>
              </div>
            )}

            {/* Thumbnail strip */}
            {photos.length > 0 && (
              <div className="px-4 py-3 border-b border-border min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-2">
                  Fotos del avance
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
                  {photos.map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => openLightbox(i)}
                      className="flex-shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={photo.alt || `Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar + milestones */}
            <div className="p-4 space-y-3">
              {data.lastUpdated && data.lastUpdated !== "—" && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Última actualización · <span className="font-medium text-foreground">{data.lastUpdated}</span>
                </p>
              )}
              {data.globalProgress > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Avance global
                      </span>
                      <span className="text-lg font-bold text-success tabular-nums">
                        {data.globalProgress}%
                      </span>
                    </div>
                    <Progress value={data.globalProgress} className="h-2" />
                    {currentStage && (
                      <p className="text-[11px] text-muted-foreground">
                        Etapa actual:{" "}
                        <span className="font-semibold text-foreground">{currentStage}</span>
                      </p>
                    )}
                  </>
                )}

                {data.milestones.length > 0 && (() => {
                  const currentIdx = data.milestones.findIndex((m) => !m.done);
                  return (
                    <ul className="space-y-1.5 pt-1">
                      {data.milestones.map((m, i) => {
                        const isCurrent = i === currentIdx;
                        return (
                          <li
                            key={i}
                            className={`flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                              isCurrent ? "bg-primary/8 ring-1 ring-primary/20" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {m.done ? (
                                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                              ) : isCurrent ? (
                                <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                </div>
                              ) : (
                                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={
                                m.done
                                  ? "text-foreground"
                                  : isCurrent
                                  ? "text-primary font-semibold"
                                  : "text-muted-foreground"
                              }>
                                {m.phase}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  actual
                                </span>
                              )}
                            </div>
                            <span className={`text-xs tabular-nums ${isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                              {m.pct}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}

                {data.estimatedDelivery && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border">
                    <Calendar className="w-3 h-3" />
                    Entrega estimada ·{" "}
                    {new Date(data.estimatedDelivery).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
            </div>
          </div>
        )}
      </section>

      {/* Lightbox — portalled to body to escape overflow:clip */}
      {lightboxOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="w-full max-w-4xl px-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={photos[lightboxIndex]?.url}
                alt={photos[lightboxIndex]?.alt || `Foto ${lightboxIndex + 1}`}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            </div>

            {photos.length > 1 && (
              <>
                <div className="flex gap-2 pt-4">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                      className={`h-1.5 rounded-full transition-all ${
                        i === lightboxIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute inset-y-0 left-4 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.max(0, i - 1)); }}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-30"
                    disabled={lightboxIndex === 0}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.min(photos.length - 1, i + 1)); }}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-30"
                    disabled={lightboxIndex === photos.length - 1}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}

            {/* Thumbnail strip in lightbox */}
            {photos.length > 1 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5 px-4 max-w-[90vw] overflow-x-auto">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                    className={`flex-shrink-0 w-10 h-10 rounded overflow-hidden border-2 transition-all ${
                      i === lightboxIndex ? "border-white" : "border-transparent opacity-60"
                    }`}
                  >
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};

export default ConstructionProgress;
