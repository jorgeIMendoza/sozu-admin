import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, ChevronLeft, ChevronRight, X } from "lucide-react";
import DevelopmentLogo from "./DevelopmentLogo";
import type { DevelopmentInfo } from "@/lib/offers/offer-data";

interface Props {
  images: string[];
  /** 18.11.D: captions descriptivos alineados por índice con `images`. */
  captions?: string[];
  videoUrl?: string;
  development?: DevelopmentInfo;
  developmentName?: string;
  /** 18.11.A: si se provee, el botón "Ver recorrido" hace scroll a esta sección
   *  en lugar de abrir el modal de video. */
  tour360Id?: string;
}

const OfferGallery = ({ images, captions, videoUrl, development, developmentName, tour360Id }: Props) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [brokenIndices, setBrokenIndices] = useState<Set<number>>(new Set());

  // Derived visible images (original indices kept for onError mapping)
  const visibleItems = images
    .map((url, i) => ({ url, orig: i }))
    .filter(({ orig }) => !brokenIndices.has(orig));

  const clampedIdx = Math.min(activeIdx, Math.max(0, visibleItems.length - 1));
  const currentItem = visibleItems[clampedIdx];
  const currentCaption = currentItem ? captions?.[currentItem.orig] : undefined;

  const markBroken = (origIdx: number) =>
    setBrokenIndices((prev) => new Set([...prev, origIdx]));

  useEffect(() => {
    if (clampedIdx !== activeIdx) setActiveIdx(clampedIdx);
  }, [clampedIdx, activeIdx]);

  useEffect(() => {
    if (lightboxOpen || videoOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxOpen, videoOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") setActiveIdx((i) => (i + 1) % visibleItems.length);
      else if (e.key === "ArrowLeft") setActiveIdx((i) => (i - 1 + visibleItems.length) % visibleItems.length);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxOpen, visibleItems.length]);

  useEffect(() => {
    if (!videoOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setVideoOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [videoOpen]);

  if (visibleItems.length === 0) {
    return (
      <div className="w-full aspect-[16/10] md:aspect-[16/9] rounded-2xl bg-muted flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Sin imágenes disponibles</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-muted">
        <img
          key={currentItem?.url}
          src={currentItem?.url}
          alt={`Imagen ${clampedIdx + 1}`}
          width={1280}
          height={960}
          onClick={() => setLightboxOpen(true)}
          onError={() => currentItem && markBroken(currentItem.orig)}
          loading="eager"
          decoding="async"
          className="w-full h-full object-contain cursor-zoom-in"
        />
        {development && (
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <DevelopmentLogo
              development={development}
              developmentName={developmentName ?? "Desarrollo"}
              variant="overlay"
            />
          </div>
        )}
        {(tour360Id || videoUrl) && (
          <button
            onClick={() => {
              if (tour360Id) {
                const section = document.getElementById(tour360Id);
                if (section) {
                  section.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
              }
              if (videoUrl) setVideoOpen(true);
            }}
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/60 backdrop-blur-md text-background text-xs font-semibold hover:bg-foreground/80 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Ver recorrido
          </button>
        )}
        <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium">
          <span className="font-semibold tabular-nums">{clampedIdx + 1}/{visibleItems.length}</span>
          {currentCaption && (
            <>
              <span aria-hidden className="opacity-60">·</span>
              <span className="truncate">{currentCaption}</span>
            </>
          )}
        </div>
        {visibleItems.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((i) => (i === 0 ? visibleItems.length - 1 : i - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors flex items-center justify-center"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveIdx((i) => (i === visibleItems.length - 1 ? 0 : i + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors flex items-center justify-center"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
        {visibleItems.map(({ url, orig }, i) => (
          <button
            key={orig}
            onClick={() => setActiveIdx(i)}
            className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
              clampedIdx === i ? "border-primary" : "border-transparent opacity-60"
            }`}
          >
            <img
              src={url}
              alt={`Miniatura ${i + 1}`}
              width={80}
              height={80}
              loading="lazy"
              decoding="async"
              onError={() => markBroken(orig)}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {lightboxOpen && currentItem && createPortal(
        <div
          role="dialog" aria-modal="true" aria-label="Galería de imágenes"
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          {visibleItems.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => (i - 1 + visibleItems.length) % visibleItems.length); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <img
            src={currentItem.url}
            alt={captions?.[currentItem.orig] ?? `Imagen ${clampedIdx + 1} de ${visibleItems.length}`}
            onError={() => markBroken(currentItem.orig)}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {visibleItems.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => (i + 1) % visibleItems.length); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold tabular-nums">
            {clampedIdx + 1} / {visibleItems.length}
          </div>
        </div>,
        document.body
      )}

      {videoOpen && videoUrl && createPortal(
        <div
          role="dialog" aria-modal="true" aria-label="Video del desarrollo"
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setVideoOpen(false)}
        >
          <button
            onClick={() => setVideoOpen(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <video
            src={videoUrl}
            controls
            autoPlay={!window.matchMedia("(prefers-reduced-motion: reduce)").matches}
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default OfferGallery;
