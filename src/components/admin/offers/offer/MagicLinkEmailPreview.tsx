import { Mail, ArrowRight, Shield, Clock } from "lucide-react";
import sozuLogo from "@/assets/sozu-logo.png";
import type { Agent } from "@/lib/offers/agent-data";
import type { MagicLinkRequest } from "@/lib/offers/auth-data";

interface Props {
  request: MagicLinkRequest;
  agent?: Agent;
  recipientName?: string;
  baseUrl?: string;
}

const MagicLinkEmailPreview = ({ request, agent, recipientName, baseUrl }: Props) => {
  // Construir el link con el origen actual (en producción, dominio real)
  const origin = baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const magicLink = `${origin}/acceder/${request.token}`;

  const firstName = recipientName?.split(" ")[0] ?? "Hola";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm max-w-lg mx-auto">
      {/* Email header (como cliente de email) */}
      <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Vista previa del email</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {new Date(request.createdAt).toLocaleString("es-MX", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Email body */}
      <div className="p-6 space-y-5">
        {/* Brand bar */}
        <div className="flex items-center gap-2.5 pb-4 border-b border-border">
          <img src={sozuLogo} alt="SOZU" className="h-6 w-auto" />
        </div>

        {/* Greeting */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            {firstName}, aquí tienes tu link de acceso
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Recibimos tu solicitud para acceder a tu pre-apartado en SOZU. Toca el botón de abajo
            para ingresar a tu panel:
          </p>
        </div>

        {/* CTA principal */}
        <div className="space-y-3">
          <a
            href={magicLink}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-full"
          >
            Acceder a mi pre-apartado
            <ArrowRight className="w-4 h-4" />
          </a>

          <div className="text-center">
            <p className="text-[11px] text-muted-foreground mb-1.5">
              O copia este link en tu navegador:
            </p>
            <p className="text-[11px] text-muted-foreground font-mono break-all bg-muted/40 rounded-lg px-3 py-2">
              {magicLink}
            </p>
          </div>
        </div>

        {/* Info boxes */}
        <div className="grid grid-cols-2 gap-3">
          <InfoBox icon={Shield} title="Link único" description="Solo funciona una vez y es personal para ti." />
          <InfoBox icon={Clock} title="Expira en 30 min" description="Si se vence, puedes solicitar uno nuevo." />
        </div>

        {/* Agent signature */}
        {agent && (
          <div className="rounded-xl bg-muted/40 p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Si tienes cualquier duda, estoy aquí para ayudarte.
            </p>
            <div className="flex items-center gap-3">
              <img
                src={agent.photoUrl}
                alt={agent.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">{agent.fullName}</p>
                <p className="text-[11px] text-muted-foreground">{agent.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {agent.phone} · {agent.email}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Si no solicitaste este link, puedes ignorar este correo. No se realizará ninguna acción
            en tu cuenta. Este email fue enviado por SOZU desde una dirección no monitoreada.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-muted/40 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          SOZU &copy; 2026 &middot; Av. de Las Rosas 1297, Chapalita, Guadalajara, Jal.
        </p>
      </div>
    </div>
  );
};

const InfoBox = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
}) => (
  <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2.5">
    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-[11px] font-semibold text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

export default MagicLinkEmailPreview;
