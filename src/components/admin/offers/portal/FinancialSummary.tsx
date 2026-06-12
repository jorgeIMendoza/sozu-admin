import { useState } from "react";
import { TrendingUp, ChevronDown, BarChart3 } from "lucide-react";
import type { FinancialData, PropertyData } from "@/lib/offers/mock-data";

interface FinancialSummaryProps {
  financials: FinancialData;
  property: PropertyData;
  onViewDetails: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(amount);

const FinancialSummary = ({ financials, property, onViewDetails }: FinancialSummaryProps) => {
  const [expanded, setExpanded] = useState(false);
  const progressPercent = (financials.totalPaid / financials.initialPrice) * 100;
  const pricePerM2 = Math.round(financials.initialPrice / 87.5);
  const currentPricePerM2 = Math.round(pricePerM2 * (1 + financials.estimatedAppreciation / 100));
  const estimatedCurrentValue = Math.round(financials.initialPrice * (1 + financials.estimatedAppreciation / 100));

  return (
    <section className="px-5 py-4 animate-slide-up" style={{ animationDelay: "0.15s" }}>
      <h2 className="font-display font-semibold text-foreground text-sm mb-3">
        Rendimiento de tu inversión
      </h2>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Main metrics */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Plusvalía estimada</p>
                <p className="text-lg font-bold text-primary tabular-nums">
                  +{financials.estimatedAppreciation}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Valor estimado actual</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(estimatedCurrentValue)}
              </p>
            </div>
          </div>

          {/* Sparkline placeholder */}
          <div className="flex items-end gap-[3px] h-10 px-1">
            {[30, 35, 33, 40, 38, 45, 50, 48, 55, 60, 58, 65, 70, 68, 75, 80, 78, 85, 88, 92, 90, 95, 100].map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/20 rounded-sm min-w-[2px] transition-all hover:bg-primary/40"
                style={{ height: `${v}%` }}
              />
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {expanded ? "Ocultar análisis" : "Ver análisis financiero completo"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Precio por m² inicial</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCurrency(pricePerM2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Precio por m² actual</p>
                <p className="text-sm font-semibold text-primary tabular-nums">
                  {formatCurrency(currentPricePerM2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganancia estimada</p>
                <p className="text-sm font-semibold text-primary tabular-nums">
                  {formatCurrency(estimatedCurrentValue - financials.initialPrice)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Área</p>
                <p className="text-sm font-semibold text-foreground">{property.area}</p>
              </div>
            </div>

            <button
              onClick={onViewDetails}
              className="w-full py-2.5 rounded-xl bg-primary/8 text-xs font-semibold text-primary hover:bg-primary/12 transition-colors"
            >
              Ver historial de pagos completo
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default FinancialSummary;
