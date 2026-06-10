import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  MapPin,
  TrendingUp,
  Wrench,
  Home,
  Building2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  KeyRound,
} from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { fmtMXN } from "@/lib/utils";
import { getPropertyImage } from "@/lib/offers/property-images";
import PropertyDocuments from "./PropertyDocuments";
import PropertyHumanContact from "./PropertyHumanContact";
import PropertyTechnicalSheet from "./PropertyTechnicalSheet";

interface Props {
  investment: InvestmentProperty;
  onBack?: () => void;
}

type MaintenanceUiStatus = "current" | "due_soon" | "overdue";
type Usage = "uso_propio" | "renta" | "disponible";

const PropertyPatrimonyDetail = ({ investment }: Props) => {
  const { property, financials, maintenance } = investment;
  const valueMXN = financials.currentEstimatedValue;
  const purchaseMXN = financials.initialPrice;
  const deltaMXN = valueMXN - purchaseMXN;
  const deltaPct = financials.estimatedAppreciation;

  // Default delivery date hardcoded (would come from real store)
  const deliveredAt = "2024-05-15";

  const maintenanceStatus: MaintenanceUiStatus =
    maintenance?.status === "pendiente" ? "due_soon" : "current";

  const usage: Usage = "uso_propio";

  return (
    <div className="pb-32 space-y-8">
      <PatrimonyHero investment={investment} deliveredAt={deliveredAt} />

      <AssetValue
        valueMXN={valueMXN}
        purchaseValueMXN={purchaseMXN}
        deltaMXN={deltaMXN}
        deltaPct={deltaPct}
        deliveredAt={deliveredAt}
      />

      <MaintenanceSection
        maintenance={maintenance}
        status={maintenanceStatus}
      />

      <UsageSection usage={usage} />

      <PropertyDocuments propertyId={property.id} />

      <PropertyHumanContact investment={investment} role="administrator" />

      <PropertyTechnicalSheet property={property} />

      <PatrimonyStickyCTA
        status={maintenanceStatus}
        amount={maintenance?.monthlyFee ?? 0}
      />
    </div>
  );
};

// ── Hero ──

const PatrimonyHero = ({
  investment,
  deliveredAt,
}: {
  investment: InvestmentProperty;
  deliveredAt: string;
}) => {
  const { property } = investment;
  const heroImg = getPropertyImage(property.id);
  const gallery: string[] = heroImg ? [heroImg] : [];
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const sinceLabel = new Date(deliveredAt).toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-success">
          Tu patrimonio · U-{property.unitNumber}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3 flex-wrap">
          <h1 className="font-display font-bold text-[24px] md:text-[30px] text-foreground tracking-tight leading-tight">
            {property.projectName} · U-{property.unitNumber}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-success/15 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Tuya desde {sinceLabel}
          </span>
        </div>
        {(property.address || property.location) && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{property.address ?? property.location}</span>
          </p>
        )}
      </div>

      {gallery.length > 0 && (
        <div className="space-y-3">
          <div
            className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-2xl overflow-hidden bg-muted cursor-zoom-in group"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={gallery[activeImage]}
              alt={`${property.projectName} U-${property.unitNumber}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/95 text-success-foreground text-[10px] font-semibold backdrop-blur">
              <KeyRound className="w-3 h-3" />
              Entregada
            </div>
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
            {gallery.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((i) => (i === 0 ? gallery.length - 1 : i - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((i) => (i === gallery.length - 1 ? 0 : i + 1));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {lightboxOpen && gallery.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={gallery[activeImage]}
            alt="ampliado"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </section>
  );
};

// ── Valor del activo ──

const AssetValue = ({
  valueMXN,
  purchaseValueMXN,
  deltaMXN,
  deltaPct,
  deliveredAt,
}: {
  valueMXN: number;
  purchaseValueMXN: number;
  deltaMXN: number;
  deltaPct: number;
  deliveredAt?: string;
}) => {
  const positive = deltaMXN >= 0;
  const years = deliveredAt
    ? Math.max(0.1, (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;
  const annualized = years > 0 ? deltaPct / years : 0;

  const toneText = positive ? "text-success" : "text-destructive";

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Valor del activo
        </h2>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
            Valor actual estimado
          </p>
          <p className="font-display font-bold text-[34px] md:text-[40px] text-foreground tabular-nums leading-none mt-2">
            {fmtMXN(valueMXN)}
          </p>
          <div className={`mt-2 inline-flex items-center gap-1.5 ${toneText}`}>
            {positive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span className="text-[14px] font-semibold tabular-nums">
              {positive ? "+" : ""}
              {fmtMXN(deltaMXN)}
            </span>
            <span className="text-[12px] font-medium tabular-nums">
              ({positive ? "+" : ""}
              {deltaPct.toFixed(1)}%)
            </span>
            <span className="text-[12px] text-muted-foreground">desde la compra</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border-subtle">
          <KpiCell label="Precio de compra" value={fmtMXN(purchaseValueMXN)} />
          <KpiCell
            label="Plusvalía total"
            value={`${positive ? "+" : ""}${fmtMXN(deltaMXN)}`}
            tone={positive ? "success" : "destructive"}
          />
          {years > 0 && (
            <KpiCell
              label="Anualizada"
              value={`${positive ? "+" : ""}${annualized.toFixed(1)}%`}
              tone={positive ? "success" : "destructive"}
              hint="por año"
            />
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-3 border-t border-border-subtle">
          Estimación basada en valor de mercado de inmuebles comparables en la zona. No constituye
          avalúo oficial. Para una valuación formal con fines fiscales o de venta, contacta a tu
          administrador.
        </p>
      </div>
    </section>
  );
};

const KpiCell = ({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive";
  hint?: string;
}) => {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-[14px] md:text-[15px] font-semibold tabular-nums ${cls}`}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

// ── Mantenimiento ──

const MaintenanceSection = ({
  maintenance,
  status,
}: {
  maintenance: InvestmentProperty["maintenance"];
  status: MaintenanceUiStatus;
}) => {
  const monthlyFee = maintenance?.monthlyFee ?? 4500;
  const nextDate = maintenance?.nextDueDate ?? "Próximo mes";
  const history = maintenance?.history ?? [];

  const cfg = {
    current: {
      Icon: CheckCircle2,
      label: "Al día",
      pill: "bg-success/15 text-success",
      banner: "bg-success/[0.06] border-success/15",
    },
    due_soon: {
      Icon: Calendar,
      label: "Por vencer",
      pill: "bg-warning/15 text-warning",
      banner: "bg-warning/[0.06] border-warning/20",
    },
    overdue: {
      Icon: AlertCircle,
      label: "Vencido",
      pill: "bg-destructive/15 text-destructive",
      banner: "bg-destructive/[0.06] border-destructive/20",
    },
  }[status];

  const StatusIcon = cfg.Icon;

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Mantenimiento
        </h2>
      </div>

      <div className="space-y-4">
        <div className={`rounded-xl border p-4 ${cfg.banner}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.pill}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Estado
                </p>
                <p className="text-[14px] font-semibold text-foreground">{cfg.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Próximo pago
              </p>
              <p className="text-[14px] font-semibold text-foreground tabular-nums">
                {fmtMXN(monthlyFee)}
              </p>
              <p className="text-[11px] text-muted-foreground">{nextDate}</p>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground px-1 pb-1">
              Historial reciente
            </p>
            {history.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{item.month}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.status === "pagado" ? "Pagado" : "Pendiente"}
                    </p>
                  </div>
                </div>
                <p className="text-[13px] font-semibold text-foreground tabular-nums">
                  {fmtMXN(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ── Uso ──

const UsageSection = ({ usage }: { usage: Usage }) => {
  const cfg = {
    uso_propio: {
      Icon: Home,
      label: "Uso propio",
      description: "Estás usando esta propiedad como tu residencia o uso personal.",
      pill: "bg-primary/15 text-primary",
      cta: "Ponerla en renta",
    },
    renta: {
      Icon: KeyRound,
      label: "En renta",
      description: "Esta propiedad está generando ingresos por renta.",
      pill: "bg-success/15 text-success",
      cta: "Ver detalles de la renta",
    },
    disponible: {
      Icon: Building2,
      label: "Disponible",
      description: "Esta propiedad está vacía. Puedes ponerla en renta o usarla.",
      pill: "bg-muted text-muted-foreground",
      cta: "Activar uso o renta",
    },
  }[usage];

  const Icon = cfg.Icon;

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Home className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Uso de la propiedad
        </h2>
      </div>

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.pill}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold font-display text-foreground">{cfg.label}</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{cfg.description}</p>
          <button
            type="button"
            className="mt-3 text-[12px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
            onClick={() => console.log("Cambiar uso de la propiedad")}
          >
            {cfg.cta} →
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Sticky CTA ──

const PatrimonyStickyCTA = ({
  status,
  amount,
}: {
  status: MaintenanceUiStatus;
  amount: number;
}) => {
  if (status === "current") return null;

  const cfg =
    status === "overdue"
      ? {
          label: `Pagar mantenimiento vencido ${fmtMXN(amount)}`,
          classes: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        }
      : {
          label: `Pagar mantenimiento ${fmtMXN(amount)}`,
          classes: "bg-warning text-warning-foreground hover:bg-warning/90",
        };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3 md:p-4 md:left-[260px]">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => console.log("Navegar a pago de mantenimiento")}
          className={`w-full h-12 rounded-xl text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${cfg.classes}`}
        >
          {cfg.label}
        </button>
      </div>
    </div>
  );
};

export default PropertyPatrimonyDetail;
