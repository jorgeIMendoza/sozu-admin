import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FinancialData } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface InvestmentPerformanceProps {
  financials: FinancialData;
}

const InvestmentPerformance = ({ financials }: InvestmentPerformanceProps) => {
  const [open, setOpen] = useState(false);

  const rows = [
    { label: "Precio por m² inicial", value: fmt(financials.pricePerM2Initial) },
    { label: "Precio por m² actual", value: fmt(financials.pricePerM2Current), highlight: true },
    { label: "Valor estimado actual", value: fmt(financials.currentEstimatedValue) },
    { label: "Plusvalía", value: `+${financials.estimatedAppreciation}%`, highlight: true },
  ];

  return (
    <section className="px-5 py-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2"
      >
        <h3 className="font-display font-semibold text-sm text-foreground">
          Rendimiento de inversión
        </h3>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-2 bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-between items-center px-4 py-3 ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className={`text-xs font-semibold tabular-nums ${row.highlight ? "text-primary" : "text-foreground"}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default InvestmentPerformance;
