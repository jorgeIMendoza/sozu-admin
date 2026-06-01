import { useState } from "react";
import { CheckCircle2, Clock, Loader2, FileText } from "lucide-react";
import type { Installment } from "@/lib/portal-cliente/payment-data";
import type { PropertyPaymentPlan } from "@/lib/portal-cliente/payment-data";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import PaymentReceiptModal, { type ReceiptData } from "./PaymentReceiptModal";
import { buildReceiptFromInstallment } from "@/lib/portal-cliente/receipt-utils";

interface PaymentStatusTrackerProps {
  installment: Installment;
  paymentPlan?: PropertyPaymentPlan;
  investment?: InvestmentProperty;
}

const statusSteps = [
  { key: "recibido", label: "Pago recibido", icon: Clock },
  { key: "validando", label: "Validando con banco", icon: Loader2 },
  { key: "confirmado", label: "Confirmado", icon: CheckCircle2 },
] as const;

const statusOrder = { recibido: 0, validando: 1, confirmado: 2 };

const PaymentStatusTracker = ({ installment, paymentPlan, investment }: PaymentStatusTrackerProps) => {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  if (installment.status !== "pagado" || !installment.confirmationStatus) return null;

  const currentIndex = statusOrder[installment.confirmationStatus];
  const isConfirmed = installment.confirmationStatus === "confirmado";

  const formatTimestamp = (ts?: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewReceipt = () => {
    if (!paymentPlan || !investment) return;
    setReceiptData(buildReceiptFromInstallment(installment, paymentPlan, investment));
  };

  return (
    <section className="px-5 py-2">
      <div className="bg-card rounded-2xl border border-primary/15 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            Estado del último pago
          </h4>
          {isConfirmed && paymentPlan && investment && (
            <button
              onClick={handleViewReceipt}
              className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Ver comprobante
            </button>
          )}
        </div>

        <div className="space-y-0">
          {statusSteps.map((step, idx) => {
            const isComplete = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            const isLast = idx === statusSteps.length - 1;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${
                      isComplete ? "text-primary" : "text-muted-foreground/40"
                    } ${isCurrent && step.key === "validando" ? "animate-spin" : ""}`} />
                  </div>
                  {!isLast && (
                    <div className={`w-px h-6 ${
                      idx < currentIndex ? "bg-primary/30" : "bg-border"
                    }`} />
                  )}
                </div>
                <div className="pt-1 pb-3">
                  <p className={`text-sm font-medium ${
                    isComplete ? "text-foreground" : "text-muted-foreground/50"
                  }`}>
                    {step.label}
                  </p>
                  {isComplete && installment.confirmationTimestamp && idx <= currentIndex && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {formatTimestamp(
                        idx === 0 ? installment.paidAt : installment.confirmationTimestamp
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PaymentReceiptModal
        receipt={receiptData}
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
      />
    </section>
  );
};

export default PaymentStatusTracker;
