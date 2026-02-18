import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, MapPin, FileText, FolderOpen, Landmark, Check, Trophy, ChevronRight, Loader2 } from "lucide-react";
import { useAgentOnboardingStatus, type OnboardingStep } from "@/hooks/useAgentOnboardingStatus";
import { AgentOnboardingStepDialog } from "./AgentOnboardingStepDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<string, React.ElementType> = {
  basic: User,
  address: MapPin,
  fiscal: FileText,
  documents: FolderOpen,
  'bank-accounts': Landmark,
};

interface AgentOnboardingWidgetProps {
  personaId: number;
}

export function AgentOnboardingWidget({ personaId }: AgentOnboardingWidgetProps) {
  const { steps, completedCount, totalSteps, percentage, isLoading } = useAgentOnboardingStatus(personaId);
  const [activeStep, setActiveStep] = useState<OnboardingStep['id'] | null>(null);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // All complete - show badge
  if (percentage === 100) {
    return (
      <Card className="border-0 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
        <CardContent className="flex items-center gap-3 py-4 px-5">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500 text-white shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">¡Perfil completo!</p>
            <p className="text-xs text-muted-foreground">Tu perfil está al 100%. Ya puedes operar sin restricciones.</p>
          </div>
          <Badge className="bg-emerald-500 text-white border-0 shrink-0">100%</Badge>
        </CardContent>
      </Card>
    );
  }

  // Progress color based on percentage
  const getProgressColor = () => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  // Find next incomplete step
  const nextIncomplete = steps.find(s => !s.isComplete);

  return (
    <>
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-foreground">Completa tu perfil</p>
              <p className="text-xs text-muted-foreground">{completedCount} de {totalSteps} pasos completados</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", percentage >= 80 ? "text-emerald-600" : percentage >= 40 ? "text-amber-600" : "text-red-600")}>
                {percentage}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all duration-700 ease-out", getProgressColor())}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id];
              const isNext = nextIncomplete?.id === step.id;

              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                    step.isComplete
                      ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                      : isNext
                      ? "bg-primary/5 ring-1 ring-primary/30 hover:bg-primary/10"
                      : "bg-muted/40 hover:bg-muted/60"
                  )}
                >
                  {/* Icon circle */}
                  <div
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-all",
                      step.isComplete
                        ? "bg-emerald-500 text-white"
                        : isNext
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {step.isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>

                  {/* Label */}
                  <span className={cn(
                    "flex-1 text-sm font-medium",
                    step.isComplete ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                  )}>
                    {step.label}
                  </span>

                  {/* Status */}
                  {step.isComplete ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10 shrink-0">
                      Listo
                    </Badge>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Dialog */}
      {activeStep && (
        <AgentOnboardingStepDialog
          step={activeStep}
          personaId={personaId}
          open={!!activeStep}
          onOpenChange={(open) => {
            if (!open) setActiveStep(null);
          }}
        />
      )}
    </>
  );
}
