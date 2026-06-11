import { useState } from "react";
import { CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";

const SeccionIdentidadFiscal = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const [expanded, setExpanded] = useState(false);
  const fi = formalReservation.fiscalIdentity;
  const virtualCLABE = formalReservation.propertyVirtualCLABE ?? "";
  const clabeFormatted = virtualCLABE.match(/.{1,4}/g)?.join(" ") ?? virtualCLABE;
  const payment = formalReservation.payment;

  return (
    <div className="rounded-2xl bg-card border-2 border-success/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-success/[0.02] transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sección 1</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-success">Completada</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Identidad fiscal</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              RFC {fi?.rfc ?? "—"} · CLABE ****{virtualCLABE.slice(-4) || "----"}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-success/15">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Field label="RFC" value={fi?.rfc} mono />
            <Field label="Régimen fiscal" value={fi?.regimenFiscal} />
            <Field label="Nombre fiscal" value={fi?.legalName} className="sm:col-span-2" />
            <Field
              label="CLABE de cobranza (permanente)"
              value={clabeFormatted}
              mono
              className="sm:col-span-2"
            />
            {payment && (
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    RFC del banco emisor del primer pago
                  </p>
                  {payment.rfcMatched && (
                    <CheckCircle2 className="w-3 h-3 text-success" />
                  )}
                </div>
                <p className="text-sm text-foreground font-mono tabular-nums mt-0.5">
                  {payment.emisorRFC || "—"}
                </p>
                {payment.rfcMatched && (
                  <p className="text-[11px] text-success mt-0.5">
                    ✓ Coincide con tu RFC validado
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">
              Tu RFC fue validado contra el SAT y vinculado automáticamente con tu CLABE de cobranza vía
              STP al detectar tu primer pago.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  className?: string;
}) => (
  <div className={className}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <p className={`text-sm text-foreground ${mono ? "font-mono tabular-nums" : ""} mt-0.5`}>
      {value ?? "—"}
    </p>
  </div>
);

export default SeccionIdentidadFiscal;
