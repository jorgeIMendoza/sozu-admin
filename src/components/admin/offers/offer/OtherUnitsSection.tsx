/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { Building2, ArrowUpRight, MapPin, Bed, Bath, Maximize2 } from "lucide-react";
import type { SimilarUnit } from "@/lib/offers/offer-data";

interface OtherUnitsSectionProps {
  units: SimilarUnit[];
  developmentName: string;
}

const formatMxnShort = (amount: number): string => {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  return `$${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(amount)}`;
};

const OtherUnitsSection = ({ units, developmentName }: OtherUnitsSectionProps) => {
  if (!units || units.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Otras unidades disponibles en {developmentName}
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
          Si esta unidad no es la indicada, estas opciones del mismo desarrollo pueden interesarte.
        </p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {units.slice(0, 4).map((unit) => (
            <SimilarUnitCard key={unit.id} unit={unit} />
          ))}
        </div>

        {units.length > 4 && (
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Tu agente puede mostrarte más opciones según tus preferencias.
          </p>
        )}
      </div>
    </section>
  );
};

const SimilarUnitCard = ({ unit }: { unit: SimilarUnit }) => (
  <a
    href={unit.offerUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="block rounded-xl border border-border bg-card overflow-hidden group hover:border-primary/40 hover:shadow-md transition-all"
  >
    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
      <img
        src={unit.thumbnailUrl}
        alt={`${unit.modelName} ${unit.label}`}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute top-2 right-2">
        <span className="px-2 py-0.5 rounded-full bg-card/90 backdrop-blur-md text-[10px] font-bold text-foreground tabular-nums">
          {unit.label}
        </span>
      </div>
      <div className="absolute top-2 left-2">
        <span className="px-2 py-0.5 rounded-full bg-foreground/70 backdrop-blur-md text-[10px] font-semibold text-background">
          {unit.modelName}
        </span>
      </div>
    </div>

    <div className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-foreground tabular-nums">
          Desde {formatMxnShort(unit.priceFrom)}
        </p>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>

      <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground tabular-nums flex-wrap">
        <span className="flex items-center gap-1">
          <Maximize2 className="w-2.5 h-2.5" />
          {unit.areaSqm} m²
        </span>
        <span className="flex items-center gap-1">
          <Bed className="w-2.5 h-2.5" />
          {unit.bedrooms}
        </span>
        <span className="flex items-center gap-1">
          <Bath className="w-2.5 h-2.5" />
          {unit.bathrooms}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5" />
          Piso {unit.floorLevel}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1.5">
        Vista <span className="font-semibold text-foreground">{unit.view}</span>
      </p>
    </div>
  </a>
);

export default OtherUnitsSection;
