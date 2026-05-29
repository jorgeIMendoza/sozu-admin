import { useState } from "react";
import {
  CreditCard,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Receipt,
  FileText,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import {
  type PropertyPaymentPlan,
  getNextInstallment,
  getPlanProgress,
  getInstallmentBadge,
  getAccelerationState,
  getVisibleInstallments,
} from "@/lib/portal-cliente/payment-data";
import { useConstructionProgress } from "@/lib/portal-cliente/construction-progress-data";
import { fmtMXN as fmt } from "@/lib/utils";
import DaikuPaymentSheet from "./detail/DaikuPaymentSheet";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromInstallment } from "@/lib/portal-cliente/receipt-utils";
import AccelerationBanner from "./AccelerationBanner";
import PagoFinalSheet from "./detail/PagoFinalSheet";

interface DaikuPaymentCenterProps {
  property: InvestmentProperty;
  plan: PropertyPaymentPlan;
}

const DaikuPaymentCenter = ({ property, plan }: DaikuPaymentCenterProps) => {
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [accelerationSheetOpen, setAccelerationSheetOpen] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  const nextInstallment = getNextInstallment(plan);
  const progress = getPlanProgress(plan);
  const { data: construction } = useConstructionProgress(property.property.id);
  const acceleration = getAccelerationState(plan);

  const pagoFinalStage = property.stages.find((s) => s.id === "pago_final");
  const acceleratedStage = pagoFinalStage
    ? { ...pagoFinalStage, status: "active" as const, description: "Liquidación anticipada" }
    : null;

  const showBanner =
    acceleration.tier !== "none" &&
    acceleration.remainingBalance > 0 &&
    plan.estimatedDeliveryDate &&
    acceleration.daysUntilDelivery !== null;

  const heroDimmed = acceleration.tier === "critical";

  // Tone derivation for hero
  type Tone = "success" | "primary" | "warning" | "destructive";
  const heroTone: Tone = !nextInstallment
    ? "success"
    : nextInstallment.status === "vencido"
      ? "destructive"
      : nextInstallment.status === "cercano"
        ? "warning"
        : "primary";

  const toneBg: Record<Tone, string> = {
    success: "bg-success/10",
    primary: "bg-primary/5",
    warning: "bg-warning/10",
    destructive: "bg-destructive/10",
  };
  const toneIconBg: Record<Tone, string> = {
    success: "bg-success/15",
    primary: "bg-primary/15",
    warning: "bg-warning/15",
    destructive: "bg-destructive/15",
  };
  const toneText: Record<Tone, string> = {
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  const ToneIcon =
    heroTone === "success"
      ? CheckCircle2
      : heroTone === "warning"
        ? AlertTriangle
        : heroTone === "destructive"
          ? AlertCircle
          : Clock;

  const heroBtnClass =
    heroTone === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const scrollToInstallment = (n: number) => {
    const visibleNumbers = new Set(getVisibleInstallments(plan).map((i) => i.number));
    if (!visibleNumbers.has(n)) {
      setShowAllInstallments(true);
    }
    setTimeout(() => {
      document.getElementById(`installment-${n}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const scrollToConstruction = () => {
    const el = document.getElementById("construction-progress");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      toast("Tu vista de avance de obra está más abajo en el detalle de la propiedad.");
    }
  };

  const lastUpdate = construction?.updates[0];
  const propertyLabel = `${property.property.projectName} ${property.property.unitNumber}`;

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      {/* 0. Acceleration banner */}
      {showBanner && (
        <AccelerationBanner
          tier={acceleration.tier as "informative" | "urgent" | "critical"}
          daysUntilDelivery={acceleration.daysUntilDelivery!}
          remainingBalance={acceleration.remainingBalance}
          remainingInstallmentsCount={acceleration.remainingInstallmentsCount}
          estimatedDeliveryDate={plan.estimatedDeliveryDate!}
          onCoordinate={() => setAccelerationSheetOpen(true)}
          propertyId={property.property.id}
          propertyName={property.property.projectName}
          unitNumber={property.property.unitNumber}
        />
      )}

      {/* 1. Hero próximo pago */}
      <div
        className={`rounded-2xl p-5 ${toneBg[heroTone]} ${heroDimmed ? "opacity-60" : ""}`}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${toneIconBg[heroTone]}`}
          >
            <ToneIcon className={`w-5 h-5 ${toneText[heroTone]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-[10px] uppercase tracking-widest font-semibold ${toneText[heroTone]}`}
            >
              {nextInstallment ? "Próximo pago" : "Al corriente"}
            </p>
            {nextInstallment ? (
              <>
                <h3 className="font-display font-bold text-2xl text-foreground tabular-nums leading-tight">
                  Parcialidad {nextInstallment.number} · {fmt(nextInstallment.amount)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {nextInstallment.daysUntilDue < 0
                    ? `Venció el ${nextInstallment.dueDateDisplay} · Hace ${Math.abs(nextInstallment.daysUntilDue)} días`
                    : `Vence el ${nextInstallment.dueDateDisplay} · En ${nextInstallment.daysUntilDue} días`}
                </p>
              </>
            ) : (
              <h3 className="font-display font-bold text-xl text-foreground leading-tight">
                No tienes pagos pendientes
              </h3>
            )}
          </div>
        </div>
        {nextInstallment && (
          <button
            onClick={() => setPaymentSheetOpen(true)}
            className={`w-full h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${heroBtnClass}`}
          >
            <CreditCard className="w-4 h-4" />
            Pagar parcialidad
          </button>
        )}
      </div>

      {/* 2. Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pagadas</p>
          <p className="font-display font-semibold text-base tabular-nums mt-0.5">
            {progress.paidCount} / {plan.totalInstallments}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pagado</p>
          <p className="font-display font-semibold text-base tabular-nums mt-0.5 text-success">
            {fmt(progress.paidAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Restante</p>
          <p className="font-display font-semibold text-base tabular-nums mt-0.5 text-foreground">
            {fmt(progress.pendingAmount)}
          </p>
        </div>
      </div>

      {/* 3. Dot grid */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between items-baseline mb-3">
          <h4 className="font-display font-semibold text-sm text-foreground">
            Plan de {plan.totalInstallments} parcialidades
          </h4>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {progress.progressPct.toFixed(0)}% completado
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {plan.installments.map((inst) => {
            const base =
              "relative aspect-square rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all border";
            const cls =
              inst.status === "pagado"
                ? "bg-success/15 text-success border-success/20"
                : inst.status === "cercano"
                  ? "bg-warning/15 text-warning border-warning/30 ring-2 ring-warning/20"
                  : inst.status === "vencido"
                    ? "bg-destructive/15 text-destructive border-destructive/30 ring-2 ring-destructive/20"
                    : "bg-muted/40 text-muted-foreground border-border";
            return (
              <button
                key={inst.id}
                onClick={() => scrollToInstallment(inst.number)}
                className={`${base} ${cls}`}
                aria-label={`Parcialidad ${inst.number}`}
              >
                {inst.number}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success/40" /> Pagada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning/40" /> Próxima
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted" /> Futura
          </span>
        </div>
      </div>

      {/* 4. Avance de obra */}
      {construction && lastUpdate && (
        <button
          onClick={scrollToConstruction}
          className="w-full text-left rounded-xl border border-primary/20 bg-primary/[0.03] p-4 flex items-center gap-3 hover:bg-primary/[0.05] transition-colors"
        >
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-primary mb-0.5">
              Avance de obra
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{lastUpdate.stage}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tu proyecto está al {construction.globalProgress}% · Última actualización{" "}
              {construction.lastUpdated}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="font-display font-bold text-xl text-primary tabular-nums">
              {construction.globalProgress}%
            </span>
            <ChevronRight className="w-4 h-4 text-primary" />
          </div>
        </button>
      )}

      {/* 5. Calendario timeline */}
      <div>
        <div className="flex justify-between items-baseline mt-1">
          <h4 className="font-display font-semibold text-sm text-foreground">
            Calendario de pagos
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {progress.pendingCount} pendientes
          </span>
        </div>
        {(() => {
          const installmentsToShow = showAllInstallments
            ? plan.installments
            : getVisibleInstallments(plan);
          return (
            <>
              <div className="space-y-2 mt-3">
                {installmentsToShow.map((inst, idx) => {
                  const prev = installmentsToShow[idx - 1];
                  const gapCount =
                    prev && inst.number - prev.number > 1
                      ? inst.number - prev.number - 1
                      : 0;
                  const showGap = gapCount > 0 && !showAllInstallments;

                  const itemBorder =
                    inst.status === "cercano"
                      ? "border-warning/30 bg-warning/[0.04]"
                      : inst.status === "vencido"
                        ? "border-destructive/30 bg-destructive/[0.04]"
                        : "border-border bg-card";

                  const numClass =
                    inst.status === "pagado"
                      ? "bg-success/15 text-success"
                      : inst.status === "cercano"
                        ? "bg-warning/15 text-warning ring-2 ring-warning/20"
                        : inst.status === "vencido"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted/40 text-muted-foreground";

                  const badge = getInstallmentBadge(inst.status);

                  return (
                    <div key={inst.id}>
                      {showGap && (
                        <div className="flex items-center gap-2 py-2 px-1">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {gapCount} parcialidades más
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div
                        id={`installment-${inst.number}`}
                        className={`rounded-lg border p-3 transition-all ${itemBorder}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold tabular-nums ${numClass}`}
                          >
                            {inst.status === "pagado" ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              inst.number
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground tabular-nums">
                              Parcialidad {inst.number} · {fmt(inst.amount)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {inst.status === "pagado" && inst.paidAt
                                ? `Pagada el ${new Date(inst.paidAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
                                : `Vence el ${inst.dueDateDisplay}`}
                            </p>
                            {inst.constructionMilestone && (
                              <p className="text-[10px] text-muted-foreground/80 mt-0.5 inline-flex items-center">
                                <Building2 className="w-3 h-3 mr-1 text-muted-foreground/70" />
                                {inst.constructionMilestone}
                              </p>
                            )}
                            {inst.confirmationStatus === "recibido" && (
                              <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" />
                                Comprobante recibido · en revisión
                              </p>
                            )}
                            {inst.confirmationStatus === "validando" && (
                              <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5" />
                                Detectado vía STP · validando (24-48 hrs)
                              </p>
                            )}
                            {inst.confirmationStatus === "confirmado" &&
                              inst.status === "pagado" && (
                                <p className="text-[10px] text-success mt-1 flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Pago confirmado
                                </p>
                              )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {inst.status === "pagado" && (
                              <button
                                onClick={() =>
                                  setReceiptData(
                                    buildReceiptFromInstallment(inst, plan, property),
                                  )
                                }
                                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                                aria-label="Ver recibo"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowAllInstallments(!showAllInstallments)}
                className="w-full mt-3 py-3 text-xs font-medium text-primary hover:text-primary/80 flex items-center justify-center gap-1.5 transition-colors"
              >
                {showAllInstallments ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Mostrar solo lo importante
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Ver las {plan.totalInstallments} parcialidades
                  </>
                )}
              </button>
            </>
          );
        })()}
      </div>

      <DaikuPaymentSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        installment={nextInstallment ?? null}
        plan={plan}
        propertyLabel={propertyLabel}
      />

      <PaymentReceiptModal
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
        receipt={receiptData}
      />

      {acceleratedStage && (
        <PagoFinalSheet
          stage={acceleratedStage}
          investment={{
            ...property,
            financials: {
              ...property.financials,
              pendingBalance: acceleration.remainingBalance,
            },
          }}
          open={accelerationSheetOpen}
          onClose={() => setAccelerationSheetOpen(false)}
        />
      )}
    </div>
  );
};

export default DaikuPaymentCenter;

