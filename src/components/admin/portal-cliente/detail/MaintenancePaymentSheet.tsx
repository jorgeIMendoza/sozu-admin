import { CheckCircle2, CreditCard, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { fmtMXN as fmt } from "@/lib/utils";
import { markChargeAsPaid, type MaintenanceAccount, type MaintenanceCharge } from "@/lib/portal-cliente/maintenance-data";

interface MaintenancePaymentSheetProps {
  open: boolean;
  onClose: () => void;
  charge: MaintenanceCharge | null;
  account: MaintenanceAccount | null;
  propertyLabel: string;
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado al portapapeles`);
};

const MaintenancePaymentSheet = ({
  open,
  onClose,
  charge,
  account,
  propertyLabel,
}: MaintenancePaymentSheetProps) => {
  if (!charge || !account) return null;

  const reference = `${account.paymentInfo.referencePrefix}-${charge.monthKey.replace("-", "")}`;
  const isOverdue = charge.daysUntilDue < -3 || charge.status === "vencido";

  const handleConfirm = () => {
    markChargeAsPaid(account.propertyId, charge.id);
    toast.success("Pago registrado. Se reflejará en tu cuenta en 24-48 horas.");
    setTimeout(() => onClose(), 300);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5 pb-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-foreground text-base">
              Pagar mantenimiento
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {propertyLabel} · {charge.month}
            </p>
          </div>
        </div>

        {/* Monto */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 my-4 text-center">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Total a pagar
          </p>
          <p className="font-display font-bold text-4xl tabular-nums text-foreground mt-1">
            {fmt(charge.amount)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Vence el {charge.dueDateDisplay}</p>
          {isOverdue && (
            <p className="text-[11px] text-destructive mt-1 font-medium">
              Vencido hace {Math.abs(charge.daysUntilDue)} días
            </p>
          )}
        </div>

        {/* Instrucciones */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Instrucciones de transferencia
          </p>

          <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground flex-shrink-0">CLABE</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono tabular-nums text-foreground text-right break-all">
                {account.paymentInfo.clabe}
              </span>
              <button
                onClick={() => copyToClipboard(account.paymentInfo.clabe, "CLABE")}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Copiar CLABE"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground flex-shrink-0">Banco</span>
            <span className="text-sm font-medium text-foreground text-right">
              {account.paymentInfo.bankName}
            </span>
          </div>

          <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground flex-shrink-0">Beneficiario</span>
            <span className="text-sm font-medium text-foreground text-right">
              {account.paymentInfo.beneficiary}
            </span>
          </div>

          <div className="flex justify-between items-start gap-3 py-2">
            <span className="text-xs text-muted-foreground flex-shrink-0">Referencia</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground text-right break-all">
                {reference}
              </span>
              <button
                onClick={() => copyToClipboard(reference, "Referencia")}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Copiar referencia"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 mt-3">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tu pago se reflejará en 24-48 horas hábiles después de realizar la transferencia.
            Asegúrate de incluir la referencia exacta para que se acredite a tu cuota.
          </p>
        </div>

        {/* Acciones */}
        <div className="mt-5">
          <button
            onClick={handleConfirm}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            Ya realicé el pago
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Solo márcalo cuando ya hayas hecho la transferencia.
          </p>
          <button
            onClick={onClose}
            className="w-full h-10 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
          >
            Cerrar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MaintenancePaymentSheet;
