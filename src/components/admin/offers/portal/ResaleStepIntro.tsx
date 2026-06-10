import { TrendingUp, Sparkles, FileCheck2, ShieldCheck } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { getPropertyImage } from "@/lib/offers/property-images";
import { parseAreaM2 } from "@/lib/offers/resale-data";

interface ResaleStepIntroProps {
  property: InvestmentProperty;
  onNext: () => void;
}

const ResaleStepIntro = ({ property, onNext }: ResaleStepIntroProps) => {
  const { property: prop, financials } = property;
  const m2 = parseAreaM2(prop.area);
  const appreciationPct =
    ((financials.currentEstimatedValue - financials.initialPrice) /
      financials.initialPrice) *
    100;
  const pctDisplay = `+${appreciationPct.toFixed(1)}%`;
  const image = prop.image ?? getPropertyImage(prop.id);

  const benefits = [
    { icon: Sparkles, text: "Precio sugerido basado en datos reales del proyecto" },
    { icon: FileCheck2, text: "Contrato generado automáticamente con tus datos" },
    { icon: ShieldCheck, text: "Firma electrónica con validez legal (MIFIEL)" },
  ];

  return (
    <div className="px-5 py-6 space-y-6 animate-fade-in">
      {/* Property card */}
      <div className="rounded-2xl border border-border p-4 flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-xl bg-muted bg-cover bg-center flex-shrink-0"
          style={image ? { backgroundImage: `url(${image})` } : undefined}
        />
        <div className="min-w-0">
          <p className="font-display font-semibold text-base text-foreground truncate">
            {prop.projectName} · Unidad {prop.unitNumber}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {m2} m² · Entregado · Escriturado
          </p>
        </div>
      </div>

      {/* Plusvalía hero */}
      <div className="flex flex-col items-center text-center py-4">
        <div className="inline-flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-3">
          <TrendingUp className="w-3.5 h-3.5" />
          Plusvalía SOZU
        </div>
        <p className="font-display font-bold text-6xl text-primary tabular-nums leading-none">
          {pctDisplay}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          desde tu compra inicial
        </p>
      </div>

      {/* Headline */}
      <h2 className="font-display font-bold text-2xl text-foreground leading-tight">
        Tu departamento subió <span className="text-primary">{pctDisplay}</span>{" "}
        desde que lo compraste.
      </h2>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        Calculamos tu precio sugerido con los precios reales de las últimas
        unidades vendidas del proyecto. Si decides venderlo, generamos el
        contrato y lo firmas en línea, sin que salgas del portal.
      </p>

      {/* Benefits list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {benefits.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-start gap-3 px-4 py-3.5 border-b border-border/40 last:border-0"
          >
            <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-snug">{text}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="pt-2">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Ver mi precio sugerido
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
          Es gratis y no te compromete. El contrato lo firmas solo si aceptas el
          precio y los términos.
        </p>
      </div>
    </div>
  );
};

export default ResaleStepIntro;
