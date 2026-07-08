import { useState } from "react";
import {
  MessageCircle,
  Phone,
  Mail,
  Languages,
  Award,
  Building2,
  Clock,
  Check,
  BadgeCheck,
} from "lucide-react";
import type { Agent } from "@/lib/offers/agent-data";
import {
  buildAgentWhatsAppLink,
  buildAgentPhoneLink,
  buildAgentEmailLink,
  AGENT_PHOTO_FALLBACK,
} from "@/lib/offers/agent-data";

interface Props {
  agent: Agent;
  offerId?: string;
  offerLabel?: string;
}

const AgentCard = ({ agent, offerId, offerLabel }: Props) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const hasPersonPhoto = !!agent.photoUrl && !photoFailed;
  const ctaCount = [agent.whatsapp, agent.phone, agent.email].filter(Boolean).length || 1;
  const whatsappMsg = offerId
    ? `Hola ${agent.firstName}, tengo interés en la oferta ${offerId}${
        offerLabel ? ` (${offerLabel})` : ""
      }.`
    : undefined;

  const credentials: { icon: typeof Award; label: string }[] = [];
  if (agent.yearsExperience) {
    credentials.push({
      icon: Award,
      label: `${agent.yearsExperience} año${agent.yearsExperience === 1 ? "" : "s"} de experiencia`,
    });
  }
  if (agent.unitsManagedInProject) {
    credentials.push({
      icon: Building2,
      label: `${agent.unitsManagedInProject} unidades vendidas en este desarrollo`,
    });
  }
  if (agent.languages && agent.languages.length > 0) {
    credentials.push({ icon: Languages, label: agent.languages.join(" · ") });
  }
  if (agent.responseTimeAvg) {
    credentials.push({ icon: Clock, label: agent.responseTimeAvg });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header con indicador "en línea" */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-success/15 via-success/8 to-transparent border-b border-success/20 px-5 py-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-success">
          Tu agente está acompañándote
        </p>
      </div>

      <div className="p-5 md:p-6">
        <div className="flex gap-4 md:gap-5">
          {/* Foto */}
          <div className="flex-shrink-0 w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-white ring-2 ring-success/20 shadow-sm flex items-center justify-center">
            {hasPersonPhoto ? (
              <img
                src={agent.photoUrl!}
                alt={agent.fullName}
                className="w-full h-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <img src={AGENT_PHOTO_FALLBACK} alt="SOZU" className="w-4/5 object-contain" />
            )}
          </div>

          {/* Identidad */}
          <div className="min-w-0 flex-1 self-center">
            <h3 className="text-lg md:text-xl font-bold leading-tight">{agent.fullName}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{agent.title}</p>
            {agent.brokerage && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full border border-success/30 bg-success/5">
                {agent.brokerageLogo ? (
                  <img
                    src={agent.brokerageLogo}
                    alt={agent.brokerage}
                    className="w-4 h-4 object-contain dark:invert"
                  />
                ) : (
                  <BadgeCheck className="w-3.5 h-3.5 text-success" />
                )}
                <span className="text-xs font-semibold text-foreground">
                  {agent.isAllied ? `Aliado · ${agent.brokerage}` : `Equipo ${agent.brokerage}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {agent.bio && (
          <div className="mt-5 rounded-xl bg-muted/40 border-l-2 border-success/50 px-4 py-3">
            <p className="text-sm italic text-muted-foreground leading-relaxed">"{agent.bio}"</p>
          </div>
        )}

        {/* Credentials grid */}
        {credentials.length > 0 && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {credentials.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{c.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Specialization */}
        {agent.specialization && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              <span className="font-semibold">Especialidad:</span> {agent.specialization}
            </p>
          </div>
        )}

        {/* CTAs — solo los que tienen dato (evita links muertos tel:/wa.me/) */}
        <div
          className="mt-5 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${ctaCount}, minmax(0, 1fr))` }}
        >
          {agent.whatsapp && (
            <a
              href={buildAgentWhatsAppLink(agent, whatsappMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-success text-success-foreground text-xs font-semibold shadow-sm hover:bg-success/90 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
          {agent.phone && (
            <a
              href={buildAgentPhoneLink(agent)}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-background text-xs font-semibold hover:bg-muted hover:border-success/40 transition-colors"
            >
              <Phone className="w-4 h-4 text-success" />
              Llamar
            </a>
          )}
          {agent.email && (
            <a
              href={buildAgentEmailLink(agent, offerId ? `Consulta sobre ${offerId}` : undefined)}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-background text-xs font-semibold hover:bg-muted hover:border-success/40 transition-colors"
            >
              <Mail className="w-4 h-4 text-success" />
              Email
            </a>
          )}
        </div>

        {(agent.phone || agent.email) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {agent.phone && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Phone className="w-3 h-3" /> {agent.phone}
              </span>
            )}
            {agent.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {agent.email}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
