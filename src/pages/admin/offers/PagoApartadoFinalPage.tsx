/**
 * @deprecated 18.10.B — Reemplazado por `CompletarApartadoPage` (`/apartar/:id/completar`),
 * que descompone este flujo monolítico en wizard de 3 pasos (Tipo → Identidad → Pago SPEI).
 * Se conserva temporalmente como destino de la ruta `/apartado-provisional/:id/pago` para
 * enlaces antiguos en notificaciones ya enviadas. Eliminar tras un ciclo de rollout.
 */
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { Wallet, Copy, CheckCircle2, ArrowLeft, ShieldCheck, Info, Eye } from "lucide-react";

const APARTADO_AMOUNT_MXN = 20000;
const AUTO_DETECT_DELAY_MS = 15000;
const SHOW_DEMO_PAY_BUTTON = true; // SWAP POINT: import.meta.env.DEV en producción

const PagoApartadoFinalPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );
  const recordPayment = useFormalReservationStore((s) => s.recordPayment);
  const releaseHold = useFormalReservationStore((s) => s.releaseHold);

  const [copiedClabe, setCopiedClabe] = useState(false);
  const [paymentDetected, setPaymentDetected] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Guard: solo permitir esta página si el FR está en status apartado_provisional
  useEffect(() => {
    if (!formalReservation) return;
    if (formalReservation.status === "apartado_provisional") return;
    if (
      ["pago_recibido", "expediente_en_curso", "expediente_completo"].includes(
        formalReservation.status
      )
    ) {
      navigate(`/en-adquisicion/${formalReservation.id}/expediente`, { replace: true });
    } else {
      navigate(`/apartado-provisional/${formalReservation.id}`, { replace: true });
    }
  }, [formalReservation, navigate]);

  const triggerPaymentDetected = () => {
    if (!formalReservation || paymentDetected) return;
    setPaymentDetected(true);

    // 1. Registrar el pago → convierte al cliente y crea expediente
    recordPayment(formalReservation.id, {
      id: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amountMXN: APARTADO_AMOUNT_MXN,
      paymentMethod: "spei",
      detectedAt: new Date().toISOString(),
      speiTrackingKey: `MBAN${Date.now().toString().slice(-10)}${Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase()}`,
    });

    // 2. Liberar hold de tarjeta
    releaseHold(formalReservation.id, "payment");

    // 3. Navegar a pantalla ceremonial de conversión (18.9.B)
    setTimeout(
      () => navigate(`/apartar/${formalReservation.id}/exito`, { replace: true }),
      1500
    );
  };

  // Auto-detect del pago a los 15s con contador visible
  useEffect(() => {
    if (!formalReservation || paymentDetected) return;
    if (formalReservation.status !== "apartado_provisional") return;
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

  if (!formalReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  const clabe = formalReservation.propertyVirtualCLABE ?? "";
  const clabeFormatted = clabe.match(/.{1,4}/g)?.join(" ") ?? clabe;
  const fiscalRFC = formalReservation.fiscalIdentity?.rfc ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/apartado-provisional/${formalReservation.id}`)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
          <h1 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Completar apartado
          </h1>
          <span className="w-12" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Paso final · Transferencia SPEI
          </p>
          <h2 className="text-2xl font-bold text-foreground">Completa tu apartado</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Realiza la transferencia SPEI por{" "}
            <strong className="text-foreground">
              ${APARTADO_AMOUNT_MXN.toLocaleString("es-MX")} MXN
            </strong>{" "}
            desde tu cuenta bancaria. Al detectar tu pago, liberaremos la retención en tu tarjeta
            automáticamente.
          </p>
        </div>

        {/* CLABE virtual del departamento */}
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] overflow-hidden">
          <div className="bg-primary/[0.08] px-4 py-2.5 border-b border-primary/20 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Tu CLABE de cobranza
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                CLABE
              </span>
              <button
                type="button"
                onClick={handleCopyClabe}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[11px] font-semibold text-foreground hover:border-primary/40 transition-colors"
              >
                {copiedClabe ? (
                  <CheckCircle2 className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copiedClabe ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="text-lg sm:text-xl font-mono font-bold text-foreground tabular-nums break-all">
              {clabeFormatted}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Beneficiario: SOZU COMERCIALIZADORA SA DE CV · Banco: STP (646)
            </p>
          </div>
        </div>

        {/* Monto + concepto */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Monto exacto
            </p>
            <p className="text-base font-bold text-foreground tabular-nums mt-1">
              ${APARTADO_AMOUNT_MXN.toLocaleString("es-MX")} MXN
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Concepto</p>
            <p className="text-xs font-mono font-semibold text-foreground mt-1 break-all">
              Apartado {formalReservation.id}
            </p>
          </div>
        </div>

        {/* Warning fiscal sobre cuenta emisora */}
        <div className="rounded-xl border border-warning/40 bg-warning/[0.05] p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground leading-relaxed">
            Paga desde una cuenta a tu nombre, vinculada al RFC{" "}
            <strong className="font-mono">{fiscalRFC}</strong>. STP vinculará automáticamente tu
            cuenta al recibir el pago.
          </p>
        </div>

        {/* Estado: esperando o detectado */}
        {!paymentDetected ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Esperando tu transferencia…
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {secondsElapsed}s transcurridos
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-success/40 bg-success/[0.05] p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">¡Pago detectado!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Liberando retención y generando tu ID de cliente…
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botón demo */}
        {SHOW_DEMO_PAY_BUTTON && !paymentDetected && (
          <button
            type="button"
            onClick={triggerPaymentDetected}
            className="w-full h-11 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Simular pago ahora
            <span className="text-[9px] uppercase tracking-wider bg-background/20 px-1.5 py-0.5 rounded">
              Demo
            </span>
          </button>
        )}

        {/* Tranquilidad sobre liberación del hold */}
        <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Al detectar tu pago, la retención de{" "}
            <strong className="text-foreground">
              ${formalReservation.hold?.amountMXN.toLocaleString("es-MX")}
            </strong>{" "}
            en tu tarjeta se libera automáticamente. No habrá cargo a tu tarjeta.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PagoApartadoFinalPage;
