import { Check, Circle, AlertCircle } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface StatusTimelineProps {
  stages: StageInfo[];
  onStageTap: (stage: StageInfo) => void;
}

const StatusTimeline = ({ stages, onStageTap }: StatusTimelineProps) => {
  return (
    <section className="px-4 py-5 animate-fade-in">
      <h2 className="font-display font-semibold text-foreground text-base mb-4">
        Estatus de tu proceso
      </h2>

      {/* Context message for active stage */}
      {stages.find(s => s.status === "active")?.contextMessage && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-snug">
              {stages.find(s => s.status === "active")!.contextMessage}
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          return (
            <div
              key={stage.id}
              className="flex gap-3 cursor-pointer group"
              onClick={() => onStageTap(stage)}
            >
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    stage.status === "completed"
                      ? "bg-primary text-primary-foreground"
                      : stage.status === "active"
                      ? "bg-warning text-warning-foreground ring-4 ring-warning/20 animate-pulse-soft"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stage.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[2rem] ${
                      stage.status === "completed" ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`pb-5 flex-1 min-w-0 ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`font-medium text-sm leading-tight ${
                    stage.status === "pending"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {stage.description}
                </p>
                {stage.cta && stage.status === "active" && (
                  <button className="mt-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors">
                    {stage.cta.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default StatusTimeline;
