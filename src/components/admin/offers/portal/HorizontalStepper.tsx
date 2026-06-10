import { useRef } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface HorizontalStepperProps {
  stages: StageInfo[];
  onStageTap: (stage: StageInfo) => void;
}

const HorizontalStepper = ({ stages, onStageTap }: HorizontalStepperProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-5 animate-fade-in">
      <div className="px-5 mb-3">
        <h2 className="font-display font-semibold text-foreground text-sm">
          Tu proceso de inversión
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto px-5 pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stages.map((stage, index) => {
          const isActive = stage.status === "active";
          const isCompleted = stage.status === "completed";

          return (
            <button
              key={stage.id}
              onClick={() => onStageTap(stage)}
              className={`flex-shrink-0 snap-start rounded-xl p-3.5 transition-all active:scale-[0.97] ${
                isActive
                  ? "w-48 bg-card shadow-sm"
                  : isCompleted
                  ? "w-32 bg-card/60"
                  : "w-32 bg-muted/30"
              }`}
            >
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground/60"
                  }`}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5" /> : index + 1}
                </div>
                <span
                  className={`text-[11px] font-semibold truncate ${
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Description */}
              <p className={`text-[10px] leading-snug text-left line-clamp-2 ${
                isActive ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}>
                {stage.description}
              </p>

              {/* CTA for active */}
              {isActive && stage.cta && (
                <div className="mt-2.5 flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                  {stage.cta.label}
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default HorizontalStepper;
