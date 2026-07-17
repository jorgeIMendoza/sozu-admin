import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  HardHat,
  History,
  ImageIcon,
  Loader2,
  PlayCircle,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/admin/portal-socio-bancario/ui";
import { cn } from "@/lib/utils";
import {
  useAvanceObraProyecto,
  useProyectosAvanceObra,
  type AvanceObraVideo,
} from "@/hooks/usePortalSocioBancario/useAvanceObra";

/**
 * Avance de Obra — Portal Socio Bancario.
 *
 * Basado en el esquema de la sección "Avance de obra" de la Oferta
 * Comercial Digital (OfferConstructionProgress): avance global, etapa
 * actual, etapas restantes con su porcentaje, video más reciente,
 * historial de videos y galería de fotos del avance.
 */
export default function SocioBancarioAvanceObraPage() {
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [videoSeleccionado, setVideoSeleccionado] = useState<AvanceObraVideo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: proyectos = [], isLoading: cargandoProyectos } = useProyectosAvanceObra();
  const { data, isLoading, isError } = useAvanceObraProyecto(proyectoId);

  // Autoseleccionar el primer proyecto disponible.
  useEffect(() => {
    if (proyectoId === null && proyectos.length > 0) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  // Al cambiar de proyecto, volver al video más reciente.
  useEffect(() => {
    setVideoSeleccionado(null);
    setLightboxIndex(null);
  }, [proyectoId]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxIndex]);

  const progress = data?.progress ?? 0;

  // Avance PROPIO de cada etapa (0-100 dentro de su banda), coherente con
  // el % global. El pct del milestone es el umbral global acumulado.
  const stageRows = useMemo(() => {
    const milestones = data?.milestones ?? [];
    return milestones.map((m, i) => {
      const prev = i === 0 ? 0 : milestones[i - 1].pct;
      const band = m.pct - prev;
      const ownPct =
        band <= 0
          ? progress >= m.pct
            ? 100
            : 0
          : Math.round(Math.min(100, Math.max(0, ((progress - prev) / band) * 100)));
      return { ...m, ownPct, done: ownPct >= 100 };
    });
  }, [data?.milestones, progress]);

  const currentStage =
    stageRows.find((m) => m.ownPct < 100)?.phase ??
    [...stageRows].reverse().find((m) => m.done)?.phase ??
    "—";

  const videoActivo = videoSeleccionado ?? data?.videos[0] ?? null;
  const fotos = data?.fotos ?? [];

  const fmtFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Avance de Obra"
        description="Etapa actual del desarrollo, video más reciente, historial y fotos del avance."
        action={
          <Select
            value={proyectoId !== null ? String(proyectoId) : undefined}
            onValueChange={(v) => setProyectoId(Number(v))}
            disabled={cargandoProyectos}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder={cargandoProyectos ? "Cargando proyectos…" : "Selecciona un proyecto"} />
            </SelectTrigger>
            <SelectContent>
              {proyectos.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError && (
        <Panel title="Error">
          <p className="text-sm text-destructive">
            No fue posible cargar el avance de obra. Intenta de nuevo.
          </p>
        </Panel>
      )}

      {(isLoading || proyectoId === null) && !isError ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <>
          {/* ── Bloque global ── */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <HardHat className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    Avance global del proyecto
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Etapa actual:{" "}
                    <span className="font-semibold text-foreground">{currentStage}</span>
                    {data.lastUpdated && (
                      <span className="text-muted-foreground/70">
                        {" "}
                        · Actualizado: {fmtFecha(data.lastUpdated)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none shrink-0">
                {progress}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance de obra"
            >
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── 2 columnas: video | etapas ── */}
          <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
            {/* IZQUIERDA: video del avance */}
            <Panel
              title="Video de avance"
              description={
                videoActivo?.fechaCreacion
                  ? `Publicado: ${fmtFecha(videoActivo.fechaCreacion)}`
                  : undefined
              }
            >
              {videoActivo ? (
                <div className="rounded-md overflow-hidden border border-border">
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      src={videoActivo.embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={videoActivo.nombre ?? "Video de avance de obra"}
                    />
                  </div>
                  {videoActivo.nombre && (
                    <div className="px-4 py-3 bg-card border-t border-border">
                      <p className="text-sm font-semibold text-foreground">
                        {videoActivo.nombre}
                      </p>
                    </div>
                  )}
                </div>
              ) : fotos.length > 0 ? (
                <button
                  onClick={() => setLightboxIndex(0)}
                  className="relative block w-full rounded-md overflow-hidden border border-border cursor-zoom-in"
                >
                  <div className="aspect-video w-full">
                    <img
                      src={fotos[0].src}
                      alt={fotos[0].alt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              ) : (
                <div className="aspect-video rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    Material del avance próximamente
                  </p>
                </div>
              )}
            </Panel>

            {/* DERECHA: etapas de obra */}
            <Panel title="Etapas de obra" description="Avance propio de cada etapa">
              <ul className="space-y-2.5">
                {stageRows.map((m, i) => {
                  const isCurrent = !m.done && m.phase === currentStage;
                  return (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {m.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : isCurrent ? (
                          <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          </span>
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "truncate",
                            m.done
                              ? "text-foreground"
                              : isCurrent
                                ? "text-foreground font-semibold"
                                : "text-muted-foreground",
                          )}
                        >
                          {m.phase}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs tabular-nums shrink-0",
                          m.done
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : isCurrent
                              ? "text-primary font-semibold"
                              : "text-muted-foreground/60",
                        )}
                      >
                        {m.ownPct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-3 mt-3 border-t border-border/60">
                <Calendar className="w-3 h-3 shrink-0" />
                Entrega estimada · {fmtFecha(data.estimatedDelivery)}
              </p>
            </Panel>
          </div>

          {/* ── Historial de videos ── */}
          <Panel
            title="Historial de avances"
            description="Videos de avance de obra publicados anteriormente"
          >
            {data.videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay videos de avance para este proyecto.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.videos.map((v, i) => {
                  const activo = videoActivo?.id === v.id;
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => setVideoSeleccionado(v)}
                        className={cn(
                          "w-full flex items-center gap-3 py-2.5 px-2 rounded-md text-left transition-colors",
                          activo ? "bg-primary/5" : "hover:bg-muted/50",
                        )}
                      >
                        {activo ? (
                          <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <History className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm truncate",
                              activo ? "font-semibold text-foreground" : "text-foreground",
                            )}
                          >
                            {v.nombre ?? `Video de avance #${data.videos.length - i}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtFecha(v.fechaCreacion)}
                          </p>
                        </div>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Más reciente
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* ── Fotos del avance ── */}
          <Panel
            title={`Fotos del avance · ${fotos.length}`}
            description="Imágenes del avance de obra del proyecto"
          >
            {fotos.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Aún no hay fotos de avance para este
                proyecto.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {fotos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className="aspect-square rounded-md overflow-hidden group border border-border"
                  >
                    <img
                      src={p.src}
                      alt={p.alt}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {/* Lightbox */}
          {lightboxIndex !== null && fotos[lightboxIndex] && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Foto de avance de obra"
              className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
              onClick={() => setLightboxIndex(null)}
            >
              <button
                onClick={() => setLightboxIndex(null)}
                aria-label="Cerrar"
                className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <img
                src={fotos[lightboxIndex].src}
                alt={fotos[lightboxIndex].alt}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
                <button
                  aria-label="Foto anterior"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(Math.max(0, lightboxIndex - 1));
                  }}
                  className="h-11 px-4 inline-flex items-center text-white/60 text-sm"
                  disabled={lightboxIndex === 0}
                >
                  ← Anterior
                </button>
                <span className="text-white/40 text-xs tabular-nums">
                  {lightboxIndex + 1} / {fotos.length}
                </span>
                <button
                  aria-label="Foto siguiente"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(Math.min(fotos.length - 1, lightboxIndex + 1));
                  }}
                  className="h-11 px-4 inline-flex items-center text-white/60 text-sm"
                  disabled={lightboxIndex === fotos.length - 1}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      ) : !isError ? (
        <Panel title="Sin datos">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Selecciona un proyecto para ver su
            avance de obra.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
