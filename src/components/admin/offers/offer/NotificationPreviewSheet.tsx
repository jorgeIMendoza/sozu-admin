import { useState, useEffect } from "react";
import { X, Mail, MessageCircle } from "lucide-react";
import type { NotificationTemplate, TemplateContext } from "@/lib/offers/notification-templates";
import { renderTemplate } from "@/lib/offers/notification-templates";
import EmailNotificationPreview from "./EmailNotificationPreview";
import WhatsAppBubblePreview from "./WhatsAppBubblePreview";
import type { Agent } from "@/lib/offers/agent-data";

interface Props {
  open: boolean;
  onClose: () => void;
  template: NotificationTemplate;
  context: TemplateContext;
  agent?: Agent;
  recipientEmail: string;
  recipientPhone: string;
  sentAt: string;
}

const NotificationPreviewSheet = ({
  open,
  onClose,
  template,
  context,
  agent,
  recipientEmail,
  recipientPhone,
  sentAt,
}: Props) => {
  const hasEmail = template.channels.includes("email");
  const hasWhatsApp = template.channels.includes("whatsapp");
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">(
    hasEmail ? "email" : "whatsapp"
  );

  useEffect(() => {
    if (open) setActiveTab(hasEmail ? "email" : "whatsapp");
  }, [open, hasEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subject = renderTemplate(template.email.subject, context);
  const preheader = template.email.preheader
    ? renderTemplate(template.email.preheader, context)
    : undefined;
  const emailBody = renderTemplate(template.email.body, context);
  const ctaLabel = renderTemplate(template.email.ctaLabel, context);
  const ctaUrl = renderTemplate(template.email.ctaPath, context);
  const whatsappBody = renderTemplate(template.whatsapp.body, context);
  const quickReplies = template.whatsapp.quickReplies?.map((q) => renderTemplate(q, context));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-xl bg-card md:rounded-2xl rounded-t-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Notificación enviada
            </p>
            <h2 className="text-base font-semibold text-foreground mt-0.5">{template.label}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {hasEmail && hasWhatsApp && (
          <div className="px-5 pt-3">
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setActiveTab("email")}
                className={`flex-1 h-9 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "email"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
              <button
                onClick={() => setActiveTab("whatsapp")}
                className={`flex-1 h-9 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "whatsapp"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "email" && hasEmail && (
            <EmailNotificationPreview
              agent={agent}
              recipientEmail={recipientEmail}
              subject={subject}
              preheader={preheader}
              body={emailBody}
              ctaLabel={ctaLabel}
              ctaUrl={ctaUrl}
              sentAt={sentAt}
            />
          )}

          {activeTab === "whatsapp" && hasWhatsApp && (
            <WhatsAppBubblePreview
              agent={agent}
              recipientPhone={recipientPhone}
              messageBody={whatsappBody}
              quickReplies={quickReplies}
              sentAt={sentAt}
            />
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            En el demo no se envían mensajes reales. En producción esta notificación se envía
            automáticamente vía SendGrid (email) y Twilio (WhatsApp).
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreviewSheet;
