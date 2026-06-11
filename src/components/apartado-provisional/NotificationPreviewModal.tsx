import { X, Mail, MessageCircle } from "lucide-react";
import type { FormalReservation, ProvisionalNotification } from "@/lib/offers/formal-reservation-data";

interface Props {
  notification: ProvisionalNotification;
  formalReservation: FormalReservation;
  onClose: () => void;
}

const NotificationPreviewModal = ({ notification, formalReservation, onClose }: Props) => {
  const isEmail = notification.channel === "email";
  // SWAP POINT: cuando el FR tenga `contact.email` real
  const clientEmail =
    formalReservation.fiscalIdentity?.legalName
      ? `${formalReservation.fiscalIdentity.legalName.split(" ")[0].toLowerCase()}@email.com`
      : "cliente@email.com";

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            {isEmail ? (
              <Mail className="w-4 h-4 text-foreground/70" />
            ) : (
              <MessageCircle className="w-4 h-4 text-foreground/70" />
            )}
            <p className="text-xs font-semibold text-foreground">
              Vista previa del {isEmail ? "email" : "WhatsApp"}
            </p>
            <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[9px] font-bold uppercase">
              Modo Demo
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isEmail ? (
          <>
            <div className="px-5 py-3 border-b border-border text-[11px] text-muted-foreground space-y-0.5">
              <p>
                <span className="font-semibold text-foreground">De:</span> SOZU &lt;no-reply@sozu.com&gt;
              </p>
              <p>
                <span className="font-semibold text-foreground">Para:</span> {clientEmail}
              </p>
              <p>
                <span className="font-semibold text-foreground">Asunto:</span> {notification.subject}
              </p>
            </div>
            <div className="p-5">
              <p className="text-base font-bold text-foreground mb-3">SOZU</p>
              <div
                className="text-xs text-foreground/85 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: notification.body }}
              />
              <div className="mt-5 pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground">
                  © SOZU 2026 · Comercializador inmobiliario · Av. Vallarta, Guadalajara, Jalisco
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="rounded-2xl bg-success/[0.04] border border-success/20 p-4 max-w-[85%]">
              <p className="text-[11px] font-semibold text-success mb-1">SOZU</p>
              <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {notification.body}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 text-right tabular-nums">
                {new Date(notification.sentAt ?? notification.scheduledAt).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border bg-muted/10">
          <p className="text-[10px] text-muted-foreground text-center">
            En producción, el {isEmail ? "email" : "mensaje de WhatsApp"} se envía automáticamente al cliente.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreviewModal;
