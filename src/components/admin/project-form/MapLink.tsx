import { Map, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";

interface MapLinkProps {
  lat: number;
  lng: number;
  /** Callback opcional tras copiar (ej. mostrar toast). */
  onCopy?: () => void;
}

/**
 * Fila clickeable que abre las coordenadas en Google Maps. Compartida por
 * Ubicación del proyecto y Showrooms. El icono de mapa (verde) + las coordenadas
 * comunican por sí mismos la acción; no requiere título ni botón aparte.
 */
export const MapLink = ({ lat, lng, onCopy }: MapLinkProps) => (
  <a
    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-green-600/50 hover:bg-green-600/5"
  >
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-600/10 text-green-600 transition-transform group-hover:scale-105">
        <Map className="h-4 w-4" />
      </span>
      <span className="truncate text-sm tabular-nums text-foreground">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </span>
    </span>
    <IconTooltip label="Copiar coordenadas">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label="Copiar coordenadas"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard?.writeText(`${lat}, ${lng}`);
          onCopy?.();
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </IconTooltip>
  </a>
);

export default MapLink;
