import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  X,
  MapPin,
  Calendar,
  FileText,
  Construction,
  CheckCircle2,
  CreditCard,
  Building2,
  User,
} from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { fmtMXN } from "@/lib/utils";
import { getPropertyImage } from "@/lib/offers/property-images";
import PropertyDocuments from "./PropertyDocuments";
import PropertyHumanContact from "./PropertyHumanContact";
import PropertyTechnicalSheet from "./PropertyTechnicalSheet";

interface Props {
  investment: InvestmentProperty;
}

const STAGES = [
  {
    id: "preventa",
    label: "En Preventa",
    description:
      "Tu unidad está reservada. Falta confirmar el plan de pagos y firmar contrato preliminar.",
  },
  {
    id: "pago_final",
    label: "En Pago",
    description:
      "Estás liquidando las parcialidades acordadas en tu esquema de financiamiento.",
  },
  {
    id: "escrituracion",
    label: "En Escrituración",
    description:
      "Pagos completados. Coordinando firma de escritura pública ante notaría.",
  },
  {
    id: "entrega",
    label: "Por Entregar",
    description:
      "Escritura firmada. Esperando fecha de entrega física de tu unidad.",
  },
] as const;

const PropertyAcquisitionDetail = ({ investment }: Props) => {
  const { property, stages } = investment;
  const activeStage = stages.find((s) => s.status === "active");
  const currentStageIdx = Math.max(
    0,
    STAGES.findIndex((s) => s.id === activeStage?.id),
  );
  const currentStage = STAGES[currentStageIdx];

  return (
    <div className="pb-32 space-y-8">
      <PropertyHero investment={investment} />

      {/* STAGE TRACKER */}
      <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Etapa actual
          </h2>
        </div>

        <div className="relative">
          <div className="flex items-start justify-between gap-2 relative">
            {/* connector line */}
            <div className="absolute top-4 left-[12%] right-[12%] h-[2px] bg-muted -z-0" />
            <div
              className="absolute top-4 left-[12%] h-[2px] bg-success transition-all -z-0"
              style={{
                width: `${(currentStageIdx / (STAGES.length - 1)) * 76}%`,
              }}
            />
            {STAGES.map((stage, idx) => {
              const passed = idx < currentStageIdx;
              const current = idx === currentStageIdx;
              return (
                <div
                  key={stage.id}
                  className="relative z-10 flex flex-col items-center gap-2 flex-1 min-w-0"
                >
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
                    className={`text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-center leading-tight ${
                      current
                        ? "text-foreground"
                        : passed
                        ? "text-foreground/70"
                        : "text-muted-foreground"
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

      <PaymentSchedule investment={investment} />

      <ConstructionProgress investment={investment} />

      <PropertyDocuments propertyId={property.id} />

      <PropertyHumanContact investment={investment} role="agent" />

      <PropertyTechnicalSheet property={property} />


      <AcquisitionStickyCTA investment={investment} />
    </div>
  );
};

// ── Hero ──

const PropertyHero = ({ investment }: { investment: InvestmentProperty }) => {
  const { property } = investment;
  const heroImg = getPropertyImage(property.id);
  const gallery: string[] = heroImg ? [heroImg] : [];
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeStage = investment.stages.find((s) => s.status === "active");
  const stageInfo = getStageInfo(activeStage?.id ?? "preventa");

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Propiedad · U-{property.unitNumber}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3 flex-wrap">
          <h1 className="font-display font-bold text-[24px] md:text-[30px] text-foreground tracking-tight leading-tight">
            {property.projectName} · U-{property.unitNumber}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${stageInfo.classes}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {stageInfo.label}
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
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-white text-[10px] font-medium">
              {activeImage + 1} / {gallery.length}
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

          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                    activeImage === idx
                      ? "border-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt={`miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
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

// ── Cronograma de pagos ──

interface PaymentRow {
  id: string;
  label: string;
  amount: number;
  date: string;
  status: "paid" | "current" | "upcoming";
}

const PaymentSchedule = ({ investment }: { investment: InvestmentProperty }) => {
  const { payments, financials, stages } = investment;
  const activeStage = stages.find((s) => s.status === "active");

  // Derivar cronograma: pagos históricos + (si hay saldo) un pago actual y/o pago final futuro
  const rows: PaymentRow[] = payments.map((p, i) => ({
    id: `paid-${i}`,
    label: p.concept,
    amount: p.amount,
    date: p.date,
    status: "paid" as const,
  }));

  if (financials.pendingBalance > 0) {
    if (activeStage?.id === "pago_final") {
      rows.push({
        id: "current-final",
        label: "Pago final",
        amount: financials.pendingBalance,
        date: activeStage?.details?.["Fecha límite"] ?? "Próximo",
        status: "current",
      });
    } else {
      rows.push({
        id: "next",
        label: "Próximo abono",
        amount: financials.pendingBalance,
        date: "Por programar",
        status: "upcoming",
      });
    }
  }

  const paidCount = rows.filter((r) => r.status === "paid").length;

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Cronograma de pagos
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {paidCount} de {rows.length} pagados
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const cfg =
            row.status === "paid"
              ? {
                  Icon: CheckCircle2,
                  circle: "bg-success/15 text-success",
                  pill: "bg-success/15 text-success",
                  pillLabel: "Pagado",
                  bg: "",
                }
              : row.status === "current"
              ? {
                  Icon: Calendar,
                  circle: "bg-warning/20 text-warning ring-4 ring-warning/15",
                  pill: "bg-warning/15 text-warning",
                  pillLabel: "Pendiente",
                  bg: "bg-warning/5 border border-warning/20",
                }
              : {
                  Icon: Calendar,
                  circle: "bg-muted text-muted-foreground",
                  pill: "bg-muted text-muted-foreground",
                  pillLabel: "Por venir",
                  bg: "",
                };

          return (
            <div
              key={row.id}
              className={`flex items-center gap-3 rounded-xl p-3 ${cfg.bg}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.circle}`}>
                <cfg.Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">{row.date}</p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <p className="text-[13px] font-semibold text-foreground tabular-nums">
                    {fmtMXN(row.amount)}
                  </p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.pill}`}>
                    {cfg.pillLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ── Avance de obra ──

const ConstructionProgress = ({ investment }: { investment: InvestmentProperty }) => {
  const { property, stages } = investment;
  const activeStage = stages.find((s) => s.status === "active");

  // Derivar progreso por etapa
  const progressMap: Record<string, number> = {
    preventa: 25,
    pago_final: 60,
    escrituracion: 90,
    entrega: 100,
  };
  const phaseMap: Record<string, string> = {
    preventa: "Cimentación",
    pago_final: "Albañilería",
    escrituracion: "Acabados",
    entrega: "Listo para entrega",
  };
  const effectiveProgress = progressMap[activeStage?.id ?? "preventa"] ?? 28;
  const currentPhase = phaseMap[activeStage?.id ?? "preventa"] ?? "En obra";
  const photoUrl = getPropertyImage(property.id);

  return (
    <section className="rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Construction className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Avance de obra
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {photoUrl && (
          <div className="aspect-[16/9] rounded-xl overflow-hidden bg-muted">
            <img src={photoUrl} alt="Avance de obra" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Progreso general
              </span>
              <span className="text-[20px] font-display font-bold text-foreground tabular-nums">
                {effectiveProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${effectiveProgress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <DataCell label="Etapa actual" value={currentPhase} />
            <DataCell label="Última actualización" value="12 may 2026" />
            <DataCell label="Entrega estimada" value={property.deliveryDate} />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
          >
            Ver galería completa del avance
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};

const DataCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
    <p className="text-[13px] font-medium text-foreground mt-0.5">{value}</p>
  </div>
);

// ── Sticky CTA contextual ──



const AcquisitionStickyCTA = ({ investment }: { investment: InvestmentProperty }) => {
  const cta = getContextualCTA(investment);
  if (!cta) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3 md:p-4 md:left-[260px]">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={cta.onClick}
          className={`w-full h-12 rounded-xl text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${cta.classes}`}
        >
          {cta.icon}
          {cta.label}
        </button>
      </div>
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

function getContextualCTA(investment: InvestmentProperty) {
  const { financials, stages } = investment;
  const active = stages.find((s) => s.status === "active");

  if (active?.id === "pago_final" && financials.pendingBalance > 0) {
    return {
      label: `Pagar ${fmtMXN(financials.pendingBalance)}`,
      classes: "bg-warning text-warning-foreground hover:bg-warning/90",
      icon: <CreditCard className="w-4 h-4" />,
      onClick: () => console.log("Navegar a flujo de pago"),
    };
  }

  if (active?.id === "escrituracion") {
    return {
      label: "Agendar firma con notaría",
      classes: "bg-primary text-primary-foreground hover:bg-primary/90",
      icon: <FileText className="w-4 h-4" />,
      onClick: () => console.log("Navegar a agendar firma"),
    };
  }

  if (active?.id === "entrega") {
    return {
      label: "Agendar visita de entrega",
      classes: "bg-success text-success-foreground hover:bg-success/90",
      icon: <Calendar className="w-4 h-4" />,
      onClick: () => console.log("Navegar a agendar entrega"),
    };
  }

  if (active?.id === "preventa") {
    return {
      label: "Confirmar plan de pagos",
      classes: "bg-primary text-primary-foreground hover:bg-primary/90",
      icon: <CreditCard className="w-4 h-4" />,
      onClick: () => console.log("Confirmar plan"),
    };
  }

  return {
    label: "Hablar con mi agente",
    classes: "bg-primary text-primary-foreground hover:bg-primary/90",
    icon: <User className="w-4 h-4" />,
    onClick: () => console.log("Abrir WhatsApp del agente"),
  };
}

export default PropertyAcquisitionDetail;
