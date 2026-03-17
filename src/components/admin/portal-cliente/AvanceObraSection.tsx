import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Play, HardHat, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvanceObraSectionProps {
  proyectoId: number;
  idEstatusProyecto: number;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;
    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function AvanceObraSection({ proyectoId, idEstatusProyecto }: AvanceObraSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [showPrevious, setShowPrevious] = useState(false);

  // Get total estatus count for percentage calculation
  const { data: totalEstatus = 13 } = useQuery({
    queryKey: ["estatus-proyecto-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("estatus_proyecto")
        .select("id", { count: "exact", head: true })
        .eq("activo", true);
      return count || 13;
    },
    staleTime: 60 * 60_000,
  });

  // Get estatus name
  const { data: estatusNombre } = useQuery({
    queryKey: ["estatus-proyecto-nombre", idEstatusProyecto],
    queryFn: async () => {
      const { data } = await supabase
        .from("estatus_proyecto")
        .select("nombre")
        .eq("id", idEstatusProyecto)
        .maybeSingle();
      return data?.nombre || null;
    },
    enabled: !!idEstatusProyecto,
  });

  // Fetch YouTube videos for this project
  const { data: videos = [] } = useQuery({
    queryKey: ["portal-avance-obra-videos", proyectoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos_youtube")
        .select("id, nombre, link, fecha_creacion")
        .eq("id_proyecto", proyectoId)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!proyectoId,
  });

  const avancePercent = Math.round((idEstatusProyecto / totalEstatus) * 100);
  const latestVideo = videos[0] || null;
  const previousVideos = videos.slice(1);

  const latestEmbedUrl = latestVideo ? getYouTubeEmbedUrl(latestVideo.link) : null;

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="mx-5 mt-6">
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-[hsl(var(--inmob-green))]/10 flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-[hsl(var(--inmob-green))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Avance de obra</p>
            {latestVideo && (
              <p className="text-[11px] text-muted-foreground">
                Última actualización: {fmtDate(latestVideo.fecha_creacion)}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>

        {expanded && (
          <div className="border-t border-border px-4 pb-4 space-y-4">
            {/* Progress bar */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Avance global del proyecto</p>
                <span className="text-sm font-bold text-foreground tabular-nums">{avancePercent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(var(--inmob-green))] transition-all duration-500"
                  style={{ width: `${avancePercent}%` }}
                />
              </div>
              {estatusNombre && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Etapa actual: <span className="text-foreground font-medium">{estatusNombre}</span>
                </p>
              )}
            </div>

            {/* Latest video */}
            {latestVideo && (
              <div className="space-y-2">
                {latestEmbedUrl ? (
                  <div className="aspect-video rounded-xl overflow-hidden bg-black">
                    <iframe
                      src={latestEmbedUrl}
                      title={latestVideo.nombre}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <a
                    href={latestVideo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Play className="w-5 h-5 text-destructive" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{latestVideo.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">Ver en YouTube</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                )}
                <p className="text-xs text-muted-foreground px-1">{latestVideo.nombre}</p>
              </div>
            )}

            {/* Previous videos */}
            {previousVideos.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPrevious(!showPrevious)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--inmob-green))]"
                >
                  {showPrevious ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Ocultar anteriores
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Ver anteriores ({previousVideos.length})
                    </>
                  )}
                </button>

                {showPrevious && (
                  <div className="mt-3 space-y-2">
                    {previousVideos.map((video) => (
                      <a
                        key={video.id}
                        href={video.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                          <Play className="w-4 h-4 text-destructive" fill="currentColor" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{video.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtDate(video.fecha_creacion)}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No videos */}
            {videos.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Aún no hay videos de avance disponibles
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
