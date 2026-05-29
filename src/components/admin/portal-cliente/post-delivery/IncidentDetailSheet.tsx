import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  X,
  CheckCircle2,
  Clock,
  User,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCloseIncident,
  getIncidentStatusInfo,
  getIncidentCategoryLabel,
  type Incident,
  type IncidentTimelineEvent,
} from "@/lib/portal-cliente/post-delivery-data";

interface Props {
  cuentaId: string;
  incident: Incident | null;
  open: boolean;
  onClose: () => void;
}

const IncidentDetailSheet = ({ cuentaId, incident, open, onClose }: Props) => {
  const closeIncident = useCloseIncident(cuentaId);

  if (!incident) return null;
  const statusInfo = getIncidentStatusInfo(incident.status);

  const handleConfirmResolved = async () => {
    try {
      await closeIncident.mutateAsync(incident.id);
      toast.success("Incidencia cerrada. Gracias por tu confirmación.");
      onClose();
    } catch {
      toast.error("No se pudo cerrar la incidencia. Intenta de nuevo.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92vh] p-0 rounded-t-2xl overflow-y-auto"
      >
        <div className="p-5 flex items-start gap-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {getIncidentCategoryLabel(incident.category)}
            </p>
            <h3 className="text-base font-semibold text-foreground mt-0.5">
              {incident.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Reportada el{" "}
              {new Date(incident.createdAt).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-2">
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
          {incident.warrantyClaimed && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-success/10 text-success inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Bajo garantía
            </span>
          )}
        </div>

        <div className="px-5 mt-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
            Descripción
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {incident.description}
          </p>
          {incident.photos.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              📎 {incident.photos.length} foto
              {incident.photos.length === 1 ? "" : "s"} adjunta
              {incident.photos.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="px-5 mt-6">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">
            Seguimiento
          </p>
          <div className="space-y-0">
            {incident.timeline.map((event, idx) => (
              <TimelineEvent
                key={event.id}
                event={event}
                isLast={idx === incident.timeline.length - 1}
              />
            ))}
          </div>
        </div>

        <div className="px-5 py-5 mt-4">
          {incident.status === "resuelto" && (
            <button
              onClick={handleConfirmResolved}
              disabled={closeIncident.isPending}
              className="w-full h-12 rounded-xl bg-success text-success-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {closeIncident.isPending ? "Cerrando…" : "Confirmar resolución"}
            </button>
          )}
          {incident.status === "cerrado" && (
            <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Esta incidencia está cerrada.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const TimelineEvent = ({
  event,
  isLast,
}: {
  event: IncidentTimelineEvent;
  isLast: boolean;
}) => {
  const Icon =
    event.actor === "cliente" ? User : event.actor === "tecnico" ? Wrench : Clock;
  return (
    <div className="relative pl-9 pb-5">
      {!isLast && (
        <div className="absolute left-[14px] top-7 bottom-0 w-px bg-border" />
      )}
      <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {new Date(event.timestamp).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p className="text-sm text-foreground mt-0.5 leading-relaxed">
        {event.message}
      </p>
    </div>
  );
};

export default IncidentDetailSheet;
