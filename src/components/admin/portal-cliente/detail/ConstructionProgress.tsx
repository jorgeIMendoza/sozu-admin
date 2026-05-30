import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  HardHat,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useConstructionProgress } from "@/lib/portal-cliente/construction-progress-data";

interface ConstructionProgressProps {
  cuentaId: string;
  activeStageId?: string; // "post_entrega" → simplified mode
}

const ConstructionProgress = ({ cuentaId, activeStageId }: ConstructionProgressProps) => {
  const { data, isLoading } = useConstructionProgress(cuentaId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="aspect-video rounded-xl bg-muted animate-pulse" />
      </section>
    );
  }

  if (!data) return null;

  const isCompleted = activeStageId === "post_entrega";
  const featuredVideoUrl = data.featuredVideoUrl;
  const featuredVideoTitle = data.featuredVideoTitle ?? data.updates[0]?.videoTitle ?? "Recorrido del avance";
  const featuredDate = data.updates[0]?.date;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden animate-fade-in">
        {/* Header / toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              {data.projectStatus ?? (isCompleted ? "Proyecto entregado" : "Avance de obra")}
            </h2>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border">
            {/* Video embed — active projects only, not post_entrega */}
            {!isCompleted && featuredVideoUrl && (
              <div className="min-w-0">
                <div className="aspect-video w-full max-w-full bg-black overflow-hidden">
                  <iframe
                    src={featuredVideoUrl}
                    className="w-full h-full"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title={featuredVideoTitle}
                  />
                </div>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-[12px] font-semibold text-foreground leading-snug">
                    {featuredVideoTitle}
                  </p>
                  {featuredDate && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{featuredDate}</p>
                  )}
                </div>
              </div>
            )}


            {/* Progress bar + milestones */}
            <div className="p-4 space-y-3">
              {data.lastUpdated && data.lastUpdated !== "—" && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Última actualización · <span className="font-medium text-foreground">{data.lastUpdated}</span>
                </p>
              )}
              {data.globalProgress > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Avance global
                      </span>
                      <span className="text-lg font-bold text-success tabular-nums">
                        {data.globalProgress}%
                      </span>
                    </div>
                    <Progress value={data.globalProgress} className="h-2" />
                  </>
                )}

                {data.milestones.length > 0 && (() => {
                  const currentIdx = data.milestones.findIndex((m) => !m.done);
                  return (
                    <ul className="space-y-1.5 pt-1">
                      {data.milestones.map((m, i) => {
                        const isCurrent = i === currentIdx;
                        return (
                          <li
                            key={i}
                            className={`flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                              isCurrent ? "bg-primary/8 ring-1 ring-primary/20" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {m.done ? (
                                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                              ) : isCurrent ? (
                                <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                </div>
                              ) : (
                                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={
                                m.done
                                  ? "text-foreground"
                                  : isCurrent
                                  ? "text-primary font-semibold"
                                  : "text-muted-foreground"
                              }>
                                {m.phase}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  actual
                                </span>
                              )}
                            </div>
                            <span className={`text-xs tabular-nums ${isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                              {m.pct}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}

                {data.estimatedDelivery && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border">
                    <Calendar className="w-3 h-3" />
                    Entrega estimada ·{" "}
                    {new Date(data.estimatedDelivery).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
            </div>
          </div>
        )}
      </section>
  );
};

export default ConstructionProgress;
