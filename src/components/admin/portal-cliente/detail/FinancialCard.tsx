import { TrendingUp } from "lucide-react";
import { fmtMXN as fmt } from "@/lib/utils";

interface FinancialCardProps {
  initialPrice: number;
  totalPaid: number;
  pendingBalance: number;
  appreciation: number;
  progress: number;
  hasPending: boolean;
  onPayNow: () => void;
  compact?: boolean;
}

const FinancialCard = ({
  initialPrice,
  totalPaid,
  pendingBalance,
  appreciation,
  progress,
  hasPending,
  onPayNow,
  compact = false,
}: FinancialCardProps) => {
  if (compact) {
    return (
      <section className="px-5 pt-5 pb-1">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          {/* Compact: single row value + appreciation */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
                Valor del activo
              </p>
              <p className="font-display font-bold text-xl text-foreground tabular-nums tracking-tight">
                {fmt(initialPrice)}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-semibold text-primary tabular-nums">
                +{appreciation}%
              </span>
            </div>
          </div>

          {/* Compact progress bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground font-medium">Progreso</span>
              <span className="text-[10px] font-bold text-primary tabular-nums">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Compact paid | pending */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Pagado</p>
              <p className="font-display font-semibold text-xs text-primary tabular-nums">{fmt(totalPaid)}</p>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Restante</p>
              <p className="font-display font-semibold text-xs text-foreground tabular-nums">{fmt(pendingBalance)}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 pt-5 pb-1">
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        {/* Value + appreciation */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
              Valor del activo
            </p>
            <p className="font-display font-bold text-2xl text-foreground tabular-nums tracking-tight">
              {fmt(initialPrice)}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-semibold text-primary tabular-nums">
              +{appreciation}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">Progreso de pago</span>
            <span className="text-[11px] font-bold text-primary tabular-nums">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Paid | Pending */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Pagado</p>
            <p className="font-display font-semibold text-sm text-primary tabular-nums">{fmt(totalPaid)}</p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Restante</p>
            <p className="font-display font-semibold text-sm text-foreground tabular-nums">{fmt(pendingBalance)}</p>
          </div>
        </div>

        {/* Pay now button */}
        {hasPending && (
          <button
            onClick={onPayNow}
            className="mt-4 w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            Pagar ahora
          </button>
        )}
      </div>
    </section>
  );
};

export default FinancialCard;
