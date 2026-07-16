/**
 * @deprecated F.3.C - Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { useState } from "react";
import { CheckCircle2, Mail, MessageCircle, Phone, Lock, Eye } from "lucide-react";
import type { PreReservation, OfertaComercial } from "@/lib/offers/offer-data";
import { useOfferStore } from "@/lib/offers/offer-data";
import type { Agent } from "@/lib/offers/agent-data";
import {
  NOTIFICATION_TEMPLATES,
  type NotificationTemplateId,
  type NotificationTemplate,
} from "@/lib/offers/notification-templates";
import { buildTemplateContext, getScheduledFor } from "@/lib/offers/notification-helpers";
import { getSimulatedNow, useTimeTravelStore } from "@/lib/offers/time-travel";
import NotificationPreviewSheet from "./NotificationPreviewSheet";

interface Props {
  reservation: PreReservation;
  offer: OfertaComercial;
  agent?: Agent;
}

interface TimelineEvent {
  id: string;
  icon: typeof Lock;
  title: string;
  description: string;
  scheduledFor: Date;
  templateId?: NotificationTemplateId;
  isManual?: boolean;
}

const PreReservationTimeline = ({ reservation, offer, agent }: Props) => {
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);

  // Re-render cuando el time-travel cambie
  useTimeTravelStore((s) => s.offsetMinutes);

  const now = getSimulatedNow();
  const createdAt = new Date(reservation.createdAt);

  const events: TimelineEvent[] = [
    {
      id: "created",
      icon: Lock,
      title: "Pre-apartado creado",
      description: `Retención de $${reservation.amountMXN.toLocaleString("es-MX")} MXN autorizada en tarjeta termina en ${reservation.cardLast4 ?? "****"}`,
      scheduledFor: createdAt,
    },
    {
      id: "confirmation",
      icon: Mail,
      title: "Confirmación enviada",
      description: "Email + WhatsApp con detalles del pre-apartado",
      scheduledFor: getScheduledFor(reservation, 2),
      templateId: "confirmation",
    },
    {
      id: "agent_call",
      icon: Phone,
      title: "Llamada de tu agente",
      description: "Tu agente te contacta dentro de las primeras 24 horas",
      scheduledFor: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      isManual: true,
    },
    {
      id: "reminder_day_5",
      icon: MessageCircle,
      title: "Recordatorio día 5",
      description: "Seguimiento proactivo del agente",
      scheduledFor: getScheduledFor(reservation, 5 * 24 * 60),
      templateId: "reminder_day_5",
    },
    {
      id: "reminder_day_10",
      icon: MessageCircle,
      title: "Recordatorio día 10",
      description: "Aviso de que quedan 5 días para decidir",
      scheduledFor: getScheduledFor(reservation, 10 * 24 * 60),
      templateId: "reminder_day_10",
    },
    {
      id: "reminder_day_14",
      icon: MessageCircle,
      title: "Recordatorio día 14",
      description: "Último aviso antes del vencimiento",
      scheduledFor: getScheduledFor(reservation, 14 * 24 * 60),
      templateId: "reminder_day_14",
    },
  ];

  const prospect = useOfferStore
    .getState()
    .prospects.find((p) => p.id === reservation.prospectId);
  const recipientEmail = prospect?.email ?? "";
  const recipientPhone = `+52 ${prospect?.phone ?? ""}`;
  const context = buildTemplateContext(reservation, offer, agent);

  const completedCount = events.filter((e) => now >= e.scheduledFor).length;

  const handleEventClick = (event: TimelineEvent) => {
    if (!event.templateId) return;
    if (now < event.scheduledFor) return;
    const template = NOTIFICATION_TEMPLATES.find((t) => t.id === event.templateId);
    if (template) setPreviewTemplate(template);
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-foreground">Cronología</h3>
          <span className="text-[11px] text-muted-foreground">
            {completedCount} de {events.length} eventos completados
          </span>
        </div>

        <div className="space-y-0">
          {events.map((event, idx) => {
            const Icon = event.icon;
            const isLast = idx === events.length - 1;
            const isSent = now >= event.scheduledFor;
            const isTappable = !!event.templateId && isSent;
            const nextDone = events[idx + 1] && now >= events[idx + 1].scheduledFor;

            return (
              <div key={event.id} className="flex gap-3.5">
                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isSent
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isSent ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-px flex-1 min-h-[24px] mt-1 ${
                        isSent && nextDone
                          ? "bg-success/30"
                          : isSent
                          ? "bg-success/30"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleEventClick(event)}
                  disabled={!isTappable}
                  className={`flex-1 text-left pb-5 ${isSent ? "" : "opacity-60"} ${
                    isTappable
                      ? "cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={`text-sm font-medium ${
                        isSent ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {event.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {event.scheduledFor.toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {isTappable && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold">
                        <Eye className="w-3 h-3" />
                        Ver
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {event.description}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {previewTemplate && (
        <NotificationPreviewSheet
          open={!!previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          template={previewTemplate}
          context={context}
          agent={agent}
          recipientEmail={recipientEmail}
          recipientPhone={recipientPhone}
          sentAt={getScheduledFor(
            reservation,
            previewTemplate.scheduledOffsetMinutes
          ).toISOString()}
        />
      )}
    </>
  );
};

export default PreReservationTimeline;
