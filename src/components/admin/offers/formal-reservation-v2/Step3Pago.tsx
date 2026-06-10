import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import RefactorWizardShell from "./RefactorWizardShell";
import {
  Wallet,
  Copy,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Info,
} from "lucide-react";

const APARTADO_AMOUNT_MXN = 20000;
const AUTO_DETECT_DELAY_MS = 15000;

// SWAP POINT: en producción cambiar a `import.meta.env.DEV`
const SHOW_DEMO_PAY_BUTTON = true;

/**
 * @deprecated (F.1) Reemplazado por Step3HoldTarjeta.
 * Se mantiene en disco para reversión durante el desarrollo. Eliminar
 * cuando el modelo del hold esté validado en producción.
 */
const Step3Pago = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );
  const recordPayment = useFormalReservationStore((s) => s.recordPayment);

  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [paymentDetected, setPaymentDetected] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Guard: si no completó paso 2 (RFC validado), redirigir
  useEffect(() => {
    if (formalReservation && !formalReservation.fiscalIdentity) {
      navigate(`/apartar/${formalReservation.id}/paso/identidad`, { replace: true });
    }
  }, [formalReservation, navigate]);

  const appliedAmount = formalReservation?.appliedAmountMXN ?? 0;
  const amountToPay = APARTADO_AMOUNT_MXN - appliedAmount;
  const hasPreReservation = appliedAmount > 0;

  const triggerPaymentDetected = () => {
    if (!formalReservation || paymentDetected) return;
    setPaymentDetected(true);
    const speiTrackingKey = `MBAN${Date.now().toString().slice(-10)}${Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase()}`;

    recordPayment(formalReservation.id, {
      id: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amountMXN: amountToPay,
      paymentMethod: "spei",
      detectedAt: new Date().toISOString(),
      speiTrackingKey,
      // destinationCLABE, emisorRFC, rfcMatched los completa el store automáticamente
    });

    setTimeout(
      () => navigate(`/apartar/${formalReservation.id}/exito`, { replace: true }),
      1500
    );
  };

  useEffect(() => {
    if (!formalReservation || paymentDetected) return;
    const interval = setInterval(() => setSecondsElapsed((p) => p + 1), 1000);
    const timeout = setTimeout(() => triggerPaymentDetected(), AUTO_DETECT_DELAY_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formalReservation?.id, paymentDetected]);

  const handleCopyClabe = () => {
    if (!formalReservation?.propertyVirtualCLABE) return;
    navigator.clipboard.writeText(formalReservation.propertyVirtualCLABE);
    setCopiedClabe(true);
    setTimeout(() => setCopiedClabe(false), 2000);
  };
  const handleCopyAmount = () => {
    navigator.clipboard.writeText(amountToPay.toString());
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  if (!formalReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const virtualCLABE = formalReservation.propertyVirtualCLABE ?? "";
  const clabeFormatted = virtualCLABE.match(/.{1,4}/g)?.join(" ") ?? virtualCLABE;
  const fiscalRFC = formalReservation.fiscalIdentity?.rfc ?? "";

  return (
    <RefactorWizardShell formalReservation={formalReservation} currentStep={3}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Paso 3 de 3 · Pago del apartado
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Tu cuenta de cobranza
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Transfiere ${amountToPay.toLocaleString("es-MX")} MXN vía SPEI desde tu banco a la CLABE que
            generamos para tu unidad. El sistema detectará el pago y vinculará tu cuenta automáticamente.
          </p>
        </header>

        {hasPreReservation && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/30">
            <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                ${appliedAmount.toLocaleString("es-MX")} aplicados de tu pre-apartado
              </p>
              <p className="text-xs text-muted-foreground">
                Tu apartado son ${APARTADO_AMOUNT_MXN.toLocaleString("es-MX")} totales. Solo pagas el saldo restante.
              </p>
            </div>
          </div>
        )}

        {/* Card CLABE prominent */}
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tu CLABE para esta unidad
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                CLABE de cobranza
              </p>
              <button
                type="button"
                onClick={handleCopyClabe}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                {copiedClabe ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedClabe ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="text-xl md:text-2xl font-mono tabular-nums tracking-wider font-bold text-foreground break-all">
              {clabeFormatted}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Esta CLABE es <strong>permanente</strong> para tu unidad. La usarás también para todos los
              pagos de tu cronograma (saldo enganche, mensualidades, saldo a la entrega).
            </p>
          </div>
        </div>

        {/* Card datos transferencia */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Datos para tu transferencia SPEI</p>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Beneficiario
              </p>
              <p className="text-sm font-medium text-foreground">SOZU COMERCIALIZADORA SA DE CV</p>
              <p className="text-xs text-muted-foreground">Banco: STP (646)</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Monto exacto
                </p>
                <button
                  type="button"
                  onClick={handleCopyAmount}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  {copiedAmount ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAmount ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                ${amountToPay.toLocaleString("es-MX")} MXN
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Concepto
              </p>
              <p className="text-sm font-mono text-foreground">Apartado {formalReservation.id}</p>
            </div>
          </div>
        </div>

        {/* Warning crítico: cuenta emisora */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Importante: paga desde tu propia cuenta
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La transferencia debe realizarse desde una cuenta bancaria a tu nombre, vinculada al RFC{" "}
              <strong className="font-mono">{fiscalRFC}</strong>. Si llega de otra cuenta,
              STP no podrá vincularla y será reembolsada automáticamente.
            </p>
          </div>
        </div>

        {/* Banner educativo */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              ¿Cómo funciona la vinculación automática?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Al recibir tu transferencia, STP captura automáticamente el RFC del titular de tu banco
              y lo vincula con esta CLABE. No necesitas darnos tus datos bancarios — la vinculación
              ocurre por el hecho del pago.
            </p>
          </div>
        </div>

        {!paymentDetected ? (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Esperando tu transferencia…</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Detectaremos tu pago en segundos · {secondsElapsed}s
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Abre la app de tu banco y realiza la transferencia con los datos de arriba.
              Esta página se actualizará automáticamente al recibir tu pago.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-success/40 bg-success/10 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">¡Pago detectado!</p>
                <p className="text-xs text-muted-foreground">
                  Vinculando tu cuenta y generando tu ID de Cobranza…
                </p>
              </div>
            </div>
          </div>
        )}

        {SHOW_DEMO_PAY_BUTTON && !paymentDetected && (
          <button
            type="button"
            onClick={triggerPaymentDetected}
            className="w-full h-11 rounded-xl border-2 border-dashed border-warning/50 bg-warning/5 text-sm font-semibold text-foreground hover:bg-warning/10 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-warning" />
            Simular pago ahora
            <span className="ml-1 px-2 py-0.5 rounded-full bg-warning/20 text-[10px] uppercase tracking-wider text-warning font-bold">
              Demo
            </span>
          </button>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-success" />
          <p className="leading-relaxed">
            STP valida la vinculación entre tu CLABE y tu RFC de forma cifrada. SOZU no almacena
            información bancaria sensible de tu cuenta personal.
          </p>
        </div>
      </div>
    </RefactorWizardShell>
  );
};

export default Step3Pago;
