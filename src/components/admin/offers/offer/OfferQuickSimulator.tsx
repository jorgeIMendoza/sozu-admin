import { useState } from "react";
import { Calculator } from "lucide-react";
import { formatMXN } from "@/lib/offers/offer-data";

const OfferQuickSimulator = ({ price }: { price: number }) => {
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(20);

  const downAmount = Math.round(price * (downPct / 100));
  const loanAmount = price - downAmount;
  const monthlyRate = 0.105 / 12;
  const months = years * 12;
  const monthly = Math.round(
    (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Simulación rápida</h3>
      </div>

      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Enganche</span>
            <span className="font-semibold tabular-nums">
              {downPct}% · {formatMXN(downAmount)}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={50}
            step={5}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Plazo</span>
            <span className="font-semibold tabular-nums">{years} años</span>
          </div>
          <input
            type="range"
            min={5}
            max={25}
            step={5}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-border">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1">
          Mensualidad estimada
        </p>
        <p className="text-3xl font-bold tabular-nums text-primary">{formatMXN(monthly)}</p>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Cálculo aproximado a tasa fija 10.5% anual. Sujeto a aprobación bancaria y
          validación crediticia. No constituye oferta vinculante.
        </p>
      </div>
    </div>
  );
};

export default OfferQuickSimulator;
