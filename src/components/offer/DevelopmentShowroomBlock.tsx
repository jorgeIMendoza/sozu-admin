import { MapPin, Clock, Calendar, Info, Navigation, ExternalLink } from "lucide-react";
import type { ShowroomInfo } from "@/lib/offers/offer-data";
import type { Agent } from "@/lib/offers/agent-data";
import { buildAgentWhatsAppLink } from "@/lib/offers/agent-data";

interface Props {
  showroom: ShowroomInfo;
  developmentName: string;
  agent?: Agent;
}

const DevelopmentShowroomBlock = ({ showroom, developmentName, agent }: Props) => {
  const cityLine =
    showroom.city || showroom.state
      ? `${showroom.city ?? ""}${showroom.state ? `, ${showroom.state}` : ""}${
          showroom.zipCode ? ` C.P. ${showroom.zipCode}` : ""
        }`
      : "";

  const bookingMessage = `Hola ${
    agent?.firstName ?? "equipo"
  }, me gustaría agendar una visita al showroom de ${developmentName}. ¿Qué días tienen disponibilidad esta semana?`;

  const bookingLink = agent ? buildAgentWhatsAppLink(agent, bookingMessage) : undefined;
  const scheduleNote = showroom.schedule?.find((s) => s.note)?.note;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">

      {/* ── Header — showroom identity ── */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.24em] font-bold text-primary mb-1">
              Showroom · Visita en persona
            </p>
            <h4 className="text-base font-bold text-foreground leading-tight truncate">
              {developmentName}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{cityLine || showroom.address}</span>
            </p>
          </div>

        </div>
      </div>

      {/* ── Body: info left, map right ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[55fr_45fr] gap-0">

        {/* Info */}
        <div className="p-4 space-y-3">
          {/* Full address */}
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground leading-snug">{showroom.address}</p>
            {cityLine && (
              <p className="text-xs text-muted-foreground">{cityLine}</p>
            )}
          </div>

          {/* Schedule */}
          {showroom.schedule && showroom.schedule.length > 0 && (
            <div className="rounded-lg bg-muted/30 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3 text-primary" />
                <p className="text-[9.5px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                  Horarios de atención
                </p>
              </div>
              {showroom.schedule.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{entry.daysLabel}</span>
                  <span className="font-semibold text-foreground tabular-nums">{entry.hours}</span>
                </div>
              ))}
              {scheduleNote && (
                <p className="text-[10px] text-muted-foreground mt-1.5 italic border-t border-border/40 pt-1.5">
                  {scheduleNote}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {showroom.notes && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
              <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">{showroom.notes}</p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {bookingLink && (
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <Calendar className="w-3.5 h-3.5" />
                {showroom.bookingCtaLabel ?? "Agendar visita"}
              </a>
            )}
            <a
              href={showroom.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:border-foreground/30 hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Navigation className="w-3.5 h-3.5" />
              Cómo llegar
              <ExternalLink className="w-3 h-3 opacity-40" />
            </a>
          </div>
        </div>

        {/* Map — overflow hidden clips Google's "Abrir en Maps" button */}
        {showroom.googleMapsEmbedUrl && (
          <div className="relative h-[210px] sm:h-full min-h-[210px] bg-muted border-t sm:border-t-0 sm:border-l border-border overflow-hidden">
            <iframe
              src={
                showroom.googleMapsEmbedUrl.includes("output=embed")
                  ? showroom.googleMapsEmbedUrl
                  : `${showroom.googleMapsEmbedUrl}&output=embed`
              }
              title={`Mapa showroom ${developmentName}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                position: "absolute",
                top: "-40px",
                left: 0,
                width: "100%",
                height: "calc(100% + 40px)",
                border: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DevelopmentShowroomBlock;
