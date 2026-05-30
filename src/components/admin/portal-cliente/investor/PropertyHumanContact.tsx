import { MessageCircle, Phone, Mail, User } from "lucide-react";
import { useAgentForCuenta } from "@/lib/portal-cliente/agent-data";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";

interface Props {
  investment: InvestmentProperty;
  role: "agent" | "administrator";
}

const PropertyHumanContact = ({ investment, role }: Props) => {
  const { property } = investment;
  const tipo = role === "agent" ? "comercial" : "seguimiento";
  const { data: contact } = useAgentForCuenta(property.id, tipo);

  const sectionTitle =
    role === "agent" ? "Tu agente comercial" : "Tu asesor de seguimiento";

  if (!contact) {
    return (
      <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            {sectionTitle}
          </h2>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Tu {role === "agent" ? "agente comercial" : "asesor de seguimiento"} se asignará próximamente.
        </p>
      </section>
    );
  }

  const roleDescription =
    role === "agent"
      ? "Te acompaña durante el proceso de compra."
      : "Da seguimiento a tus pagos y la administración de tu propiedad.";

  const subjectLabel = `${property.projectName} U-${property.unitNumber}`;
  const waMsg =
    role === "agent"
      ? `Hola ${contact.firstName}, tengo una pregunta sobre mi propiedad ${subjectLabel}.`
      : `Hola ${contact.firstName}, tengo una pregunta sobre la administración de mi propiedad ${subjectLabel}.`;

  const waLink = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(waMsg)}`;
  const phoneLink = `tel:${contact.phone.replace(/\s/g, "")}`;
  const emailLink = `mailto:${contact.email}?subject=${encodeURIComponent(
    `Sobre ${subjectLabel}`,
  )}`;

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          {sectionTitle}
        </h2>
      </div>

      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
          <img
            src={contact.photoUrl}
            alt={contact.fullName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold font-display text-foreground leading-tight">
            {contact.fullName}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">{contact.title}</p>
          <p className="text-[12px] text-foreground/80 mt-1.5 leading-snug">{roleDescription}</p>
          {contact.responseTimeAvg && (
            <p className="text-[11px] text-success mt-1.5 font-medium">
              ● {contact.responseTimeAvg}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 rounded-lg bg-success text-success-foreground text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-success/90 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </a>
        <a
          href={phoneLink}
          className="h-10 rounded-lg border border-border bg-background text-foreground text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          Llamar
        </a>
        <a
          href={emailLink}
          className="h-10 rounded-lg border border-border bg-background text-foreground text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          Email
        </a>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground text-center">
        {contact.phone} · {contact.email}
      </p>
    </section>
  );
};

export default PropertyHumanContact;
