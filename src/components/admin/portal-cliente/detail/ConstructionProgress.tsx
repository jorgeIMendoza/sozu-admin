import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  HardHat,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useConstructionProgress } from "@/lib/portal-cliente/construction-progress-data";

interface ConstructionProgressProps {
  cuentaId: string;
  activeStageId?: string; // "post_entrega" → simplified mode
  /** Cuando la sección es el contenido único de una pestaña, abrirla ya expandida */
  defaultExpanded?: boolean;
}

const ConstructionProgress = ({ cuentaId, activeStageId, defaultExpanded = false }: ConstructionProgressProps) => {
  const { data, isLoading } = useConstructionProgress(cuentaId);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

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
  const videos = data.updates.filter((u) => !!u.videoUrl);
  const selected = videos.find((v) => v.id === selectedVideoId) ?? videos[0];

  const featuredVideoUrl = selected?.videoUrl ?? data.featuredVideoUrl;
  const featuredWatchUrl = selected?.videoWatchUrl ?? data.featuredVideoWatchUrl;
  const featuredVideoTitle = selected?.videoTitle ?? data.featuredVideoTitle ?? "Recorrido del avance";
  const featuredDate = selected?.date;

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
            {/* Video embed */}
            {featuredVideoUrl ? (
              <div className="min-w-0">
                <div className="aspect-video w-full max-w-full bg-black overflow-hidden">
                  <iframe
                    key={featuredVideoUrl}
                    src={featuredVideoUrl}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    title={featuredVideoTitle}
                  />
                </div>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-[12px] font-semibold text-foreground leading-snug">
                    {featuredVideoTitle}
                  </p>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    {featuredDate && (
                      <p className="text-[11px] text-muted-foreground">{featuredDate}</p>
                    )}
                    {featuredWatchUrl && (
                      <a
                        href={featuredWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
                      >
                        Ver en YouTube
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Videos anteriores */}
                {videos.length > 1 && (
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2">
                      Videos de avance
                    </p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                      {videos.map((v) => {
                        const active = v.id === selected?.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVideoId(v.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                              active
                                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                                : "bg-muted/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            {v.videoTitle || v.month}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-4 border-b border-border">
                <p className="text-[12px] text-muted-foreground">
                  Aún no hay videos de avance publicados para este proyecto.
                </p>
              </div>
            )}


            {/* Progress bar + milestones */}
            <div className="p-4 space-y-3">
              {data.lastUpdated && data.lastUpdated !== "-" && (
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
                  <div className="pt-1 border-t border-border space-y-0.5">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Posible fecha de entrega ·{" "}
                      {new Date(data.estimatedDelivery).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug">
                      Fecha estimada y sujeta a cambios según el avance de obra. No constituye una
                      fecha de entrega contractual.
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </section>
  );
};

export default ConstructionProgress;
