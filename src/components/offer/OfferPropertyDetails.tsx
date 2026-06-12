import { Bed, Bath, Droplet, Car, Layers, Building2, ArrowUpRight } from "lucide-react";
import type { PropertyDetails, ParkingSlot } from "@/lib/offers/offer-data";
import { formatMXN } from "@/lib/offers/offer-data";

interface Props {
  property: PropertyDetails;
  parkingSlots?: ParkingSlot[];
  materialsPaletteUrl?: string;
}

function toOrdinalWord(n: number): string {
  const words = ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"];
  return words[n] ?? String(n);
}

function formatParkingLabel(slots?: ParkingSlot[]): string | null {
  if (!slots || slots.length === 0) return null;
  if (slots.length === 1) return "1 cajón";
  return `${slots.length} cajones`;
}

const SpecRow = ({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) => (
  <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span
      className={`text-sm text-right leading-tight ${mono ? "tabular-nums font-bold" : "font-bold"} ${
        highlight ? "text-primary" : "text-foreground"
      }`}
    >
      {value}
    </span>
  </div>
);

const IconStat = ({
  icon: Icon,
  label,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 relative overflow-hidden">
    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
    {badge && (
      <span className="ml-auto text-[9px] font-semibold text-primary shrink-0">{badge}</span>
    )}
  </div>
);

const OfferPropertyDetails = ({ property, parkingSlots, materialsPaletteUrl }: Props) => {
  const parkingLabel = formatParkingLabel(parkingSlots);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/20">
        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Datos de la propiedad</h3>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: spec table */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground/60 mb-2">
              Ficha técnica
            </p>
            <SpecRow label="Proyecto" value={property.projectName} />
            <SpecRow label="Edificio" value={property.buildingName} />
            <SpecRow label="Modelo" value={property.unitModel} />
            <SpecRow label="Número" value={property.unitNumber} mono />
            <SpecRow label="Nivel" value={`Piso ${property.level}`} mono />
            {parkingLabel && <SpecRow label="Estacionamiento" value={parkingLabel} />}
            <SpecRow label="Precio de lista" value={formatMXN(property.listPrice)} mono highlight />
            <SpecRow label="Precio por m²" value={formatMXN(property.pricePerM2)} mono />
          </div>

          {/* Right: icon stats + features + palette */}
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground/60 mb-2">
                Características
              </p>
              <div className="grid grid-cols-2 gap-2">
                <IconStat
                  icon={Bed}
                  label={`${toOrdinalWord(property.bedrooms)} recámara${property.bedrooms === 1 ? "" : "s"}`}
                />
                <IconStat
                  icon={Bath}
                  label={`${toOrdinalWord(property.bathrooms)} baño${property.bathrooms === 1 ? "" : "s"}`}
                />
                <IconStat
                  icon={Car}
                  label={`${toOrdinalWord(property.parkingSpots)} ${property.parkingType.toLowerCase()}`}
                />
                {property.area && (
                  <IconStat
                    icon={ArrowUpRight}
                    label={String(property.area)}
                    badge="m²"
                  />
                )}
              </div>
            </div>

            {/* Materials palette */}
            {materialsPaletteUrl && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground/60 mb-2">
                  Paleta de materiales
                </p>
                <div className="rounded-xl overflow-hidden border border-border bg-muted">
                  <img
                    src={materialsPaletteUrl}
                    alt="Paleta de materiales"
                    className="w-full aspect-[3/1] object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferPropertyDetails;
