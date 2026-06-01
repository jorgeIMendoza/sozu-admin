import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  Copy,
  CheckCircle2,
  Upload,
  AlertTriangle,
  FileText,
  Building2,
  Zap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  type Installment,
  type PropertyPaymentPlan,
} from "@/lib/portal-cliente/payment-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface DaikuPaymentSheetProps {
  open: boolean;
  onClose: () => void;
  installment: Installment | null;
  plan: PropertyPaymentPlan;
  propertyLabel: string;
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado al portapapeles`);
};

const DaikuPaymentSheet = ({
  open,
  onClose,
  installment,
  plan,
  propertyLabel,
}: DaikuPaymentSheetProps) => {
  const [activeTab, setActiveTab] = useState<"transferencia" | "efectivo">("transferencia");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setUploadedFile(null);
      setSubmitting(false);
      setActiveTab("transferencia");
    }
  }, [open]);

  if (!installment) return null;

  const reference = `${plan.stpInfo.reference}-P${String(installment.number).padStart(2, "0")}`;
  const isOverdue = installment.daysUntilDue < 0;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido. Sube JPG, PNG o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo excede 10 MB.");
      return;
    }
    setUploadedFile(file);
  };

  const handleSubmitReceipt = async () => {
    if (!uploadedFile) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    // TODO: upload comprobante a storage + marcar confirmationStatus = "recibido" via mutation
    setSubmitting(false);
    toast.success(
      "Comprobante recibido. Te avisaremos al confirmar tu pago en máx. 24 hrs hábiles.",
    );
    setUploadedFile(null);
    setTimeout(() => onClose(), 400);
  };

  const handleSimulateSTP = () => {
    // TODO: replace with real Supabase mutation + realtime subscription on pagos table
    toast.success("Pago detectado vía STP. Validando conciliación...");
    setTimeout(() => onClose(), 800);
  };

  // Shared instructions block
  const InstructionsBlock = () => (
    <div className="rounded-xl border border-border p-4 space-y-1">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
        Instrucciones de transferencia
      </p>

      <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground flex-shrink-0">CLABE</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono tabular-nums text-foreground text-right break-all">
            {plan.stpInfo.clabe}
          </span>
          <button
            onClick={() => copyToClipboard(plan.stpInfo.clabe, "CLABE")}
            className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Copiar CLABE"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground flex-shrink-0">Banco</span>
        <span className="text-sm font-medium text-foreground text-right">
          {plan.stpInfo.bankName}
        </span>
      </div>

      <div className="flex justify-between items-start gap-3 py-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground flex-shrink-0">Beneficiario</span>
        <span className="text-sm font-medium text-foreground text-right">
          {plan.stpInfo.beneficiary}
        </span>
      </div>

      <div className="flex justify-between items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground flex-shrink-0">Referencia</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground text-right break-all">
            {reference}
          </span>
          <button
            onClick={() => copyToClipboard(reference, "Referencia")}
            className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Copiar referencia"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );

  const submitDisabled = !uploadedFile || submitting;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto px-5 pb-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-foreground text-base">
              Pagar parcialidad
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {propertyLabel} · Parcialidad {installment.number}
            </p>
          </div>
        </div>

        {/* Amount card */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 mb-4 text-center">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-primary">
            Total a pagar
          </p>
          <p className="font-display font-bold text-4xl tabular-nums text-foreground mt-1">
            {fmt(installment.amount)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2">
            Vence el {installment.dueDateDisplay}
          </p>
          {isOverdue && (
            <p className="text-[11px] text-destructive mt-1 font-medium">
              Vencido hace {Math.abs(installment.daysUntilDue)} días
            </p>
          )}
        </div>

        {/* Construction milestone */}
        {installment.constructionMilestone && (
          <div className="rounded-lg bg-muted/30 p-3 mb-4 flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Esta parcialidad financia la fase de{" "}
              <span className="font-semibold text-foreground">
                {installment.constructionMilestone}
              </span>{" "}
              del proyecto.
            </p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "transferencia" | "efectivo")}>
          <TabsList className="grid w-full grid-cols-2 h-auto p-1">
            <TabsTrigger value="transferencia" className="flex flex-col gap-0.5 py-2 px-2">
              <span className="text-xs font-semibold">Transferencia</span>
              <span className="text-[9px] uppercase tracking-wider text-success font-semibold">
                Recomendado
              </span>
            </TabsTrigger>
            <TabsTrigger value="efectivo" className="flex flex-col gap-0.5 py-2 px-2">
              <span className="text-xs font-semibold">Pago en efectivo</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                Ventanilla
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1 — Transferencia */}
          <TabsContent value="transferencia" className="mt-4 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
              <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-success">Confirmación automática</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Tu transferencia se acreditará a tu parcialidad{" "}
                  <span className="font-semibold text-foreground">automáticamente</span> cuando
                  llegue. No necesitas enviarnos nada.
                </p>
              </div>
            </div>

            <InstructionsBlock />

            <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
              Realiza la transferencia desde la banca en línea de tu banco. Asegúrate de copiar la{" "}
              <span className="font-semibold text-foreground">CLABE</span> y la{" "}
              <span className="font-semibold text-foreground">referencia</span> exactamente como
              aparecen.
            </p>

            {/* DEMO ONLY: simulates STP webhook auto-detection.
                Remove this button when real bank integration is active. */}
            <button
              onClick={handleSimulateSTP}
              className="w-full py-2 text-[10px] text-muted-foreground/60 border border-dashed border-border rounded-lg hover:bg-muted/20 transition-colors"
            >
              [DEMO] Simular pago detectado por STP
            </button>

            <button
              onClick={onClose}
              className="w-full h-12 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Entendido, cerrar
            </button>
          </TabsContent>

          {/* Tab 2 — Efectivo */}
          <TabsContent value="efectivo" className="mt-4 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
              <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-warning-foreground">
                  Requiere comprobante
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  Cuando pagas en efectivo en ventanilla, el depósito no incluye tus datos.
                  Súbenos tu comprobante y lo acreditamos manualmente en 24 hrs hábiles.
                </p>
              </div>
            </div>

            <InstructionsBlock />

            <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
              Lleva estos datos a la ventanilla. Cualquier banco acepta depósitos a esta CLABE.
              Pide tu <span className="font-semibold text-foreground">comprobante impreso</span>{" "}
              al cajero.
            </p>

            <div className="rounded-xl border border-border p-4">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3">
                Tu comprobante
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!uploadedFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium text-foreground">Sube tu comprobante</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    JPG, PNG o PDF · Máximo 10 MB
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {uploadedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="text-xs text-destructive hover:underline flex-shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitReceipt}
              disabled={submitDisabled}
              className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                submitDisabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Enviar comprobante
                </>
              )}
            </button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Cobranza SOZU revisará tu comprobante y lo cruzará con el extracto bancario. Te
              llegará una notificación cuando se acredite.
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default DaikuPaymentSheet;
