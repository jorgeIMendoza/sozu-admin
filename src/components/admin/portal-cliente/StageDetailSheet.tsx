import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Circle } from "lucide-react";
import type { StageInfo } from "@/lib/portal-cliente/mock-data";

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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto [&>button:last-child]:hidden">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-3">
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
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
        <button
          onClick={onClose}
          className="w-full mt-4 h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </SheetContent>
    </Sheet>
  );
};

export default StageDetailSheet;
