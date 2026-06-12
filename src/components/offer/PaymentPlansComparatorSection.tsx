import { useState } from "react";
import { ChevronDown, LayoutGrid, BadgePercent, CheckCircle2, TrendingDown, Clock } from "lucide-react";
import type { PaymentPlan } from "@/lib/offers/offer-data";

interface Props {
  plans: PaymentPlan[];
  recommendedPlanId?: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n: number) => `${n}%`;

const PaymentPlansComparatorSection = ({ plans, recommendedPlanId }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!plans || plans.length === 0) return null;

  const minEnganche = Math.min(...plans.map((p) => p.downPaymentPct));
  const minPrice = Math.min(...plans.map((p) => p.finalPrice));
  const hasAnyInstallments = plans.some((p) => !!p.installments);

  const getPlanBadge = (plan: PaymentPlan): { label: string; icon: typeof TrendingDown } | null => {
    if (plan.id === recommendedPlanId) return null;
    if (plan.finalPrice === minPrice && plan.id !== recommendedPlanId) return { label: "Precio más bajo", icon: TrendingDown };
    if (plan.downPaymentPct === minEnganche && plan.id !== recommendedPlanId) return { label: "Menor enganche", icon: TrendingDown };
    return null;
  };

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">

      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">
              Comparar los {plans.length} esquemas lado a lado
            </h3>
            {!isExpanded && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Desde {fmt(minPrice)} · enganche desde {pct(minEnganche)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isExpanded && (
            <span className="hidden sm:inline text-[11px] font-semibold text-primary">
              Ver tabla
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">

          {/* Scroll hint mobile */}
          <p className="sm:hidden text-[10px] text-muted-foreground px-5 pt-3 pb-0 flex items-center gap-1.5">
            <span className="inline-block w-4 h-px bg-muted-foreground/40" />
            Desliza horizontalmente para ver todos
            <span className="inline-block w-4 h-px bg-muted-foreground/40" />
          </p>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse"
              style={{ minWidth: `${Math.max(480, plans.length * 150)}px` }}
            >
              <thead>
                <tr>
                  {/* Corner cell */}
                  <th className="w-[130px] px-4 py-3 text-left bg-muted/30 border-b border-r border-border">
                    <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/60">
                      Esquema
                    </span>
                  </th>
                  {plans.map((plan) => {
                    const isRec = plan.id === recommendedPlanId;
                    const badge = getPlanBadge(plan);
                    return (
                      <th
                        key={plan.id}
                        className={`px-4 py-3 text-center border-b border-l border-border align-top ${
                          isRec ? "bg-primary" : "bg-muted/20"
                        }`}
                      >
                        {isRec && (
                          <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest font-bold text-primary-foreground/80 mb-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Recomendado
                          </div>
                        )}
                        {badge && (
                          <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-primary mb-1">
                            <badge.icon className="w-3 h-3" />
                            {badge.label}
                          </div>
                        )}
                        <p className={`text-sm font-bold leading-tight ${isRec ? "text-primary-foreground" : "text-foreground"}`}>
                          {plan.name}
                        </p>
                        {(plan.discountPct ?? 0) > 0 && (
                          <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isRec
                              ? "bg-white/20 text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          }`}>
                            <BadgePercent className="w-3 h-3" />
                            -{plan.discountPct}%
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {/* Precio final — hero row */}
                <tr className="bg-muted/10">
                  <td className="px-4 py-3.5 border-r border-b border-border">
                    <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                      Precio final
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Total a pagar</p>
                  </td>
                  {plans.map((plan) => {
                    const isRec = plan.id === recommendedPlanId;
                    const isBest = plan.finalPrice === minPrice;
                    return (
                      <td key={plan.id} className={`px-4 py-3.5 text-center border-l border-b border-border ${isRec ? "bg-primary/5" : ""}`}>
                        <p className={`text-base font-bold tabular-nums ${isRec ? "text-primary" : "text-foreground"}`}>
                          {fmt(plan.finalPrice)}
                        </p>
                        {isBest && !isRec && (
                          <span className="inline-block mt-1 text-[9px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
                            más bajo
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Enganche */}
                <tr>
                  <td className="px-4 py-3 border-r border-b border-border">
                    <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                      Enganche
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Al apartar</p>
                  </td>
                  {plans.map((plan) => {
                    const isRec = plan.id === recommendedPlanId;
                    const isMin = plan.downPaymentPct === minEnganche;
                    return (
                      <td key={plan.id} className={`px-4 py-3 text-center border-l border-b border-border ${isRec ? "bg-primary/5" : ""}`}>
                        <p className="text-sm font-semibold text-foreground tabular-nums">{fmt(plan.downPaymentAmount)}</p>
                        <p className={`text-[10px] mt-0.5 font-medium tabular-nums ${isMin ? "text-primary" : "text-muted-foreground"}`}>
                          {pct(plan.downPaymentPct)}
                          {isMin && " ·min"}
                        </p>
                      </td>
                    );
                  })}
                </tr>

                {/* Mensualidades */}
                {hasAnyInstallments && (
                  <tr className="bg-muted/5">
                    <td className="px-4 py-3 border-r border-b border-border">
                      <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                        Mensualidad
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                        <p className="text-[10px] text-muted-foreground/60">Durante obra</p>
                      </div>
                    </td>
                    {plans.map((plan) => {
                      const isRec = plan.id === recommendedPlanId;
                      return (
                        <td key={plan.id} className={`px-4 py-3 text-center border-l border-b border-border ${isRec ? "bg-primary/5" : ""}`}>
                          {plan.installments ? (
                            <>
                              <p className="text-sm font-bold text-foreground tabular-nums">
                                {fmt(plan.installments.monthlyAmount)}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                                {plan.installments.count} meses
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic">Sin mens.</p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* A la entrega */}
                <tr>
                  <td className="px-4 py-3 border-r border-border">
                    <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                      A la entrega
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Pago final</p>
                  </td>
                  {plans.map((plan) => {
                    const isRec = plan.id === recommendedPlanId;
                    return (
                      <td key={plan.id} className={`px-4 py-3 text-center border-l border-border ${isRec ? "bg-primary/5" : ""}`}>
                        <p className="text-sm font-semibold text-foreground tabular-nums">{fmt(plan.finalPaymentAmount)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{pct(plan.finalPaymentPct)}</p>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center px-5 py-3 border-t border-border/50">
            Esquemas vigentes a la fecha de expedición. Sujetos a disponibilidad.
          </p>
        </div>
      )}
    </section>
  );
};

export default PaymentPlansComparatorSection;
