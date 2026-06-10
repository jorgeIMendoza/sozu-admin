import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PaymentRecord } from "@/lib/offers/mock-data";

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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-foreground font-display">
            Historial de pagos
          </SheetTitle>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
};

export default PaymentsSheet;
