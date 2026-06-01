import { MapPin, Clock, Navigation, Calendar, ExternalLink, Info } from "lucide-react";
import type { ShowroomInfo, Agent } from "@/lib/offer-types";
import { buildAgentWhatsAppLink } from "@/lib/offer-types";

interface Props {
  showroom: ShowroomInfo;
  developmentName: string;
  agent?: Agent;
}

const DevelopmentShowroomBlock = ({ showroom, developmentName, agent }: Props) => {
  const fullAddressLine = [showroom.city, showroom.state, showroom.zipCode, showroom.country]
    .filter(Boolean).join(", ");

  const bookingMessage = `Hola ${agent?.firstName ?? "equipo"}, me gustaría agendar una visita al showroom de ${developmentName}. ¿Qué días tienen disponibilidad esta semana?`;
  const bookingLink = agent ? buildAgentWhatsAppLink(agent, bookingMessage) : undefined;
  const scheduleNote = showroom.schedule?.find((s) => s.note)?.note;

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card overflow-hidden">
      {showroom.googleMapsEmbedUrl && (
        <div className="relative w-full aspect-[21/9] md:aspect-[16/9] bg-muted">
          <iframe
            src={showroom.googleMapsEmbedUrl}
            title={`Mapa del showroom ${developmentName}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
          />
        </div>
      )}
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">Visita el showroom</p>
            <p className="font-semibold text-base text-foreground">Showroom {developmentName}</p>
          </div>
        </div>

        <div className="mb-5 md:ml-12">
          <p className="text-sm text-foreground font-medium">{showroom.address}</p>
          {fullAddressLine && <p className="text-xs text-muted-foreground mt-0.5">{fullAddressLine}</p>}
        </div>

        {showroom.schedule && showroom.schedule.length > 0 && (
          <div className="md:ml-12 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Horarios</p>
            </div>
            <div className="space-y-1">
              {showroom.schedule.map((entry, idx) => (
                <div key={idx} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-foreground">{entry.daysLabel}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{entry.hours}</span>
                </div>
              ))}
            </div>
            {scheduleNote && <p className="text-[10px] text-muted-foreground mt-2 italic">{scheduleNote}</p>}
          </div>
        )}

        {showroom.notes && (
          <div className="md:ml-12 mb-5 flex items-start gap-2 p-3 rounded-lg bg-muted/40">
            <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{showroom.notes}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-2 md:ml-12">
          {bookingLink && (
            <a href={bookingLink} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              {showroom.bookingCtaLabel ?? "Agendar visita"}
            </a>
          )}
          <a href={showroom.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={`${bookingLink ? "flex-1" : "w-full"} h-11 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2`}>
            <Navigation className="w-4 h-4" />
            Cómo llegar
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentShowroomBlock;
