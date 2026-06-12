import { useState, useEffect } from "react";
import type { OfertaComercial } from "@/lib/offers/offer-data";

interface OfferStickyMiniHeaderProps {
  offer: OfertaComercial;
  /** Referencia al elemento que sirve como trigger (típicamente la galería principal) */
  triggerRef: React.RefObject<HTMLElement>;
}

/**
 * 18.11.E: Mini-header sticky simplificado.
 * Solo muestra el logo del desarrollo centrado, sin thumbnail/precio/CTA
 * (la versión del 18.11.C duplicaba el footer fijo).
 */
const OfferStickyMiniHeader = ({ offer, triggerRef }: OfferStickyMiniHeaderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [triggerRef]);

  const developmentLogoUrl = offer.development?.logoUrl;
  const developmentName = offer.property.projectName;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
      aria-hidden={!isVisible}
    >
      <div className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-11 flex items-center justify-center">
          {developmentLogoUrl && !logoLoadFailed ? (
            <img
              src={developmentLogoUrl}
              alt={developmentName}
              onError={() => setLogoLoadFailed(true)}
              className="h-6 md:h-7 w-auto object-contain"
            />
          ) : (
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-foreground/80">
              {developmentName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferStickyMiniHeader;
