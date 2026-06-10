import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Check } from "lucide-react";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";

interface Props {
  formalReservation: FormalReservation;
  currentStep: 1 | 2 | 3;
  children: React.ReactNode;
  onBack?: () => void;
}

const STEPS = [
  { id: 1, label: "Tipo" },
  { id: 2, label: "Identidad" },
  { id: 3, label: "Apartado" },
];

const RefactorWizardShell = ({ currentStep, children, onBack }: Props) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const progressPct = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Volver</span>
          </button>

          {/* Stepper desktop */}
          <div className="hidden md:flex items-center gap-2 flex-1 justify-center">
            {STEPS.map((step, idx) => {
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : isActive
                          ? "bg-primary/10 text-primary ring-2 ring-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : step.id}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isActive ? "text-foreground" : isDone ? "text-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span className={`h-px w-6 ${isDone ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile compact */}
          <div className="md:hidden flex-1 text-center text-xs font-medium text-muted-foreground">
            Paso {currentStep} de {STEPS.length} · {STEPS[currentStep - 1].label}
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            Datos cifrados
          </div>
        </div>

        {/* Mobile progress bar */}
        <div className="md:hidden h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};

export default RefactorWizardShell;
