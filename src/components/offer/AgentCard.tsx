import { MessageCircle, Phone, Mail, Languages, Award, Building2, Clock, Check } from "lucide-react";
import type { Agent } from "@/lib/offer-types";
import { buildAgentWhatsAppLink, buildAgentPhoneLink, buildAgentEmailLink } from "@/lib/offer-types";

interface Props {
  agent: Agent;
  offerId?: string;
  offerLabel?: string;
}

const AgentCard = ({ agent, offerId, offerLabel }: Props) => {
  const whatsappMsg = offerId
    ? `Hola ${agent.firstName}, tengo interés en la oferta ${offerId}${offerLabel ? ` (${offerLabel})` : ""}.`
    : undefined;

  const credentials: { icon: typeof Award; label: string }[] = [];
  if (agent.yearsExperience) {
    credentials.push({ icon: Award, label: `${agent.yearsExperience} año${agent.yearsExperience === 1 ? "" : "s"} de experiencia` });
  }
  if (agent.unitsManagedInProject) {
    credentials.push({ icon: Building2, label: `${agent.unitsManagedInProject} unidades vendidas en este desarrollo` });
  }
  if (agent.languages?.length) {
    credentials.push({ icon: Languages, label: agent.languages.join(" · ") });
  }
  if (agent.responseTimeAvg) {
    credentials.push({ icon: Clock, label: agent.responseTimeAvg });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="bg-primary/10 border-b border-primary/20 px-5 py-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">
          Tu agente está acompañándote
        </p>
      </div>

      <div className="p-5 md:p-6">
        <div className="flex flex-row gap-4 md:gap-5">
          <div className="flex-shrink-0">
            <img
              src={agent.photoUrl}
              alt={agent.fullName}
              className="w-20 h-20 md:w-32 md:h-32 rounded-xl object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg md:text-xl font-bold leading-tight">{agent.fullName}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{agent.title}</p>
            {agent.brokerage && (
              <div className="mt-3 inline-flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-border bg-background/60 backdrop-blur-sm">
                {agent.brokerageLogo ? (
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-card ring-1 ring-border overflow-hidden">
                    <img src={agent.brokerageLogo} alt={agent.brokerage} className="w-5 h-5 object-contain dark:invert" />
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold uppercase tracking-wide text-[9px]">
                    {agent.isAllied ? "Aliado" : "Equipo"}
                  </span>
                )}
                <div className="flex flex-col leading-none">
                  <span className="text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                    {agent.isAllied ? "Agente aliado" : "Equipo"}
                  </span>
                  <span className="text-xs font-bold text-foreground mt-0.5">{agent.brokerage}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {agent.bio && (
          <p className="mt-5 text-sm italic text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-3">
            "{agent.bio}"
          </p>
        )}

        {credentials.length > 0 && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {credentials.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{c.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {agent.specialization && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              <span className="font-semibold">Especialidad:</span> {agent.specialization}
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <a
            href={buildAgentWhatsAppLink(agent, whatsappMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
          <a
            href={buildAgentPhoneLink(agent)}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border text-[13px] font-semibold hover:bg-muted transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Llamar
          </a>
          <a
            href={buildAgentEmailLink(agent, offerId ? `Consulta sobre ${offerId}` : undefined)}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border text-[13px] font-semibold hover:bg-muted transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </a>
        </div>

        <p className="mt-3 text-[11px] text-center text-muted-foreground tabular-nums">
          {agent.phone} · {agent.email}
        </p>
      </div>
    </div>
  );
};

export default AgentCard;
