import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Copy,
  Check,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { getOfferById } from "@/lib/offers/offer-data";

interface Step3PagoSPEIProps {
  formalReservation: FormalReservation;
  onBack: () => void;
}

const Step3PagoSPEI = ({ formalReservation, onBack }: Step3PagoSPEIProps) => {
  const navigate = useNavigate();
  const generateVirtualCLABE = useFormalReservationStore(
    (s) => s.generateVirtualCLABE
  );
  const recordPayment = useFormalReservationStore((s) => s.recordPayment);
  const releaseHold = useFormalReservationStore((s) => s.releaseHold);

  const [acknowledgedNoRefund, setAcknowledgedNoRefund] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [paymentDetected, setPaymentDetected] = useState(false);

  // Generación diferida de CLABE al montar este paso (idempotente).
  useEffect(() => {
    if (!formalReservation.propertyVirtualCLABE) {
      generateVirtualCLABE(formalReservation.id);
    }
  }, [
    formalReservation.id,
    formalReservation.propertyVirtualCLABE,
    generateVirtualCLABE,
  ]);

  // Contador "esperando transferencia"
  useEffect(() => {
    if (!waitingForPayment || paymentDetected) return;
    const interval = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [waitingForPayment, paymentDetected]);

  const handlePaymentDetected = () => {
    if (paymentDetected) return;
    setPaymentDetected(true);
    // Secuencia crítica: recordPayment → releaseHold → navigate ceremonial
    recordPayment(formalReservation.id, {
      id: `PAY-${Date.now().toString(36).toUpperCase()}`,
      amountMXN: 20000,
      paymentMethod: "spei",
      detectedAt: new Date().toISOString(),
      // SWAP POINT: en producción este viene de STP via webhook
      speiTrackingKey: `STP-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
    });
    releaseHold(formalReservation.id, "payment");

    // Delay para que el cliente vea el estado verde antes del redirect
    setTimeout(() => {
      navigate(`/apartar/${formalReservation.id}/exito`);
    }, 1500);
  };

  // Auto-detect del pago a los 15s (DEMO)
  useEffect(() => {
    if (!waitingForPayment || paymentDetected || secondsElapsed < 15) return;
    handlePaymentDetected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsElapsed, waitingForPayment, paymentDetected]);

  const formatCLABE = (clabe: string | null | undefined): string => {
    if (!clabe) return "Generando CLABE...";
    return clabe.match(/.{1,4}/g)?.join(" ") ?? clabe;
  };

  const handleCopyCLABE = async () => {
    if (!formalReservation.propertyVirtualCLABE) return;
    try {
      await navigator.clipboard.writeText(formalReservation.propertyVirtualCLABE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleStartWaitingForPayment = () => {
    if (!acknowledgedNoRefund) return;
    setWaitingForPayment(true);
    setSecondsElapsed(0);
  };

  const offer = getOfferById(formalReservation.offerId);
  const propertyLabel = offer
    ? `${offer.property.unitModel ?? ""} ${offer.property.unitNumber ?? ""}`.trim() ||
      "tu unidad"
    : "tu unidad";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={waitingForPayment}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al paso anterior
      </button>

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary mb-2">
          Paso 3 de 3 · Pago SPEI
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3 font-display">
          Completa tu apartado
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Realiza la transferencia SPEI por{" "}
          <strong className="text-foreground">$20,000 MXN</strong> desde tu cuenta
          bancaria a la CLABE de tu unidad. Al detectar tu pago, la retención de
          $10,000 en tu tarjeta se libera automáticamente.
        </p>
      </div>

      {/* Banner no reembolsable */}
      <div className="rounded-2xl bg-warning/[0.06] border border-warning/30 p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground mb-1.5">
              Este pago no es reembolsable
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed mb-3">
              Al transferir los <strong>$20,000 MXN</strong> vía SPEI, formalizas
              tu apartado de <strong>{propertyLabel}</strong> de manera
              definitiva. Este monto se aplicará como anticipo del enganche y{" "}
              <strong>no podrá ser devuelto bajo ninguna circunstancia</strong>,
              ni siquiera si decides no continuar con la compra después.
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed">
              Si tienes dudas, contacta a tu asesor antes de avanzar.
            </p>
          </div>
        </div>
      </div>

      {/* Checkbox obligatorio */}
      <label className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border cursor-pointer mb-6 hover:border-foreground/30 transition-colors">
        <input
          type="checkbox"
          checked={acknowledgedNoRefund}
          onChange={(e) => setAcknowledgedNoRefund(e.target.checked)}
          disabled={waitingForPayment}
          className="w-4 h-4 mt-0.5 rounded border-border accent-primary cursor-pointer flex-shrink-0 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-foreground leading-relaxed">
          <strong>Entiendo que este pago no es reembolsable.</strong> He leído el
          banner anterior y acepto las condiciones del SPEI definitivo.
        </span>
      </label>

      {!acknowledgedNoRefund && (
        <div className="rounded-xl bg-muted/30 p-4 mb-6 text-center">
          <p className="text-[11px] text-muted-foreground">
            Marca la casilla anterior para continuar.
          </p>
        </div>
      )}

      {acknowledgedNoRefund && (
        <>
          {/* CLABE block */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden mb-5">
            <div className="px-4 py-2.5 border-b border-border bg-primary/[0.04]">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">
                Tu CLABE de cobranza
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    CLABE
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground font-mono tabular-nums tracking-wider">
                    {formatCLABE(formalReservation.propertyVirtualCLABE)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCLABE}
                  disabled={!formalReservation.propertyVirtualCLABE}
                  className="h-9 px-3 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-primary" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Beneficiario:{" "}
                <strong className="text-foreground">
                  SOZU COMERCIALIZADORA SA DE CV
                </strong>{" "}
                · Banco: <strong className="text-foreground">STP (646)</strong>
              </p>
            </div>
          </div>

          {/* Monto y concepto */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl bg-card border border-border p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Monto exacto
              </p>
              <p className="text-base font-bold text-foreground tabular-nums">
                $20,000 MXN
              </p>
            </div>
            <div className="rounded-xl bg-card border border-border p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Concepto
              </p>
              <p className="text-xs font-mono text-foreground truncate">
                Apartado {formalReservation.id}
              </p>
            </div>
          </div>

          {/* Warning RFC */}
          <div className="rounded-xl bg-warning/[0.06] border border-warning/30 p-3 mb-5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                Paga desde una cuenta a tu nombre, vinculada al RFC{" "}
                <strong className="font-mono">
                  {formalReservation.fiscalIdentity?.rfc ?? "[pendiente]"}
                </strong>
                . STP vinculará automáticamente tu cuenta al recibir el pago.
              </p>
            </div>
          </div>

          {/* Estado de espera + botón DEMO */}
          {!waitingForPayment && !paymentDetected && (
            <button
              type="button"
              onClick={handleStartWaitingForPayment}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm mb-3"
            >
              Ya hice mi transferencia
            </button>
          )}

          {waitingForPayment && !paymentDetected && (
            <>
              <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Esperando tu transferencia...
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {secondsElapsed}s transcurridos
                  </p>
                </div>
              </div>

              {/* Botón DEMO: warning + dashed + pill */}
              <button
                type="button"
                onClick={handlePaymentDetected}
                className="w-full mt-3 h-11 rounded-xl bg-warning/[0.08] border border-dashed border-warning/40 text-warning text-xs font-semibold hover:bg-warning/[0.12] transition-colors flex items-center justify-center gap-2"
              >
                Simular pago ahora
                <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[9px] font-bold uppercase tracking-wide">
                  DEMO
                </span>
              </button>
            </>
          )}

          {paymentDetected && (
            <div className="rounded-2xl bg-primary/[0.08] border-2 border-primary p-5 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Pago detectado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Liberando retención y generando tu ID de cliente...
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-4 flex items-start gap-1.5 justify-center">
            <ShieldCheck className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
            Al detectar tu pago, la retención de $10,000 en tu tarjeta se libera
            automáticamente. No habrá cargo a tu tarjeta.
          </p>
        </>
      )}
    </div>
  );
};

export default Step3PagoSPEI;
