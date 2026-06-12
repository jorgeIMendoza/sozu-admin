import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { MaintenanceData, InvestmentProperty } from "@/lib/offers/mock-data";
import {
  useMaintenanceAccount,
  getAccountStatus,
  getCurrentCharge,
  getYearTotal,
  getAvailableYears,
  getChargesByYear,
  getChargeBadge,
  type MaintenanceCharge,
} from "@/lib/offers/maintenance-data";
import { fmtMXN as fmt } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MaintenancePaymentSheet from "./detail/MaintenancePaymentSheet";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromMaintenance } from "@/lib/offers/receipt-utils";

interface MaintenanceModuleProps {
  maintenance: MaintenanceData;
  investment: InvestmentProperty;
  onResaleClick?: () => void;
}

type Tone = "success" | "primary" | "warning" | "destructive";

const TONE_BG: Record<Tone, string> = {
  success: "bg-success/10",
  primary: "bg-primary/5",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
};

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
};

const TONE_ICON_BG: Record<Tone, string> = {
  success: "bg-success/15",
  primary: "bg-primary/10",
  warning: "bg-warning/15",
  destructive: "bg-destructive/15",
};

const TONE_ICON: Record<Tone, typeof CheckCircle2> = {
  success: CheckCircle2,
  primary: Clock,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

const MaintenanceModule = ({ maintenance, investment, onResaleClick }: MaintenanceModuleProps) => {
  const account = useMaintenanceAccount(investment.property.id);
  const status = account ? getAccountStatus(account) : null;
  const currentCharge = account ? getCurrentCharge(account) : undefined;
  const availableYears = account ? getAvailableYears(account) : [];
  const initialYear =
    currentCharge?.year ?? availableYears[0] ?? new Date().getFullYear();

  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  const yearTotal = account ? getYearTotal(account, selectedYear) : null;
  const chargesForYear = account ? getChargesByYear(account, selectedYear) : [];

  const propertyLabel = `${investment.property.projectName} ${investment.property.unitNumber}`;

  const resaleStage = investment.stages.find(
    (s) => s.id === "post_entrega" && s.cta?.action === "resale",
  );
  const showResaleBanner = !!resaleStage;

  const handleViewReceipt = (charge: MaintenanceCharge) => {
    setReceiptData(buildReceiptFromMaintenance(charge.month, charge.amount, investment));
  };

  const handleResaleClick = () => {
    if (onResaleClick) {
      onResaleClick();
      return;
    }
    toast.message("Próximamente", {
      description: "Pronto podrás iniciar tu proceso de reventa desde el portal.",
    });
  };

  // ── Fallback: sin MaintenanceAccount, render simple ──
  if (!account || !status) {
    const tone: Tone = maintenance.status === "pendiente" ? "warning" : "success";
    const Icon = TONE_ICON[tone];
    return (
      <section className="px-5 pt-5 animate-fade-in">
        <div className={`rounded-2xl p-5 ${TONE_BG[tone]}`}>
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-full ${TONE_ICON_BG[tone]} flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-6 h-6 ${TONE_TEXT[tone]}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[10px] uppercase tracking-widest font-semibold ${TONE_TEXT[tone]}`}
              >
                {tone === "warning" ? "Pago pendiente" : "Al corriente"}
              </p>
              <h3 className="font-display font-bold text-xl text-foreground mt-0.5">
                {tone === "warning"
                  ? `${fmt(maintenance.monthlyFee)}`
                  : "Estás al día"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Próximo vencimiento: {maintenance.nextDueDate}
              </p>
            </div>
          </div>
          {tone === "warning" && (
            <button
              onClick={() => setPaymentSheetOpen(true)}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 mt-4 hover:bg-primary/90 transition-colors active:scale-[0.98]"
            >
              <CreditCard className="w-4 h-4" />
              Pagar ahora
            </button>
          )}
        </div>

        <div className="mt-4">
          <p className="font-display font-semibold text-foreground text-sm mb-3">
            Histórico de pagos
          </p>
          <div className="space-y-2">
            {maintenance.history.map((h) => (
              <div
                key={h.month}
                className="flex items-center justify-between py-3 px-3 rounded-lg border-b border-border/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{h.month}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {h.status === "pagado" ? "Pagado" : "Pendiente"}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {fmt(h.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ── Versión enriquecida ──
  const Icon = TONE_ICON[status.tone];
  const showPayCTA = status.status !== "al_corriente" && currentCharge;
  const payCtaBg =
    status.tone === "destructive" ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90";
  const payCtaText =
    status.tone === "destructive" ? "text-destructive-foreground" : "text-primary-foreground";

  return (
    <section className="px-5 pt-5 animate-fade-in">
      {/* 1. Status header */}
      <div className={`rounded-2xl p-5 ${TONE_BG[status.tone]}`}>
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-full ${TONE_ICON_BG[status.tone]} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`w-6 h-6 ${TONE_TEXT[status.tone]}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] uppercase tracking-widest font-semibold ${TONE_TEXT[status.tone]}`}
            >
              {status.label}
            </p>
            <h3 className="font-display font-bold text-xl text-foreground mt-0.5 tabular-nums">
              {currentCharge
                ? `${currentCharge.month} · ${fmt(currentCharge.amount)}`
                : "Estás al día"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {status.description}
            </p>
          </div>
        </div>
        {showPayCTA && (
          <button
            onClick={() => setPaymentSheetOpen(true)}
            className={`w-full h-12 rounded-xl ${payCtaBg} ${payCtaText} text-sm font-semibold inline-flex items-center justify-center gap-2 mt-4 transition-colors active:scale-[0.98]`}
          >
            <CreditCard className="w-4 h-4" />
            Pagar ahora
          </button>
        )}
      </div>

      {/* 2. Stats grid */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Cuota mensual
          </p>
          <p className="font-display font-semibold text-sm tabular-nums text-foreground mt-1">
            {fmt(account.monthlyFee)}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Pagado en {selectedYear}
          </p>
          <p className="font-display font-semibold text-sm tabular-nums text-foreground mt-1">
            {fmt(yearTotal?.paid ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Próximo vence
          </p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {currentCharge?.dueDateDisplay ?? "—"}
          </p>
        </div>
      </div>

      {/* 3. Histórico */}
      <div className="mt-5">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-display font-semibold text-foreground text-sm">
            Histórico de pagos
          </h4>
          {availableYears.length > 1 ? (
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="h-8 w-[88px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">{selectedYear}</span>
          )}
        </div>

        {chargesForYear.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Sin movimientos de mantenimiento en {selectedYear}.
          </div>
        ) : (
          <div className="space-y-2">
            {chargesForYear.map((c, idx) => {
              const badge = getChargeBadge(c.status);
              const isLast = idx === chargesForYear.length - 1;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-3 py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors ${
                    !isLast ? "border-b border-border/40" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.month}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.status === "pagado"
                        ? `Pagado el ${c.paidAtDisplay}`
                        : `Vence el ${c.dueDateDisplay}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {fmt(c.amount)}
                      </p>
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {c.status === "pagado" && (
                      <button
                        onClick={() => handleViewReceipt(c)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors group"
                        aria-label="Ver recibo"
                      >
                        <Receipt className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Banner de reventa */}
      {showResaleBanner && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 mt-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Tu propiedad está lista para reventa
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monetiza tu inversión sin perder los beneficios de tu propiedad.
              </p>
            </div>
            <button
              onClick={handleResaleClick}
              className="text-xs font-semibold text-primary inline-flex items-center gap-0.5 flex-shrink-0"
            >
              Conocer más
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <MaintenancePaymentSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        charge={currentCharge ?? null}
        account={account}
        propertyLabel={propertyLabel}
      />

      <PaymentReceiptModal
        receipt={receiptData}
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
      />
    </section>
  );
};

export default MaintenanceModule;
