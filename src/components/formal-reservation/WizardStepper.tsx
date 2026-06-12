import { Check } from "lucide-react";

interface Props {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  onStepClick?: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
}

const STEPS = [
  { id: 1, label: "Tipo" },
  { id: 2, label: "Datos" },
  { id: 3, label: "Plan" },
  { id: 4, label: "Docs" },
  { id: 5, label: "Contrato" },
  { id: 6, label: "Firma" },
] as const;

const WizardStepper = ({ currentStep, onStepClick }: Props) => {
  return (
    <div className="flex items-center gap-1 md:gap-2">
      {STEPS.map((step, idx) => {
        const reached = step.id < currentStep;
        const current = step.id === currentStep;
        const clickable = step.id <= currentStep;

        return (
          <div key={step.id} className="flex items-center gap-1 md:gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(step.id as 1 | 2 | 3 | 4 | 5 | 6)}
              className={`flex items-center gap-1.5 transition-colors ${
                clickable ? "cursor-pointer" : "cursor-not-allowed"
              }`}
              aria-label={`Paso ${step.id}: ${step.label}`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                  reached
                    ? "bg-primary text-primary-foreground"
                    : current
                    ? "bg-primary/10 text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {reached ? <Check className="w-3.5 h-3.5" /> : step.id}
              </span>
              <span
                className={`hidden md:inline text-xs font-medium ${
                  current ? "text-foreground" : reached ? "text-foreground/80" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <span
                className={`h-px w-4 md:w-6 ${
                  reached ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WizardStepper;
