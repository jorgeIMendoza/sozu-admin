import { GraduationCap, Utensils, Trees, ShoppingBag, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface LifestyleCategory {
  id: string;
  icon: LucideIcon;
  label: string;
  metric: string;
  images: { url: string; caption: string }[];
}

interface Props {
  zoneName: string;
}

// SWAP POINT: reemplazar URLs por fotos reales del vecindario con consentimiento de uso
const LIFESTYLE_CATEGORIES: LifestyleCategory[] = [
  {
    id: "education",
    icon: GraduationCap,
    label: "Educación",
    metric: "12 escuelas top en 5 km",
    images: [
      { url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800", caption: "American School Foundation" },
      { url: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800", caption: "Liceo del Valle" },
    ],
  },
  {
    id: "gastronomy",
    icon: Utensils,
    label: "Gastronomía",
    metric: "40+ restaurantes calificados",
    images: [
      { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800", caption: "Hueso · Cocina contemporánea" },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800", caption: "Anita Li · Cocina de autor" },
    ],
  },
  {
    id: "recreation",
    icon: Trees,
    label: "Recreación",
    metric: "Country Club + 3 parques",
    images: [
      { url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", caption: "Guadalajara Country Club" },
      { url: "https://images.unsplash.com/photo-1564981797816-1043664bf78d?w=800", caption: "Parque Metropolitano" },
    ],
  },
  {
    id: "daily",
    icon: ShoppingBag,
    label: "Vida diaria",
    metric: "Andares y Plaza Patria a 5–7 min",
    images: [
      { url: "https://images.unsplash.com/photo-1519748771451-a94c596fad67?w=800", caption: "Andares Shopping" },
      { url: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800", caption: "Plaza Patria" },
    ],
  },
];

const LifestyleCountryClubSection = ({ zoneName }: Props) => {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <h3 className="text-sm font-semibold">Vivir en {zoneName}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-5">
            La zona es parte del producto. Esto es lo que tendrás a la mano.
          </p>
        </div>
      </div>

      {/* Cards - horizontal scroll on mobile, 4-col on desktop */}
      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible scrollbar-none">
          {LIFESTYLE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const heroImage = cat.images[0];
            return (
              <div
                key={cat.id}
                className="relative flex-shrink-0 w-[200px] md:w-auto rounded-xl overflow-hidden bg-muted group"
                style={{ aspectRatio: "3/4" }}
              >
                {/* Hero image */}
                {heroImage && (
                  <img
                    src={heroImage.url}
                    alt={cat.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Content overlay */}
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center mb-2 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{cat.label}</p>
                  <p className="text-[10px] text-white/70 leading-tight mt-0.5">{cat.metric}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LifestyleCountryClubSection;
