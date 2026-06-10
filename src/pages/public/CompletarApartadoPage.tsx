import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import Step1TipoComprador from "@/components/formal-reservation-v2/Step1TipoComprador";
import Step2ValidacionRFC from "@/components/formal-reservation-v2/Step2ValidacionRFC";
import Step3PagoSPEI from "@/components/completar-apartado/Step3PagoSPEI";

/**
 * (18.10.B) Wizard de completar apartado — 3 pasos post-hold:
 *   1. Tipo de comprador
 *   2. Validación RFC (CSF)
 *   3. Pago SPEI definitivo ($20,000 MXN)
 *
 * Reemplaza al flujo monolítico de `PagoApartadoFinalPage` (@deprecated 18.10.B).
 */

type StepIndex = 0 | 1 | 2;

const STEP_LABELS = ["Tipo", "Identidad fiscal", "Pago"] as const;

const CompletarApartadoPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    formalReservationId ? s.reservations.find((r) => r.id === formalReservationId) ?? null : null
  );
  const enterCompletionWizard = useFormalReservationStore(
    (s) => s.enterCompletionWizard
  );

  // Marcar status `completando_apartado` al entrar (idempotente).
  useEffect(() => {
    if (formalReservation && formalReservation.status === "apartado_provisional") {
      enterCompletionWizard(formalReservation.id);
    }
  }, [formalReservation, enterCompletionWizard]);

  // Paso inicial: si ya tiene buyerType/fiscalIdentity, avanzar.
  const initialStep: StepIndex = useMemo(() => {
    if (!formalReservation) return 0;
    if (formalReservation.fiscalIdentity) return 2;
    if (formalReservation.buyerType) return 1;
    return 0;
  }, [formalReservation]);

  const [step, setStep] = useState<StepIndex>(initialStep);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  if (!formalReservation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Apartado no encontrado.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 text-xs font-semibold text-primary hover:underline"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              navigate(`/apartado-provisional/${formalReservation.id}`)
            }
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al apartado
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Datos cifrados
          </div>
        </div>

        {/* Stepper de 3 burbujas */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-center justify-between gap-2">
            {STEP_LABELS.map((label, idx) => {
              const isActive = idx === step;
              const isDone = idx < step;
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors flex-shrink-0 ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap ${
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < STEP_LABELS.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        isDone ? "bg-primary/30" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Contenido del paso */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {step === 0 && (
          <Step1TipoComprador
            formalReservation={formalReservation}
            onComplete={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Step2ValidacionRFC
            formalReservation={formalReservation}
            onComplete={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <Step3PagoSPEI
            formalReservation={formalReservation}
            onBack={() => setStep(1)}
          />
        )}
      </main>
    </div>
  );
};

export default CompletarApartadoPage;
