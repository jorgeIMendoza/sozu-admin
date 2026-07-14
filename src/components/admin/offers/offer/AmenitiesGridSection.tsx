import { Sparkles } from "lucide-react";
import type { Amenity } from "@/lib/offers/offer-data";

interface AmenitiesGridSectionProps {
  amenities: Amenity[];
}

const SIZE_CLASSES: Record<Amenity["size"], string> = {
  large: "md:col-span-2 md:row-span-2",
  medium: "",
  small: "",
};

const AmenitiesGridSection = ({ amenities }: AmenitiesGridSectionProps) => {
  if (!amenities || amenities.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Amenidades del desarrollo</h3>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-[140px]">
          {amenities.map((amenity) => (
            <AmenityCard key={amenity.id} amenity={amenity} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface AmenityCardProps {
  amenity: Amenity;
}

// Solo visual: imagen de referencia + nombre, o solo nombre. Sin interacción.
const AmenityCard = ({ amenity }: AmenityCardProps) => {
  const firstImage = amenity.images[0];
  // Bento (tamaño grande) solo cuando hay imagen; las de solo texto quedan uniformes.
  const sizeClass = firstImage ? SIZE_CLASSES[amenity.size] : "";

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border-subtle bg-muted ${sizeClass}`}>
      {firstImage ? (
        <>
          <img
            src={firstImage.url}
            alt={amenity.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent" />
          <div className="absolute inset-0 p-4 flex flex-col justify-end">
            <h4 className="text-sm font-bold text-background leading-tight">{amenity.name}</h4>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 p-4 flex items-center justify-center bg-card">
          <h4 className="text-sm font-bold text-foreground text-center leading-tight">{amenity.name}</h4>
        </div>
      )}
    </div>
  );
};

export default AmenitiesGridSection;
