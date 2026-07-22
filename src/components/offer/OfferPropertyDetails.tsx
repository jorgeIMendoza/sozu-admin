import { useState, Fragment } from "react";
import { Bed, Bath, Car, Building2, Ruler, Package, ChevronRight, KeyRound, Copy, Check } from "lucide-react";
import type { PropertyDetails, OfertaBodega, OfertaEstacionamiento } from "@/lib/offers/offer-data";
import { formatMXN } from "@/lib/offers/offer-data";
import UnitExtrasDialog from "./UnitExtrasDialog";
import SectionCard from "./SectionCard";

interface Props {
  property: PropertyDetails;
  bodegas?: OfertaBodega[];
  estacionamientos?: OfertaEstacionamiento[];
  clabeStp?: string;
}

function toOrdinalWord(n: number): string {
  const words = ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"];
  return words[n] ?? String(n);
}

/** Tipos distintos de estacionamiento (Normal, Tandem, …) para subtítulo. */
function parkingTypesLabel(estac?: OfertaEstacionamiento[]): string | null {
  if (!estac || estac.length === 0) return null;
  const tipos = Array.from(new Set(estac.map((e) => e.tipo).filter(Boolean))) as string[];
  return tipos.length > 0 ? tipos.join(", ") : null;
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

/**
 * Tile de característica. Si recibe `onClick` se vuelve interactivo (chevron +
 * hover) y abre el detalle. Un solo lugar por dato → sin repetición.
 */
const StatTile = ({
  icon: Icon,
  label,
  sublabel,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  badge?: string;
  onClick?: () => void;
}) => {
  const interactive = !!onClick;
  const Wrapper = interactive ? "button" : "div";
  return (
    <Wrapper
      {...(interactive ? { type: "button" as const, onClick } : {})}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-left w-full ${
        interactive
          ? "bg-primary/5 border-primary/25 hover:bg-primary/10 transition-colors"
          : "bg-muted/50 border-border/40"
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
      {badge && !interactive && (
        <span className="ml-auto text-[9px] font-semibold text-primary shrink-0">{badge}</span>
      )}
      {interactive && <ChevronRight className="ml-auto w-3.5 h-3.5 text-primary/70 shrink-0" />}
    </Wrapper>
  );
};

const OfferPropertyDetails = ({
  property,
  bodegas,
  estacionamientos,
  clabeStp,
}: Props) => {
  const [dialogKind, setDialogKind] = useState<"bodega" | "estacionamiento" | null>(null);
  const [copied, setCopied] = useState(false);

  const hasBodegas = (bodegas?.length ?? 0) > 0;
  const hasEstac = (estacionamientos?.length ?? 0) > 0;
  const estacTipos = parkingTypesLabel(estacionamientos);
  const estacIncluido = hasEstac && estacionamientos!.every((e) => e.incluido);

  const copyClabe = async () => {
    if (!clabeStp) return;
    try {
      await navigator.clipboard.writeText(clabeStp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible - no-op */
    }
  };

  return (
    <SectionCard icon={Building2} title="Datos de la propiedad" bodyClassName="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: ficha técnica - SOLO datos de identificación + precio */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground/60 mb-2">
              Ficha técnica
            </p>
            <SpecRow label="Proyecto" value={property.projectName} />
            <SpecRow label="Edificio" value={property.buildingName} />
            <SpecRow label="Modelo" value={property.unitModel} />
            <SpecRow label="Número" value={property.unitNumber} mono />
            <SpecRow label="Nivel" value={`Piso ${property.level}`} mono />
            <SpecRow label="Precio de lista" value={formatMXN(property.listPrice)} mono highlight />
            {property.pricePerM2 ? (
              <SpecRow label="Precio por m²" value={formatMXN(property.pricePerM2)} mono />
            ) : null}
            {/* Desglose de bodegas incluidas (mismo detalle que el diálogo de bodega) */}
            {(bodegas ?? [])
              .filter((b) => b.incluido && (b.costo ?? 0) > 0)
              .map((b) => {
                const m2 = b.m2 ?? 0;
                const costo = b.costo ?? 0;
                const precioM2 = m2 > 0 ? costo / m2 : costo;
                return (
                  <Fragment key={`bodega-ficha-${b.id}`}>
                    <SpecRow label="Bodega" value={b.nombre} />
                    {m2 > 0 && (
                      <SpecRow
                        label="Bodega m²"
                        value={`${m2.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m²`}
                        mono
                      />
                    )}
                    <SpecRow label="Bodega precio de lista" value={`${formatMXN(precioM2)} /m²`} mono />
                    <SpecRow label="Bodega precio total" value={formatMXN(costo)} mono highlight />
                  </Fragment>
                );
              })}
            {/* Total = precio de lista de la propiedad + costo de bodegas incluidas */}
            {(() => {
              const bodegaTotal = (bodegas ?? [])
                .filter((b) => b.incluido)
                .reduce((s, b) => s + (b.costo ?? 0), 0);
              return bodegaTotal > 0 ? (
                <SpecRow label="Total" value={formatMXN(property.listPrice + bodegaTotal)} mono highlight />
              ) : null;
            })()}
          </div>

          {/* Right: características + extras - cada dato UNA sola vez */}
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground/60 mb-2">
                Características
              </p>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  icon={Bed}
                  label={`${toOrdinalWord(property.bedrooms)} recámara${property.bedrooms === 1 ? "" : "s"}`}
                />
                <StatTile
                  icon={Bath}
                  label={`${toOrdinalWord(property.bathrooms)} baño${property.bathrooms === 1 ? "" : "s"}`}
                />
                {property.area ? (
                  <StatTile icon={Ruler} label={`${property.area}`} badge="m²" />
                ) : null}
                {/* Estacionamiento - tile clickeable con detalle en modal */}
                {hasEstac && (
                  <StatTile
                    icon={Car}
                    label={`${estacionamientos!.length} caj${estacionamientos!.length === 1 ? "ón" : "ones"}`}
                    sublabel={estacTipos ?? (estacIncluido ? "Incluido" : undefined)}
                    onClick={() => setDialogKind("estacionamiento")}
                  />
                )}
                {/* Bodega - mismo trato que estacionamiento */}
                {hasBodegas && (
                  <StatTile
                    icon={Package}
                    label={`${bodegas!.length} bodega${bodegas!.length === 1 ? "" : "s"}`}
                    sublabel={(() => {
                      const total = bodegas!.reduce((s, b) => s + (b.costo ?? 0), 0);
                      return total > 0
                        ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(total)
                        : undefined;
                    })()}
                    onClick={() => setDialogKind("bodega")}
                  />
                )}
              </div>
            </div>

            {/* CLABE STP */}
            {clabeStp && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted/50 border border-border/40">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted-foreground/60">
                    CLABE STP
                  </p>
                  <p className="text-sm font-bold tabular-nums truncate">{clabeStp}</p>
                </div>
                <button
                  type="button"
                  onClick={copyClabe}
                  className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:opacity-80"
                  aria-label="Copiar CLABE"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiada" : "Copiar"}
                </button>
              </div>
            )}
          </div>
        </div>

      <UnitExtrasDialog
        open={dialogKind !== null}
        onOpenChange={(o) => !o && setDialogKind(null)}
        kind={dialogKind ?? "bodega"}
        bodegas={bodegas}
        estacionamientos={estacionamientos}
      />
    </SectionCard>
  );
};

export default OfferPropertyDetails;
