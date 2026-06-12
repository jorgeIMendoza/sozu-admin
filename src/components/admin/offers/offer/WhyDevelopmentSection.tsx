/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { Building2, Trophy, Quote, MapPin, Pencil, Sparkles, Hammer, Trees, Shield, Award } from "lucide-react";
import type { Developer, DevelopmentThesis } from "@/lib/offers/offer-data";

interface WhyDevelopmentSectionProps {
  developer: Developer;
  thesis: DevelopmentThesis[];
  developmentName: string;
}

const ICON_MAP: Record<string, typeof MapPin> = {
  MapPin, Pencil, Sparkles, Hammer, Trees, Shield, Award, Building2,
};

const WhyDevelopmentSection = ({ developer, thesis, developmentName }: WhyDevelopmentSectionProps) => {
  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">¿Por qué {developmentName}?</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
          Lo que hace este proyecto diferente — y por qué eso importa para tu decisión.
        </p>
      </div>

      <div className="p-5 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          {developer.logoUrl && (
            <div className="flex-shrink-0">
              <img src={developer.logoUrl} alt={developer.name} className="h-14 md:h-16 w-auto object-contain" loading="lazy" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Desarrollado por</p>
            <h4 className="text-base font-bold text-foreground mb-1">{developer.name}</h4>
            {developer.description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{developer.description}</p>
            )}
          </div>
          <div className="flex md:flex-col gap-4 md:gap-2 md:items-end md:text-right md:flex-shrink-0">
            <div>
              <p className="text-xl md:text-2xl font-bold text-foreground tabular-nums leading-none">{developer.projectsDelivered}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Proyectos<br className="hidden md:inline" /> entregados</p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-foreground tabular-nums leading-none">{developer.yearsActive}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Años de<br className="hidden md:inline" /> experiencia</p>
            </div>
          </div>
        </div>

        {developer.founderQuote && (
          <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Quote className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs md:text-sm text-foreground/85 italic leading-relaxed mb-3">"{developer.founderQuote}"</p>
                <div className="flex items-center gap-3">
                  {developer.founderPhotoUrl && (
                    <img src={developer.founderPhotoUrl} alt={developer.founderName ?? ""} className="w-10 h-10 rounded-full object-cover flex-shrink-0" loading="lazy" />
                  )}
                  <div>
                    {developer.founderName && <p className="text-xs font-bold text-foreground">{developer.founderName}</p>}
                    {developer.founderTitle && <p className="text-[10px] text-muted-foreground">{developer.founderTitle}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {thesis.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Tres razones para considerarlo</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {thesis.map((t, idx) => {
                const Icon = ICON_MAP[t.iconName] ?? Sparkles;
                return (
                  <div key={idx} className="rounded-xl bg-muted/20 border border-border p-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h5 className="text-xs font-bold text-foreground mb-1.5 leading-snug">{t.title}</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{t.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default WhyDevelopmentSection;
