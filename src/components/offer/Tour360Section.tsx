import { useState, useRef, useEffect } from "react";
import { Move, ScanEye } from "lucide-react";
import SectionCard from "./SectionCard";
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
    <SectionCard id="tour-360" icon={ScanEye} title="Recorre tu unidad" bodyClassName="p-0" className="scroll-mt-20">
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

    </SectionCard>
  );
};

export default Tour360Section;
