import { TrendingUp } from "lucide-react";
import { mockPortfolio, getPortfolioTotals, filterPortfolioByCategory } from "@/lib/offers/mock-data";

const fmt = (n: number) => `$${n.toLocaleString("es-MX")}`;
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const HeroFinancialSummary = () => {
  const totals = getPortfolioTotals(mockPortfolio);
  const progressPct =
    totals.totalInvested > 0 ? Math.round((totals.totalPaid / totals.totalInvested) * 100) : 0;

  const totalEstimatedValue = totals.totalCurrentValue;
  const gainAbsolute = totalEstimatedValue - totals.totalInvested;
  const gainPercent = totals.appreciationPercent;

  return (
    <section className="px-5 md:px-0 pt-4 md:pt-2 animate-fade-in">
      <div className="rounded-2xl bg-card border border-border-soft p-6 md:p-8 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Hero amount */}
          <div className="lg:col-span-7">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Patrimonio total
            </p>
            <p className="mt-3 font-display font-bold text-foreground text-[40px] md:text-[56px] leading-none tracking-tight tabular-nums">
              {fmt(totalEstimatedValue)}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1 font-semibold text-success tabular-nums">
                <TrendingUp className="w-3.5 h-3.5" />
                +{fmt(Math.max(0, gainAbsolute))}
              </span>
              <span className="text-success font-medium tabular-nums">
                ({gainPercent.toFixed(1)}%)
              </span>
              <span className="text-muted-foreground">últimos 12 meses</span>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              {totals.count} propiedades activas
            </p>

            {/* Category breakdown */}
            {(() => {
              const inAcq = filterPortfolioByCategory(mockPortfolio, "in_acquisition");
              const patrimony = filterPortfolioByCategory(mockPortfolio, "active_patrimony");
              const patrimonyValue = patrimony.reduce(
                (s, p) => s + p.financials.currentEstimatedValue,
                0,
              );
              const acqValue = inAcq.reduce(
                (s, p) => s + p.financials.currentEstimatedValue,
                0,
              );
              return (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px]">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-muted-foreground">Patrimonio activo:</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {fmt(patrimonyValue)}
                    </span>
                    <span className="text-muted-foreground">
                      ({patrimony.length} unidad{patrimony.length === 1 ? "" : "es"})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    <span className="text-muted-foreground">En adquisición:</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {fmt(acqValue)}
                    </span>
                    <span className="text-muted-foreground">
                      ({inAcq.length} unidad{inAcq.length === 1 ? "" : "es"})
                    </span>
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Métricas stack */}
          <div className="lg:col-span-5 lg:border-l lg:border-border-subtle lg:pl-8">
            <dl className="divide-y divide-border-subtle">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[12px] text-muted-foreground">Invertido total</dt>
                <dd className="text-[14px] font-semibold text-foreground tabular-nums">
                  {fmt(totals.totalInvested)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[12px] text-muted-foreground">Plusvalía generada</dt>
                <dd className="text-[14px] font-semibold text-success tabular-nums">
                  +{fmt(Math.max(0, gainAbsolute))}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[12px] text-muted-foreground">Saldo pendiente</dt>
                <dd className="text-[14px] font-semibold text-foreground tabular-nums">
                  {fmt(totals.totalPending)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 pt-5 border-t border-border-subtle">
          <div className="flex items-center justify-between mb-2 text-[12px]">
            <span className="font-medium text-foreground">Pagado · {progressPct}%</span>
            <span className="text-muted-foreground tabular-nums">
              {fmtCompact(totals.totalPaid)} de {fmtCompact(totals.totalInvested)}
            </span>
          </div>
          <div className="w-full h-[3px] bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroFinancialSummary;
