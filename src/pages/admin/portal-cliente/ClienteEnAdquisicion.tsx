import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, CreditCard, FileText, TrendingUp, ChevronRight, Calendar, ChevronLeft, Search } from "lucide-react";
import { filterPortfolioByCategory, getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { useProjectPhotos } from "@/lib/portal-cliente/construction-progress-data";

function MiniCarousel({
  projectId,
  fallbackUrl,
  imageGradient,
  alt,
}: {
  projectId?: number;
  fallbackUrl?: string;
  imageGradient: string;
  alt: string;
}) {
  const { data: photos } = useProjectPhotos(projectId);
  const [idx, setIdx] = useState(0);

  const items: { url: string }[] = photos?.length
    ? photos
    : fallbackUrl
    ? [{ url: fallbackUrl }]
    : [];

  const current = items[idx];

  if (!current) {
    return <div className={`w-full h-full bg-gradient-to-br ${imageGradient}`} />;
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => Math.max(0, i - 1));
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => Math.min(items.length - 1, i + 1));
  };

  return (
    <div className="relative w-full h-full group/mini">
      <img src={current.url} alt={alt} className="w-full h-full object-cover" />
      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            disabled={idx === 0}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover/mini:opacity-100 transition-opacity flex items-center justify-center disabled:hidden"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={next}
            disabled={idx === items.length - 1}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover/mini:opacity-100 transition-opacity flex items-center justify-center disabled:hidden"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all ${
                  i === idx ? "w-3 h-1 bg-white" : "w-1 h-1 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const STAGE_ORDER = ["preventa", "pago_final", "escrituracion", "entrega"] as const;
const STAGE_SHORT: Record<string, string> = {
  preventa: "Preventa",
  pago_final: "Pago",
  escrituracion: "Escritura",
  entrega: "Entrega",
};

const statusTone: Record<string, string> = {
  warning: "bg-warning/15 text-warning",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
};

function AcquisitionCard({
  inv,
  onClick,
}: {
  inv: InvestmentProperty;
  onClick: () => void;
}) {
  const { property, financials } = inv;
  const status = getPropertyStatus(inv);
  const paidPct =
    financials.initialPrice > 0
      ? Math.round((financials.totalPaid / financials.initialPrice) * 100)
      : 0;
  const heroImage = property.image || getPropertyImage(property.id, property.projectName);
  const activeStage = inv.stages.find((s) => s.status === "active");
  const currentIdx = activeStage ? STAGE_ORDER.indexOf(activeStage.id as typeof STAGE_ORDER[number]) : -1;
  const pendingDocs = inv.additionalProducts?.reduce(
    (s, p) => s + p.documents.filter((d) => d.status === "pendiente").length,
    0,
  ) ?? 0;
  const nextAmount =
    inv.financials.pendingBalance > 0 ? inv.financials.pendingBalance : undefined;
  const nextDate = activeStage?.details?.["Fecha límite"] ?? property.deliveryDate;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl bg-card border border-border hover:border-border-soft hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="flex gap-4 p-4">
        <div className="flex-shrink-0">
          <div className="w-[120px] h-[100px] rounded-xl overflow-hidden">
            <MiniCarousel
              projectId={property.projectId}
              fallbackUrl={heroImage || undefined}
              imageGradient={property.imageGradient}
              alt={property.projectName}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
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
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                statusTone[status.color] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {status.label}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Pagado</span>
              <span className="text-foreground tabular-nums font-medium">{paidPct}%</span>
            </div>
            <div className="w-full h-[3px] bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((stage, idx) => {
            const reached = currentIdx >= idx || inv.stages.find((s) => s.id === stage)?.status === "completed";
            const isCurrent = currentIdx === idx;
            return (
              <div
                key={stage}
                className={`flex-1 h-[3px] rounded-full ${
                  isCurrent
                    ? "bg-primary"
                    : reached
                    ? "bg-primary/60"
                    : "bg-muted"
                }`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-medium tracking-wide uppercase">
          {STAGE_ORDER.map((stage, idx) => (
            <span
              key={stage}
              className={
                currentIdx === idx
                  ? "text-primary"
                  : currentIdx > idx
                  ? "text-foreground/70"
                  : "text-muted-foreground/60"
              }
            >
              {STAGE_SHORT[stage]}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap text-[11px]">
          {nextAmount && (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <CreditCard className="w-3.5 h-3.5 text-warning" />
              <span className="tabular-nums font-medium">{fmt(nextAmount)}</span>
              <span className="text-muted-foreground">· {nextDate}</span>
            </span>
          )}
          {!nextAmount && nextDate && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {nextDate}
            </span>
          )}
          {pendingDocs > 0 && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              {pendingDocs} doc{pendingDocs > 1 ? "s" : ""}
            </span>
          )}
          {financials.estimatedAppreciation > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <TrendingUp className="w-3.5 h-3.5" />
              +{financials.estimatedAppreciation}%
            </span>
          )}
        </div>
        <span className="text-[12px] font-medium text-primary group-hover:underline inline-flex items-center gap-0.5">
          Ver detalle
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
      <div className="flex gap-4 p-4">
        <div className="w-[120px] h-[100px] rounded-xl bg-muted flex-shrink-0" />
        <div className="flex-1 flex flex-col justify-between gap-3 py-1">
          <div className="space-y-2">
            <div className="h-3.5 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 bg-muted rounded w-full" />
            <div className="h-[3px] bg-muted rounded-full w-full" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        <div className="h-[3px] bg-muted rounded-full w-full" />
        <div className="flex justify-between">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-2 bg-muted rounded w-10" />
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border-subtle">
        <div className="h-2.5 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
    </div>
    <p className="mt-4 font-display font-semibold text-foreground">
      No hay compras en curso
    </p>
    <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto">
      Cuando el cliente inicie una nueva adquisición, aparecerá aquí con su progreso, pagos pendientes y documentación.
    </p>
  </div>
);

const ClienteEnAdquisicion = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: portfolio, isLoading } = usePortfolioCliente();
  const items = portfolio ? filterPortfolioByCategory(portfolio, "in_acquisition") : [];
  const filtered = items.filter((inv) =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.location}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <section className="px-5 md:px-0 pt-6 pb-6">
        <div className="mb-5">
          <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
            En adquisición
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Propiedades en proceso de compra
            {!isLoading && items.length > 0 && ` · ${items.length} unidad${items.length === 1 ? "" : "es"} activa${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
            ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((inv) => (
              <AcquisitionCard
                key={inv.property.id}
                inv={inv}
                onClick={() =>
                  navigate(`/admin/portal-cliente/en-adquisicion/propiedad/${inv.property.id}`, {
                    state: { from: "en-adquisicion" },
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

export default ClienteEnAdquisicion;
