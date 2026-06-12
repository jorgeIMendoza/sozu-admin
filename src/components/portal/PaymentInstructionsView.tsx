import { useState } from "react";
import { ArrowLeft, Copy, Check, Shield, Building2, Info } from "lucide-react";
import type { STPPaymentInfo, Installment } from "@/lib/offers/payment-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface PaymentInstructionsViewProps {
  stpInfo: STPPaymentInfo;
  installment: Installment;
  onBack: () => void;
}

const PaymentInstructionsView = ({ stpInfo, installment, onBack }: PaymentInstructionsViewProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const fields = [
    { label: "CLABE interbancaria", value: stpInfo.clabe, copyable: true, key: "clabe", mono: true },
    { label: "Banco receptor", value: stpInfo.bankName, copyable: false, key: "bank", mono: false },
    { label: "Beneficiario", value: stpInfo.beneficiary, copyable: false, key: "beneficiary", mono: false },
    { label: "Monto sugerido", value: fmt(installment.amount), copyable: true, key: "amount", mono: true },
    { label: "Concepto / Referencia", value: stpInfo.reference, copyable: true, key: "reference", mono: true },
  ];

  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">Instrucciones de pago</h1>
            <p className="text-[11px] text-muted-foreground">Transferencia interbancaria</p>
          </div>
        </div>
      </header>

      {/* Intro */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-foreground leading-relaxed">
            Realiza la transferencia desde tu banca en línea utilizando esta CLABE única vinculada a tu propiedad.
            El pago se reflejará automáticamente una vez confirmado por el banco.
          </p>
        </div>
      </div>

      {/* Payment fields */}
      <div className="px-5 py-3">
        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {fields.map((field) => (
            <div key={field.key} className="px-4 py-3.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">
                {field.label}
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold text-foreground ${field.mono ? "font-mono tabular-nums tracking-wide" : ""} break-all`}>
                  {field.value}
                </p>
                {field.copyable && (
                  <button
                    onClick={() => copyToClipboard(
                      field.key === "amount" ? String(installment.amount) : field.value,
                      field.key
                    )}
                    className="flex-shrink-0 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors active:scale-95"
                    aria-label={`Copiar ${field.label}`}
                  >
                    {copied === field.key ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Copy CLABE main CTA */}
      <div className="px-5 py-3">
        <button
          onClick={() => copyToClipboard(stpInfo.clabe, "clabe-main")}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3.5 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          {copied === "clabe-main" ? (
            <>
              <Check className="w-4 h-4" />
              CLABE copiada
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copiar CLABE
            </>
          )}
        </button>
      </div>

      {/* Security badge */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-3 p-3.5 bg-muted/50 rounded-xl border border-border">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground">Conexión segura</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Esta CLABE está vinculada exclusivamente a tu propiedad y RFC.
            </p>
          </div>
        </div>
      </div>

      {/* Bank info footer */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 justify-center opacity-50">
          <Building2 className="w-3.5 h-3.5" />
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
            Procesado por STP
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaymentInstructionsView;
