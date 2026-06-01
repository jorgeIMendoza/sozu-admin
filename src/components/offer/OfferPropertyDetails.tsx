import { Bed, Bath, Droplet, Car, Layers, Building2 } from "lucide-react";
import type { PropertyDetails } from "@/lib/offer-types";
import { formatMXN } from "@/lib/offer-types";

interface Props {
  property: PropertyDetails;
  materialsPaletteUrl?: string;
}

function spanishNumber(n: number): string {
  const words = ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"];
  return words[n] ?? String(n);
}

const SpecRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border/60 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium text-foreground text-right ${mono ? "tabular-nums" : ""}`}>
      {value}
    </span>
  </div>
);

const IconStat = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50">
    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
    <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
  </div>
);

const OfferPropertyDetails = ({ property, materialsPaletteUrl }: Props) => (
  <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
    <div className="flex items-center gap-2 mb-5">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Datos de la propiedad</h2>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <SpecRow label="Proyecto" value={property.projectName} />
        <SpecRow label="Edificio" value={property.buildingName} />
        <SpecRow label="Modelo" value={property.unitModel} />
        <SpecRow label="Número de propiedad" value={property.unitNumber} mono />
        <SpecRow label="Nivel" value={String(property.level)} mono />
        <SpecRow label="Vista" value={property.view} />
        <SpecRow label="Área interior" value={`${property.interiorArea ?? property.area} m²`} mono />
        {property.exteriorArea && (
          <SpecRow label="Área exterior" value={`${property.exteriorArea} m²`} mono />
        )}
        <SpecRow label="Precio de lista" value={formatMXN(property.listPrice)} mono />
        <SpecRow label="Precio por m²" value={formatMXN(property.pricePerM2)} mono />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <IconStat icon={Bed} label={`${spanishNumber(property.bedrooms)} recámara${property.bedrooms === 1 ? "" : "s"}`} />
          <IconStat icon={Car} label={`${spanishNumber(property.parkingSpots)} ${property.parkingType.toLowerCase()}`} />
          <IconStat icon={Bath} label={`${spanishNumber(property.bathrooms)} baño${property.bathrooms === 1 ? "" : "s"}`} />
          {property.hasBalcony && <IconStat icon={Layers} label="Balcón / terraza" />}
          {property.halfBathrooms > 0 && (
            <IconStat
              icon={Droplet}
              label={`${spanishNumber(property.halfBathrooms)} sanitario${property.halfBathrooms === 1 ? "" : "s"}`}
            />
          )}
        </div>

        {materialsPaletteUrl && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
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
);

export default OfferPropertyDetails;
