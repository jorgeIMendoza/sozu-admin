import { TrendingUp, Menu } from "lucide-react";
import { fmtMXN as fmt } from "@/lib/utils";

interface PortfolioHeroProps {
  totalInvested: number;
  totalPaid: number;
  totalPending: number;
  appreciationPercent: number;
  propertyCount: number;
  onMenuOpen: () => void;
}

const PortfolioHero = ({
  totalInvested,
  totalPaid,
  totalPending,
  appreciationPercent,
  propertyCount,
  onMenuOpen,
}: PortfolioHeroProps) => {
  const progress = totalInvested > 0 ? (totalPaid / totalInvested) * 100 : 0;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/97 to-primary/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.10),transparent_70%)]" />

      <div className="relative px-5 pt-4 pb-7">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-primary-foreground text-base tracking-tight">
              Mi Portafolio
            </h1>
            <p className="text-primary-foreground/50 text-[11px] mt-0.5">
              {propertyCount} {propertyCount === 1 ? "propiedad" : "propiedades"}
            </p>
          </div>
          <button
            onClick={onMenuOpen}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-foreground/8 text-primary-foreground/70 hover:bg-primary-foreground/12 transition-colors"
            aria-label="Menú"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Main value */}
        <div className="mb-6">
          <p className="text-primary-foreground/40 text-[11px] uppercase tracking-widest font-medium mb-1.5">
            Valor total invertido
          </p>
          <p className="font-display font-bold text-[2rem] leading-none text-primary-foreground tabular-nums tracking-tight">
            {fmt(totalInvested)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary">
              +{appreciationPercent.toFixed(1)}% plusvalía
            </span>
          </div>
        </div>

        {/* Progress bar — thin and elegant */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-primary-foreground/40 text-[11px] font-medium">
              Progreso de pago
            </span>
            <span className="text-[11px] font-bold text-primary tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-primary-foreground/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary animate-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Inline metrics — no boxes */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-foreground/35 text-[10px] uppercase tracking-wider font-medium mb-0.5">
              Pagado
            </p>
            <p className="font-display font-semibold text-base text-primary tabular-nums">
              {fmt(totalPaid)}
            </p>
          </div>
          <div className="w-px h-8 bg-primary-foreground/10" />
          <div className="text-right">
            <p className="text-primary-foreground/35 text-[10px] uppercase tracking-wider font-medium mb-0.5">
              Pendiente
            </p>
            <p className="font-display font-semibold text-base text-primary-foreground/80 tabular-nums">
              {fmt(totalPending)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PortfolioHero;
