import type { InvestmentProperty } from "@/lib/offers/mock-data";
import {
  type ResaleScenario,
  type ScenarioId,
  getProjectGrowthData,
  parseAreaM2,
} from "@/lib/offers/resale-data";
import { fmtMXN } from "@/lib/utils";

interface ResaleStepPricingProps {
  property: InvestmentProperty;
  scenarios: ResaleScenario[];
  selectedScenarioId: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  onNext: () => void;
}

const dotByTier: Record<ResaleScenario["urgencyTier"], string> = {
  high: "bg-warning",
  balanced: "bg-primary",
  premium: "bg-violet-500",
};

const fmtPerM2 = (n: number) =>
  `$${Math.round(n).toLocaleString("es-MX")} / m²`;

const ResaleStepPricing = ({
  property,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onNext,
}: ResaleStepPricingProps) => {
  const m2 = parseAreaM2(property.property.area);
  const suggested = scenarios.find((s) => s.id === "sugerido")!;
  const growth = getProjectGrowthData(property.property.projectName);

  const maxPrice = growth
    ? Math.max(...growth.points.map((p) => p.pricePerM2))
    : 0;

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <h2 className="font-display font-bold text-xl text-foreground">
          Tu precio sugerido
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Basado en los precios reales de venta del proyecto{" "}
          {property.property.projectName}.
        </p>
      </div>

      {/* Anchor */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 mx-5 mt-3 p-6 text-center">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary mb-2">
          PRECIO SUGERIDO
        </p>
        <p className="font-display font-bold text-5xl tabular-nums text-foreground leading-none">
          {fmtMXN(suggested.totalPrice)}
        </p>
        <p className="text-sm text-muted-foreground mt-2 tabular-nums">
          {fmtPerM2(suggested.pricePerM2)} · {m2} m²
        </p>
      </div>

      {/* Scenarios */}
      <div className="px-5 mt-6">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="font-display font-semibold text-sm text-foreground">
            Elige tu estrategia
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Tap para cambiar
          </span>
        </div>

        <div className="space-y-2.5">
          {scenarios.map((s) => {
            const selected = s.id === selectedScenarioId;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScenario(s.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selected
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:bg-muted/20"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${dotByTier[s.urgencyTier]}`}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {s.label}
                    </span>
                    {s.recommended && (
                      <span className="text-[9px] uppercase font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <span className="font-display font-bold text-lg tabular-nums text-foreground">
                    {fmtMXN(s.totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">
                    {s.tagline}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {fmtPerM2(s.pricePerM2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Growth chart */}
      {growth && (
        <div className="mt-6 px-5">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
            Crecimiento por m² del proyecto {growth.projectName}
          </p>
          <div className="rounded-xl border border-border bg-card p-4">
            <svg
              viewBox="0 0 280 120"
              className="w-full h-[120px]"
              preserveAspectRatio="none"
            >
              {growth.points.map((p, i) => {
                const barW = 28;
                const gap = (280 - barW * growth.points.length) / (growth.points.length + 1);
                const x = gap + i * (barW + gap);
                const maxBarH = 80;
                const h = (p.pricePerM2 / maxPrice) * maxBarH;
                const y = 95 - h;
                let fill = "hsl(var(--primary) / 0.5)";
                if (p.label === "start") fill = "hsl(var(--primary) / 0.3)";
                if (p.label === "end") fill = "hsl(var(--primary))";
                return (
                  <g key={p.monthKey}>
                    {p.label && (
                      <text
                        x={x + barW / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize="7"
                        fill="hsl(var(--foreground))"
                        fontWeight="500"
                      >
                        {p.label === "start" ? "Inicio" : "Última"}
                      </text>
                    )}
                    <rect x={x} y={y} width={barW} height={h} rx={2} fill={fill} />
                    <text
                      x={x + barW / 2}
                      y={108}
                      textAnchor="middle"
                      fontSize="7"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {p.monthDisplay}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                Tasa anualizada (CAGR)
              </span>
              <span className="text-sm font-semibold tabular-nums text-success">
                +{growth.cagr.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-5 px-5">
        El precio sugerido es una estimación basada en transacciones comparables
        del proyecto. <strong className="font-semibold">No constituye avalúo
        formal</strong> en términos de la Ley Federal sobre Metrología y
        Normalización ni del INDAABIN. Para fines fiscales o crediticios, se
        requiere avalúo de perito autorizado.
      </p>

      {/* CTA */}
      <div className="px-5 pt-4">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Ver mi utilidad
        </button>
      </div>
    </div>
  );
};

export default ResaleStepPricing;
