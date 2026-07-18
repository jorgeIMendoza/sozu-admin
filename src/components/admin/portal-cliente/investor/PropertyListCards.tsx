import { useState } from "react";
import {
  CreditCard,
  FileText,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import type { InvestmentProperty } from "@/lib/portal-cliente/types";
import { fmtMXN as fmt } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";
import { useProjectPhotos } from "@/lib/portal-cliente/construction-progress-data";

// ── Carrusel de fotos de obra (adquisición) ──

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

// ── Card: propiedad en adquisición ──

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

export function AcquisitionCard({
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
      data-cta="cliente.adquisicion.ver-propiedad"
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

// ── Card: propiedad en patrimonio (entregada) ──

export function PatrimonyCard({
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
  const maintStatus = maintenance?.status === "pendiente" ? "due_soon" : "current";
  const maintConfig =
    maintStatus === "current"
      ? { label: "Al día", Icon: CheckCircle2, cls: "bg-success/15 text-success" }
      : { label: "Pago próximo", Icon: Calendar, cls: "bg-warning/15 text-warning" };
  const Mi = maintConfig.Icon;

  return (
    <div
      data-cta="cliente.patrimonio.ver-propiedad"
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
