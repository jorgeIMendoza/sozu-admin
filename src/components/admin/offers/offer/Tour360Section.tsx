import { useState, useRef, useEffect } from "react";
import { Maximize2, Move, ExternalLink, Sparkles } from "lucide-react";
import type { Tour360 } from "@/lib/offers/offer-data";

interface Tour360SectionProps {
  tour: Tour360;
  developmentName: string;
  propertyLabel: string;
}

const Tour360Section = ({ tour, developmentName, propertyLabel }: Tour360SectionProps) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || hasInteracted) return;
    const node = containerRef.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasInteracted) {
          setShowInstructions(true);
          timeout = setTimeout(() => setShowInstructions(false), 5000);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timeout) clearTimeout(timeout);
    };
  }, [hasInteracted]);

  const handleInteract = () => {
    setHasInteracted(true);
    setShowInstructions(false);
  };

  return (
    <section id="recorrido-360" className="scroll-mt-20">
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Recorre tu unidad</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
                Recorre cada espacio de {developmentName} · {propertyLabel} como si estuvieras adentro.
                {tour.durationEstimate ? ` Toma ${tour.durationEstimate}.` : ""}
              </p>
            </div>
            <a
              href={tour.fallbackUrl ?? tour.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              Abrir en pantalla completa
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div ref={containerRef} className="relative bg-foreground" onMouseDown={handleInteract} onTouchStart={handleInteract}>
          <div className="aspect-video w-full">
            <iframe
              src={tour.embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              loading="lazy"
              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
              allowFullScreen
              scrolling="no"
              title={`Recorrido 360° de ${developmentName} · ${propertyLabel}`}
              className="w-full h-full"
            />
          </div>

          {showInstructions && (
            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 bg-foreground/85 backdrop-blur-md text-background px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
              <Move className="w-3.5 h-3.5" />
              Arrastra para girar · Toca los puntos para moverte
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-subtle bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Maximize2 className="w-3 h-3" />
            Activa pantalla completa o modo VR desde los controles del recorrido
          </p>
          <a
            href={tour.fallbackUrl ?? tour.embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="md:hidden text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            Abrir aparte
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Tour360Section;
