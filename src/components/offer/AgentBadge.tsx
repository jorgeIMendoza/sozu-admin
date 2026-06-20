import { useState } from "react";
import type { Agent } from "@/lib/offers/agent-data";
import { buildAgentWhatsAppLink, AGENT_PHOTO_FALLBACK } from "@/lib/offers/agent-data";

interface Props {
  agent: Agent;
  variant?: "compact" | "inline";
  showStatus?: boolean;
}

const AgentBadge = ({ agent, variant = "compact", showStatus = true }: Props) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const isLogo = !agent.photoUrl || photoFailed;

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 inline-flex items-center justify-center${isLogo ? " bg-muted/60" : ""}`}>
          <img
            src={agent.photoUrl || AGENT_PHOTO_FALLBACK}
            alt={agent.fullName}
            className={isLogo ? "w-[75%] h-[75%] object-contain dark:invert" : "w-full h-full object-cover"}
            onError={() => setPhotoFailed(true)}
          />
        </span>
        <span className="font-medium">{agent.firstName}</span>
      </span>
    );
  }

  return (
    <a
      href={buildAgentWhatsAppLink(agent)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 group"
    >
      <div className="relative">
        <div className={`w-9 h-9 rounded-full overflow-hidden ring-2 ring-card flex items-center justify-center${isLogo ? " bg-muted/60" : ""}`}>
          <img
            src={agent.photoUrl || AGENT_PHOTO_FALLBACK}
            alt={agent.fullName}
            className={isLogo ? "w-[65%] h-[65%] object-contain dark:invert" : "w-full h-full object-cover"}
            onError={() => setPhotoFailed(true)}
          />
        </div>
        {showStatus && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />
        )}
      </div>
      <div className="hidden md:flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Tu agente
        </span>
        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
          {agent.fullName}
        </span>
      </div>
    </a>
  );
};

export default AgentBadge;
