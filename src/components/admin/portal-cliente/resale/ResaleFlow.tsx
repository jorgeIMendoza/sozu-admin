import { useEffect } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import {
  calculateScenarios,
  resetResaleProcess,
  type ScenarioId,
} from "@/lib/portal-cliente/resale-data";
import { usePropertyDetailUrlState } from "@/hooks/usePropertyDetailUrlState";
import ResaleStepIntro from "./ResaleStepIntro";
import ResaleStepPricing from "./ResaleStepPricing";
import ResaleStepEarnings from "./ResaleStepEarnings";
import ResaleStepContract from "./ResaleStepContract";
import ResaleStepSignature from "./ResaleStepSignature";
import ResaleStepSuccess from "./ResaleStepSuccess";
import SupportLauncher from "@/components/admin/portal-cliente/support/SupportLauncher";
import type { SupportContext } from "@/lib/portal-cliente/advisor-data";

interface ResaleFlowProps {
  property: InvestmentProperty;
  onClose: () => void;
}

type Step =
  | "intro"
  | "pricing"
  | "earnings"
  | "contract"
  | "signature"
  | "success";

const STEP_ORDER: Step[] = [
  "intro",
  "pricing",
  "earnings",
  "contract",
  "signature",
  "success",
];

const ResaleFlow = ({ property, onClose }: ResaleFlowProps) => {
  const urlState = usePropertyDetailUrlState();
  const currentStep: Step = (urlState.step as Step) ?? "intro";
  const selectedScenarioId: ScenarioId =
    (urlState.scenario as ScenarioId) ?? "sugerido";

  const scenarios = calculateScenarios(property);
  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)!;

  // Initialize fresh entry: if no step in URL, reset and seed.
  useEffect(() => {
    if (!urlState.step) {
      resetResaleProcess(property.property.id);
      urlState.set(
        { flow: "resale", step: "intro", scenario: "sugerido" },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.property.id]);

  const setStep = (step: Step) => {
    urlState.set({ step });
  };

  const setSelectedScenario = (scenario: ScenarioId) => {
    urlState.set({ scenario }, { replace: true });
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };
  const goBack = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx === 0) onClose();
    else setStep(STEP_ORDER[idx - 1]);
  };

  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-3 h-14">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Atrás"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <p className="flex-1 text-center text-sm font-medium text-foreground truncate">
            Reventa · {property.property.projectName} {property.property.unitNumber}
          </p>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Progress dots */}
        {currentStep !== "success" && (
          <div className="flex justify-center gap-1.5 pb-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i <= stepIndex ? "w-6 bg-primary" : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pb-20">
        {currentStep === "intro" && (
          <ResaleStepIntro property={property} onNext={goNext} />
        )}
        {currentStep === "pricing" && (
          <ResaleStepPricing
            property={property}
            scenarios={scenarios}
            selectedScenarioId={selectedScenarioId}
            onSelectScenario={setSelectedScenario}
            onNext={goNext}
          />
        )}
        {currentStep === "earnings" && (
          <ResaleStepEarnings
            property={property}
            scenarios={scenarios}
            selectedScenarioId={selectedScenarioId}
            onSelectScenario={setSelectedScenario}
            onNext={goNext}
          />
        )}
        {currentStep === "contract" && (
          <ResaleStepContract
            property={property}
            scenario={selectedScenario}
            onNext={goNext}
          />
        )}
        {currentStep === "signature" && (
          <ResaleStepSignature
            property={property}
            scenario={selectedScenario}
            onComplete={goNext}
          />
        )}
        {currentStep === "success" && (
          <ResaleStepSuccess
            property={property}
            scenario={selectedScenario}
            onClose={onClose}
          />
        )}

        {currentStep !== "success" && (() => {
          const STEP_LABELS: Record<Step, string> = {
            intro: "Introducción",
            pricing: "Precio sugerido",
            earnings: "Utilidad esperada",
            contract: "Contrato",
            signature: "Firma electrónica",
            success: "Completado",
          };
          const supportContext: SupportContext = {
            propertyId: property.property.id,
            propertyName: property.property.projectName,
            unitNumber: property.property.unitNumber,
            flowName: "Reventa",
            flowStep: STEP_LABELS[currentStep],
            additionalNotes: `Escenario: ${selectedScenarioId}`,
            phaseOverride: "reventa",
          };
          return (
            <div className="px-4 mt-6">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                ¿Dudas en este paso?
              </p>
              <SupportLauncher context={supportContext} variant="compact" />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ResaleFlow;
