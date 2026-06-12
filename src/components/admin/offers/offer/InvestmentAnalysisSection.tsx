/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { useState } from "react";
import { ChevronDown, TrendingUp, Building, Home, Coins, Info } from "lucide-react";
import type { MarketAnalysis } from "@/lib/offers/offer-data";

interface InvestmentAnalysisSectionProps {
  analysis: MarketAnalysis;
}

const formatPriceMxn = (price: number): string => {
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price}`;
};

const formatFullPrice = (price: number): string =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(price);

const InvestmentAnalysisSection = ({ analysis }: InvestmentAnalysisSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!analysis.pricePerSqmHistory || analysis.pricePerSqmHistory.length === 0) return null;

  const firstYear = analysis.pricePerSqmHistory[0];
  const lastYear = analysis.pricePerSqmHistory[analysis.pricePerSqmHistory.length - 1];
  const yearSpan = lastYear.year - firstYear.year;
  const cagr = yearSpan > 0
    ? (Math.pow(lastYear.pricePerSqm / firstYear.pricePerSqm, 1 / yearSpan) - 1) * 100
    : 0;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">Análisis de inversión</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Histórico, proyección y rendimiento de renta — opcional, para perfil inversionista.
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          <div className="p-5 space-y-5">
            <PricePerSqmChart analysis={analysis} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/20 border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Precio actual / m²</p>
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">${formatFullPrice(lastYear.pricePerSqm)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">En {analysis.zoneName.split(",")[0]}</p>
              </div>

              <div className="rounded-xl bg-muted/20 border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Apreciación anual</p>
                </div>
                <p className="text-xl font-bold text-primary tabular-nums">{cagr.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground mt-1">Promedio últimos {yearSpan} años</p>
              </div>

              {analysis.projectedPricePerSqmAtDelivery && analysis.deliveryYear && (
                <div className="rounded-xl bg-primary/[0.04] border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Proyección {analysis.deliveryYear}</p>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">${formatFullPrice(analysis.projectedPricePerSqmAtDelivery)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Al momento de entrega</p>
                </div>
              )}
            </div>

            {analysis.comparableZones && analysis.comparableZones.length > 0 && (
              <div className="rounded-xl bg-muted/20 border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Comparativa contra colonias adyacentes</p>
                </div>
                <div className="space-y-2">
                  <ComparativeBar
                    name={`${analysis.zoneName.split(",")[0]} (esta unidad)`}
                    price={lastYear.pricePerSqm}
                    maxPrice={Math.max(lastYear.pricePerSqm, ...analysis.comparableZones.map((z) => z.avgPricePerSqm))}
                    isHighlighted
                  />
                  {analysis.comparableZones.map((zone) => (
                    <ComparativeBar
                      key={zone.name}
                      name={zone.name}
                      price={zone.avgPricePerSqm}
                      maxPrice={Math.max(lastYear.pricePerSqm, ...analysis.comparableZones!.map((z) => z.avgPricePerSqm))}
                    />
                  ))}
                </div>
              </div>
            )}

            {analysis.rentalEstimate && (
              <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4">
                <div className="flex items-start gap-3">
                  <Coins className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground mb-2">Si decides rentar esta unidad</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Renta estimada / mes</p>
                        <p className="text-base font-bold text-foreground tabular-nums">${formatFullPrice(analysis.rentalEstimate.monthlyRentMxn)} MXN</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROI anual estimado</p>
                        <p className="text-base font-bold text-primary tabular-nums">{analysis.rentalEstimate.annualROI.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-warning/[0.04] border border-warning/20 p-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-foreground/75 leading-relaxed">
                  <strong className="text-foreground">Estimaciones referenciales</strong> basadas en datos históricos del mercado inmobiliario de la zona. <strong>No constituyen garantía de rendimiento futuro ni compromiso de plusvalía.</strong> Las proyecciones asumen condiciones macroeconómicas estables y no consideran cambios regulatorios, fiscales o de mercado. Consulta con un asesor financiero antes de tomar decisiones de inversión.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const PricePerSqmChart = ({ analysis }: { analysis: MarketAnalysis }) => {
  const dataPoints = [...analysis.pricePerSqmHistory];
  if (analysis.projectedPricePerSqmAtDelivery && analysis.deliveryYear) {
    dataPoints.push({ year: analysis.deliveryYear, pricePerSqm: analysis.projectedPricePerSqmAtDelivery });
  }
  const minPrice = Math.min(...dataPoints.map((p) => p.pricePerSqm));
  const maxPrice = Math.max(...dataPoints.map((p) => p.pricePerSqm));
  const priceRange = maxPrice - minPrice || 1;
  const minYear = dataPoints[0].year;
  const maxYear = dataPoints[dataPoints.length - 1].year;
  const yearRange = maxYear - minYear || 1;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (year: number) => padding.left + ((year - minYear) / yearRange) * chartWidth;
  const getY = (price: number) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  const historicalPoints = analysis.pricePerSqmHistory;
  const historicalPath = historicalPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(p.year)} ${getY(p.pricePerSqm)}`)
    .join(" ");

  const lastHistorical = historicalPoints[historicalPoints.length - 1];
  const projection = analysis.projectedPricePerSqmAtDelivery && analysis.deliveryYear
    ? { year: analysis.deliveryYear, pricePerSqm: analysis.projectedPricePerSqmAtDelivery }
    : null;

  return (
    <div className="rounded-xl bg-muted/10 border border-border p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Precio por m² en {analysis.zoneName.split(",")[0]}
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-primary" />
            <span className="text-muted-foreground">Histórico</span>
          </div>
          {projection && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 border-t border-dashed border-primary" />
              <span className="text-muted-foreground">Proyección</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-full" xmlns="http://www.w3.org/2000/svg">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * (1 - fraction)}
                x2={width - padding.right}
                y2={padding.top + chartHeight * (1 - fraction)}
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              <text
                x={padding.left - 5}
                y={padding.top + chartHeight * (1 - fraction) + 3}
                fontSize="9"
                fill="hsl(var(--muted-foreground))"
                textAnchor="end"
              >
                {formatPriceMxn(minPrice + priceRange * fraction)}
              </text>
            </g>
          ))}

          <path d={historicalPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {projection && (
            <line
              x1={getX(lastHistorical.year)}
              y1={getY(lastHistorical.pricePerSqm)}
              x2={getX(projection.year)}
              y2={getY(projection.pricePerSqm)}
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          )}

          {historicalPoints.map((p) => (
            <circle key={p.year} cx={getX(p.year)} cy={getY(p.pricePerSqm)} r="3" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2" />
          ))}

          {projection && (
            <circle cx={getX(projection.year)} cy={getY(projection.pricePerSqm)} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" />
          )}

          {dataPoints.map((p) => (
            <text key={p.year} x={getX(p.year)} y={height - 10} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">
              {p.year}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

interface ComparativeBarProps {
  name: string;
  price: number;
  maxPrice: number;
  isHighlighted?: boolean;
}

const ComparativeBar = ({ name, price, maxPrice, isHighlighted = false }: ComparativeBarProps) => {
  const widthPct = (price / maxPrice) * 100;
  return (
    <div className="flex items-center gap-3">
      <p className={`text-[11px] w-32 md:w-40 truncate flex-shrink-0 ${isHighlighted ? "font-bold text-foreground" : "text-muted-foreground"}`}>{name}</p>
      <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isHighlighted ? "bg-primary" : "bg-muted-foreground/30"}`} style={{ width: `${widthPct}%` }} />
      </div>
      <p className={`text-[11px] tabular-nums w-20 text-right flex-shrink-0 ${isHighlighted ? "font-bold text-foreground" : "text-muted-foreground"}`}>${formatFullPrice(price)}</p>
    </div>
  );
};

export default InvestmentAnalysisSection;
