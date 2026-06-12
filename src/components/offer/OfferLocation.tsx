import { MapPin, Navigation } from "lucide-react";

interface Props {
  location: { address: string; lat: number; lng: number; nearby: string[] };
}

const OfferLocation = ({ location }: Props) => {
  const mapSrc = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`;
  const mapsUrl = `https://maps.google.com/?q=${location.lat},${location.lng}`;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Label strip */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">Ubicación</h3>
      </div>

      {/* Map — overflow hidden clips Google's "Abrir en Maps" button */}
      <div className="w-full aspect-[21/9] bg-muted overflow-hidden relative">
        <iframe
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Mapa de ubicación"
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

      {/* Info strip */}
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground mb-2.5 leading-snug">
            {location.address}
          </p>
          {location.nearby.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1.5">
                A poca distancia
              </p>
              <div className="flex flex-wrap gap-1.5">
                {location.nearby.map((n, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-medium"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto shrink-0 h-10 flex items-center justify-center gap-1.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
          Cómo llegar
        </a>
      </div>
    </div>
  );
};

export default OfferLocation;
