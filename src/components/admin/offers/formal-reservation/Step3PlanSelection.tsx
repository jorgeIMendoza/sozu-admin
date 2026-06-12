import { useState } from "react";
import {
  useFormalReservationStore,
  type FormalReservation,
} from "@/lib/offers/formal-reservation-data";
import type { OfertaComercial, PreReservation } from "@/lib/offers/offer-data";
import { ArrowRight, ArrowLeft, Check, AlertCircle, Sparkles } from "lucide-react";

interface Props {
  formalReservation: FormalReservation;
  preReservation?: PreReservation;
  offer: OfertaComercial;
}

const fmt = (n: number) =>
  `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

const Step3PlanSelection = ({ formalReservation, preReservation, offer }: Props) => {
  const setSelectedPlan = useFormalReservationStore((s) => s.setSelectedPlan);
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);

  const plans = offer.paymentPlans;
  const interestedPlanId = preReservation?.interestedPlanId;
  const initialSelection = formalReservation.selectedPlanId ?? interestedPlanId ?? null;

  const [selected, setSelected] = useState<string | null>(initialSelection);
  const [confirmed, setConfirmed] = useState(false);

  const handleSelect = (planId: string) => {
    setSelected(planId);
    if (planId !== interestedPlanId) setConfirmed(false);
  };

  const isPlanDifferent =
    selected !== null && interestedPlanId !== undefined && selected !== interestedPlanId;
  const requiresConfirmation = isPlanDifferent;
  const canContinue = selected !== null && (!requiresConfirmation || confirmed);

  const selectedPlan = plans.find((p) => p.id === selected);

  const handleContinue = () => {
    if (!selected || !canContinue || !selectedPlan) return;
    const remaining = Math.max(0, selectedPlan.downPaymentAmount - formalReservation.appliedAmountMXN);
    setSelectedPlan(formalReservation.id, selected, remaining);
    setCurrentStep(formalReservation.id, 4);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 3 de 6 · Plan de financiamiento
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          Confirma tu plan de pago
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Este es el plan que quedará registrado en el contrato preliminar.
          A mayor enganche, mayor descuento.
        </p>
      </div>

      {interestedPlanId && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Tu interés inicial fue {interestedPlanId}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const wasInterested = plan.id === interestedPlanId;
          const discountAmount = plan.discountAmount ?? 0;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelect(plan.id)}
              className={`text-left rounded-2xl p-5 transition-all relative ${
                isSelected
                  ? "bg-primary/[0.04] border-2 border-primary"
                  : "bg-card border-2 border-border hover:border-foreground/30"
              }`}
            >
              {wasInterested && !isSelected && (
                <div className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                  Tu interés
                </div>
              )}
              {isSelected && (
                <div className="absolute -top-2 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="font-display text-2xl font-bold text-foreground">{plan.name}</h3>
                {plan.discountPct > 0 && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">
                    -{plan.discountPct}%
                  </span>
                )}
              </div>

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Precio final
              </p>
              <p className="font-display text-xl font-semibold text-foreground tabular-nums">
                {fmt(plan.finalPrice)}
              </p>

              {discountAmount > 0 && (
                <p className="text-[11px] text-success font-medium mt-0.5 tabular-nums">
                  Ahorro de {fmt(discountAmount)}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Enganche · {plan.downPaymentPct}%
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(plan.downPaymentAmount)}
                  </span>
                </div>
                {plan.installments && plan.installments.count > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {plan.installments.count} mensualidades
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {fmt(plan.installments.monthlyAmount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Entrega · {plan.finalPaymentPct}%
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(plan.finalPaymentAmount)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {requiresConfirmation && (
        <div className="rounded-xl bg-warning/5 border border-warning/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2.5">
              <p className="text-sm font-semibold text-foreground">
                Estás cambiando de plan
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tu interés inicial era el plan <strong>{interestedPlanId}</strong>. Cambiar al
                plan <strong>{selected}</strong> significa modificar las condiciones financieras
                de tu compra. Una vez firmado el contrato preliminar, cambios adicionales
                requieren renegociación con tu agente.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  Entiendo y confirmo que quiero proceder con el plan <strong>{selected}</strong>.
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {selectedPlan && formalReservation.appliedAmountMXN > 0 && (
        <div className="rounded-xl bg-success/5 border border-success/20 p-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Tus {fmt(formalReservation.appliedAmountMXN)} del pre-apartado se aplicarán como
                anticipo del enganche
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Solo te restará pagar{" "}
                <strong className="text-foreground tabular-nums">
                  {fmt(Math.max(0, selectedPlan.downPaymentAmount - formalReservation.appliedAmountMXN))}
                </strong>{" "}
                para completar el enganche.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(formalReservation.id, 2)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={handleContinue}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step3PlanSelection;
