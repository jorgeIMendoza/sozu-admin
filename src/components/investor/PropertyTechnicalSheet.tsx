import { Building2 } from "lucide-react";
import type { PropertyData } from "@/lib/offers/mock-data";

interface Props {
  property: PropertyData;
}

const PropertyTechnicalSheet = ({ property }: Props) => (
  <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
    <div className="flex items-center gap-2 mb-4">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        Datos técnicos
      </h2>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-4">
      <DataCell label="Proyecto" value={property.projectName} />
      <DataCell label="Unidad" value={`U-${property.unitNumber}`} />
      <DataCell label="Tipo" value={property.type} />
      <DataCell label="Área" value={property.area} />
      <DataCell label="Recámaras" value={String(property.bedrooms)} />
      <DataCell label="Baños" value={String(property.bathrooms)} />
      <DataCell label="Piso" value={property.floor} />
      <DataCell label="Entrega" value={property.deliveryDate} />
    </div>
  </section>
);

const DataCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
      {label}
    </p>
    <p className="text-[13px] font-medium text-foreground mt-0.5">{value}</p>
  </div>
);

export default PropertyTechnicalSheet;
