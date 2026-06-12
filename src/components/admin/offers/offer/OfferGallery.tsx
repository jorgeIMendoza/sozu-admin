import { useState } from "react";
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
  const currentCaption = captions?.[activeIdx];

  return (
    <>
      <div className="relative w-full aspect-[16/10] md:aspect-[16/9] rounded-2xl overflow-hidden bg-muted">
        <img
          src={images[activeIdx]}
          alt={`Imagen ${activeIdx + 1}`}
          onClick={() => setLightboxOpen(true)}
          className="w-full h-full object-cover cursor-zoom-in"
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
          <span className="font-semibold tabular-nums">{activeIdx + 1}/{images.length}</span>
          {currentCaption && (
            <>
              <span aria-hidden className="opacity-60">·</span>
              <span className="truncate">{currentCaption}</span>
            </>
          )}
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((i) => (i === 0 ? images.length - 1 : i - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors flex items-center justify-center"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveIdx((i) => (i === images.length - 1 ? 0 : i + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors flex items-center justify-center"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
              activeIdx === i ? "border-primary" : "border-transparent opacity-60"
            }`}
          >
            <img src={img} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={images[activeIdx]}
            alt={`Imagen ${activeIdx + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {videoOpen && videoUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setVideoOpen(false)}
        >
          <button
            onClick={() => setVideoOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default OfferGallery;
