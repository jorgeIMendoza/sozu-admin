import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, Sparkles, X } from "lucide-react";
import type { Amenity } from "@/lib/offers/offer-data";
import SectionCard from "./SectionCard";

interface AmenitiesGridSectionProps {
  amenities: Amenity[];
}

const AmenitiesGridSection = ({ amenities }: AmenitiesGridSectionProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!amenities || amenities.length === 0) return null;

  const withImages = amenities.filter((a) => a.images.length > 0);
  const active = openIdx !== null ? amenities[openIdx] : null;

  return (
    <SectionCard
      icon={Sparkles}
      title="Amenidades del desarrollo"
      headerRight={
        <span className="text-[10px] font-semibold text-muted-foreground/70 tabular-nums bg-muted px-2 py-0.5 rounded-full">
          {amenities.length}
        </span>
      }
      bodyClassName="p-4"
    >
        {/* Grid uniforme y compacto - todas del mismo tamaño */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {amenities.map((amenity, i) => (
            <AmenityTile
              key={amenity.id}
              amenity={amenity}
              onOpen={amenity.images.length > 0 ? () => setOpenIdx(i) : undefined}
            />
          ))}
        </div>

      {active && active.images.length > 0 && createPortal(
        <AmenityLightbox
          amenity={active}
          hasPrev={hasPrevWithImages(amenities, openIdx!)}
          hasNext={hasNextWithImages(amenities, openIdx!)}
          onPrev={() => setOpenIdx(prevWithImages(amenities, openIdx!))}
          onNext={() => setOpenIdx(nextWithImages(amenities, openIdx!))}
          onClose={() => setOpenIdx(null)}
          totalWithImages={withImages.length}
        />,
        document.body
      )}
    </SectionCard>
  );
};

/* ── Navegación entre amenidades que SÍ tienen imágenes ── */
function nextWithImages(list: Amenity[], from: number): number {
  for (let i = from + 1; i < list.length; i++) if (list[i].images.length > 0) return i;
  return from;
}
function prevWithImages(list: Amenity[], from: number): number {
  for (let i = from - 1; i >= 0; i--) if (list[i].images.length > 0) return i;
  return from;
}
function hasNextWithImages(list: Amenity[], from: number): boolean {
  return nextWithImages(list, from) !== from;
}
function hasPrevWithImages(list: Amenity[], from: number): boolean {
  return prevWithImages(list, from) !== from;
}

interface AmenityTileProps {
  amenity: Amenity;
  onOpen?: () => void;
}

const AmenityTile = ({ amenity, onOpen }: AmenityTileProps) => {
  const firstImage = amenity.images[0];
  const count = amenity.images.length;

  if (!firstImage) {
    // Solo texto - tile uniforme, sin interacción
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-card flex items-center justify-center p-3">
        <h4 className="text-[13px] font-semibold text-foreground text-center leading-tight">{amenity.name}</h4>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      aria-label={`Ver ${amenity.name}`}
    >
      <img
        src={firstImage.url}
        alt={amenity.name}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* Badge expandir / contador */}
      <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Expand className="w-3 h-3" />
        {count > 1 && <span className="text-[10px] font-semibold tabular-nums leading-none">{count}</span>}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <h4 className="text-[12.5px] font-bold text-white leading-tight drop-shadow-sm line-clamp-2">{amenity.name}</h4>
      </div>
    </button>
  );
};

/* ── Lightbox fullscreen con carrusel de la amenidad ── */
interface AmenityLightboxProps {
  amenity: Amenity;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  totalWithImages: number;
}

const AmenityLightbox = ({ amenity, hasPrev, hasNext, onPrev, onNext, onClose }: AmenityLightboxProps) => {
  const [imgIdx, setImgIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const images = amenity.images;
  const total = images.length;
  const current = images[Math.min(imgIdx, total - 1)];

  // Reinicia al cambiar de amenidad
  useEffect(() => { setImgIdx(0); }, [amenity.id]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") stepImg(1);
      else if (e.key === "ArrowLeft") stepImg(-1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const stepImg = (dir: 1 | -1) =>
    setImgIdx((i) => (i + dir + total) % total);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { if (dx < 0) stepImg(1); else stepImg(-1); }
    touchStartX.current = null;
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label={amenity.name}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar: título + descripción + cerrar */}
      <div className="flex items-start justify-between gap-4 px-4 md:px-8 pt-4 md:pt-6" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <h3 className="text-white text-lg md:text-2xl font-bold leading-tight">{amenity.name}</h3>
          {amenity.shortDescription && (
            <p className="text-white/60 text-xs md:text-sm mt-1 max-w-2xl line-clamp-2">{amenity.shortDescription}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
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
        <img
          key={current?.url}
          src={current?.url}
          alt={current?.caption ?? amenity.name}
          className="max-w-full max-h-full object-contain rounded-lg animate-in fade-in-50 duration-300"
        />

        {total > 1 && (
          <>
            <button
              onClick={() => stepImg(-1)}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => stepImg(1)}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Caption + contador */}
      <div className="px-4 md:px-8 text-center" onClick={(e) => e.stopPropagation()}>
        {current?.caption && (
          <p className="text-white/70 text-xs md:text-sm mb-2">{current.caption}</p>
        )}
        {total > 1 && (
          <p className="text-white/50 text-xs font-semibold tabular-nums">{Math.min(imgIdx, total - 1) + 1} / {total}</p>
        )}
      </div>

      {/* Tira de miniaturas */}
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 md:px-8 py-4 justify-start md:justify-center" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setImgIdx(i)}
              className={`flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                Math.min(imgIdx, total - 1) === i ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={img.url} alt={img.caption ?? `${amenity.name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Navegación entre amenidades */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 pb-5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" /> Amenidad anterior
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          Siguiente amenidad <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AmenitiesGridSection;
