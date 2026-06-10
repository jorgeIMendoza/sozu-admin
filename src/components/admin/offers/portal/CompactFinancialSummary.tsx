import { TrendingUp } from "lucide-react";
import { fmtMXN as fmt } from "@/lib/utils";

interface CompactFinancialSummaryProps {
  totalInvested: number;
  totalPaid: number;
  totalPending: number;
  appreciationPercent: number;
}

const CompactFinancialSummary = ({
  totalInvested,
  totalPaid,
  totalPending,
  appreciationPercent,
}: CompactFinancialSummaryProps) => {
  const progress = totalInvested > 0 ? (totalPaid / totalInvested) * 100 : 0;

  return (
    <section className="px-5 md:px-0 py-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <h2 className="font-display font-semibold text-sm text-foreground mb-3">
        Resumen financiero
      </h2>
      <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
        {/* Top row: invested + appreciation */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Total invertido
            </p>
            <p className="font-display font-bold text-xl text-foreground tabular-nums mt-0.5">
              {fmt(totalInvested)}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-full">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary tabular-nums">
              +{appreciationPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              Progreso de pago
            </span>
            <span className="text-[11px] font-bold text-primary tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary animate-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Paid vs Pending */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Pagado
            </p>
            <p className="font-display font-semibold text-sm text-primary tabular-nums mt-0.5">
              {fmt(totalPaid)}
            </p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Pendiente
            </p>
            <p className="font-display font-semibold text-sm text-foreground tabular-nums mt-0.5">
              {fmt(totalPending)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompactFinancialSummary;
