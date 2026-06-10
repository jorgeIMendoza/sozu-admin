/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { Users, Award, BadgeCheck, Quote } from "lucide-react";
import type { SalesMetrics, Testimonial, DevelopmentRecognition } from "@/lib/offers/offer-data";

interface SocialProofSectionProps {
  metrics?: SalesMetrics;
  testimonials?: Testimonial[];
  recognitions?: DevelopmentRecognition[];
  developmentName: string;
}

const SocialProofSection = ({ metrics, testimonials, recognitions, developmentName }: SocialProofSectionProps) => {
  const hasMetrics = metrics && metrics.totalUnits > 0;
  const hasTestimonials = testimonials && testimonials.length > 0;
  const hasRecognitions = recognitions && recognitions.length > 0;

  if (!hasMetrics && !hasTestimonials && !hasRecognitions) return null;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Otros ya confiaron en {developmentName}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
          Familias e inversionistas que ya hicieron este camino antes que tú.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {hasMetrics && metrics && <SalesMetricsCard metrics={metrics} />}
        {hasTestimonials && testimonials && <TestimonialsCarousel testimonials={testimonials} />}
        {hasRecognitions && recognitions && <RecognitionsList recognitions={recognitions} />}
      </div>
    </section>
  );
};

const SalesMetricsCard = ({ metrics }: { metrics: SalesMetrics }) => {
  const soldPercent = Math.round((metrics.soldUnits / metrics.totalUnits) * 100);
  return (
    <div className="rounded-xl bg-muted/20 border border-border p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avance de comercialización</p>
        {metrics.unitsSoldLast6Months !== undefined && metrics.unitsSoldLast6Months > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
            {metrics.unitsSoldLast6Months} vendidas · últimos 6 meses
          </span>
        )}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-bold text-foreground tabular-nums">{metrics.soldUnits} de {metrics.totalUnits} unidades vendidas</p>
          <p className="text-xs text-muted-foreground tabular-nums">{soldPercent}%</p>
        </div>
        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${soldPercent}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
        <div>
          <p className="text-base font-bold text-foreground tabular-nums">{metrics.soldUnits}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendidas</p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground tabular-nums">{metrics.reservedUnits}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Apartadas</p>
        </div>
        <div>
          <p className="text-base font-bold text-primary tabular-nums">{metrics.availableUnits}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Disponibles</p>
        </div>
      </div>
    </div>
  );
};

const TestimonialsCarousel = ({ testimonials }: { testimonials: Testimonial[] }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Lo que dicen quienes ya viven aquí</p>
    <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible snap-x snap-mandatory">
      {testimonials.map((t) => <TestimonialCard key={t.id} testimonial={t} />)}
    </div>
  </div>
);

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => {
  const formattedDate = new Date(testimonial.date).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return (
    <div className="rounded-xl bg-muted/20 border border-border p-4 min-w-[280px] md:min-w-0 snap-start flex flex-col">
      <Quote className="w-4 h-4 text-primary/50 mb-2 flex-shrink-0" />
      <p className="text-[11px] text-foreground/85 italic leading-relaxed mb-4 flex-1">"{testimonial.quote}"</p>
      <div className="flex items-center gap-3 pt-3 border-t border-border">
        {testimonial.authorPhotoUrl ? (
          <img src={testimonial.authorPhotoUrl} alt={testimonial.authorName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-foreground truncate">{testimonial.authorName}</p>
            {testimonial.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {testimonial.unitBought ? `Unidad ${testimonial.unitBought} · ` : ""}{formattedDate}
          </p>
        </div>
      </div>
    </div>
  );
};

const RecognitionsList = ({ recognitions }: { recognitions: DevelopmentRecognition[] }) => (
  <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4">
    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-3">Reconocimientos</p>
    <div className="space-y-2">
      {recognitions.map((rec) => (
        <div key={rec.id} className="flex items-start gap-2.5">
          <Award className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">{rec.title}</p>
            <p className="text-[10px] text-muted-foreground">{rec.awardedBy} · {rec.year}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SocialProofSection;
