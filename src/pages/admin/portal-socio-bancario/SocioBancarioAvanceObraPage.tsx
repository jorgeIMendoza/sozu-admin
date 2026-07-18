import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  History,
  ImageIcon,
  LineChart as LineChartIcon,
  PlayCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel, Pill } from "@/components/admin/portal-socio-bancario/ui";
import { DesarrolloNoAsignado, PendienteDeCarga } from "@/components/admin/portal-socio-bancario/EmptyStates";
import { cn } from "@/lib/utils";
import { useSocioProyecto } from "@/hooks/usePortalSocioBancario/useSocioProyecto";
import {
  useAvanceObraProyecto,
  type AvanceObraVideo,
} from "@/hooks/usePortalSocioBancario/useAvanceObra";

/**
 * Avance de Obra — Portal Socio Bancario V1.
 *
 * El banco valida "la obra va conforme al plan". Para eso necesita el
 * PROGRAMADO junto al real. Hoy la base NO tiene programa de obra ni un
 * histórico de mediciones físicas: el "% real" es una ESTIMACIÓN por tiempo
 * transcurrido. Por eso el programado, la curva y el dictamen se muestran como
 * estado vacío honesto (Pendiente de carga) — nunca fabricados.
 */
export default function SocioBancarioAvanceObraPage() {
  const { idProyecto, nombre, noAsignado, isLoading: loadingProyecto } = useSocioProyecto();
  const [videoSeleccionado, setVideoSeleccionado] = useState<AvanceObraVideo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data, isLoading, isError } = useAvanceObraProyecto(idProyecto);

  useEffect(() => {
    setVideoSeleccionado(null);
    setLightboxIndex(null);
  }, [idProyecto]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxIndex]);

  const progress = data?.progress ?? 0;

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
      ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";
  const fmtFechaCorta = (iso: string | null) =>
    iso
      ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

  if (noAsignado) {
    return (
      <>
        <PageHeader title="Avance de Obra" description="Portal Socio Bancario" />
        <DesarrolloNoAsignado />
      </>
    );
  }

  const cargando = loadingProyecto || (idProyecto != null && isLoading);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Avance de Obra"
        description={
          nombre
            ? `Avance físico, video, historial y fotos · ${nombre}`
            : "Avance físico del desarrollo"
        }
      />

      {isError && (
        <Panel title="Error">
          <p className="text-sm text-destructive">
            No fue posible cargar el avance de obra. Intenta de nuevo.
          </p>
        </Panel>
      )}

      {cargando && !isError ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <>
          {/* ── 5.1 Avance global: real vs programado ── */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Avance global del proyecto
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Etapa actual: <span className="font-semibold text-foreground">{currentStage}</span>
                  {data.lastUpdated && (
                    <span className="text-muted-foreground/70"> · Actualizado: {fmtFecha(data.lastUpdated)}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Real */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Real</p>
                <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none mt-1">
                  {progress}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Estimado por tiempo de obra</p>
              </div>
              {/* Programado — no existe baseline */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Programado</p>
                <p className="text-3xl font-bold tabular-nums text-muted-foreground/50 leading-none mt-1">—</p>
                {/* SWAP POINT: programa de obra (baseline) para el % programado. */}
                <p className="text-[10px] text-muted-foreground mt-1">Pendiente de carga</p>
              </div>
              {/* Desviación */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Desviación</p>
                <p className="text-3xl font-bold tabular-nums text-muted-foreground/50 leading-none mt-1">—</p>
                <p className="text-[10px] text-muted-foreground mt-1">Requiere programado</p>
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance de obra"
            >
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* ── 5.2 Curva de avance (programado vs real) ── */}
          <Panel
            title="Curva de avance"
            description="Programado vs. real a lo largo del tiempo"
          >
            {/* No hay programa de obra ni histórico de mediciones físicas en la
                base → no se dibuja ninguna curva (no se fabrica). */}
            <PendienteDeCarga
              icon={LineChartIcon}
              titulo="Programa de obra pendiente de carga"
              detalle="La curva programado vs. real requiere el programa de obra (baseline) y el histórico de mediciones físicas. En cuanto se carguen, aquí se dibujará la curva S."
            />
            {/* SWAP POINT: tabla de programa de obra + mediciones para la curva S. */}
          </Panel>

          {/* ── 2 columnas: video | etapas ── */}
          <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
            {/* Video */}
            <Panel
              title="Video de avance"
              description={
                videoActivo?.fechaCreacion ? `Publicado: ${fmtFecha(videoActivo.fechaCreacion)}` : undefined
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
                      <p className="text-sm font-semibold text-foreground">{videoActivo.nombre}</p>
                    </div>
                  )}
                </div>
              ) : fotos.length > 0 ? (
                <button
                  onClick={() => setLightboxIndex(0)}
                  className="relative block w-full rounded-md overflow-hidden border border-border cursor-zoom-in"
                >
                  <div className="aspect-video w-full">
                    <img src={fotos[0].src} alt={fotos[0].alt} className="w-full h-full object-cover" />
                  </div>
                </button>
              ) : (
                <div className="aspect-video rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Material del avance próximamente</p>
                </div>
              )}
            </Panel>

            {/* ── 5.3 Etapas: programado vs real ── */}
            <Panel title="Etapas de obra" description="Programado vs. real por etapa">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 text-left">Etapa</th>
                      <th className="px-2 py-2 text-right">Prog.</th>
                      <th className="px-2 py-2 text-right">Real</th>
                      <th className="px-2 py-2 text-right">Desv.</th>
                      <th className="px-2 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stageRows.map((m, i) => {
                      const isCurrent = !m.done && m.phase === currentStage;
                      const estado = m.done ? "Completada" : isCurrent ? "En proceso" : "Pendiente";
                      const estadoCls = m.done
                        ? "bg-success/15 text-success"
                        : isCurrent
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-muted text-muted-foreground";
                      return (
                        <tr key={i}>
                          <td className="px-2 py-2 text-foreground">{m.phase}</td>
                          {/* Programado por etapa: no existe baseline. // SWAP POINT */}
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground/50">—</td>
                          <td className="px-2 py-2 text-right tabular-nums">{m.ownPct}%</td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground/50">—</td>
                          <td className="px-2 py-2">
                            <Pill className={estadoCls}>{estado}</Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-3 mt-3 border-t border-border/60">
                <Calendar className="w-3 h-3 shrink-0" />
                Entrega estimada · {fmtFecha(data.estimatedDelivery)}
              </p>
            </Panel>
          </div>

          {/* ── 5.4 Verificación de obra (dictamen / supervisión externa) ── */}
          <Panel title="Verificación de obra" description="Supervisión / dictamen de un tercero">
            <PendienteDeCarga
              icon={ShieldCheck}
              titulo="Verificación externa pendiente de carga"
              detalle="Aquí se mostrará el supervisor/perito, la fecha y el documento de dictamen que verifica el avance reportado. Aún no hay dato cargado."
            />
            {/* SWAP POINT: datos reales del supervisor/perito (nombre, fecha, documento). */}
          </Panel>

          {/* ── 5.5 Historial de videos ── */}
          <Panel title="Historial de avances" description="Videos de avance de obra publicados anteriormente">
            {data.videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay videos de avance para este proyecto.</p>
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
                          <p className={cn("text-sm truncate", activo ? "font-semibold text-foreground" : "text-foreground")}>
                            {v.nombre ?? `Video de avance #${data.videos.length - i}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{fmtFecha(v.fechaCreacion)}</p>
                        </div>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[10px] shrink-0">Más reciente</Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* ── 5.6 Fotos del avance (con fecha real) ── */}
          <Panel title={`Fotos del avance · ${fotos.length}`} description="Imágenes del avance de obra, más recientes primero">
            {fotos.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Aún no hay fotos de avance para este proyecto.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {fotos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className="group text-left"
                    title={fmtFechaCorta(p.fecha) ?? undefined}
                  >
                    <div className="aspect-square rounded-md overflow-hidden border border-border">
                      <img
                        src={p.src}
                        alt={p.alt}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {fmtFechaCorta(p.fecha) ?? "Sin fecha"}
                    </p>
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
                className="max-w-full max-h-[78vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              {fmtFechaCorta(fotos[lightboxIndex].fecha) && (
                <p className="mt-3 text-white/70 text-sm tabular-nums">
                  {fmtFechaCorta(fotos[lightboxIndex].fecha)}
                </p>
              )}
              <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
                <button
                  aria-label="Foto anterior"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(Math.max(0, lightboxIndex - 1));
                  }}
                  className="h-11 px-4 inline-flex items-center text-white/60 text-sm disabled:opacity-30"
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
                  className="h-11 px-4 inline-flex items-center text-white/60 text-sm disabled:opacity-30"
                  disabled={lightboxIndex === fotos.length - 1}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
