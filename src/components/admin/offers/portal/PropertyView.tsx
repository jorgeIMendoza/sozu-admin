import { MapPin, Ruler, BedDouble, Bath, CalendarDays, Layers } from "lucide-react";
import type { PropertyData } from "@/lib/offers/mock-data";

interface PropertyViewProps {
  property: PropertyData;
}

const PropertyView = ({ property }: PropertyViewProps) => {
  const details = [
    { icon: Layers, label: "Tipo", value: property.type },
    { icon: Ruler, label: "Área", value: property.area },
    { icon: Layers, label: "Piso", value: property.floor },
    { icon: BedDouble, label: "Recámaras", value: property.bedrooms.toString() },
    { icon: Bath, label: "Baños", value: property.bathrooms.toString() },
    { icon: CalendarDays, label: "Entrega est.", value: property.deliveryDate },
  ];

  return (
    <div className="px-4 py-5 pb-24 animate-fade-in">
      <h2 className="font-display font-bold text-xl text-foreground mb-1">
        {property.projectName}
      </h2>
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-5">
        <MapPin className="w-3.5 h-3.5" />
        {property.location}
      </div>

      {/* Property hero placeholder */}
      <div className="w-full aspect-[16/9] rounded-xl bg-gradient-to-br from-primary/20 to-accent mb-5 flex items-center justify-center">
        <span className="text-4xl font-display font-bold text-primary/30">
          {property.unitNumber}
        </span>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <h3 className="font-display font-semibold text-foreground text-sm mb-3">
          Detalles de la unidad
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {details.map((d) => (
            <div key={d.label} className="flex items-start gap-2.5">
              <d.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-medium text-foreground">{d.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PropertyView;
