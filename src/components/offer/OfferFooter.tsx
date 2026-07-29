import sozuLogo from "@/assets/sozu-logo.png";
import type { OfertaComercial } from "@/lib/offers/offer-data";
import { LEGAL_LINKS } from "@/lib/legalUrls";

interface Props {
  offer: OfertaComercial;
  /** Clases extra en el <footer> (ej. margen para sticky CTA en mobile). */
  className?: string;
}

/**
 * Footer unificado de la oferta digital (sello empresarial, fondo oscuro).
 * Se reutiliza en la oferta pública y en el flujo de captura/pago para
 * mantener el mismo estándar visual.
 */
const OfferFooter = ({ offer, className = "" }: Props) => {
  return (
    <footer className={`bg-zinc-900 text-zinc-400 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Presentado por */}
        <div className="flex flex-col items-center text-center">
          <p className="text-[8px] uppercase tracking-[0.32em] font-semibold text-zinc-500 mb-4">
            Una oferta presentada por
          </p>
          <div className="flex items-center justify-center gap-6 md:gap-10">
            {offer.development?.developerName && (
              <>
                {/* Desarrolladora - clic → su sitio oficial; si no tiene, fallback SOZU */}
                <a
                  href={offer.development.developerWebsite ?? "https://www.sozu.com/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="h-6 md:h-7 flex items-center justify-center">
                    {offer.development.developerLogoUrl ? (
                      <img
                        src={offer.development.developerLogoUrl}
                        alt={offer.development.developerName}
                        className="h-5 md:h-6 w-auto object-contain brightness-0 invert"
                      />
                    ) : (
                      <span className="text-base md:text-lg font-bold text-white tracking-tight">
                        {offer.development.developerName}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide">
                    Desarrollador
                  </span>
                </a>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-px h-4 bg-zinc-700" />
                  <span className="text-[8px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">con</span>
                  <div className="w-px h-4 bg-zinc-700" />
                </div>
              </>
            )}
            {/* Comercializador SOZU - clic → sozu.com */}
            <a
              href="https://www.sozu.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-6 md:h-7 flex items-center justify-center">
                <img src={sozuLogo} alt="SOZU" className="h-5 md:h-6 w-auto object-contain brightness-0 invert" />
              </div>
              <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide">
                Comercializador
              </span>
            </a>
          </div>
        </div>

        {/* Enlaces legales (viven en el sitio corporativo de SOZU) */}
        <div className="mt-5 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {LEGAL_LINKS.map((l) => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-zinc-400 underline-offset-2 transition-colors hover:text-zinc-200 hover:underline"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Línea legal */}
        <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-center md:text-left">
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            SOZU © 2026 · Comercializador autorizado{offer.development ? ` de ${offer.development.legalName ?? offer.property.projectName}` : ""}. Oferta personal e intransferible.
          </p>
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            Oferta informativa · No constituye contrato de compraventa · Sujeta a disponibilidad · Precios en MXN
          </p>
        </div>
      </div>
    </footer>
  );
};

export default OfferFooter;
