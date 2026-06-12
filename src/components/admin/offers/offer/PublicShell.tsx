import sozuLogo from "@/assets/sozu-logo.png";
import type { Agent } from "@/lib/offers/agent-data";
import { Phone } from "lucide-react";
import AgentBadge from "./AgentBadge";

interface PublicShellProps {
  children: React.ReactNode;
  agent?: Agent;
  contactPhone?: string;
}

const PublicShell = ({ children, agent, contactPhone = "+52 33 3306 6660" }: PublicShellProps) => {
  const telHref = `tel:${contactPhone.replace(/\s+/g, "")}`;
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <img src={sozuLogo} alt="SOZU" className="h-7 w-auto dark:invert" />
          {agent ? (
            <AgentBadge agent={agent} />
          ) : (
            <a
              href={telHref}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden md:inline tabular-nums">{contactPhone}</span>
              <span className="md:hidden">Llamar</span>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card/40">
        <div className="max-w-5xl mx-auto px-4 py-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
            SOZU © 2026 · Esta oferta es informativa y no constituye contrato de compraventa.
            Sujeta a disponibilidad y validez vigente. Precios en MXN.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
