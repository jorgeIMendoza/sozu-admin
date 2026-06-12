import { useState } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PropertyData, FinancialData, StageInfo } from "@/lib/offers/mock-data";

interface FinancialHeroProps {
  property: PropertyData;
  financials: FinancialData;
  currentStage: StageInfo;
  onMenuOpen: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(amount);

const statusLabel: Record<string, string> = {
  preventa: "En Preventa",
  pago_final: "Pago Pendiente",
  escrituracion: "En Escrituración",
  entrega: "Por Entregar",
  post_entrega: "Entregado",
};

const FinancialHero = ({ property, financials, currentStage, onMenuOpen }: FinancialHeroProps) => {
  const progressPercent = (financials.totalPaid / financials.initialPrice) * 100;
  const [animateProgress] = useState(true);

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-primary/30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />

      <div className="relative px-5 pt-4 pb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-primary-foreground text-base tracking-tight">
              {property.projectName}
            </h1>
            <p className="text-primary-foreground/60 text-xs mt-0.5">
              Unidad {property.unitNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] font-semibold">
              {statusLabel[currentStage.id] || currentStage.label}
            </Badge>
            <button
              onClick={onMenuOpen}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/15 transition-colors"
              aria-label="Menú"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Main value */}
        <div className="mb-5">
          <p className="text-primary-foreground/50 text-[11px] uppercase tracking-wider font-medium mb-1">
            Valor de compra
          </p>
          <p className="font-display font-bold text-3xl text-primary-foreground tabular-nums tracking-tight">
            {formatCurrency(financials.initialPrice)}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary">
              +{financials.estimatedAppreciation}% plusvalía
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-primary-foreground/50 text-[11px] font-medium">
              Progreso de pago
            </span>
            <span className="text-xs font-bold text-primary tabular-nums">
              {progressPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-primary to-primary/70 ${
                animateProgress ? "animate-progress-fill" : ""
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Paid vs remaining */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-foreground/5 rounded-xl p-3 border border-primary-foreground/10">
            <p className="text-primary-foreground/40 text-[10px] uppercase tracking-wider font-medium mb-1">
              Pagado
            </p>
            <p className="font-display font-bold text-lg text-primary tabular-nums">
              {formatCurrency(financials.totalPaid)}
            </p>
          </div>
          <div className="bg-primary-foreground/5 rounded-xl p-3 border border-primary-foreground/10">
            <p className="text-primary-foreground/40 text-[10px] uppercase tracking-wider font-medium mb-1">
              Restante
            </p>
            <p className="font-display font-bold text-lg text-primary-foreground tabular-nums">
              {formatCurrency(financials.pendingBalance)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinancialHero;
