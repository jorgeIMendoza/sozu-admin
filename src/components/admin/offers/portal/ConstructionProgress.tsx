import { useState } from "react";
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Play,
  X,
  Bell,
  BellOff,
  ImageIcon,
  CheckCircle2,
  Circle,
  HardHat,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  type ConstructionProgressData,
  type ConstructionUpdate,
  useConstructionNotificationsEnabled,
  useConstructionStore,
} from "@/lib/offers/construction-progress-data";

interface ConstructionProgressProps {
  data: ConstructionProgressData;
}

const ConstructionProgress = ({ data }: ConstructionProgressProps) => {
  const [expanded, setExpanded] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ src: string; alt: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const notifs = useConstructionNotificationsEnabled(data.projectId);
  const toggleNotifs = useConstructionStore((s) => s.toggleNotifications);
  const handleToggleNotifs = () => {
    toggleNotifs(data.projectId);
    toast.success(
      !notifs
        ? "Te avisaremos sobre nuevos avances de obra"
        : "Notificaciones de avance silenciadas",
    );
  };

  const openLightbox = (photos: { src: string; alt: string }[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openVideo = (url: string) => {
    setVideoUrl(url);
    setVideoOpen(true);
  };

  const latest = data.updates[0];
  const previous = data.updates.slice(1);
  const currentStage =
    data.milestones.find((m) => !m.done)?.phase ??
    [...data.milestones].reverse().find((m) => m.done)?.phase ??
    "—";

  const featuredVideoUrl = data.featuredVideoUrl ?? latest?.videoUrl;
  const featuredVideoTitle =
    data.featuredVideoTitle ?? latest?.videoTitle ?? "Recorrido del avance";

  return (
    <section className="px-5 py-4 animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <HardHat className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Avance de obra
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Última actualización: {data.lastUpdated}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Global progress + milestones */}
          <div className="bg-card rounded-2xl border border-border p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Avance global del proyecto
              </span>
              <span className="text-2xl font-bold text-success tabular-nums">
                {data.globalProgress}%
              </span>
            </div>
            <Progress value={data.globalProgress} className="h-2 mb-1" />
            <p className="text-[11px] text-muted-foreground mb-4">
              Etapa actual: <span className="font-semibold text-foreground">{currentStage}</span>
            </p>

            <ul className="space-y-2">
              {data.milestones.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {m.done ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={m.done ? "text-foreground" : "text-muted-foreground"}>
                      {m.phase}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{m.pct}%</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-3 border-t border-border space-y-0.5">
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
          </div>

          {/* Featured video (latest) */}
          {featuredVideoUrl && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={featuredVideoUrl}
                  className="w-full h-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={featuredVideoTitle}
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-foreground">{featuredVideoTitle}</p>
                {latest && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {latest.date} · {latest.stage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Latest update photos + description */}
          {latest && (
            <UpdateCard
              update={latest}
              hideVideo
              onPhotoTap={openLightbox}
              onVideoTap={openVideo}
            />
          )}

          {/* Previous updates */}
          {previous.length > 0 && (
            <div>
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-primary"
              >
                <span className="flex items-center gap-1.5">
                  {historyOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {historyOpen ? "Ocultar anteriores" : `Ver ${previous.length} actualizaciones anteriores`}
                </span>
              </button>
              {historyOpen && (
                <div className="mt-2 space-y-3">
                  {previous.map((u) => (
                    <UpdateCard
                      key={u.id}
                      update={u}
                      onPhotoTap={openLightbox}
                      onVideoTap={openVideo}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notification toggle */}
          <button
            onClick={handleToggleNotifs}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border"
          >
            <div className="flex items-center gap-2.5">
              {notifs ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">
                Notificaciones de avance
              </span>
            </div>
            <div
              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                notifs ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  notifs ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 flex items-center justify-center w-full px-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhotos[lightboxIndex]?.src}
              alt={lightboxPhotos[lightboxIndex]?.alt}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>

          {lightboxPhotos.length > 1 && (
            <div className="flex gap-2 pb-8 pt-4">
              {lightboxPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(i);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === lightboxIndex ? "bg-white w-6" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.max(0, lightboxIndex - 1));
              }}
              className="text-white/60 text-sm"
              disabled={lightboxIndex === 0}
            >
              ← Anterior
            </button>
            <span className="text-white/40 text-xs tabular-nums">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(Math.min(lightboxPhotos.length - 1, lightboxIndex + 1));
              }}
              className="text-white/60 text-sm"
              disabled={lightboxIndex === lightboxPhotos.length - 1}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setVideoOpen(false)}
        >
          <button
            onClick={() => setVideoOpen(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div
            className="w-full max-w-2xl aspect-video px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={videoUrl + (videoUrl.includes("?") ? "&" : "?") + "autoplay=1"}
              className="w-full h-full rounded-xl"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Avance de obra"
            />
          </div>
        </div>
      )}
    </section>
  );
};

/* ── Update Card ── */

interface UpdateCardProps {
  update: ConstructionUpdate;
  hideVideo?: boolean;
  onPhotoTap: (photos: { src: string; alt: string }[], index: number) => void;
  onVideoTap: (url: string) => void;
}

const UpdateCard = ({ update, hideVideo, onPhotoTap, onVideoTap }: UpdateCardProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{update.date}</span>
        </div>
        <div className="flex items-center gap-2">
          {update.progressPercent !== undefined && (
            <span className="text-[10px] font-bold text-primary tabular-nums">
              {update.progressPercent}%
            </span>
          )}
          <span className="text-[10px] font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded-full">
            {update.stage}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {update.description}
      </p>

      {update.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {update.photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => onPhotoTap(update.photos, i)}
              className="relative flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden group"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              {i === 0 && update.photos.length > 3 && (
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <ImageIcon className="w-2.5 h-2.5" />
                  {update.photos.length}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {!hideVideo && update.videoUrl && (
        <button
          onClick={() => onVideoTap(update.videoUrl!)}
          className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-primary ml-0.5" />
          </div>
          <div className="text-left">
            <span className="text-xs font-medium text-foreground">
              {update.videoTitle ?? "Video del avance"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Ver recorrido de obra
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

export default ConstructionProgress;
