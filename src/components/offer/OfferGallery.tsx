import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

const OfferGallery = ({ images, captions, videoUrl, tour360Id }: Props) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [brokenIndices, setBrokenIndices] = useState<Set<number>>(new Set());
  const touchStartX = useRef<number | null>(null);

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

  const stepLightbox = (dir: 1 | -1) =>
    setActiveIdx((i) => (i + dir + visibleItems.length) % visibleItems.length);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50 && visibleItems.length > 1) stepLightbox(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  if (visibleItems.length === 0) {
    return (
      <div className="w-full aspect-[16/10] md:aspect-[16/9] rounded-md bg-muted flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Sin imágenes disponibles</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
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
          className="w-full h-full object-contain cursor-zoom-in animate-in fade-in duration-500"
        />
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
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 px-4 md:px-6 pt-4" onClick={(e) => e.stopPropagation()}>
            <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold tabular-nums">
              {clampedIdx + 1} / {visibleItems.length}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Imagen principal */}
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-16 py-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {visibleItems.length > 1 && (
              <button
                onClick={() => stepLightbox(-1)}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <img
              key={currentItem.url}
              src={currentItem.url}
              alt={captions?.[currentItem.orig] ?? `Imagen ${clampedIdx + 1} de ${visibleItems.length}`}
              onError={() => markBroken(currentItem.orig)}
              className="max-w-full max-h-full object-contain rounded-lg animate-in fade-in-50 duration-300"
            />
            {visibleItems.length > 1 && (
              <button
                onClick={() => stepLightbox(1)}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Caption */}
          {currentCaption && (
            <div className="px-4 md:px-8 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-white/70 text-xs md:text-sm">{currentCaption}</p>
            </div>
          )}

          {/* Tira de miniaturas */}
          {visibleItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 md:px-8 py-4 justify-start md:justify-center" onClick={(e) => e.stopPropagation()}>
              {visibleItems.map(({ url, orig }, i) => (
                <button
                  key={orig}
                  onClick={() => setActiveIdx(i)}
                  className={`flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    clampedIdx === i ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <img src={url} alt={`Miniatura ${i + 1}`} loading="lazy" className="w-full h-full object-cover" onError={() => markBroken(orig)} />
                </button>
              ))}
            </div>
          )}
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
