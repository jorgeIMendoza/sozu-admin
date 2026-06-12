import { useState } from "react";
import { Bell, Mail, MessageCircle, Check, Clock } from "lucide-react";
import type { FormalReservation, ProvisionalNotification } from "@/lib/offers/formal-reservation-data";
import NotificationPreviewModal from "./NotificationPreviewModal";

const ProvisionalNotificationsCard = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const [selected, setSelected] = useState<ProvisionalNotification | null>(null);

  const notifications = formalReservation.notifications ?? [];
  if (notifications.length === 0) return null;

  const sorted = [...notifications].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
  const sentCount = sorted.filter((n) => n.status === "sent").length;

  return (
    <>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground flex items-center gap-2">
            <Bell className="w-3 h-3" />
            Recordatorios automáticos
          </p>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {sentCount} de {sorted.length}
          </span>
        </div>

        <div className="divide-y divide-border">
          {sorted.map((n) => {
            const isSent = n.status === "sent";
            const scheduledDate = new Date(n.scheduledAt);
            const ChannelIcon = n.channel === "email" ? Mail : MessageCircle;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => isSent && setSelected(n)}
                disabled={!isSent}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${
                  isSent ? "hover:bg-muted/30 cursor-pointer" : "cursor-not-allowed opacity-60"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSent ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  {isSent ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ChannelIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {n.channel === "email" ? "Email" : "WhatsApp"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">Día {n.day}</span>
                  </div>
                  <p className={`text-xs leading-snug truncate ${isSent ? "text-foreground" : "text-muted-foreground"}`}>
                    {n.subject}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                    {scheduledDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    {" · "}
                    {scheduledDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <NotificationPreviewModal
          notification={selected}
          formalReservation={formalReservation}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default ProvisionalNotificationsCard;
