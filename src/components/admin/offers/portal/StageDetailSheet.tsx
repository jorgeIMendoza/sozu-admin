import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, Circle } from "lucide-react";
import type { StageInfo } from "@/lib/offers/mock-data";

interface StageDetailSheetProps {
  stage: StageInfo | null;
  open: boolean;
  onClose: () => void;
  onCtaAction?: (action: string) => void;
}

const StageDetailSheet = ({ stage, open, onClose, onCtaAction }: StageDetailSheetProps) => {
  if (!stage) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                stage.status === "completed"
                  ? "bg-primary text-primary-foreground"
                  : stage.status === "active"
                  ? "bg-warning text-warning-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {stage.status === "completed" ? (
                <Check className="w-5 h-5" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </div>
            <div>
              <SheetTitle className="text-foreground font-display">
                {stage.label}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">{stage.description}</p>
            </div>
          </div>
        </SheetHeader>

        {stage.contextMessage && (
          <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground leading-snug">
              {stage.contextMessage}
            </p>
          </div>
        )}

        {stage.details && (
          <div className="space-y-3">
            {Object.entries(stage.details).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-start py-2.5 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">{key}</span>
                <span className="text-sm font-medium text-foreground text-right max-w-[55%]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {stage.cta && stage.status === "active" && (
          <button
            onClick={() => stage.cta && onCtaAction?.(stage.cta.action)}
            className="w-full mt-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            {stage.cta.label}
          </button>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default StageDetailSheet;
