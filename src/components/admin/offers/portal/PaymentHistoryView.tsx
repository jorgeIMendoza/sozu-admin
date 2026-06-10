import { useState, useMemo } from "react";
import { ArrowLeft, Filter, ChevronDown, CheckCircle2, Clock, FileText } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { getPropertyStatus } from "@/lib/offers/mock-data";
import { usePaymentPlan } from "@/lib/offers/payment-data";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromInstallment, buildReceiptFromPaymentRecord, buildReceiptFromMaintenance } from "@/lib/offers/receipt-utils";
import { fmtMXN as fmt } from "@/lib/utils";

interface PaymentHistoryViewProps {
  investment: InvestmentProperty;
  onBack: () => void;
}

type UnifiedPayment = {
  date: string;
  concept: string;
  amount: number;
  status: "pagado" | "pendiente";
  type: "Inversión" | "Mantenimiento";
  /** index for receipt building */
  sourceIndex: number;
};

const PaymentHistoryView = ({ investment, onBack }: PaymentHistoryViewProps) => {
  const { property, payments, financials } = investment;
  const status = getPropertyStatus(investment);
  const paymentPlan = usePaymentPlan(property.id);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Todos");
  const [selectedType, setSelectedType] = useState("Todos");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const paidPayments = payments.filter((p) => p.status === "pagado");
  const totalPaidAmount = paidPayments.reduce((s, p) => s + p.amount, 0);
  const lastPayment = paidPayments.length > 0 ? paidPayments[paidPayments.length - 1] : null;

  const maintenancePayments = investment.maintenance?.history || [];

  const allPayments = useMemo(() => {
    let result: UnifiedPayment[] = [];

    // Investment payments — prefer STP installments if available
    if (paymentPlan) {
      paymentPlan.installments.forEach((inst, i) => {
        result.push({
          date: inst.dueDateDisplay,
          concept: inst.number === 1 ? "Enganche" : `Parcialidad ${inst.number}`,
          amount: inst.amount,
          status: inst.status === "pagado" ? "pagado" : "pendiente",
          type: "Inversión",
          sourceIndex: i,
        });
      });
    } else {
      payments.forEach((p, i) => {
        result.push({
          date: p.date,
          concept: p.concept,
          amount: p.amount,
          status: p.status,
          type: "Inversión",
          sourceIndex: i,
        });
      });
    }

    // Maintenance
    maintenancePayments.forEach((m, i) => {
      result.push({
        date: m.month,
        concept: "Mantenimiento",
        amount: m.amount,
        status: m.status,
        type: "Mantenimiento",
        sourceIndex: i,
      });
    });

    // Filter by status
    if (selectedFilter === "Pagados") result = result.filter((p) => p.status === "pagado");
    if (selectedFilter === "Pendientes") result = result.filter((p) => p.status === "pendiente");

    // Filter by type
    if (selectedType === "Inversión") result = result.filter((p) => p.type === "Inversión");
    if (selectedType === "Mantenimiento") result = result.filter((p) => p.type === "Mantenimiento");

    return result;
  }, [payments, paymentPlan, maintenancePayments, selectedFilter, selectedType]);

  const handleViewReceipt = (payment: UnifiedPayment) => {
    if (payment.status !== "pagado") return;

    let receipt: ReceiptData;

    if (payment.type === "Mantenimiento") {
      receipt = buildReceiptFromMaintenance(payment.date, payment.amount, investment);
    } else if (paymentPlan) {
      const inst = paymentPlan.installments[payment.sourceIndex];
      receipt = buildReceiptFromInstallment(inst, paymentPlan, investment);
    } else {
      const rec = payments[payment.sourceIndex];
      receipt = buildReceiptFromPaymentRecord(rec, investment);
    }

    setReceiptData(receipt);
  };

  return (
    <div className="animate-fade-in pb-24">
      {/* Compact header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-sm text-foreground">Historial de pagos</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {property.projectName} · U{property.unitNumber}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            status.color === "warning" ? "bg-warning/15 text-warning"
            : status.color === "success" ? "bg-success/15 text-success"
            : "bg-primary/15 text-primary"
          }`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 pt-5 pb-4">
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Total pagado</p>
              <p className="font-display font-bold text-base text-foreground tabular-nums mt-0.5">
                {fmt(totalPaidAmount)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Pagos</p>
              <p className="font-display font-bold text-base text-foreground mt-0.5">
                {paidPayments.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Último pago</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {lastPayment?.date || "—"}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">Progreso de pago</span>
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round((financials.totalPaid / financials.initialPrice) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(financials.totalPaid / financials.initialPrice) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 mb-3">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Filtrar
          <ChevronDown className={`w-3 h-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {filterOpen && (
        <div className="px-5 pb-3 animate-fade-in space-y-2">
          {/* Status filter */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Estatus</p>
            <div className="flex gap-1.5 flex-wrap">
              {["Todos", "Pagados", "Pendientes"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    selectedFilter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          {investment.maintenance && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Tipo</p>
              <div className="flex gap-1.5 flex-wrap">
                {["Todos", "Inversión", "Mantenimiento"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedType(f)}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      selectedType === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/30"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment list */}
      <div className="px-5">
        <h3 className="font-display font-semibold text-sm text-foreground mb-3">Pagos registrados</h3>
        <div className="space-y-2">
          {allPayments.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No hay pagos registrados</p>
            </div>
          ) : (
            allPayments.map((payment, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-3.5"
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    payment.status === "pagado" ? "bg-success/10" : "bg-warning/10"
                  }`}>
                    {payment.status === "pagado" ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Clock className="w-4 h-4 text-warning" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{payment.concept}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{payment.date}</span>
                      {payment.type === "Mantenimiento" && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[10px] text-muted-foreground">Mant.</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount + receipt */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className={`text-sm font-semibold tabular-nums ${
                        payment.status === "pagado" ? "text-foreground" : "text-warning"
                      }`}>
                        {fmt(payment.amount)}
                      </p>
                      <p className={`text-[10px] font-medium ${
                        payment.status === "pagado" ? "text-success" : "text-warning"
                      }`}>
                        {payment.status === "pagado" ? "Pagado" : "Pendiente"}
                      </p>
                    </div>

                    {/* Receipt button */}
                    {payment.status === "pagado" && (
                      <button
                        onClick={() => handleViewReceipt(payment)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors group"
                        aria-label="Ver comprobante"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <PaymentReceiptModal
        receipt={receiptData}
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  );
};

export default PaymentHistoryView;
