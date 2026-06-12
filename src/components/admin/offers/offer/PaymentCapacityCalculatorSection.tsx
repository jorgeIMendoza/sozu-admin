/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Calculator, Check, AlertCircle, TrendingUp, Wallet, ArrowDown } from "lucide-react";
import type { PaymentPlan } from "@/lib/offers/offer-data";

interface PaymentCapacityCalculatorSectionProps {
  plans: PaymentPlan[];
  onPlanRecommended?: (planId: string | null) => void;
}

const formatMxn = (amount: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);

const parseInputToNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
};

const formatInputValue = (value: number): string => {
  if (value === 0) return "";
  return new Intl.NumberFormat("es-MX").format(value);
};

type Evaluated = {
  plan: PaymentPlan;
  monthlyAmount: number;
  savingsCoversDownPayment: boolean;
  savingsShortfall: number;
  monthlyAffordable: boolean;
  monthlyPctOfIncome: number;
  isViable: boolean;
};

const PaymentCapacityCalculatorSection = ({
  plans,
  onPlanRecommended,
}: PaymentCapacityCalculatorSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [availableSavings, setAvailableSavings] = useState(0);
  const [monthlyDebts, setMonthlyDebts] = useState(0);

  const hasFilledInputs = monthlyIncome > 0 && availableSavings >= 0;
  const disposableIncome = monthlyIncome - monthlyDebts;

  const analysis = useMemo(() => {
    if (!hasFilledInputs) return null;
    const maxAffordableMonthly = disposableIncome * 0.3;

    const evaluated: Evaluated[] = plans.map((plan) => {
      const monthlyAmount = plan.installments?.monthlyAmount ?? 0;
      const savingsCoversDownPayment = availableSavings >= plan.downPaymentAmount;
      const savingsShortfall = savingsCoversDownPayment ? 0 : plan.downPaymentAmount - availableSavings;
      const monthlyAffordable = monthlyAmount === 0 ? true : monthlyAmount <= maxAffordableMonthly;
      const monthlyPctOfIncome =
        disposableIncome > 0 ? (monthlyAmount / disposableIncome) * 100 : 0;
      return {
        plan,
        monthlyAmount,
        savingsCoversDownPayment,
        savingsShortfall,
        monthlyAffordable,
        monthlyPctOfIncome,
        isViable: savingsCoversDownPayment && monthlyAffordable,
      };
    });

    const recommended = evaluated.find((e) => e.isViable) ?? evaluated[0];
    return { evaluated, recommended, maxAffordableMonthly };
  }, [hasFilledInputs, plans, availableSavings, disposableIncome]);

  const recommendedId = analysis?.recommended?.plan.id ?? null;
  useEffect(() => {
    onPlanRecommended?.(recommendedId);
  }, [recommendedId, onPlanRecommended]);

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">¿Te alcanza? Hagamos la cuenta rápida</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tres datos · 30 segundos · sin compartir información personal.
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
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CurrencyInput
                label="Ingreso mensual familiar *"
                value={monthlyIncome}
                onChange={setMonthlyIncome}
                placeholder="80,000"
                hint="Suma de quienes contribuyan al pago."
              />
              <CurrencyInput
                label="Ahorro para enganche *"
                value={availableSavings}
                onChange={setAvailableSavings}
                placeholder="1,500,000"
                hint="Líquido disponible hoy."
              />
              <CurrencyInput
                label="Deudas mensuales fijas"
                value={monthlyDebts}
                onChange={setMonthlyDebts}
                placeholder="15,000"
                hint="Otros créditos activos. Opcional."
              />
            </div>

            {hasFilledInputs && analysis && (
              <CalculadoraResultado analysis={analysis} />
            )}

            {!hasFilledInputs && (
              <div className="rounded-xl bg-muted/20 border border-border-subtle p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Llena al menos ingreso y ahorro para ver tu análisis.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-muted/10 p-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Pre-evaluación basada en la regla del 30% (la mensualidad no debe exceder el 30% del ingreso disponible). No es una pre-aprobación crediticia formal. Tu asesor puede revisar tu caso particular con factores adicionales como historial crediticio, antigüedad laboral y composición familiar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const CurrencyInput = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
  hint: string;
}) => (
  <div>
    <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
        $
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={formatInputValue(value)}
        onChange={(e) => onChange(parseInputToNumber(e.target.value))}
        placeholder={placeholder}
        className="w-full h-11 pl-7 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors tabular-nums"
      />
    </div>
    <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
  </div>
);

const CalculadoraResultado = ({
  analysis,
}: {
  analysis: { evaluated: Evaluated[]; recommended: Evaluated; maxAffordableMonthly: number };
}) => {
  const { recommended, evaluated } = analysis;
  const viableCount = evaluated.filter((e) => e.isViable).length;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl p-4 ${
          viableCount > 0
            ? "bg-primary/[0.06] border border-primary/30"
            : "bg-warning/[0.06] border border-warning/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              viableCount > 0 ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"
            }`}
          >
            {viableCount > 0 ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground mb-1">
              {viableCount > 0
                ? `${viableCount} de ${evaluated.length} esquemas se ajustan a tu capacidad`
                : "Ninguno de los esquemas se ajusta completamente todavía"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {viableCount > 0
                ? `Te recomendamos el esquema ${recommended.plan.name} para empezar — es el que requiere menor capital inicial dentro de lo que puedes pagar.`
                : "Habla con Ramón para explorar opciones: aumentar tu enganche te da más esquemas disponibles, y la mensualidad puede ajustarse si extendemos el plazo."}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card border-2 border-primary/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border-subtle bg-primary/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Esquema recomendado
            </span>
            <span className="text-sm font-bold text-foreground">{recommended.plan.name}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {formatMxn(recommended.plan.finalPrice)}
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Enganche
              </p>
            </div>
            <p className="text-base font-bold text-foreground tabular-nums mb-1">
              {formatMxn(recommended.plan.downPaymentAmount)}
            </p>
            {recommended.savingsCoversDownPayment ? (
              <p className="text-[10px] text-primary font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                Tu ahorro alcanza
              </p>
            ) : (
              <p className="text-[10px] text-warning font-semibold flex items-center gap-1">
                <ArrowDown className="w-3 h-3" />
                Te faltan {formatMxn(recommended.savingsShortfall)}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Mensualidad
              </p>
            </div>
            <p className="text-base font-bold text-foreground tabular-nums mb-1">
              {recommended.monthlyAmount > 0 ? formatMxn(recommended.monthlyAmount) : "—"}
            </p>
            {recommended.monthlyAmount > 0 ? (
              <p
                className={`text-[10px] font-semibold ${
                  recommended.monthlyAffordable ? "text-primary" : "text-warning"
                }`}
              >
                {recommended.monthlyPctOfIncome.toFixed(1)}% de tu ingreso disponible
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">Sin mensualidades</p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                A la entrega
              </p>
            </div>
            <p className="text-base font-bold text-foreground tabular-nums mb-1">
              {formatMxn(recommended.plan.finalPaymentAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground">Al recibir las llaves</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCapacityCalculatorSection;
