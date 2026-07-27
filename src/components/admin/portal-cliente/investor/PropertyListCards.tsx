import { useState } from "react";
import {
  CreditCard,
  FileText,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  MapPin,
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

// Punto de color del badge sobre la imagen (pill blanco sólido = siempre legible).
const statusDot: Record<string, string> = {
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
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
      className="group cursor-pointer rounded-2xl bg-card border border-border hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Hero */}
      <div className="relative h-44">
        <MiniCarousel
          projectId={property.projectId}
          fallbackUrl={heroImage || undefined}
          imageGradient={property.imageGradient}
          alt={property.projectName}
        />
        {/* Capa negra bajo el texto para legibilidad del título/ubicación */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

        {/* Estatus: pill blanco sólido + punto de color → siempre visible sobre la foto */}
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-neutral-900 shadow-md whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[status.color] ?? "bg-neutral-400"}`} />
          {status.label}
        </span>

        {/* Título sobre la imagen */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display font-bold text-[17px] text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
            {property.projectName}
            <span className="font-medium text-white/85"> · U-{property.unitNumber}</span>
          </p>
          {property.location && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/90 truncate max-w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{property.location}</span>
            </p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-4 flex-1 flex flex-col gap-3.5">
        {/* Avance de pago */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Avance de pago
            </span>
            <span className="font-display font-bold text-[15px] text-foreground tabular-nums leading-none">
              {paidPct}
              <span className="text-[11px] font-semibold text-muted-foreground">%</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-muted/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap text-[11px] min-w-0">
          {nextAmount ? (
            <span className="inline-flex items-center gap-1.5 text-foreground min-w-0">
              <CreditCard className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="tabular-nums font-semibold">{fmt(nextAmount)}</span>
              <span className="text-muted-foreground truncate">· {nextDate}</span>
            </span>
          ) : nextDate ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {nextDate}
            </span>
          ) : null}
          {pendingDocs > 0 && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {pendingDocs} doc{pendingDocs > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-[12px] font-semibold text-primary inline-flex items-center gap-0.5 shrink-0 group-hover:gap-1.5 transition-all">
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
      className="group cursor-pointer rounded-2xl bg-card border border-border hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Hero */}
      <div className="relative h-44">
        <MiniCarousel
          projectId={property.projectId}
          fallbackUrl={heroImage || undefined}
          imageGradient={property.imageGradient}
          alt={property.projectName}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-neutral-900 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Entregada
        </span>
        <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/55 text-white backdrop-blur-md shadow-sm whitespace-nowrap">
          Tuya desde {property.deliveryDate}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display font-bold text-[17px] text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
            {property.projectName}
            <span className="font-medium text-white/85"> · U-{property.unitNumber}</span>
          </p>
          {property.location && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/90 truncate max-w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{property.location}</span>
            </p>
          )}
        </div>
      </div>

      {/* Valor / plusvalía */}
      <div className="p-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor actual</p>
            <p className="text-[16px] font-display font-bold text-foreground tabular-nums mt-0.5">
              {fmt(valueMXN)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Plusvalía</p>
            <p
              className={`text-[16px] font-display font-bold tabular-nums mt-0.5 inline-flex items-center gap-1 ${
                plusvaliaPct >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {plusvaliaPct >= 0 ? "+" : ""}
              {plusvaliaPct}%
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-muted/20 flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${maintConfig.cls}`}>
          <Mi className="w-3 h-3" />
          {maintConfig.label}
        </span>
        <span className="text-[12px] font-semibold text-primary inline-flex items-center gap-0.5 shrink-0 group-hover:gap-1.5 transition-all">
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
