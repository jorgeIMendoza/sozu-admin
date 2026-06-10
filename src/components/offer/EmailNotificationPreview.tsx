import { Mail, ArrowRight } from "lucide-react";
import sozuLogo from "@/assets/sozu-logo.png";
import type { Agent } from "@/lib/offers/agent-data";

interface Props {
  agent?: Agent;
  recipientEmail: string;
  subject: string;
  preheader?: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  sentAt: string;
}

const EmailNotificationPreview = ({
  agent,
  recipientEmail,
  subject,
  preheader,
  body,
  ctaLabel,
  ctaUrl,
  sentAt,
}: Props) => {
  const senderName = agent ? `${agent.firstName} desde SOZU` : "SOZU";
  const senderEmail = "no-reply@sozu.mx";

  const renderBody = (text: string) => {
    const paragraphs = text.split("\n\n");
    return paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      const isHeader = /^\*\*(.+)\*\*$/.test(trimmed);

      if (isHeader) {
        const content = trimmed.replace(/^\*\*(.+)\*\*$/, "$1");
        return (
          <p
            key={idx}
            className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mt-5 mb-1"
          >
            {content}
          </p>
        );
      }

      const segments = para.split(/(\*\*[^*]+\*\*)/);
      return (
        <p
          key={idx}
          className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-wrap"
        >
          {segments.map((seg, i) =>
            /^\*\*[^*]+\*\*$/.test(seg) ? (
              <strong key={i} className="font-semibold">
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={i}>{seg}</span>
            )
          )}
        </p>
      );
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Email meta header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Vista previa del email
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(sentAt).toLocaleString("es-MX", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="space-y-1">
          <Row label="De" value={`${senderName} <${senderEmail}>`} />
          <Row label="Para" value={recipientEmail} />
          <Row label="Asunto" value={subject} bold />
          {preheader && <Row label="Preview" value={preheader} dim />}
        </div>
      </div>

      {/* Email body */}
      <div className="bg-background">
        <div className="px-6 pt-6 pb-2">
          <img src={sozuLogo} alt="SOZU" className="h-6 dark:invert" />
        </div>

        <div className="px-6 py-4">
          {renderBody(body)}

          {/* CTA */}
          <div className="my-6">
            <a
              href={ctaUrl}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-muted-foreground mt-3">
              O abre este link en tu navegador:
            </p>
            <p className="text-[11px] text-primary break-all font-mono">
              {typeof window !== "undefined" ? window.location.origin : ""}
              {ctaUrl}
            </p>
          </div>

          {/* Firma del agente */}
          {agent && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="flex items-center gap-3">
                <img
                  src={agent.photoUrl}
                  alt={agent.fullName}
                  className="w-11 h-11 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{agent.fullName}</p>
                  <p className="text-xs text-muted-foreground">{agent.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {agent.phone} · {agent.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-6 pt-4 border-t border-border">
            Recibiste este email porque tienes un pre-apartado activo con SOZU. Si no deseas
            recibir más comunicaciones, puedes cancelar tu pre-apartado desde tu panel.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            SOZU © 2026 · Av. de Las Rosas 1297, Chapalita, Guadalajara, Jal.
          </p>
        </div>
      </div>
    </div>
  );
};

const Row = ({
  label,
  value,
  bold,
  dim,
}: {
  label: string;
  value: string;
  bold?: boolean;
  dim?: boolean;
}) => (
  <div className="flex gap-2 text-[11px]">
    <span className="text-muted-foreground w-14 flex-shrink-0">{label}:</span>
    <span
      className={`flex-1 min-w-0 break-words ${
        bold ? "font-semibold text-foreground" : dim ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {value}
    </span>
  </div>
);

export default EmailNotificationPreview;
