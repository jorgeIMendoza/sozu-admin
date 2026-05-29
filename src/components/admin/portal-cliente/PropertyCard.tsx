import { TrendingUp, CreditCard } from "lucide-react";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";

interface PropertyCardProps {
  investment: InvestmentProperty;
  onSelect: (id: string) => void;
}

const dotByColor: Record<string, string> = {
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
};

const PropertyCard = ({ investment, onSelect }: PropertyCardProps) => {
  const { property, financials } = investment;
  const status = getPropertyStatus(investment);
  const paidPct = financials.initialPrice > 0
    ? Math.round((financials.totalPaid / financials.initialPrice) * 100)
    : 0;
  const heroImage = property.image || getPropertyImage(property.id);
  const hasPendingPayment = status.label === "Pago Pendiente";
  const dot = dotByColor[status.color] ?? "bg-muted-foreground";
  const estimatedValue = financials.currentEstimatedValue ?? financials.initialPrice;

  return (
    <div
      onClick={() => onSelect(property.id)}
      className="group cursor-pointer rounded-xl bg-card border border-border hover:border-border-soft hover:shadow-sm transition-all duration-150"
    >
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="hidden sm:block flex-shrink-0">
          <div
            className={`w-[112px] h-[96px] rounded-lg overflow-hidden ${
              heroImage ? "" : `bg-gradient-to-br ${property.imageGradient}`
            }`}
          >
            {heroImage && (
              <img
                src={heroImage}
                alt={property.projectName}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] text-foreground leading-tight">
                <span className="font-semibold">{property.projectName}</span>
                <span className="text-muted-foreground font-normal"> · U-{property.unitNumber}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {property.location}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {status.label}
            </span>
          </div>

          {/* 3-metric grid with hairline dividers */}
          <div className="grid grid-cols-3 divide-x divide-border-subtle border-y border-border-subtle py-2.5">
            <div className="px-2 first:pl-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor</p>
              <p className="text-[13px] font-semibold text-foreground tabular-nums mt-0.5">
                {fmt(estimatedValue)}
              </p>
            </div>
            <div className="px-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Plusvalía</p>
              <p className="text-[13px] font-semibold text-success tabular-nums mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                {financials.estimatedAppreciation.toFixed(1)}%
              </p>
            </div>
            <div className="px-2 last:pr-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pagado</p>
              <p className="text-[13px] font-semibold text-foreground tabular-nums mt-0.5">
                {paidPct}%
              </p>
              <div className="mt-1 w-full h-[2px] bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-primary group-hover:underline">
              Ver detalle →
            </span>
            {hasPendingPayment && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                <CreditCard className="w-3 h-3" />
                Pagar
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
