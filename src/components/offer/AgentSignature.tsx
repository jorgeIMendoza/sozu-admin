import type { Agent } from "@/lib/offer-types";

interface Props {
  agent: Agent;
  label?: string;
}

const AgentSignature = ({ agent, label = "Atendido personalmente por" }: Props) => (
  <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
    <img
      src={agent.photoUrl}
      alt={agent.fullName}
      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
    />
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground leading-tight">{agent.fullName}</p>
      <p className="text-xs text-muted-foreground leading-tight">{agent.title}</p>
    </div>
    {agent.brokerage && (
      <div className="hidden sm:flex flex-col items-end text-right">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
          {agent.isAllied ? "Agente aliado" : "Equipo"}
        </span>
        <span className="text-xs font-semibold text-foreground">{agent.brokerage}</span>
      </div>
    )}
  </div>
);

export default AgentSignature;
