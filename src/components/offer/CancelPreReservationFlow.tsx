/**
 * @deprecated F.3.C - Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { useState } from "react";
import {
  X,
  AlertTriangle,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Calendar,
  Lock,
  Building2,
} from "lucide-react";
import { formatMXN, type CancellationReason } from "@/lib/offers/offer-data";
import { CANCELLATION_REASONS, COUNTER_OFFERS } from "@/lib/offers/cancellation-config";
import type { Agent } from "@/lib/offers/agent-data";
import { buildAgentWhatsAppLink } from "@/lib/offers/agent-data";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirmCancel: () => Promise<void>;
  onRecordFeedback: (input: {
    primaryReason: CancellationReason;
    subReason?: string;
    freeFormFeedback?: string;
    outcome: "cancelled" | "retained" | "contacted_agent";
  }) => void;
  amountMXN: number;
  cardLast4?: string;
  propertyLabel: string;
  daysRemaining: number;
  reservationId: string;
  offerId: string;
  agent?: Agent;
}

type FlowStep = "intro" | "reason" | "counter" | "confirm" | "processing" | "done";

const CancelPreReservationFlow = ({
  open,
  onClose,
  onConfirmCancel,
  onRecordFeedback,
  amountMXN,
  cardLast4,
  propertyLabel,
  daysRemaining,
  offerId,
  agent,
}: Props) => {
  const [step, setStep] = useState<FlowStep>("intro");
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [subReason, setSubReason] = useState("");
  const [freeFormFeedback, setFreeFormFeedback] = useState("");

  if (!open) return null;

  const reasonConfig = selectedReason
    ? CANCELLATION_REASONS.find((r) => r.id === selectedReason)
    : null;
  const counterOffer = selectedReason ? COUNTER_OFFERS[selectedReason] : null;

  const resetFlow = () => {
    setStep("intro");
    setSelectedReason(null);
    setSubReason("");
    setFreeFormFeedback("");
  };

  const handleClose = () => {
    if (selectedReason && step !== "done" && step !== "processing") {
      onRecordFeedback({
        primaryReason: selectedReason,
        subReason: subReason || undefined,
        freeFormFeedback: freeFormFeedback || undefined,
        outcome: "retained",
      });
    }
    resetFlow();
    onClose();
  };

  const handleContactAgent = () => {
    if (!selectedReason) return;
    onRecordFeedback({
      primaryReason: selectedReason,
      subReason: subReason || undefined,
      freeFormFeedback: freeFormFeedback || undefined,
      outcome: "contacted_agent",
    });
    if (agent) {
      const msg = `Hola ${agent.firstName}, estaba por cancelar mi pre-apartado de ${propertyLabel} pero antes quería comentar contigo. ¿Tienes un momento?`;
      window.open(buildAgentWhatsAppLink(agent, msg), "_blank", "noopener,noreferrer");
    }
    resetFlow();
    onClose();
  };

  const handleConfirmCancel = async () => {
    if (!selectedReason) return;
    setStep("processing");
    onRecordFeedback({
      primaryReason: selectedReason,
      subReason: subReason || undefined,
      freeFormFeedback: freeFormFeedback || undefined,
      outcome: "cancelled",
    });
    await new Promise((res) => setTimeout(res, 1200));
    await onConfirmCancel();
    setStep("done");
  };

  const showBackButton = step === "reason" || step === "counter" || step === "confirm";
  const stepIndex = ["intro", "reason", "counter", "confirm"].indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full md:max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border-subtle flex-shrink-0">
          {showBackButton && (
            <button
              onClick={() => {
                if (step === "reason") setStep("intro");
                else if (step === "counter") setStep("reason");
                else if (step === "confirm") setStep("counter");
              }}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              aria-label="Atrás"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <p className="flex-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            {step === "intro" && "Antes de cancelar..."}
            {step === "reason" && "Cuéntanos qué pasó"}
            {step === "counter" && "Una opción antes de cerrar"}
            {step === "confirm" && "Confirmar cancelación"}
            {step === "processing" && "Procesando..."}
            {step === "done" && "Pre-apartado cancelado"}
          </p>

          {step !== "processing" && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        {stepIndex >= 0 && (
          <div className="px-4 py-2 flex-shrink-0">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    stepIndex >= i ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Body scrollable */}
        <div className="overflow-y-auto flex-1">
          {step === "intro" && (
            <IntroStep
              propertyLabel={propertyLabel}
              daysRemaining={daysRemaining}
              amountMXN={amountMXN}
              agent={agent}
              onContinue={() => setStep("reason")}
              onContactAgent={() => {
                if (agent) {
                  const msg = `Hola ${agent.firstName}, estaba pensando en cancelar mi pre-apartado de ${propertyLabel}. ¿Podemos hablar antes de que tome esa decisión?`;
                  window.open(buildAgentWhatsAppLink(agent, msg), "_blank", "noopener,noreferrer");
                }
                onClose();
              }}
              onKeep={handleClose}
            />
          )}

          {step === "reason" && (
            <ReasonStep
              selectedReason={selectedReason}
              setSelectedReason={setSelectedReason}
              subReason={subReason}
              setSubReason={setSubReason}
              freeFormFeedback={freeFormFeedback}
              setFreeFormFeedback={setFreeFormFeedback}
              onContinue={() => setStep("counter")}
              onKeep={handleClose}
            />
          )}

          {step === "counter" && reasonConfig && counterOffer && selectedReason && (
            <CounterStep
              reasonConfig={reasonConfig}
              counterOffer={counterOffer}
              agent={agent}
              onTakeOffer={() => {
                if (counterOffer.ctaAction === "show_plans") {
                  onRecordFeedback({
                    primaryReason: selectedReason,
                    subReason: subReason || undefined,
                    freeFormFeedback: freeFormFeedback || undefined,
                    outcome: "retained",
                  });
                  window.location.href = `/oferta/${offerId}#comparador`;
                } else if (counterOffer.ctaAction === "talk_to_agent") {
                  handleContactAgent();
                } else {
                  onRecordFeedback({
                    primaryReason: selectedReason,
                    subReason: subReason || undefined,
                    freeFormFeedback: freeFormFeedback || undefined,
                    outcome: "retained",
                  });
                  resetFlow();
                  onClose();
                }
              }}
              onContinueCancel={() => setStep("confirm")}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              propertyLabel={propertyLabel}
              amountMXN={amountMXN}
              cardLast4={cardLast4}
              onConfirm={handleConfirmCancel}
              onKeep={handleClose}
            />
          )}

          {step === "processing" && (
            <div className="py-12 text-center px-5">
              <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-base font-semibold text-foreground mb-1">
                Procesando cancelación...
              </h3>
              <p className="text-sm text-muted-foreground">
                Liberando la retención de tu tarjeta
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="py-10 text-center px-5">
              <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-4">
                <Check className="w-7 h-7 text-success" strokeWidth={3} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Pre-apartado cancelado
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Tu reembolso de{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatMXN(amountMXN)}
                </span>{" "}
                está siendo procesado. Llegará a tu tarjeta entre 3 y 5 días hábiles.
              </p>
              <p className="text-xs text-muted-foreground italic mb-5">
                Gracias por compartirnos tu razón. Nos ayuda a mejorar.
              </p>
              <button
                onClick={() => {
                  resetFlow();
                  onClose();
                }}
                className="h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Step 1: Intro (loss aversion) ──

const IntroStep = ({
  propertyLabel,
  daysRemaining,
  amountMXN,
  agent,
  onContinue,
  onContactAgent,
  onKeep,
}: {
  propertyLabel: string;
  daysRemaining: number;
  amountMXN: number;
  agent?: Agent;
  onContinue: () => void;
  onContactAgent: () => void;
  onKeep: () => void;
}) => (
  <div className="p-5 space-y-5">
    <p className="text-sm text-foreground leading-relaxed">
      Estás por liberar tu pre-apartado de{" "}
      <span className="font-semibold">{propertyLabel}</span>.
    </p>

    <div className="space-y-3">
      <LossRow
        icon={Building2}
        label="La unidad quedará disponible para otros"
        sublabel="Si cambias de opinión después, podríamos no tenerla."
      />
      <LossRow
        icon={Calendar}
        label={`Aún tienes ${daysRemaining} día${daysRemaining === 1 ? "" : "s"} de vigencia`}
        sublabel="No tienes que decidir hoy. Puedes seguir explorando tus opciones."
      />
      <LossRow
        icon={Lock}
        label={`Tu retención de ${formatMXN(amountMXN)} seguirá disponible`}
        sublabel="Como enganche si avanzas con el apartado formal."
      />
    </div>

    {agent && (
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
        <div className="flex gap-3">
          <img
            src={agent.photoUrl}
            alt={agent.fullName}
            className="w-11 h-11 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              ¿Quieres hablar primero con {agent.firstName}?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-3">
              {agent.responseTimeAvg ?? "Responde rápido por WhatsApp"}. Una llamada de 10 minutos
              puede aclarar dudas.
            </p>
            <button
              onClick={onContactAgent}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Hablar con {agent.firstName}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col gap-2 pt-1">
      <button
        onClick={onKeep}
        className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Mantener mi pre-apartado
      </button>
      <button
        onClick={onContinue}
        className="w-full h-11 rounded-lg bg-transparent text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
      >
        Continuar con la cancelación
      </button>
    </div>
  </div>
);

const LossRow = ({
  icon: Icon,
  label,
  sublabel,
}: {
  icon: typeof Building2;
  label: string;
  sublabel: string;
}) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{sublabel}</p>
    </div>
  </div>
);

// ── Step 2: Reason ──

const ReasonStep = ({
  selectedReason,
  setSelectedReason,
  subReason,
  setSubReason,
  freeFormFeedback,
  setFreeFormFeedback,
  onContinue,
  onKeep,
}: {
  selectedReason: CancellationReason | null;
  setSelectedReason: (r: CancellationReason) => void;
  subReason: string;
  setSubReason: (v: string) => void;
  freeFormFeedback: string;
  setFreeFormFeedback: (v: string) => void;
  onContinue: () => void;
  onKeep: () => void;
}) => {
  const selectedConfig = selectedReason
    ? CANCELLATION_REASONS.find((r) => r.id === selectedReason)
    : null;

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          ¿Qué nos llevó a esta decisión?
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          Tu respuesta nos ayuda a mejorar. Sin presión - sigues pudiendo cancelar.
        </p>
      </div>

      <div className="space-y-2">
        {CANCELLATION_REASONS.map((reason) => {
          const Icon = reason.icon;
          const isSelected = selectedReason === reason.id;
          return (
            <button
              key={reason.id}
              onClick={() => {
                setSelectedReason(reason.id);
                setSubReason("");
              }}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                isSelected
                  ? "bg-primary/[0.06] border-primary/30"
                  : "bg-card border-border hover:border-foreground/20"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    isSelected ? "font-semibold text-foreground" : "font-medium text-foreground"
                  }`}
                >
                  {reason.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {reason.description}
                </p>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>

      {selectedConfig?.subReasonPrompt && selectedConfig.subReasonOptions && (
        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            {selectedConfig.subReasonPrompt}
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedConfig.subReasonOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setSubReason(opt)}
                className={`w-full flex items-center gap-2 px-3 h-9 rounded-md text-xs text-left transition-colors ${
                  subReason === opt
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-card border border-border text-foreground hover:border-foreground/30"
                }`}
              >
                {subReason === opt && <Check className="w-3 h-3" />}
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedReason && (
        <div>
          <label className="text-xs font-semibold text-foreground mb-1.5 block">
            ¿Algo más que nos quieras compartir? (opcional)
          </label>
          <textarea
            value={freeFormFeedback}
            onChange={(e) => setFreeFormFeedback(e.target.value.slice(0, 500))}
            placeholder="Cualquier detalle que ayude a entender mejor tu situación..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
            {freeFormFeedback.length}/500
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onContinue}
          disabled={!selectedReason}
          className={`w-full h-11 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            selectedReason
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onKeep}
          className="w-full h-11 rounded-lg bg-transparent text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
        >
          Mantener mi pre-apartado
        </button>
      </div>
    </div>
  );
};

// ── Step 3: Counter-offer ──

const CounterStep = ({
  reasonConfig,
  counterOffer,
  agent,
  onTakeOffer,
  onContinueCancel,
}: {
  reasonConfig: {
    id: CancellationReason;
    label: string;
    icon: typeof Building2;
  };
  counterOffer: {
    empathyMsg: string;
    insight: string;
    ctaLabel: string;
    ctaAction: "show_plans" | "talk_to_agent" | "respect_decision";
    ctaSubtext?: string;
  };
  agent?: Agent;
  onTakeOffer: () => void;
  onContinueCancel: () => void;
}) => {
  const Icon = reasonConfig.icon;
  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          {reasonConfig.label}
        </p>
      </div>

      <h3 className="font-bold text-lg text-foreground mb-3 leading-snug">
        {counterOffer.empathyMsg}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {counterOffer.insight}
      </p>

      {counterOffer.ctaAction === "talk_to_agent" && agent && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border-subtle mb-5">
          <img
            src={agent.photoUrl}
            alt={agent.fullName}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Tu agente</p>
            <p className="text-sm font-semibold text-foreground line-clamp-1">{agent.fullName}</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{agent.title}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={onTakeOffer}
          className="w-full min-h-12 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex flex-col items-center justify-center"
        >
          <span>{counterOffer.ctaLabel}</span>
          {counterOffer.ctaSubtext && (
            <span className="text-[10px] font-normal opacity-80 mt-0.5">
              {counterOffer.ctaSubtext}
            </span>
          )}
        </button>
        <button
          onClick={onContinueCancel}
          className="w-full h-11 rounded-lg bg-transparent text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
        >
          Continuar con la cancelación
        </button>
      </div>
    </div>
  );
};

// ── Step 4: Confirm ──

const ConfirmStep = ({
  propertyLabel,
  amountMXN,
  cardLast4,
  onConfirm,
  onKeep,
}: {
  propertyLabel: string;
  amountMXN: number;
  cardLast4?: string;
  onConfirm: () => void;
  onKeep: () => void;
}) => (
  <div className="p-5">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-foreground">
          Confirmamos la cancelación de tu pre-apartado de{" "}
          <span className="font-semibold">{propertyLabel}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Esto liberará la unidad y procesaremos el reembolso de{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatMXN(amountMXN)}
          </span>{" "}
          a tu tarjeta termina en {cardLast4 ?? "****"}.
        </p>
      </div>
    </div>

    <div className="rounded-lg bg-muted/40 p-3 mb-5">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        El reembolso aparecerá en tu estado de cuenta entre{" "}
        <span className="font-semibold text-foreground">3 y 5 días hábiles</span>, dependiendo de
        tu banco. No habrá ningún cargo.
      </p>
    </div>

    <div className="flex flex-col gap-2">
      <button
        onClick={onConfirm}
        className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
      >
        Confirmar cancelación
      </button>
      <button
        onClick={onKeep}
        className="w-full h-11 rounded-lg bg-transparent text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
      >
        Mantener mi pre-apartado
      </button>
    </div>
  </div>
);

export default CancelPreReservationFlow;
