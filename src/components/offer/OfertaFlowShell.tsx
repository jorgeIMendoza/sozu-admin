import { ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import sozuLogo from "@/assets/sozu-logo.png";

interface Step {
  label: string;
}

const STEPS: Step[] = [
  { label: "Tus datos" },
  { label: "Tipo de comprador" },
  { label: "Retención" },
];

interface Props {
  children: React.ReactNode;
  currentStep?: 1 | 2 | 3; // undefined = pre-wizard (captura de datos)
  onBack?: () => void;
  title?: string;
}

export default function OfertaFlowShell({ children, currentStep, onBack, title }: Props) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <img src={sozuLogo} alt="SOZU" className="h-6 w-auto dark:invert" />

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">Datos cifrados</span>
          </div>
        </div>

        {/* Desktop stepper */}
        {currentStep && (
          <div className="hidden md:block border-t border-border">
            <div className="max-w-lg mx-auto px-4 py-3">
              <div className="flex items-center justify-between relative">
                {/* Progress line background */}
                <div className="absolute top-4 left-[10%] right-[10%] h-[2px] bg-muted" />
                {/* Progress line fill */}
                <div
                  className="absolute top-4 left-[10%] h-[2px] bg-primary transition-all duration-500"
                  style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 80}%` }}
                />

                {STEPS.map((step, idx) => {
                  const num = idx + 1;
                  const done = num < currentStep;
                  const active = num === currentStep;
                  return (
                    <div key={step.label} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : active
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? "✓" : num}
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          active ? "text-primary" : done ? "text-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mobile step indicator */}
        {currentStep && (
          <div className="md:hidden border-t border-border px-4 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Paso <span className="font-semibold text-foreground">{currentStep}</span> de {STEPS.length}
              </span>
              <span className="text-muted-foreground">{STEPS[currentStep - 1].label}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col">
        <div className="w-full max-w-lg mx-auto px-4 py-6 flex-1 flex flex-col">
          {title && (
            <h1 className="text-[22px] font-display font-bold text-foreground tracking-tight mb-5">
              {title}
            </h1>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
