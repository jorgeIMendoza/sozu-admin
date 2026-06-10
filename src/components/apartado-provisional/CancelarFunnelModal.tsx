import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  ShieldCheck,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { calculateCountdown } from "@/lib/offers/hold-countdown";
import { getOfferById } from "@/lib/offers/offer-data";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import {
  CANCELLATION_REASONS,
  EMPATHETIC_MESSAGES,
  type CancellationReasonId,
} from "@/lib/offers/cancellation-funnel-data";

/**
 * 18.11.D: Avatar del asesor con fallback al ícono genérico.
 */
const AgentAvatar = ({
  agent,
  size = "md",
}: {
  agent: Agent | undefined;
  size?: "md" | "lg";
}) => {
  const dim = size === "lg" ? "w-10 h-10" : "w-10 h-10";
  if (agent?.photoUrl) {
    return (
      <img
        src={agent.photoUrl}
        alt={agent.fullName}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-muted flex items-center justify-center flex-shrink-0`}
    >
      <MessageCircle className="w-5 h-5 text-foreground/70" />
    </div>
  );
};

/**
 * (18.10.C) Funnel completo de cancelación tipo Netflix — 4 pasos:
 *   1. Reconsiderar (recordar lo que se pierde)
 *   2. Seleccionar razón (7 razones + "Otra")
 *   3. Mensaje empático contextual con CTA WhatsApp
 *   4. Confirmación final con detalle de desbloqueo del hold
 */

type FunnelStep = 1 | 2 | 3 | 4;

const AGENT_WHATSAPP = "523310137670"; // SWAP POINT: formalReservation.assignedAgent?.whatsapp

interface CancelarFunnelModalProps {
  formalReservation: FormalReservation;
  open: boolean;
  onClose: () => void;
}

const CancelarFunnelModal = ({ formalReservation, open, onClose }: CancelarFunnelModalProps) => {
  const navigate = useNavigate();
  const cancelHoldVoluntary = useFormalReservationStore((s) => s.cancelHoldVoluntary);

  const [currentStep, setCurrentStep] = useState<FunnelStep>(1);
  const [selectedReasonId, setSelectedReasonId] = useState<CancellationReasonId | null>(null);

  // Reset state al cerrar (con delay para que termine la animación)
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setCurrentStep(1);
        setSelectedReasonId(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Defensividad: si el hold expira mid-flow, cerrar el funnel
  useEffect(() => {
    if (!open) return;
    if (!formalReservation.hold || formalReservation.hold.status !== "active") {
      onClose();
    }
  }, [open, formalReservation.hold, onClose]);

  if (!open) return null;

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep((currentStep + 1) as FunnelStep);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as FunnelStep);
  };

  const handleConfirmCancel = () => {
    if (!selectedReasonId) return;
    const reasonLabel =
      CANCELLATION_REASONS.find((r) => r.id === selectedReasonId)?.label ?? selectedReasonId;
    cancelHoldVoluntary(formalReservation.id, reasonLabel);
    onClose();
    navigate(`/apartado-provisional/${formalReservation.id}/liberado`, { replace: true });
  };

  const handleKeepApartado = () => onClose();

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con navegación + barra de progreso */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={currentStep === 1 ? handleKeepApartado : handleBack}
              className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label={currentStep === 1 ? "Cerrar" : "Volver"}
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              {currentStep === 1 && "Antes de cancelar..."}
              {currentStep === 2 && "Cuéntanos qué pasó"}
              {currentStep === 3 && "Una opción antes de cerrar"}
              {currentStep === 4 && "Confirmar cancelación"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 pb-3 flex gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-5">
          {currentStep === 1 && (
            <FunnelStep1Reconsider
              formalReservation={formalReservation}
              onContinue={handleNext}
              onKeep={handleKeepApartado}
            />
          )}
          {currentStep === 2 && (
            <FunnelStep2SelectReason
              selectedReasonId={selectedReasonId}
              onSelectReason={setSelectedReasonId}
              onContinue={handleNext}
              onKeep={handleKeepApartado}
            />
          )}
          {currentStep === 3 && selectedReasonId && (
            <FunnelStep3Empathetic
              reasonId={selectedReasonId}
              formalReservation={formalReservation}
              onContinue={handleNext}
            />
          )}
          {currentStep === 4 && (
            <FunnelStep4Confirm
              formalReservation={formalReservation}
              onConfirm={handleConfirmCancel}
              onKeep={handleKeepApartado}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CancelarFunnelModal;

// ─────────────────────────────────────────────────────────
// Helpers de labels
// ─────────────────────────────────────────────────────────
const getPropertyLabels = (formalReservation: FormalReservation) => {
  const offer = getOfferById(formalReservation.offerId);
  const developmentName = offer?.property?.projectName ?? "tu desarrollo";
  const propertyLabel = offer
    ? `${offer.property.unitModel ?? ""} ${offer.property.unitNumber ?? ""}`.trim() ||
      "tu unidad"
    : "tu unidad";
  return { developmentName, propertyLabel };
};

// ─────────────────────────────────────────────────────────
// Paso 1 — Reconsiderar
// ─────────────────────────────────────────────────────────

interface FunnelStep1Props {
  formalReservation: FormalReservation;
  onContinue: () => void;
  onKeep: () => void;
}

const FunnelStep1Reconsider = ({ formalReservation, onContinue, onKeep }: FunnelStep1Props) => {
  const countdown = formalReservation.hold
    ? calculateCountdown(formalReservation.hold.expiresAt)
    : null;
  const { developmentName, propertyLabel } = getPropertyLabels(formalReservation);
  const agent = useAgentById(formalReservation.agentId);
  const agentFirstName = agent?.firstName ?? "tu asesor";
  const agentWhatsApp = agent?.whatsapp ?? AGENT_WHATSAPP;

  return (
    <div>
      <p className="text-sm text-foreground mb-5 leading-relaxed">
        Estás por liberar tu apartado provisional de{" "}
        <strong>
          {developmentName} · {propertyLabel}
        </strong>
        .
      </p>

      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-foreground/70" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">
              La unidad quedará disponible para otros
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Si cambias de opinión después, podríamos no tenerla.
            </p>
          </div>
        </div>

        {countdown && !countdown.isExpired && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">
                Aún tienes {countdown.days} {countdown.days === 1 ? "día" : "días"} y{" "}
                {countdown.hours} {countdown.hours === 1 ? "hora" : "horas"} de vigencia
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                No tienes que decidir hoy. Puedes seguir explorando tus opciones.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-foreground/70" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">
              Tu retención de $10,000 se desbloqueará
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              El crédito vuelve a estar disponible en tu tarjeta. No habrá cargo.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4 mb-6">
        <div className="flex items-start gap-3">
          <AgentAvatar agent={agent} />
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">
              ¿Quieres hablar primero con {agentFirstName}?
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
              Responde en menos de 30 min. Una llamada de 10 minutos puede aclarar dudas.
            </p>
            <a
              href={`https://wa.me/${agentWhatsApp}?text=${encodeURIComponent(
                `Hola ${agentFirstName}, estoy considerando cancelar mi apartado ${formalReservation.id} y me gustaría platicar antes.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              Hablar con {agentFirstName}
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onKeep}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm mb-3"
      >
        Mantener mi apartado
      </button>

      <button
        type="button"
        onClick={onContinue}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline py-2"
      >
        Continuar con la cancelación
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Paso 2 — Selección de razón
// ─────────────────────────────────────────────────────────

interface FunnelStep2Props {
  selectedReasonId: CancellationReasonId | null;
  onSelectReason: (id: CancellationReasonId) => void;
  onContinue: () => void;
  onKeep: () => void;
}

const FunnelStep2SelectReason = ({
  selectedReasonId,
  onSelectReason,
  onContinue,
  onKeep,
}: FunnelStep2Props) => {
  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-2">
        ¿Qué nos llevó a esta decisión?
      </h3>
      <p className="text-[11px] text-muted-foreground mb-5 leading-relaxed">
        Tu respuesta nos ayuda a mejorar. Sin presión — sigues pudiendo cancelar.
      </p>

      <div className="space-y-2 mb-5">
        {CANCELLATION_REASONS.map((reason) => {
          const Icon = reason.icon;
          const isSelected = selectedReasonId === reason.id;
          return (
            <button
              key={reason.id}
              type="button"
              onClick={() => onSelectReason(reason.id)}
              className={`w-full px-3 py-3 rounded-xl border-2 text-left flex items-start gap-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/[0.04]"
                  : "border-border hover:border-foreground/30 bg-card"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-primary/10" : "bg-muted/50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isSelected ? "text-primary" : "text-foreground/70"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{reason.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{reason.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!selectedReasonId}
        className="w-full h-12 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
      >
        Continuar
        <ArrowRight className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onKeep}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline py-2"
      >
        Mantener mi apartado
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Paso 3 — Mensaje empático contextual
// ─────────────────────────────────────────────────────────

interface FunnelStep3Props {
  reasonId: CancellationReasonId;
  formalReservation: FormalReservation;
  onContinue: () => void;
}

const FunnelStep3Empathetic = ({ reasonId, formalReservation, onContinue }: FunnelStep3Props) => {
  const message = EMPATHETIC_MESSAGES[reasonId];
  const ReasonIcon =
    CANCELLATION_REASONS.find((r) => r.id === reasonId)?.icon ?? MessageCircle;
  const agent = useAgentById(formalReservation.agentId);
  const agentWhatsApp = agent?.whatsapp ?? AGENT_WHATSAPP;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ReasonIcon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">
          {message.contextLabel}
        </p>
      </div>

      <h3 className="text-base font-bold text-foreground mb-3 leading-snug">
        {message.title}
      </h3>

      <p className="text-xs text-muted-foreground mb-6 leading-relaxed">{message.body}</p>

      <div className="rounded-xl bg-card border border-border p-4 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <AgentAvatar agent={agent} />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Tu agente
            </p>
            <p className="text-xs font-bold text-foreground">{agent?.fullName ?? "Tu asesor"}</p>
            <p className="text-[10px] text-muted-foreground">{agent?.title ?? "Asesor Inmobiliario"}</p>
          </div>
        </div>

        <a
          href={`https://wa.me/${agentWhatsApp}?text=${encodeURIComponent(
            message.whatsappMessage
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex flex-col items-center justify-center gap-0.5"
        >
          <span className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            {message.ctaLabel}
          </span>
          <span className="text-[9px] font-normal opacity-80">Sin compromiso.</span>
        </a>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline py-2"
      >
        Continuar con la cancelación
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Paso 4 — Confirmación final
// ─────────────────────────────────────────────────────────

interface FunnelStep4Props {
  formalReservation: FormalReservation;
  onConfirm: () => void;
  onKeep: () => void;
}

const FunnelStep4Confirm = ({ formalReservation, onConfirm, onKeep }: FunnelStep4Props) => {
  const { developmentName, propertyLabel } = getPropertyLabels(formalReservation);
  const cardLast4 = formalReservation.hold?.cardLast4 ?? "****";

  return (
    <div>
      <div className="rounded-xl bg-warning/[0.06] border border-warning/30 p-4 mb-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-foreground leading-snug">
            Confirmamos la cancelación de tu apartado provisional de{" "}
            <strong>
              {developmentName} · {propertyLabel}
            </strong>
            .
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">Se liberará la unidad</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Volverá a estar disponible para otros clientes inmediatamente.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">
              Desbloquearemos la retención de $10,000 en tu tarjeta ****{cardLast4}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              El crédito quedará disponible nuevamente{" "}
              <strong>dentro de las próximas 24 a 72 horas</strong>, dependiendo de los tiempos
              de tu banco. <strong>No habrá ningún cargo</strong> — ese dinero nunca se
              transfirió, solo estaba reservado.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full h-12 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 mb-3"
      >
        Confirmar cancelación
      </button>

      <button
        type="button"
        onClick={onKeep}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline py-2"
      >
        Mejor mantener mi apartado
      </button>
    </div>
  );
};
