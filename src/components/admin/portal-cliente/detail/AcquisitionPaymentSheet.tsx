import { useEffect, useState } from "react";
import { CreditCard, Copy, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { fmtMXN } from "@/lib/utils";
import { useClientePropiedadDetalle } from "@/hooks/useClientePropiedadDetalle";

interface Props {
  open: boolean;
  onClose: () => void;
  cuentaId: number | null;
  propertyLabel: string;
}

const cp = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
};

const AcquisitionPaymentSheet = ({ open, onClose, cuentaId, propertyLabel }: Props) => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { data: propDetalle, isLoading } = useClientePropiedadDetalle(
    open ? cuentaId : null,
  );

  const clabe = propDetalle?.propiedadClabeStp ?? null;
  const beneficiario = propDetalle?.propiedadBeneficiarioNombre ?? null;

  const nextInstallment = propDetalle?.parcialidades
    .filter((p) => !p.pagado)
    .sort((a, b) => a.orden - b.orden)[0] ?? null;

  const monto = nextInstallment?.saldoPendiente ?? propDetalle?.pending ?? 0;
  const concepto = nextInstallment?.concepto ?? "Pago de propiedad";
  const fechaVencimiento = nextInstallment?.fechaPago
    ? new Date(nextInstallment.fechaPago + "T12:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const content = (
    <div className="flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
        <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm leading-tight">Datos para pago</h3>
          <p className="text-xs text-muted-foreground truncate">{propertyLabel}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-36 bg-muted rounded-xl" />
          </div>
        ) : (
          <>
            {/* Monto */}
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                {nextInstallment ? concepto : "Saldo pendiente"}
              </p>
              <p className="font-bold text-3xl tabular-nums text-foreground mt-1">
                {fmtMXN(monto)}
              </p>
              {fechaVencimiento && (
                <p className="text-xs text-muted-foreground mt-1">
                  Vencimiento: {fechaVencimiento}
                </p>
              )}
              {monto > 0 && (
                <button
                  onClick={() => cp(monto.toFixed(2), "Monto")}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copiar monto
                </button>
              )}
            </div>

            {/* Instrucciones */}
            {clabe ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 pt-3 pb-2 bg-muted/30">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                    Instrucciones de transferencia
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/60">
                  <span className="text-xs text-muted-foreground shrink-0">CLABE</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-mono tabular-nums text-foreground break-all text-right">
                      {clabe}
                    </span>
                    <button
                      onClick={() => cp(clabe, "CLABE")}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                      aria-label="Copiar CLABE"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {beneficiario && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/60">
                    <span className="text-xs text-muted-foreground shrink-0">Beneficiario</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground text-right truncate max-w-[180px]">
                        {beneficiario}
                      </span>
                      <button
                        onClick={() => cp(beneficiario, "Beneficiario")}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                        aria-label="Copiar beneficiario"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/60">
                  <span className="text-xs text-muted-foreground shrink-0">Concepto</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{concepto}</span>
                    <button
                      onClick={() => cp(concepto, "Concepto")}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                      aria-label="Copiar concepto"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  La CLABE de pago aún no está configurada. Contacta a tu asesor.
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Realiza la transferencia desde tu banca en línea. El pago se reflejará en
                24–48 horas hábiles.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4 border-t border-border/50">
        <button
          onClick={onClose}
          className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="p-0 max-w-md max-h-[85vh] overflow-y-auto [&>button:last-child]:hidden">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[75dvh] p-0 rounded-t-2xl [&>button:last-child]:hidden"
      >
        {content}
      </SheetContent>
    </Sheet>
  );
};

export default AcquisitionPaymentSheet;
