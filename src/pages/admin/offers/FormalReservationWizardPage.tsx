import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferStore, useOfferById } from "@/lib/offers/offer-data";
import WizardStepper from "@/components/admin/offers/formal-reservation/WizardStepper";
import Step1BuyerType from "@/components/admin/offers/formal-reservation/Step1BuyerType";
import Step2PersonalData from "@/components/admin/offers/formal-reservation/Step2PersonalData";
import Step3PlanSelection from "@/components/admin/offers/formal-reservation/Step3PlanSelection";
import Step4Documents from "@/components/admin/offers/formal-reservation/Step4Documents";
import Step5ContractPreview from "@/components/admin/offers/formal-reservation/Step5ContractPreview";
import Step6Signature from "@/components/admin/offers/formal-reservation/Step6Signature";

/**
 * @deprecated (18.9.D) Reemplazado por el flujo refactorizado 18.9.A-C
 * (Step1TipoComprador → Step2ValidacionRFC → Step3ClabeStp → Step4PagoSpei →
 * ClienteConversionPage → ExpedientePage).
 *
 * Ya no es accesible desde rutas activas: cualquier URL del wizard legacy
 * pasa por `LegacyWizardRedirect` y aterriza en el paso correspondiente del
 * flujo nuevo. El archivo se mantiene en disco para reversión durante demos.
 *
 * Eliminar (junto con `Step1..Step6` legacy y los campos `currentStep`,
 * `documents`, `personalData`, `contractSignature` del modelo) en la próxima
 * iteración mayor, cuando:
 *  - no queden FRs legacy en localStorage de usuarios activos
 *  - el equipo confirme 2 semanas en producción sin regresiones del flujo nuevo
 */
const FormalReservationWizardPage = () => {
  const params = useParams<{ preReservationId?: string; formalReservationId?: string }>();
  const navigate = useNavigate();

  const reservations = useFormalReservationStore((s) => s.reservations);
  const formalReservation =
    params.formalReservationId
      ? reservations.find((r) => r.id === params.formalReservationId)
      : params.preReservationId
      ? reservations.find((r) => r.preReservationId === params.preReservationId)
      : undefined;

  const preReservationIdFromFR = formalReservation?.preReservationId ?? null;

  const preReservation = useOfferStore((s) =>
    preReservationIdFromFR
      ? s.preReservations.find((pr) => pr.id === preReservationIdFromFR)
      : undefined
  );
  const prospect = useOfferStore((s) =>
    s.prospects.find((p) => p.id === formalReservation?.prospectId)
  );
  const offer = useOfferById(formalReservation?.offerId ?? "");

  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);

  useEffect(() => {
    if (!formalReservation) {
      if (params.preReservationId) {
        navigate(`/mi-pre-apartado/${params.preReservationId}`);
      } else {
        navigate("/");
      }
    }
  }, [formalReservation, navigate, params.preReservationId]);

  if (!formalReservation || !offer) return null;

  const currentStep = formalReservation.currentStep;
  const cameFromPreReservation = !!formalReservation.preReservationId;

  const handleBackToOrigin = () => {
    if (cameFromPreReservation && formalReservation.preReservationId) {
      navigate(`/mi-pre-apartado/${formalReservation.preReservationId}`);
    } else {
      navigate(`/oferta/${formalReservation.offerId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBackToOrigin}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {cameFromPreReservation ? "Volver al pre-apartado" : "Volver a la oferta"}
            </span>
          </button>

          <div className="flex-1 flex justify-center min-w-0 overflow-x-auto">
            <WizardStepper
              currentStep={currentStep}
              onStepClick={(step) => {
                if (step <= currentStep) {
                  setCurrentStep(formalReservation.id, step);
                }
              }}
            />
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            Datos cifrados
          </div>
        </div>
      </header>

      <main>
        {currentStep === 1 && <Step1BuyerType formalReservation={formalReservation} />}
        {currentStep === 2 && (
          <Step2PersonalData
            formalReservation={formalReservation}
            prefill={
              prospect
                ? { fullName: prospect.fullName, email: prospect.email, phone: prospect.phone }
                : undefined
            }
          />
        )}
        {currentStep === 3 && (
          <Step3PlanSelection
            formalReservation={formalReservation}
            preReservation={preReservation}
            offer={offer}
          />
        )}
        {currentStep === 4 && (
          <Step4Documents
            formalReservation={formalReservation}
            preReservation={preReservation}
          />
        )}
        {currentStep === 5 && (
          <Step5ContractPreview
            formalReservation={formalReservation}
            preReservation={preReservation}
          />
        )}
        {currentStep === 6 && (
          <Step6Signature
            formalReservation={formalReservation}
            preReservation={preReservation}
            offer={offer}
          />
        )}
      </main>
    </div>
  );
};

export default FormalReservationWizardPage;
