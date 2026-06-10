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
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Vivir en {zoneName}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          La zona es parte del producto — no solo el departamento. Esto es lo que vas a tener a la mano.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {LIFESTYLE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{cat.metric}</p>
                </div>
              </div>

              <div className="space-y-2">
                {cat.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={img.url}
                      alt={img.caption}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2">
                      <p className="text-[10px] font-medium text-white leading-tight">
                        {img.caption}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LifestyleCountryClubSection;
