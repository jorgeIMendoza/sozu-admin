import { useState } from "react";
import {
  Sparkles,
  Dumbbell,
  Laptop,
  Flower2,
  Users,
  Bell,
  Shield,
  Waves,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { Amenity } from "@/lib/offers/offer-data";

interface AmenitiesGridSectionProps {
  amenities: Amenity[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Dumbbell,
  Laptop,
  Flower2,
  Users,
  Bell,
  Shield,
  Waves,
};

// No row/col span — keeps grid clean for any amenity count
const SIZE_RING: Record<Amenity["size"], string> = {
  large: "ring-1 ring-primary/25",
  medium: "",
  small: "",
};

const AmenitiesGridSection = ({ amenities }: AmenitiesGridSectionProps) => {
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);

  if (!amenities || amenities.length === 0) return null;

  return (
    <>
      <section className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle bg-muted/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Amenidades del desarrollo</h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
            Acceso exclusivo para residentes. Toca cualquier amenidad para ver más detalles.
          </p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 auto-rows-[160px]">
            {amenities.map((amenity) => (
              <AmenityCard
                key={amenity.id}
                amenity={amenity}
                onClick={() => setSelectedAmenity(amenity)}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-3">
            {amenities.length} amenidades · Toca para ver detalles
          </p>
        </div>
      </section>

      {selectedAmenity && (
        <AmenityModal amenity={selectedAmenity} onClose={() => setSelectedAmenity(null)} />
      )}
    </>
  );
};

interface AmenityCardProps {
  amenity: Amenity;
  onClick: () => void;
}

const AmenityCard = ({ amenity, onClick }: AmenityCardProps) => {
  const firstImage = amenity.images[0];
  const IconComponent = ICON_MAP[amenity.iconName] ?? Sparkles;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-border bg-muted text-left transition-all duration-300 hover:shadow-xl hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${SIZE_RING[amenity.size]}`}
    >
      {firstImage ? (
        <>
          <img
            src={firstImage.url}
            alt={amenity.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5 transition-opacity duration-300 group-hover:opacity-90" />
          <div className="absolute inset-0 p-4 flex flex-col justify-end">
            <div className="flex items-center gap-1.5 mb-1">
              <IconComponent className="w-3.5 h-3.5 text-white/90" />
              <h4 className="text-sm font-bold text-white leading-tight">{amenity.name}</h4>
            </div>
            <p className="text-[11px] text-white/70 leading-snug line-clamp-2 transition-all duration-300 group-hover:text-white/90">
              {amenity.shortDescription}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-white/0 group-hover:text-white/80 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
              Ver detalles →
            </span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 p-4 flex flex-col items-center justify-center gap-2 bg-muted">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <IconComponent className="w-6 h-6 text-primary" />
          </div>
          <h4 className="text-sm font-bold text-foreground text-center">{amenity.name}</h4>
          <p className="text-[11px] text-muted-foreground text-center line-clamp-2">
            {amenity.shortDescription}
          </p>
        </div>
      )}
    </button>
  );
};

interface AmenityModalProps {
  amenity: Amenity;
  onClose: () => void;
}

const AmenityModal = ({ amenity, onClose }: AmenityModalProps) => {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const IconComponent = ICON_MAP[amenity.iconName] ?? Sparkles;

  const hasMultipleImages = amenity.images.length > 1;
  const currentImage = amenity.images[currentImageIdx];

  const handlePrev = () =>
    setCurrentImageIdx((idx) => (idx === 0 ? amenity.images.length - 1 : idx - 1));
  const handleNext = () =>
    setCurrentImageIdx((idx) => (idx === amenity.images.length - 1 ? 0 : idx + 1));

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {currentImage ? (
          <div className="relative aspect-[4/3] bg-muted">
            <img
              src={currentImage.url}
              alt={currentImage.caption ?? amenity.name}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md text-foreground hover:bg-card transition-colors flex items-center justify-center shadow-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Siguiente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md text-foreground hover:bg-card transition-colors flex items-center justify-center shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {amenity.images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentImageIdx(idx)}
                      aria-label={`Imagen ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentImageIdx ? "w-6 bg-background" : "w-1.5 bg-background/50 hover:bg-background/80"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {currentImage.caption && (
              <div className="absolute bottom-12 left-0 right-0 px-4">
                <p className="text-[11px] text-background bg-foreground/40 backdrop-blur-sm px-3 py-1 rounded-md inline-block">
                  {currentImage.caption}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md text-foreground hover:bg-card transition-colors flex items-center justify-center shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <IconComponent className="w-10 h-10 text-primary" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md text-foreground hover:bg-card transition-colors flex items-center justify-center shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconComponent className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-primary">Amenidad</p>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">{amenity.name}</h2>
          <p className="text-xs text-foreground/85 leading-relaxed mb-3">
            {amenity.longDescription ?? amenity.shortDescription}
          </p>
          {amenity.images.length > 1 && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {currentImageIdx + 1} de {amenity.images.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AmenitiesGridSection;
