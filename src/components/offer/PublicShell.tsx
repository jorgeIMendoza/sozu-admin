import { Phone } from "lucide-react";
const sozuLogo = "/sozu-logo.png";
import type { Agent } from "@/lib/offer-types";
import { buildAgentWhatsAppLink } from "@/lib/offer-types";

interface Props {
  children: React.ReactNode;
  agent?: Agent;
  contactPhone?: string;
}

const PublicShell = ({ children, agent, contactPhone = "+52 33 3306 6660" }: Props) => {
  const telHref = `tel:${contactPhone.replace(/\s+/g, "")}`;
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <img src={sozuLogo} alt="SOZU" className="h-7 w-auto dark:invert" />
          {agent ? (
            <a
              href={buildAgentWhatsAppLink(agent)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 group"
            >
              <div className="relative">
                <img
                  src={agent.photoUrl}
                  alt={agent.fullName}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-card"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />
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

      <footer className="border-t border-border bg-card/40 mt-12">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
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
