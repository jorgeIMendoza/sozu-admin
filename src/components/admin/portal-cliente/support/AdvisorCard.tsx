import { Phone } from "lucide-react";
import type { Advisor, SupportContext } from "@/lib/portal-cliente/advisor-data";
import { buildContextualWhatsAppMessage, buildWhatsAppLink } from "@/lib/portal-cliente/advisor-data";

interface AdvisorCardProps {
  advisor: Advisor;
  context: SupportContext;
  variant?: "compact" | "expanded";
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const AdvisorCard = ({ advisor, context, variant = "compact" }: AdvisorCardProps) => {
  const waMessage = buildContextualWhatsAppMessage(context, advisor.name);
  const waLink = buildWhatsAppLink(advisor, waMessage);
  const telLink = `tel:${advisor.phoneNumber.replace(/\s/g, "")}`;
  const isExpanded = variant === "expanded";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className={`${
            isExpanded ? "w-14 h-14 text-base" : "w-11 h-11 text-sm"
          } rounded-full bg-primary/10 text-primary font-display font-semibold flex items-center justify-center flex-shrink-0`}
        >
          {advisor.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Tu asesor en esta fase
          </p>
          <p className="font-display font-semibold text-sm text-foreground leading-tight mt-0.5">
            {advisor.name}
          </p>
          <p className="text-xs text-muted-foreground">{advisor.role}</p>
          {isExpanded && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {advisor.availability}
            </p>
          )}
        </div>
      </div>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-11 rounded-xl bg-success text-success-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-success/90 transition-colors active:scale-[0.98]"
      >
        <WhatsAppIcon className="w-4 h-4" />
        Contactar por WhatsApp
      </a>

      {isExpanded && (
        <a
          href={telLink}
          className="w-full h-9 rounded-lg text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          O llama al {advisor.phoneNumber}
        </a>
      )}
    </div>
  );
};

export default AdvisorCard;
