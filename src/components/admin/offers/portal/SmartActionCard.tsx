import { AlertCircle, ArrowRight } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface SmartActionCardProps {
  stage: StageInfo;
  onAction: () => void;
}

const SmartActionCard = ({ stage, onAction }: SmartActionCardProps) => {
  if (!stage.contextMessage || stage.status !== "active") return null;

  return (
    <section className="px-5 pt-4 animate-slide-up">
      <button
        onClick={onAction}
        className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/30 transition-all active:scale-[0.99] group"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug mb-2">
              {stage.contextMessage}
            </p>
            {stage.cta && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                {stage.cta.label}
                <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </button>
    </section>
  );
};

export default SmartActionCard;
