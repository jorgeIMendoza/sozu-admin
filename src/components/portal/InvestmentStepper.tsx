import { Check } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface InvestmentStepperProps {
  stages: StageInfo[];
  onStageTap: (stage: StageInfo) => void;
}

const InvestmentStepper = ({ stages, onStageTap }: InvestmentStepperProps) => {
  return (
    <section className="px-5 py-4">
      <h3 className="font-display font-semibold text-sm text-foreground mb-3">
        Proceso de inversión
      </h3>

      <div className="flex items-center gap-0">
        {stages.map((stage, index) => {
          const isCompleted = stage.status === "completed";
          const isActive = stage.status === "active";
          const isLast = index === stages.length - 1;

          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => onStageTap(stage)}
                className="flex flex-col items-center gap-1.5 group flex-shrink-0"
              >
                {/* Circle */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary/15 text-primary ring-2 ring-primary/20"
                      : "bg-muted text-muted-foreground/50"
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
                </div>

                {/* Label */}
                <span
                  className={`text-[9px] font-medium text-center leading-tight max-w-[52px] ${
                    isActive ? "text-primary font-semibold" : isCompleted ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {stage.label}
                </span>
              </button>

              {/* Connector */}
              {!isLast && (
                <div
                  className={`flex-1 h-px mx-1 ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default InvestmentStepper;
