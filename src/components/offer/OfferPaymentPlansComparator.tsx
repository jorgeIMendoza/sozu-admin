import { useState, useEffect } from "react";
import { Wallet, TrendingDown, CalendarClock, KeyRound, BadgePercent } from "lucide-react";
import type { PaymentPlan } from "@/lib/offer-types";
import { formatMXN } from "@/lib/offer-types";

interface Props {
  plans: PaymentPlan[];
  listPrice: number;
  selectedPlanId?: string;
  onSelectPlan?: (planId: string) => void;
}

const LegendItem = ({ color, label, pct }: { color: string; label: string; pct: number }) => (
  <div className="flex items-center gap-1.5 text-[11px]">
    <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums text-foreground">{pct}%</span>
  </div>
);

const FlowRow = ({
  icon: Icon,
  label,
  sublabel,
  amount,
  amountSuffix,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  amount: number;
  amountSuffix?: string;
}) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-border/60 last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sublabel}</p>
      </div>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-sm font-semibold tabular-nums text-foreground">{formatMXN(amount)}</p>
      {amountSuffix && (
        <p className="text-[10px] text-muted-foreground leading-tight">{amountSuffix}</p>
      )}
    </div>
  </div>
);

const OfferPaymentPlansComparator = ({ plans, listPrice, selectedPlanId, onSelectPlan }: Props) => {
  const [internalId, setInternalId] = useState(selectedPlanId ?? plans[0]?.id ?? "");

  useEffect(() => {
    if (selectedPlanId) setInternalId(selectedPlanId);
  }, [selectedPlanId]);

  const activeId = selectedPlanId ?? internalId;
  const setActive = (id: string) => {
    setInternalId(id);
    onSelectPlan?.(id);
  };

  const selectedPlan = plans.find((p) => p.id === activeId) ?? plans[0];
  if (!selectedPlan) return null;

  const installmentsSublabel = selectedPlan.installments?.endDate
    ? `Hasta ${new Date(selectedPlan.installments.endDate).toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
      })}`
    : selectedPlan.installments
    ? `${selectedPlan.installments.count} pagos mensuales`
    : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <BadgePercent className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Esquemas de financiamiento</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Explora cómo se distribuye el pago en cada esquema. A mayor enganche, mayor descuento.
      </p>

      {/* Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        {plans.map((plan) => {
          const isActive = plan.id === activeId;
          return (
            <button
              key={plan.id}
              onClick={() => setActive(plan.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-medium transition-all border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-foreground/30"
              }`}
            >
              <span>{plan.name}</span>
              {plan.discountPct > 0 && (
                <span
                  className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
                  }`}
                >
                  −{plan.discountPct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected plan card */}
      <div className="mt-5 rounded-xl border border-border bg-background p-5 md:p-6 space-y-6">
        {/* Price + discount */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1">
            Precio con este esquema
          </p>
          <p className="text-3xl md:text-4xl font-bold tabular-nums text-foreground">
            {formatMXN(selectedPlan.finalPrice)}
          </p>
          {selectedPlan.discountAmount > 0 ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              Ahorras {formatMXN(selectedPlan.discountAmount)} vs. precio lista
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Precio igual al de lista — sin descuento aplicado
            </p>
          )}
        </div>

        {/* Stacked bar */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
            Distribución del pago
          </p>
          <div className="flex w-full h-3 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${selectedPlan.downPaymentPct}%` }}
              title={`Enganche ${selectedPlan.downPaymentPct}%`}
            />
            {selectedPlan.installmentsPct > 0 && (
              <div
                className="h-full bg-primary/40"
                style={{ width: `${selectedPlan.installmentsPct}%` }}
                title={`Mensualidades ${selectedPlan.installmentsPct}%`}
              />
            )}
            <div
              className="h-full bg-foreground/70"
              style={{ width: `${selectedPlan.finalPaymentPct}%` }}
              title={`Entrega ${selectedPlan.finalPaymentPct}%`}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            <LegendItem color="bg-primary" label="Enganche" pct={selectedPlan.downPaymentPct} />
            {selectedPlan.installmentsPct > 0 && (
              <LegendItem color="bg-primary/40" label="Mensualidades" pct={selectedPlan.installmentsPct} />
            )}
            <LegendItem color="bg-foreground/70" label="A la entrega" pct={selectedPlan.finalPaymentPct} />
          </div>
        </div>

        {/* Numeric breakdown */}
        <div>
          <FlowRow
            icon={Wallet}
            label="Enganche hoy"
            sublabel={`${selectedPlan.downPaymentPct}% del precio`}
            amount={selectedPlan.downPaymentAmount}
          />
          {selectedPlan.installments && (
            <FlowRow
              icon={CalendarClock}
              label="Mensualidades"
              sublabel={installmentsSublabel}
              amount={selectedPlan.installments.monthlyAmount}
              amountSuffix="por mes"
            />
          )}
          <FlowRow
            icon={KeyRound}
            label="Pago a la entrega"
            sublabel={`${selectedPlan.finalPaymentPct}% al recibir las llaves`}
            amount={selectedPlan.finalPaymentAmount}
          />
          {selectedPlan.discountAmount > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">Tu ahorro total</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    vs. precio de lista ({formatMXN(listPrice)})
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                −{formatMXN(selectedPlan.discountAmount)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferPaymentPlansComparator;
