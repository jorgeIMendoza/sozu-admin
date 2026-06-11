import { ArrowLeft, ChevronRight } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { getPropertyStatus } from "@/lib/offers/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface PropertySelectorProps {
  title: string;
  portfolio: InvestmentProperty[];
  onSelect: (property: InvestmentProperty) => void;
  onBack: () => void;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  "Pago Pendiente": { bg: "bg-warning/15", text: "text-warning" },
  "En Preventa": { bg: "bg-primary/15", text: "text-primary" },
  Entregada: { bg: "bg-success/15", text: "text-success" },
  "En Escrituración": { bg: "bg-primary/15", text: "text-primary" },
  "Por Entregar": { bg: "bg-primary/15", text: "text-primary" },
  Completado: { bg: "bg-success/15", text: "text-success" },
};

const PropertySelector = ({ title, portfolio, onSelect, onBack }: PropertySelectorProps) => {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display font-semibold text-base text-foreground">{title}</h1>
        </div>
      </div>

      {/* Subtitle */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-sm text-muted-foreground">Selecciona una propiedad</p>
      </div>

      {/* Property list */}
      <div className="px-5 space-y-2 pb-8">
        {portfolio.map((inv) => {
          const status = getPropertyStatus(inv);
          const st = statusStyles[status.label] || { bg: "bg-muted", text: "text-muted-foreground" };
          const progress = inv.financials.initialPrice > 0
            ? Math.round((inv.financials.totalPaid / inv.financials.initialPrice) * 100)
            : 0;
          const isDelivered = status.label === "Entregada";

          return (
            <button
              key={inv.property.id}
              onClick={() => onSelect(inv)}
              className="w-full flex items-center gap-3.5 bg-card rounded-2xl border border-border p-4 transition-all active:scale-[0.98] hover:border-primary/30 text-left"
            >
              {/* Icon circle */}
              <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0`}>
                <span className={`font-display font-bold text-sm ${st.text}`}>
                  {inv.property.unitNumber}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-foreground truncate">
                  {inv.property.projectName}
                  <span className="font-normal text-muted-foreground"> · U{inv.property.unitNumber}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-medium ${st.text}`}>{status.label}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {isDelivered
                      ? `+${inv.financials.estimatedAppreciation}% plusvalía`
                      : `${progress}% pagado`}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PropertySelector;
