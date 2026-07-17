import { Navigation, Clock, MapPin } from "lucide-react";
import SectionCard from "./SectionCard";
import type { ShowroomInfo } from "@/lib/offers/offer-data";

interface Props {
  location: { address: string; lat: number; lng: number; nearby: string[] };
  showroom?: ShowroomInfo | null;
}

const OfferLocation = ({ location, showroom }: Props) => {
  const mapSrc = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`;
  const mapsUrl = `https://maps.google.com/?q=${location.lat},${location.lng}`;
  const hasShowroom = !!showroom?.address;

  return (
    <SectionCard icon={MapPin} title="Ubicación" bodyClassName="p-4 md:p-5">
      <div className={`grid gap-4 ${hasShowroom ? "md:grid-cols-2" : ""}`}>

        {/* ── El desarrollo ── */}
        <div className="rounded-md border border-border overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">El desarrollo</p>
          </div>

          {/* Map - overflow hidden clips Google's "Abrir en Maps" button */}
          <div className="w-full aspect-[16/10] bg-muted overflow-hidden relative">
            <iframe
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de ubicación del desarrollo"
              style={{ position: "absolute", top: "-40px", left: 0, width: "100%", height: "calc(100% + 40px)", border: "none" }}
            />
          </div>

          <div className="px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-foreground leading-snug">{location.address}</p>
            {location.nearby.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1.5">
                  A poca distancia
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {location.nearby.map((n, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-medium">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex h-10 items-center justify-center gap-1.5 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              Cómo llegar
            </a>
          </div>
        </div>

        {/* ── Showroom de ventas ── */}
        {hasShowroom && showroom && (
          <div className="rounded-md border border-border overflow-hidden bg-card">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Showroom de ventas</p>
            </div>

            {showroom.googleMapsEmbedUrl ? (
              <div className="w-full aspect-[16/10] bg-muted overflow-hidden">
                <iframe
                  src={showroom.googleMapsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Mapa del showroom"
                  className="w-full h-full"
                  style={{ border: "none" }}
                />
              </div>
            ) : (
              <div className="w-full aspect-[16/10] bg-muted/40 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-muted-foreground/30" />
              </div>
            )}

            <div className="px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-foreground leading-snug">{showroom.address}</p>

              {showroom.schedule && showroom.schedule.length > 0 && (
                <div className="space-y-1">
                  {showroom.schedule.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0 text-primary/60" />
                      <span className="font-medium text-foreground">{s.daysLabel}:</span>
                      <span>{s.hours}</span>
                    </div>
                  ))}
                </div>
              )}

              {showroom.notes && (
                <p className="text-xs text-muted-foreground leading-relaxed">{showroom.notes}</p>
              )}

              <a
                href={showroom.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex h-10 items-center justify-center gap-1.5 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                {showroom.bookingCtaLabel ?? "Cómo llegar"}
              </a>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default OfferLocation;
