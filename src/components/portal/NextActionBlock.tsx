import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface NextActionBlockProps {
  currentStage: StageInfo;
  onAction: () => void;
}

const NextActionBlock = ({ currentStage, onAction }: NextActionBlockProps) => {
  const hasAction = currentStage.status === "active" && currentStage.contextMessage;

  if (!hasAction) {
    return (
      <section className="px-5 py-4">
        <div className="flex items-center gap-3 py-3 px-4 bg-primary/5 rounded-xl border border-primary/10">
          <CheckCircle2 className="w-4.5 h-4.5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Estás al día</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">No hay acciones pendientes</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-4">
      <button
        onClick={onAction}
        className="w-full flex items-center gap-3 py-3 px-4 bg-warning/5 rounded-xl border border-warning/15 text-left group transition-colors hover:bg-warning/10 active:scale-[0.99]"
      >
        <AlertCircle className="w-4.5 h-4.5 text-warning flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {currentStage.contextMessage}
          </p>
          {currentStage.cta && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary mt-1">
              {currentStage.cta.label}
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>
    </section>
  );
};

export default NextActionBlock;
