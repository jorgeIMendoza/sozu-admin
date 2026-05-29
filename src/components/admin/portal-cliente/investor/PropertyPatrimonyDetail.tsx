import { useState, useEffect, useRef } from "react";
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
  MessageCircle,
  Phone,
  Mail,
  User,
} from "lucide-react";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { fmtMXN } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";
import { useAgentForCuenta } from "@/lib/portal-cliente/agent-data";
import PropertyDocuments from "./PropertyDocuments";
import PropertyHumanContact from "./PropertyHumanContact";
import PropertyTechnicalSheet from "./PropertyTechnicalSheet";
import { useProjectPhotos } from "@/lib/portal-cliente/construction-progress-data";
import { createPortal } from "react-dom";
import ManualsBlock from "../post-delivery/ManualsBlock";

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

  const deliveredAt = property.fechaEscritura ?? "2024-05-15";

  const maintenanceStatus: MaintenanceUiStatus =
    maintenance?.status === "pendiente" ? "due_soon" : "current";

  const usage: Usage = "uso_propio";

  return (
    <div className="pb-24 space-y-6">
      <PatrimonyHero investment={investment} deliveredAt={deliveredAt} />

      <div className="md:grid md:grid-cols-[1fr_280px] md:gap-6 space-y-6 md:space-y-0">
        {/* ── Main column ── */}
        <div className="space-y-6">
          <PatrimonyImage investment={investment} />

          <div className="md:hidden">
            <PropertyHumanContact investment={investment} role="administrator" />
          </div>

          <AssetValue
            valueMXN={valueMXN}
            purchaseValueMXN={purchaseMXN}
            deltaMXN={deltaMXN}
            deltaPct={deltaPct}
            deliveredAt={deliveredAt}
          />
          <MaintenanceSection maintenance={maintenance} status={maintenanceStatus} />
          <UsageSection usage={usage} />
          <PropertyDocuments propertyId={property.id} />
          <ManualsBlock cuentaId={property.id} />

          <div className="md:hidden">
            <PropertyTechnicalSheet property={property} />
          </div>
        </div>

        {/* ── Right column (desktop only) ── */}
        <div className="hidden md:block">
          <div className="space-y-4">
            <PatrimonyAgentSideCard investment={investment} />
            <DesktopPatrimonySidebar
              investment={investment}
              maintenanceStatus={maintenanceStatus}
            />
            <PatrimonyTechSideCard property={property} />
          </div>
        </div>
      </div>

      {/* Mobile-only sticky CTA */}
      <PatrimonyStickyCTA status={maintenanceStatus} amount={maintenance?.monthlyFee ?? 0} />
    </div>
  );
};

// ── Agent side card (desktop sidebar) ──

const PatrimonyAgentSideCard = ({ investment }: { investment: InvestmentProperty }) => {
  const { property } = investment;
  const { data: contact } = useAgentForCuenta(property.id, "seguimiento");

  if (!contact) {
    return (
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Tu asesor de seguimiento
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground">Se asignará próximamente.</p>
      </div>
    );
  }

  const subjectLabel = `${property.projectName} U-${property.unitNumber}`;
  const waMsg = `Hola ${contact.firstName}, tengo una pregunta sobre mi propiedad ${subjectLabel}.`;
  const waLink = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Tu asesor de seguimiento
        </h2>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-muted flex-shrink-0">
          <img
            src={contact.photoUrl}
            alt={contact.fullName}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold font-display text-foreground leading-tight truncate">
            {contact.fullName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{contact.title}</p>
          {contact.responseTimeAvg && (
            <p className="text-[10px] text-success font-medium mt-0.5">● {contact.responseTimeAvg}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          className="h-9 rounded-lg bg-success text-success-foreground text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-success/90 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" /> WA
        </a>
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`}
          className="h-9 rounded-lg border border-border bg-background text-foreground text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-muted transition-colors">
          <Phone className="w-3.5 h-3.5" /> Tel
        </a>
        <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Sobre ${subjectLabel}`)}`}
          className="h-9 rounded-lg border border-border bg-background text-foreground text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-muted transition-colors">
          <Mail className="w-3.5 h-3.5" /> Email
        </a>
      </div>
    </div>
  );
};

// ── Technical side card (desktop sidebar) ──

const PatrimonyTechSideCard = ({ property }: { property: InvestmentProperty["property"] }) => (
  <div className="rounded-2xl bg-card border border-border p-5">
    <div className="flex items-center gap-2 mb-4">
      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        Datos técnicos
      </h2>
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
      <TechCell label="Proyecto" value={property.projectName} />
      <TechCell label="Unidad" value={`U-${property.unitNumber}`} />
      <TechCell label="Tipo" value={property.type} />
      <TechCell label="Área" value={property.area} />
      <TechCell label="Recámaras" value={String(property.bedrooms)} />
      <TechCell label="Baños" value={String(property.bathrooms)} />
      <TechCell label="Piso" value={property.floor} />
    </div>
  </div>
);

const TechCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
    <p className="text-[12px] font-medium text-foreground mt-0.5 truncate">{value}</p>
  </div>
);

// ── Desktop sidebar ──

const DesktopPatrimonySidebar = ({
  investment,
  maintenanceStatus,
}: {
  investment: InvestmentProperty;
  maintenanceStatus: MaintenanceUiStatus;
}) => {
  const { financials, maintenance } = investment;
  const valueMXN = financials.currentEstimatedValue;
  const purchaseMXN = financials.initialPrice;
  const deltaMXN = valueMXN - purchaseMXN;
  const positive = deltaMXN >= 0;

  return (
    <div className="space-y-3">
      {/* Asset value card */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
          Valor actual estimado
        </p>
        <p className="font-display font-bold text-2xl tabular-nums text-foreground">
          {fmtMXN(valueMXN)}
        </p>
        <p className={`text-[12px] font-medium mt-1 ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? "+" : ""}
          {fmtMXN(deltaMXN)} ({positive ? "+" : ""}
          {financials.estimatedAppreciation.toFixed(1)}%)
        </p>
        <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
          <p>
            Precio de compra:{" "}
            <span className="font-medium text-foreground">{fmtMXN(purchaseMXN)}</span>
          </p>
        </div>
      </div>

      {/* Maintenance card */}
      {maintenance && (
        <div
          className={`rounded-2xl border p-4 ${
            maintenanceStatus === "current"
              ? "bg-success/[0.04] border-success/20"
              : maintenanceStatus === "due_soon"
              ? "bg-warning/[0.04] border-warning/20"
              : "bg-destructive/[0.04] border-destructive/20"
          }`}
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
            Mantenimiento mensual
          </p>
          <p className="font-display font-bold text-xl tabular-nums text-foreground">
            {fmtMXN(maintenance.monthlyFee)}
          </p>
          {maintenanceStatus !== "current" && (
            <button
              type="button"
              className={`mt-3 w-full h-9 rounded-xl text-[12px] font-semibold inline-flex items-center justify-center transition-colors ${
                maintenanceStatus === "overdue"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-warning text-warning-foreground hover:bg-warning/90"
              }`}
              onClick={() => console.log("Pagar mantenimiento")}
            >
              Pagar mantenimiento
            </button>
          )}
        </div>
      )}
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

  const sinceLabel = new Date(deliveredAt).toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });

  return (
    <section>
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
    </section>
  );
};

// ── Property gallery (main image + thumbnail strip) ──

const PatrimonyImage = ({ investment }: { investment: InvestmentProperty }) => {
  const { property } = investment;
  const heroImg = property.image || getPropertyImage(property.id, property.projectName);
  const { data: projectPhotos } = useProjectPhotos(property.projectId);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const allUrlsRef = useRef<string[]>([]);

  // Project photos take priority; fallback to heroImg only when empty
  const allUrls: string[] = projectPhotos?.length
    ? projectPhotos.map((p) => p.url).filter(Boolean)
    : heroImg
    ? [heroImg]
    : [];

  allUrlsRef.current = allUrls;

  const goTo = (idx: number) =>
    setActiveIdx(Math.max(0, Math.min(allUrlsRef.current.length - 1, idx)));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setActiveIdx((i) => Math.min(allUrlsRef.current.length - 1, i + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const current = allUrls[activeIdx] ?? null;

  if (!current) {
    return (
      <div
        className={`aspect-[2/1] rounded-2xl bg-gradient-to-br ${property.imageGradient} flex flex-col items-center justify-end p-5 pb-6`}
      >
        <p className="font-display font-bold text-foreground/50 text-xl text-center">
          {property.projectName}
        </p>
        <p className="text-foreground/35 text-[13px] mt-1">U-{property.unitNumber}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Main image */}
        <div
          className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden bg-muted cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={current}
            alt={`${property.projectName} U-${property.unitNumber}`}
            className="w-full h-full object-cover object-bottom"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/95 text-success-foreground text-[10px] font-semibold backdrop-blur">
            <KeyRound className="w-3 h-3" />
            Entregada
          </div>
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          {allUrls.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goTo(activeIdx - 1); }}
                disabled={activeIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 disabled:opacity-30"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goTo(activeIdx + 1); }}
                disabled={activeIdx === allUrls.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 disabled:opacity-30"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 right-3 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] tabular-nums">
                {activeIdx + 1} / {allUrls.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip — horizontal scroll */}
        {allUrls.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {allUrls.map((url, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === activeIdx
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent opacity-60 hover:opacity-90"
                }`}
              >
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox — portalled to body */}
      {lightboxOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="w-full max-w-5xl px-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={allUrls[activeIdx]}
                alt={`${property.projectName} ${activeIdx + 1}`}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            </div>

            {allUrls.length > 1 && (
              <>
                <div className="absolute inset-y-0 left-4 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); goTo(activeIdx - 1); }}
                    disabled={activeIdx === 0}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); goTo(activeIdx + 1); }}
                    disabled={activeIdx === allUrls.length - 1}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto pb-0.5 scrollbar-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {allUrls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                        i === activeIdx ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                      }`}
                    >
                      <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
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

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
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

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-3 border-t border-border">
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
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</p>
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
                className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0"
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
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.pill}`}
        >
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

// ── Mobile-only sticky CTA ──

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
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
      <button
        type="button"
        onClick={() => console.log("Navegar a pago de mantenimiento")}
        className={`w-full h-12 rounded-xl text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${cfg.classes}`}
      >
        {cfg.label}
      </button>
    </div>
  );
};

export default PropertyPatrimonyDetail;
