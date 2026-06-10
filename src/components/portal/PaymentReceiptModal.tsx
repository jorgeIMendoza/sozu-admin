import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Download, Share2, Shield, CheckCircle2, Copy, Check } from "lucide-react";
import { fmtMXNDecimals as fmt } from "@/lib/utils";
import sozuLogo from "@/assets/sozu-logo.png";

export interface ReceiptData {
  folio: string;
  emissionDate: string;
  clientName: string;
  clientRFC: string;
  projectName: string;
  unitNumber: string;
  productName?: string;
  concept: string;
  amount: number;
  paymentMethod: string;
  clabe: string;
  referenceSTP: string;
  confirmationDate: string;
  totalPaidAccumulated: number;
  pendingBalance: number;
  totalAssetValue: number;
}

interface PaymentReceiptModalProps {
  receipt: ReceiptData | null;
  open: boolean;
  onClose: () => void;
}

const PaymentReceiptModal = ({ receipt, open, onClose }: PaymentReceiptModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const progress =
    receipt.totalAssetValue > 0
      ? (receipt.totalPaidAccumulated / receipt.totalAssetValue) * 100
      : 0;

  const maskedClabe = `••••••••••••••${receipt.clabe.slice(-4)}`;

  const handleCopyFolio = () => {
    navigator.clipboard.writeText(receipt.folio);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border">
        {/* Custom header — replaces default DialogHeader visually */}
        <DialogHeader className="sr-only">
          <DialogTitle>Recibo de Pago</DialogTitle>
        </DialogHeader>

        {/* Brand header */}
        <div className="bg-primary/5 border-b border-border px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <img src={sozuLogo} alt="SOZU" className="h-5 w-auto object-contain" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1.5">
                Recibo de Pago
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span className="text-[10px] font-semibold text-success">Aplicado</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">Folio</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs font-mono font-semibold text-foreground">{receipt.folio}</p>
                <button onClick={handleCopyFolio} className="p-0.5 rounded hover:bg-muted transition-colors">
                  {copied ? (
                    <Check className="w-3 h-3 text-primary" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Fecha de emisión</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{receipt.emissionDate}</p>
            </div>
          </div>
        </div>

        {/* Payment detail section */}
        <div className="px-6 py-5 space-y-5">
          {/* Client & Property info */}
          <div className="space-y-3">
            <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Información del pago
            </h4>
            <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
              <DetailRow label="Cliente" value={receipt.clientName} />
              <DetailRow label="RFC" value={receipt.clientRFC} mono />
              <DetailRow label="Propiedad" value={`${receipt.projectName} — U${receipt.unitNumber}`} />
              {receipt.productName && (
                <DetailRow label="Producto" value={receipt.productName} />
              )}
              <DetailRow label="Concepto" value={receipt.concept} />
              <DetailRow label="Método de pago" value={receipt.paymentMethod} />
              <DetailRow label="CLABE vinculada" value={maskedClabe} mono />
              <DetailRow label="Referencia bancaria" value={receipt.referenceSTP} mono />
              <DetailRow label="Fecha de confirmación" value={receipt.confirmationDate} />
            </div>
          </div>

          {/* Amount hero */}
          <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
              Monto pagado
            </p>
            <p className="font-display font-bold text-2xl text-foreground tabular-nums">
              {fmt(receipt.amount)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">MXN</p>
          </div>

          {/* Financial summary */}
          <div className="space-y-3">
            <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Resumen actualizado de la propiedad
            </h4>
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Valor total del activo</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {fmt(receipt.totalAssetValue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Total pagado acumulado</span>
                <span className="text-sm font-semibold text-primary tabular-nums">
                  {fmt(receipt.totalPaidAccumulated)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Saldo pendiente</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {fmt(receipt.pendingBalance)}
                </span>
              </div>

              {/* Progress */}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground">Progreso de pago</span>
                  <span className="font-semibold text-foreground tabular-nums">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2.5 p-3 bg-muted/50 rounded-xl">
            <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Este recibo fue generado automáticamente tras la confirmación del pago por STP.
            </p>
          </div>
        </div>

        {/* Actions footer */}
        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 flex gap-3">
          <button
            onClick={() => {
              // Future: actual PDF download
              const el = document.createElement("a");
              el.download = `SOZU-Recibo-${receipt.folio}.pdf`;
              el.click();
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Recibo SOZU ${receipt.folio}`,
                  text: `Recibo de pago ${receipt.concept} - ${fmt(receipt.amount)}`,
                });
              }
            }}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted transition-colors active:scale-[0.98]"
            aria-label="Compartir"
          >
            <Share2 className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-xs font-semibold text-foreground text-right ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default PaymentReceiptModal;
