import { useState } from "react";
import {
  Calendar, CheckCircle2, Circle, HardHat, ChevronDown, ChevronUp, ImageIcon, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ConstructionPhoto { src: string; alt: string; }

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
  progress, milestones, estimatedDelivery, lastUpdated,
  videoUrl, videoTitle, photos = [], description,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const currentIdx = milestones.findIndex((m) => !m.done);

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden animate-fade-in">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5"
      >
        <div className="flex items-center gap-2">
          <HardHat className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Avance de obra
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
          {/* Video */}
          {videoUrl && (
            <div className="min-w-0">
              <div className="aspect-video w-full max-w-full bg-black overflow-hidden">
                <iframe
                  src={videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  title={videoTitle ?? "Recorrido del avance"}
                />
              </div>
              {videoTitle && (
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-[12px] font-semibold text-foreground leading-snug">{videoTitle}</p>
                  {lastUpdated && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{lastUpdated}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress + milestones */}
          <div className="p-4 space-y-3">
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Última actualización · <span className="font-medium text-foreground">{lastUpdated}</span>
              </p>
            )}

            {progress > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Avance global</span>
                  <span className="text-lg font-bold text-success tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </>
            )}

            {milestones.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {milestones.map((m, i) => {
                  const isCurrent = i === currentIdx;
                  return (
                    <li
                      key={i}
                      className={`flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                        isCurrent ? "bg-primary/[0.08] ring-1 ring-primary/20" : ""
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
                          m.done ? "text-foreground"
                          : isCurrent ? "text-primary font-semibold"
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
            )}

            {description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">{description}</p>
            )}

            {estimatedDelivery && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border">
                <Calendar className="w-3 h-3" />
                Entrega estimada ·{" "}
                {new Date(estimatedDelivery).toLocaleDateString("es-MX", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            )}

            {/* Photo grid */}
            {photos.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Fotos del avance ({photos.length})
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, i) => (
                    <button key={i} onClick={() => setLightboxIndex(i)} className="aspect-square rounded-lg overflow-hidden group">
                      <img src={p.src} alt={p.alt} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
          <img src={photos[lightboxIndex].src} alt={photos[lightboxIndex].alt} className="max-w-full max-h-[80vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(Math.max(0, lightboxIndex - 1)); }} className="text-white/60 text-sm disabled:opacity-30" disabled={lightboxIndex === 0}>← Anterior</button>
            <span className="text-white/40 text-xs tabular-nums">{lightboxIndex + 1} / {photos.length}</span>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(Math.min(photos.length - 1, lightboxIndex + 1)); }} className="text-white/60 text-sm disabled:opacity-30" disabled={lightboxIndex === photos.length - 1}>Siguiente →</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default OfferConstructionProgress;
