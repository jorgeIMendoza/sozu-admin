import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Clock } from "lucide-react";
import type { PaymentRecord } from "@/lib/portal-cliente/mock-data";

interface PaymentsSheetProps {
  open: boolean;
  onClose: () => void;
  payments?: PaymentRecord[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(amount);

const PaymentsSheet = ({ open, onClose, payments = [] }: PaymentsSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto [&>button:last-child]:hidden">
        <div className="flex items-center gap-3 px-1 pb-4 border-b border-border">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="font-semibold text-foreground">Historial de pagos</h2>
        </div>

        <div className="space-y-1">
          {payments.map((payment, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {payment.concept}
                </p>
                <p className="text-xs text-muted-foreground">{payment.date}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCurrency(payment.amount)}
                </p>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider ${
                    payment.status === "pagado"
                      ? "text-primary"
                      : "text-warning"
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </SheetContent>
    </Sheet>
  );
};

export default PaymentsSheet;
