import { useNavigate } from "react-router-dom";
import { Wallet, CheckCircle2, AlertCircle, Calendar, ChevronRight, TrendingUp } from "lucide-react";
import { filterPortfolioByCategory } from "@/lib/portal-cliente/mock-data";
import type { InvestmentProperty } from "@/lib/portal-cliente/types";
import { fmtMXN as fmt } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";

function PatrimonyCard({
  inv,
  onClick,
}: {
  inv: InvestmentProperty;
  onClick: () => void;
}) {
  const { property, financials, maintenance } = inv;
  const heroImage = property.image || getPropertyImage(property.id, property.projectName);
  const valueMXN = financials.currentEstimatedValue;
  const plusvaliaPct = financials.estimatedAppreciation;
  const plusvaliaAmount = financials.currentEstimatedValue - financials.initialPrice;
  const maintStatus = maintenance?.status === "pendiente" ? "due_soon" : "current";
  const maintConfig =
    maintStatus === "current"
      ? { label: "Al día", Icon: CheckCircle2, cls: "bg-success/15 text-success" }
      : { label: "Pago próximo", Icon: Calendar, cls: "bg-warning/15 text-warning" };
  const Mi = maintConfig.Icon;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl bg-card border border-border hover:border-border-soft hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex gap-4 p-4">
        <div className="flex-shrink-0 relative">
          <div
            className={`w-[120px] h-[100px] rounded-xl overflow-hidden ${
              heroImage ? "" : `bg-gradient-to-br ${property.imageGradient}`
            }`}
          >
            {heroImage && (
              <img
                src={heroImage}
                alt={property.projectName}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-success text-success-foreground flex items-center justify-center shadow">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] text-foreground leading-tight">
                <span className="font-semibold font-display">{property.projectName}</span>
                <span className="text-muted-foreground font-normal"> · U-{property.unitNumber}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {property.location}
              </p>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              Tuya desde {property.deliveryDate}
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border-subtle border-y border-border-subtle py-2 mt-1">
            <div className="px-2 first:pl-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Valor actual
              </p>
              <p className="text-[14px] font-semibold text-foreground tabular-nums mt-0.5">
                {fmt(valueMXN)}
              </p>
            </div>
            <div className="px-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Plusvalía
              </p>
              <p
                className={`text-[14px] font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1 ${
                  plusvaliaPct >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                {plusvaliaPct >= 0 ? "+" : ""}
                {plusvaliaPct}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${maintConfig.cls}`}>
            <Mi className="w-3 h-3" />
            {maintConfig.label}
          </span>
          {maintenance && (
            <span className="text-muted-foreground">
              Próx. {fmt(maintenance.monthlyFee)} · {maintenance.nextDueDate}
            </span>
          )}
          <span className="text-muted-foreground">· Uso propio</span>
        </div>
        <span className="text-[12px] font-medium text-primary group-hover:underline inline-flex items-center gap-0.5">
          Ver detalle
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>

      {maintStatus !== "current" && maintenance && (
        <div className="px-4 py-2 bg-warning/10 border-t border-warning/30 flex items-center justify-between text-[12px]">
          <span className="font-medium text-warning">
            Mantenimiento pendiente · {fmt(maintenance.monthlyFee)}
          </span>
          <span className="text-warning font-semibold">Pagar →</span>
        </div>
      )}
    </div>
  );
}

const KpiCell = ({ label, value, tone }: { label: string; value: string; tone: "default" | "success" }) => (
  <div className="rounded-2xl bg-card border border-border p-4">
    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
      {label}
    </p>
    <p
      className={`mt-2 font-display font-bold text-[22px] tabular-nums ${
        tone === "success" ? "text-success" : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
      <Wallet className="w-5 h-5 text-muted-foreground" />
    </div>
    <p className="mt-4 font-display font-semibold text-foreground">
      Tu patrimonio se construirá aquí
    </p>
    <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto">
      Cuando alguna de tus propiedades sea entregada, pasará automáticamente a esta sección donde
      podrás gestionar mantenimiento, ver plusvalía y administrar tus activos.
    </p>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
    <div className="flex gap-4 p-4">
      <div className="w-[120px] h-[100px] rounded-xl bg-muted flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded-md w-3/4" />
        <div className="h-3 bg-muted rounded-md w-1/2" />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-8 bg-muted rounded-md" />
          <div className="h-8 bg-muted rounded-md" />
        </div>
      </div>
    </div>
    <div className="px-4 py-3 border-t border-border-subtle flex gap-3">
      <div className="h-5 bg-muted rounded-full w-20" />
      <div className="h-5 bg-muted rounded-md w-32" />
    </div>
  </div>
);

const ClientePatrimonio = () => {
  const navigate = useNavigate();
  const { data: portfolio, isLoading } = usePortfolioCliente();

  const items = portfolio ? filterPortfolioByCategory(portfolio, "active_patrimony") : [];

  const totalValue = items.reduce((s, p) => s + p.financials.currentEstimatedValue, 0);
  const totalPlusvalia = items.reduce(
    (s, p) => s + (p.financials.currentEstimatedValue - p.financials.initialPrice),
    0,
  );

  return (
    <>
      <section className="px-5 md:px-0 pt-6 pb-6">
        <div className="mb-5">
          <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
            Mi patrimonio
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Tus propiedades entregadas
            {!isLoading && items.length > 0 && ` · ${items.length} unidad${items.length === 1 ? "" : "es"}`}
          </p>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            {items.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                <KpiCell label="Valor actual" value={fmt(totalValue)} tone="default" />
                <KpiCell label="Plusvalía acumulada" value={`+${fmt(Math.max(0, totalPlusvalia))}`} tone="success" />
                <KpiCell label="Unidades activas" value={String(items.length)} tone="default" />
              </div>
            )}

            {items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {items.map((inv) => (
                  <PatrimonyCard
                    key={inv.property.id}
                    inv={inv}
                    onClick={() =>
                      navigate(`/admin/portal-cliente/patrimonio/propiedad/${inv.property.id}`, {
                        state: { from: "patrimonio" },
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default ClientePatrimonio;
void AlertCircle;
