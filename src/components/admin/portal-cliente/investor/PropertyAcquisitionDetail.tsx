import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  CreditCard,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Phone,
  Mail,
  Eye,
  AlertTriangle,
  Landmark,
  Layers,
  Receipt,
} from "lucide-react";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { usePaymentPlan, type PaymentApplication } from "@/lib/portal-cliente/payment-data";
import DocViewerPortal from "@/components/admin/portal-cliente/DocViewerPortal";
import { fmtMXN, fmtMXNDecimals } from "@/lib/utils";
import { getPropertyImage } from "@/lib/portal-cliente/property-images";
import { useProjectPhotos } from "@/lib/portal-cliente/construction-progress-data";
import { useAgentForCuenta } from "@/lib/portal-cliente/agent-data";
import PropertyDocuments from "./PropertyDocuments";
import FichaTecnicaSection from "./FichaTecnicaSection";
import { useClientePropiedadDetalle } from "@/hooks/useClientePropiedadDetalle";
import ConstructionProgressSection from "@/components/admin/portal-cliente/detail/ConstructionProgress";
import AdditionalProducts from "@/components/admin/portal-cliente/detail/AdditionalProducts";
import AcquisitionPaymentSheet from "@/components/admin/portal-cliente/detail/AcquisitionPaymentSheet";
import PagoFinalSheet from "@/components/admin/portal-cliente/detail/PagoFinalSheet";
import PaymentMethodBadge from "@/components/admin/portal-cliente/PaymentMethodBadge";

interface Props {
  investment: InvestmentProperty;
}

const STAGES = [
  {
    id: "preventa",
    label: "En Preventa",
    description: "Tu unidad está reservada. Falta confirmar el plan de pagos y firmar contrato preliminar.",
  },
  {
    id: "pago_final",
    label: "En Pago",
    description: "Estás liquidando las parcialidades acordadas en tu esquema de financiamiento.",
  },
  {
    id: "escrituracion",
    label: "En Escrituración",
    description: "Pagos completados. Coordinando firma de escritura pública ante notaría.",
  },
  {
    id: "entrega",
    label: "Por Entregar",
    description: "Escritura firmada. Esperando fecha de entrega física de tu unidad.",
  },
] as const;

const PropertyAcquisitionDetail = ({ investment }: Props) => {
  const { property, stages } = investment;
  const activeStage = stages.find((s) => s.status === "active");
  const currentStageIdx = Math.max(0, STAGES.findIndex((s) => s.id === activeStage?.id));
  const currentStage = STAGES[currentStageIdx];
  const stageInfo = getStageInfo(activeStage?.id ?? "preventa");

  const { data: propDetalle, isLoading: loadingFicha } = useClientePropiedadDetalle(Number(property.id));

  const [showPaySheet, setShowPaySheet] = useState(false);
  const [showPagoFinalSheet, setShowPagoFinalSheet] = useState(false);
  const propertyLabel = `${property.projectName} · U-${property.unitNumber}`;
  const enDemanda = !!property.enDemanda;

  const handlePay = () => {
    if (enDemanda) return; // propiedad en proceso legal → solo lectura
    const tipoFin = investment.property.tipoFinanciamiento;
    // Crédito hipotecario: SOZU no cobra, paga el banco → flujo de banco/estado, nunca datos de pago (STP)
    if (tipoFin === "CREDITO_HIPOTECARIO") {
      setShowPagoFinalSheet(true);
      return;
    }
    // Recursos propios: instrucciones de pago (STP)
    if (tipoFin === "RECURSOS_PROPIOS") {
      setShowPaySheet(true);
      return;
    }
    // Aún sin forma de pago: si es el último → elegir forma; si no → pago normal
    const pendingPayments = investment.payments.filter(p => p.status !== "pagado");
    const isLastPayment = pendingPayments.length === 1;
    if (isLastPayment) setShowPagoFinalSheet(true);
    else setShowPaySheet(true);
  };

  return (
    <div className="pb-24 space-y-5 relative">
      {/* ── En demanda: overlay de solo lectura ── */}
      {enDemanda && (
        <div className="absolute inset-0 z-40 bg-neutral-500/20 dark:bg-neutral-900/45 backdrop-grayscale cursor-not-allowed flex justify-center">
          <div className="sticky top-6 h-fit inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-yellow-950 shadow-lg border border-yellow-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">En demanda · Modo solo lectura</span>
          </div>
        </div>
      )}

      {/* ── Full-width title ── */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Propiedad · U-{property.unitNumber}
        </p>
        <div className="mt-1 flex items-start justify-between gap-2 flex-wrap">
          <h1 className="font-display font-bold text-[22px] md:text-[28px] text-foreground tracking-tight leading-tight">
            {property.projectName}
            <span className="text-muted-foreground font-normal"> · U-{property.unitNumber}</span>
          </h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${stageInfo.classes}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {stageInfo.label}
          </span>
        </div>
        {(property.address || property.location) && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{property.address ?? property.location}</span>
          </p>
        )}
      </div>

      {/* ── 2-col grid ── */}
      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-6 space-y-4 md:space-y-0">

        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* 0 · Confirmación de forma de pago final elegida */}
          <PaymentMethodBadge cuentaId={Number(property.id)} tipo={property.tipoFinanciamiento} />

          {/* 1 · Imagen */}
          <PropertyImage investment={investment} />

          {/* 2 · Avance de obra */}
          <ConstructionProgressSection cuentaId={property.id} activeStageId={activeStage?.id} />

          {/* 3 · Productos adicionales */}
          {(investment.additionalProducts?.length ?? 0) > 0 && (
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <AdditionalProducts products={investment.additionalProducts!} />
            </div>
          )}

          {/* 4 · Etapa actual */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Etapa actual
              </h2>
            </div>

            <div className="relative">
              <div className="flex items-start justify-between gap-2 relative">
                <div className="absolute top-4 left-[12%] right-[12%] h-[2px] bg-muted -z-0" />
                <div
                  className="absolute top-4 left-[12%] h-[2px] bg-success transition-all -z-0"
                  style={{ width: `${(currentStageIdx / (STAGES.length - 1)) * 76}%` }}
                />
                {STAGES.map((stage, idx) => {
                  const passed = idx < currentStageIdx;
                  const current = idx === currentStageIdx;
                  return (
                    <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all ${
                          passed
                            ? "bg-success text-success-foreground"
                            : current
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {passed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide text-center leading-tight ${
                          current ? "text-foreground" : passed ? "text-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {currentStage && (
                <div className="mt-6 rounded-xl bg-primary/5 border border-primary/15 p-4">
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-primary">
                    Ahora estás aquí · {currentStage.label}
                  </p>
                  <p className="text-[13px] text-foreground mt-1.5 leading-relaxed">
                    {activeStage?.contextMessage ?? currentStage.description}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Precio de compra (mobile only — desktop shows in right col) */}
          <div className="md:hidden">
            <FinancialSideCard investment={investment} onPay={handlePay} />
          </div>

          {/* 5 · Cronograma de pagos */}
          <PaymentSchedule investment={investment} />

          {/* 6 · Documentos */}
          <PropertyDocuments propertyId={property.id} />

          {/* 7 · Ficha técnica */}
          {loadingFicha ? (
            <div className="rounded-2xl border border-border bg-card p-5 md:p-6 animate-pulse space-y-3">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
              <div className="h-40 bg-muted rounded-xl" />
            </div>
          ) : propDetalle && (propDetalle.numeroPiso != null || propDetalle.planoUbicacionUrl || propDetalle.planoArquitectonico) ? (
            <FichaTecnicaSection propDetalle={propDetalle} />
          ) : null}

          {/* Agente (mobile only — desktop shows in right col) */}
          <div className="md:hidden">
            <AgentSideCard investment={investment} />
          </div>
        </div>

        {/* ── Right column (desktop only) ── */}
        <div className="hidden md:block space-y-4">
          <AgentSideCard investment={investment} />
          <FinancialSideCard investment={investment} onPay={handlePay} />
          <TechnicalSideCard property={property} />
        </div>
      </div>

      {/* Mobile-only sticky CTA (oculto en modo solo lectura por demanda) */}
      {!enDemanda && <AcquisitionStickyCTA investment={investment} onPay={handlePay} />}

      <AcquisitionPaymentSheet
        open={showPaySheet}
        onClose={() => setShowPaySheet(false)}
        cuentaId={Number(property.id)}
        propertyLabel={propertyLabel}
      />

      {activeStage && (
        <PagoFinalSheet
          stage={activeStage}
          investment={investment}
          open={showPagoFinalSheet}
          onClose={() => setShowPagoFinalSheet(false)}
          onViewPaymentInstructions={() => {
            setShowPagoFinalSheet(false);
            setShowPaySheet(true);
          }}
        />
      )}
    </div>
  );
};

// ── Lightbox (shared) ──

interface LightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

const Lightbox = ({ src, alt = "", open, onClose }: LightboxProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-full max-h-[85vh] object-contain rounded-xl"
        />
      </div>
    </div>,
    document.body,
  );
};

// ── Property image ──

const PropertyImage = ({ investment }: { investment: InvestmentProperty }) => {
  const { property } = investment;
  const heroImg = property.image || getPropertyImage(property.id, property.projectName);
  const { data: projectPhotos } = useProjectPhotos(property.projectId);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const allUrls: string[] = projectPhotos?.length
    ? projectPhotos.map((p) => p.url).filter(Boolean)
    : heroImg
    ? [heroImg]
    : [];

  const goTo = (idx: number) =>
    setActiveIdx(Math.max(0, Math.min(allUrls.length - 1, idx)));

  const current = allUrls[activeIdx] ?? null;

  if (!current) {
    return (
      <div
        className={`aspect-video rounded-2xl bg-gradient-to-br ${property.imageGradient} flex flex-col items-center justify-end p-5 pb-6`}
      >
        <p className="font-display font-bold text-foreground/50 text-xl text-center">{property.projectName}</p>
        <p className="text-foreground/35 text-[13px] mt-1">U-{property.unitNumber}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div
          className="relative w-full aspect-video rounded-2xl overflow-hidden bg-muted cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={current}
            alt={`${property.projectName} U-${property.unitNumber}`}
            className="w-full h-full object-cover object-bottom"
            loading="lazy"
            decoding="async"
          />
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
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        src={current}
        alt={`${property.projectName} U-${property.unitNumber}`}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};

// ── Cronograma de pagos ──

type ScheduleStatus = "pagado" | "parcial" | "pendiente";

interface ScheduleRow {
  id: string;
  label: string;
  planned: number;   // monto total del concepto (acuerdos_pago.monto)
  applied: number;   // suma de pagos aplicados (aplicaciones_pago)
  pending: number;   // planned - applied
  date: string;
  status: ScheduleStatus;
  applications: PaymentApplication[];
}

type SchedulePreview = { url: string; label: string; date: string; amount: number };

function fmtScheduleDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr;
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// Sub-lista: cada pago (dispersión) aplicado a un concepto
const AppliedPaymentRow = ({ app, onView }: { app: PaymentApplication; onView: (p: SchedulePreview) => void }) => {
  const url = app.cepUrl ?? app.evidenceUrl;
  return (
    <div className="flex items-center gap-2 py-1.5 pl-3 border-l-2 border-primary/20">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-foreground truncate">
          {app.methodName ?? "Pago"} · <span className="tabular-nums">{fmtMXNDecimals(app.amount)}</span>
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {app.dateDisplay}{app.trackingKey ? ` · Clave ${app.trackingKey}` : ""}
        </p>
      </div>
      {url && (
        <button
          onClick={() => onView({ url, label: app.methodName ?? "Pago", date: app.date, amount: app.amount })}
          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={app.cepUrl ? "CEP electrónico" : "Comprobante de pago"}
        >
          <Receipt className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const PaymentSchedule = ({ investment }: { investment: InvestmentProperty }) => {
  const plan = usePaymentPlan(investment.property.id);
  const [listExpanded, setListExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<SchedulePreview | null>(null);

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Fuente de verdad: pagos aplicados (aplicaciones_pago) por concepto, no el monto planeado.
  const allRows: ScheduleRow[] = plan
    ? plan.installments.map((inst) => {
        const applied = inst.appliedAmount;
        const planned = inst.amount;
        const isPaid = inst.status === "pagado";
        const status: ScheduleStatus = isPaid ? "pagado" : applied > 0.01 ? "parcial" : "pendiente";
        return {
          id: inst.id,
          label: inst.concepto,
          planned,
          applied,
          pending: Math.max(0, planned - applied),
          date: inst.dueDate,
          status,
          applications: inst.applications ?? [],
        };
      })
    : investment.payments.map((p, i) => {
        const paid = p.status === "pagado";
        return {
          id: `p-${i}`,
          label: p.concept,
          planned: p.amount,
          applied: paid ? p.amount : 0,
          pending: paid ? 0 : p.amount,
          date: p.date,
          status: (paid ? "pagado" : "pendiente") as ScheduleStatus,
          applications: [] as PaymentApplication[],
        };
      });

  allRows.sort((a, b) => b.date.localeCompare(a.date));

  const paidCount = allRows.filter((r) => r.status === "pagado").length;
  const LIMIT = 5;
  const rows = listExpanded ? allRows : allRows.slice(0, LIMIT);
  const hasMore = allRows.length > LIMIT;

  const statusMeta: Record<ScheduleStatus, { pill: string; icon: string; label: string; box: string }> = {
    pagado:    { pill: "bg-success/10 text-success", icon: "bg-success/15 text-success", label: "Pagado", box: "" },
    parcial:   { pill: "bg-warning/10 text-warning", icon: "bg-warning/20 text-warning", label: "Parcial", box: "bg-warning/[0.04] border border-warning/20" },
    pendiente: { pill: "bg-warning/10 text-warning", icon: "bg-warning/20 text-warning", label: "Pendiente", box: "bg-warning/[0.04] border border-warning/20" },
  };

  // Celda de monto según estatus
  const amountCell = (row: ScheduleRow, align: "right" | "left") => {
    const alignCls = align === "right" ? "text-right items-end" : "text-left items-start";
    if (row.status === "parcial") {
      return (
        <div className={`flex flex-col leading-tight ${alignCls}`}>
          <span className="text-[13px] font-semibold tabular-nums text-foreground whitespace-nowrap">{fmtMXNDecimals(row.applied)}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">de {fmtMXNDecimals(row.planned)}</span>
          <span className="text-[10px] font-medium text-warning tabular-nums whitespace-nowrap">Faltan {fmtMXNDecimals(row.pending)}</span>
        </div>
      );
    }
    const amt = row.status === "pagado" ? (row.applied || row.planned) : row.planned;
    return <p className={`text-[13px] font-semibold tabular-nums whitespace-nowrap ${align === "right" ? "text-right" : ""}`}>{fmtMXNDecimals(amt)}</p>;
  };

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Cronograma de pagos
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {paidCount}/{allRows.length} pagados
        </span>
      </div>

      <div className="hidden md:grid md:grid-cols-[1fr_170px_92px_32px] text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-2 border-b border-border mb-1 gap-2">
        <span>Concepto</span>
        <span className="text-right">Monto</span>
        <span className="text-right">Estatus</span>
        <span />
      </div>

      <div className="space-y-1">
        {rows.map((row) => {
          const meta = statusMeta[row.status];
          const appCount = row.applications.length;
          const canExpand = appCount >= 1;
          const isOpen = expandedRows.has(row.id);
          const countChip = appCount > 1 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              <Layers className="w-2.5 h-2.5" />{appCount} pagos
            </span>
          );

          return (
            <div key={row.id} className={`rounded-xl ${meta.box}`}>
              {/* Mobile */}
              <div className="md:hidden flex items-center gap-2.5 p-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.icon}`}>
                  {row.status === "pagado" ? <CheckCircle2 className="w-3.5 h-3.5" /> : row.status === "parcial" ? <Layers className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-medium text-foreground truncate">{row.label}</p>
                    {countChip}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{fmtScheduleDate(row.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {amountCell(row, "right")}
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${meta.pill}`}>{meta.label}</span>
                  {canExpand && (
                    <button
                      onClick={() => toggleRow(row.id)}
                      className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Ver pagos aplicados"
                    >
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden md:grid md:grid-cols-[1fr_170px_92px_32px] items-center px-2 py-2 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-medium text-foreground truncate">{row.label}</p>
                    {countChip}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{fmtScheduleDate(row.date)}</p>
                </div>
                <div className="flex justify-end">{amountCell(row, "right")}</div>
                <div className="flex justify-end">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.pill}`}>{meta.label}</span>
                </div>
                <div className="flex justify-end">
                  {canExpand && (
                    <button
                      onClick={() => toggleRow(row.id)}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Ver pagos aplicados"
                    >
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-lista de pagos aplicados */}
              {canExpand && isOpen && (
                <div className="px-3 pb-2.5 pt-0.5 space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 pl-3">
                    {appCount} pago{appCount !== 1 ? "s" : ""} aplicado{appCount !== 1 ? "s" : ""} a {row.label}
                  </p>
                  {row.applications.map((app, ai) => (
                    <AppliedPaymentRow key={ai} app={app} onView={setPreview} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setListExpanded(!listExpanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-2 border-t border-border"
        >
          {listExpanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Ver {allRows.length - LIMIT} más</>}
        </button>
      )}

      {/* Comprobante / CEP — misma modal chica que en Pagos */}
      <DocViewerPortal
        open={!!preview}
        onClose={() => setPreview(null)}
        url={preview?.url ?? ""}
        title={preview?.label ?? ""}
        subtitle={preview ? `${fmtScheduleDate(preview.date)} · ${fmtMXNDecimals(preview.amount)}` : undefined}
        downloadFilename={preview ? `SOZU-Comprobante-${preview.label}-${preview.date}.pdf` : undefined}
      />
    </section>
  );
};

// ── Financial side card ──

const FinancialSideCard = ({ investment, onPay }: { investment: InvestmentProperty; onPay: () => void }) => {
  const { financials, property } = investment;
  const progress = financials.initialPrice > 0
    ? (financials.totalPaid / financials.initialPrice) * 100
    : 0;
  const cta = getContextualCTA(investment, onPay);

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
        Precio de compra
      </p>
      <p className="font-display font-bold text-[26px] tabular-nums text-foreground leading-tight mb-4">
        {fmtMXN(financials.initialPrice)}
      </p>

      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>{progress.toFixed(0)}% pagado</span>
          <span>{fmtMXN(financials.pendingBalance)} restante</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4 border-b border-border mb-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pagado</p>
          <p className="text-[13px] font-semibold text-primary tabular-nums">{fmtMXN(financials.totalPaid)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Restante</p>
          <p className="text-[13px] font-semibold tabular-nums">{fmtMXN(financials.pendingBalance)}</p>
        </div>
      </div>

      {property.deliveryDate && property.deliveryDate !== "—" && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Entrega: <span className="font-medium text-foreground">{property.deliveryDate}</span></span>
        </div>
      )}

      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className={`w-full h-10 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${cta.classes}`}
        >
          {cta.icon}
          {cta.label}
        </button>
      )}
    </div>
  );
};

// ── Technical side card ──

const TechnicalSideCard = ({ property }: { property: InvestmentProperty["property"] }) => (
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
      <TechCell label="Entrega" value={property.deliveryDate} />
    </div>
  </div>
);

const TechCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
    <p className="text-[12px] font-medium text-foreground mt-0.5 truncate">{value}</p>
  </div>
);

// ── Agent side card ──

const AgentSideCard = ({ investment }: { investment: InvestmentProperty }) => {
  const { property } = investment;
  const { data: contact } = useAgentForCuenta(property.id, "comercial");

  if (!contact) {
    return (
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Tu agente</h2>
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
          Tu agente comercial
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
          <p className="text-[13px] font-semibold font-display text-foreground leading-tight truncate">{contact.fullName}</p>
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

// ── Mobile-only sticky CTA ──

const AcquisitionStickyCTA = ({ investment, onPay }: { investment: InvestmentProperty; onPay: () => void }) => {
  const cta = getContextualCTA(investment, onPay);
  if (!cta) return null;

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3">
      <button
        type="button"
        onClick={cta.onClick}
        className={`w-full h-12 rounded-xl text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${cta.classes}`}
      >
        {cta.icon}
        {cta.label}
      </button>
    </div>
  );
};

// ── Helpers ──

function getStageInfo(stageId: string) {
  const map: Record<string, { label: string; classes: string }> = {
    preventa: { label: "En Preventa", classes: "bg-primary/10 text-primary" },
    pago_final: { label: "Pago Pendiente", classes: "bg-warning/15 text-warning" },
    escrituracion: { label: "En Escrituración", classes: "bg-primary/15 text-primary" },
    entrega: { label: "Por Entregar", classes: "bg-success/15 text-success" },
    post_entrega: { label: "Entregada", classes: "bg-success/15 text-success" },
  };
  return map[stageId] ?? { label: stageId, classes: "bg-muted text-muted-foreground" };
}

function getContextualCTA(investment: InvestmentProperty, onPay: () => void) {
  const { financials, stages } = investment;
  const active = stages.find((s) => s.status === "active");

  if (active?.id === "pago_final" && financials.pendingBalance > 0) {
    if (investment.property.tipoFinanciamiento === "CREDITO_HIPOTECARIO") {
      return { label: "Ver crédito hipotecario", classes: "bg-primary text-primary-foreground hover:bg-primary/90", icon: <Landmark className="w-4 h-4" />, onClick: onPay };
    }
    return { label: `Pagar ${fmtMXN(financials.pendingBalance)}`, classes: "bg-warning text-warning-foreground hover:bg-warning/90", icon: <CreditCard className="w-4 h-4" />, onClick: onPay };
  }
  if (active?.id === "escrituracion") {
    return { label: "Agendar firma con notaría", classes: "bg-primary text-primary-foreground hover:bg-primary/90", icon: <FileText className="w-4 h-4" />, onClick: () => console.log("escritura") };
  }
  if (active?.id === "entrega") {
    return { label: "Agendar visita de entrega", classes: "bg-success text-success-foreground hover:bg-success/90", icon: <Calendar className="w-4 h-4" />, onClick: () => console.log("entrega") };
  }
  if (active?.id === "preventa") {
    return { label: "Confirmar plan de pagos", classes: "bg-primary text-primary-foreground hover:bg-primary/90", icon: <CreditCard className="w-4 h-4" />, onClick: onPay };
  }
  return { label: "Hablar con mi agente", classes: "bg-primary text-primary-foreground hover:bg-primary/90", icon: <User className="w-4 h-4" />, onClick: () => console.log("agente") };
}

export default PropertyAcquisitionDetail;
