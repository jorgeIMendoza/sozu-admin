import { useState } from "react";
import { HardHat, Calendar, X, ImageIcon } from "lucide-react";
import { deriveStages, currentStageOf } from "@/utils/avanceObra";

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
  // Lógica compartida (fuente de verdad): etapas reales del proyecto (estatus_proyecto).
  const stageRows = deriveStages(progress, milestones);
  const currentStage = currentStageOf(stageRows);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardHat className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Avance de obra</h3>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground">
                Última actualización: {lastUpdated}
              </p>
            )}
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums text-success">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Etapa actual: <span className="font-semibold text-foreground">{currentStage}</span>
        </p>
      </div>

      {/* Milestones checklist — 1ª mitad izquierda, resto derecha, en secuencia */}
      {(() => {
        const renderStage = (m: typeof stageRows[number], i: number) => {
          const isCurrent = !m.done && m.phase === currentStage;
          return (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none tabular-nums ${
                  m.done
                    ? "border-success text-success"
                    : isCurrent
                    ? "border-amber-500 bg-amber-50 text-amber-600"
                    : "border-muted-foreground/30 text-muted-foreground/50"
                }`}
              >
                {i + 1}
              </span>
              <span className={`flex-1 truncate ${m.done ? "text-foreground" : isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {m.phase}
              </span>
              <span className={`shrink-0 text-xs tabular-nums ${m.done ? "font-medium text-success" : isCurrent ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>{m.ownPct}%</span>
            </li>
          );
        };
        const mid = Math.ceil(stageRows.length / 2);
        return (
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            <ul className="space-y-2">{stageRows.slice(0, mid).map((m, j) => renderStage(m, j))}</ul>
            <ul className="space-y-2">{stageRows.slice(mid).map((m, j) => renderStage(m, mid + j))}</ul>
          </div>
        );
      })()}

      <div className="pt-1 border-t border-border space-y-0.5">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          Posible fecha de entrega ·{" "}
          {new Date(estimatedDelivery).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <p className="text-[10px] text-muted-foreground/70 leading-snug">
          Fecha estimada y sujeta a cambios según el avance de obra. No constituye una fecha
          de entrega contractual.
        </p>
      </div>

      {/* Featured video */}
      {videoUrl && (
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="aspect-video w-full bg-black">
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={videoTitle ?? "Recorrido del avance"}
            />
          </div>
          {videoTitle && (
            <div className="px-3 py-2 bg-muted/30">
              <p className="text-xs font-semibold text-foreground">{videoTitle}</p>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Fotos del avance ({photos.length})
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className="aspect-square rounded-lg overflow-hidden group"
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
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
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
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.max(0, lightboxIndex - 1));
              }}
              className="text-white/60 text-sm"
              disabled={lightboxIndex === 0}
            >
              ← Anterior
            </button>
            <span className="text-white/40 text-xs tabular-nums">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.min(photos.length - 1, lightboxIndex + 1));
              }}
              className="text-white/60 text-sm"
              disabled={lightboxIndex === photos.length - 1}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferConstructionProgress;
