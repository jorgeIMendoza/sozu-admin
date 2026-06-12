import { useState } from "react";
import { ChevronDown, Columns, Star } from "lucide-react";
import type { PaymentPlan } from "@/lib/offers/offer-data";

interface PaymentPlansComparatorSectionProps {
  plans: PaymentPlan[];
  recommendedPlanId?: string | null;
}

const formatMxn = (amount: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);

const PaymentPlansComparatorSection = ({
  plans,
  recommendedPlanId,
}: PaymentPlansComparatorSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!plans || plans.length === 0) return null;

  const monthlyCount = plans.find((p) => p.installments)?.installments?.count ?? 48;

  const rows: { label: string; getValue: (p: PaymentPlan) => string; highlight: boolean }[] = [
    {
      label: "Descuento",
      getValue: (p) => (p.discountPct > 0 ? `-${p.discountPct}%` : "—"),
      highlight: false,
    },
    {
      label: "Precio final",
      getValue: (p) => formatMxn(p.finalPrice),
      highlight: true,
    },
    {
      label: "Enganche",
      getValue: (p) => `${formatMxn(p.downPaymentAmount)} (${p.downPaymentPct}%)`,
      highlight: false,
    },
    {
      label: `Mensualidad (${monthlyCount} m.)`,
      getValue: (p) =>
        p.installments ? formatMxn(p.installments.monthlyAmount) : "—",
      highlight: true,
    },
    {
      label: "A la entrega",
      getValue: (p) => `${formatMxn(p.finalPaymentAmount)} (${p.finalPaymentPct}%)`,
      highlight: false,
    },
  ];

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Columns className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">
              Comparar los {plans.length} esquemas lado a lado
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ve todas las cifras en paralelo para decidir cuál te conviene más.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-border-subtle">
          <div className="p-5">
            <p className="md:hidden text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
              <span aria-hidden>←</span> Desliza para ver todos los esquemas <span aria-hidden>→</span>
            </p>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-2 pr-3 sticky left-0 bg-card z-10">
                      &nbsp;
                    </th>
                    {plans.map((plan) => {
                      const isRecommended = plan.id === recommendedPlanId;
                      return (
                        <th
                          key={plan.id}
                          className={`text-center py-2 px-2 min-w-[90px] ${
                            isRecommended ? "bg-primary/[0.06]" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`text-sm font-bold ${
                                isRecommended ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {plan.id}
                            </span>
                            {plan.discountPct > 0 && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  isRecommended
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                -{plan.discountPct}%
                              </span>
                            )}
                            {isRecommended && (
                              <span className="text-[9px] uppercase tracking-wider text-primary font-bold flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Para ti
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-border-subtle">
                      <td className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-3 pr-3 sticky left-0 bg-card z-10">
                        {row.label}
                      </td>
                      {plans.map((plan) => {
                        const isRecommended = plan.id === recommendedPlanId;
                        return (
                          <td
                            key={plan.id}
                            className={`text-center py-3 px-2 tabular-nums ${
                              isRecommended ? "bg-primary/[0.04]" : ""
                            } ${
                              row.highlight ? "font-bold text-foreground" : "text-foreground/85"
                            }`}
                          >
                            {row.getValue(plan)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
              Esquemas vigentes a la fecha de expedición. Sujetos a aprobación interna y disponibilidad. No constituyen oferta vinculante.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaymentPlansComparatorSection;
