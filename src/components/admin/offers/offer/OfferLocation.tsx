import { MapPin } from "lucide-react";

interface Props {
  location: { address: string; lat: number; lng: number; nearby: string[] };
}

const OfferLocation = ({ location }: Props) => {
  const mapSrc = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Ubicación</h3>
      </div>
      <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-3 bg-muted">
        <iframe
          src={mapSrc}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Mapa de ubicación"
        />
      </div>
      <p className="text-sm text-foreground mb-3">{location.address}</p>
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
        A poca distancia
      </p>
      <div className="flex flex-wrap gap-2">
        {location.nearby.map((n, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-medium"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
};

export default OfferLocation;
