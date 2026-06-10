import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useFormalReservationStore,
  countActiveHoldsForClient,
  getClientIdentifier,
  MAX_HOLDS_PER_CLIENT,
} from "@/lib/offers/formal-reservation-data";
import {
  processCardHold,
  HOLD_AMOUNT_MXN,
  HOLD_DAYS,
  type CardInput,
} from "@/lib/offers/card-hold-processor";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Info,
  Lock,
} from "lucide-react";

type ProcessState = "idle" | "validating_limit" | "processing" | "limit_exceeded" | "error";

const ReservarPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );
  const allReservations = useFormalReservationStore((s) => s.reservations);
  const activateHold = useFormalReservationStore((s) => s.activateHold);

  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<ProcessState>("idle");

  if (!formalReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const formatCardNumber = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    return digits.match(/.{1,4}/g)?.join(" ") ?? "";
  };

  const cardNumberDisplay = formatCardNumber(cardNumber);
  const cardNumberDigits = cardNumber.replace(/\D/g, "");
  const isCardNumberValid = cardNumberDigits.length === 16;
  const isExpiryValid =
    /^(0[1-9]|1[0-2])$/.test(expiryMonth) && /^\d{2}$/.test(expiryYear);
  const isCvcValid = /^\d{3,4}$/.test(cvc);
  const isHolderNameValid = cardHolderName.trim().length >= 3;
  const isFormValid =
    isCardNumberValid && isExpiryValid && isCvcValid && isHolderNameValid && acceptedTerms;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setState("validating_limit");
    await new Promise((resolve) => setTimeout(resolve, 600));

    const clientId = getClientIdentifier(formalReservation);
    const activeHolds = countActiveHoldsForClient(
      allReservations,
      clientId,
      formalReservation.id
    );

    if (activeHolds >= MAX_HOLDS_PER_CLIENT) {
      setState("limit_exceeded");
      return;
    }

    setState("processing");
    try {
      const cardData: CardInput = {
        cardNumber: cardNumberDigits,
        cardHolderName: cardHolderName.trim(),
        expiryMonth,
        expiryYear,
        cvc,
      };
      const holdData = await processCardHold(cardData);
      const success = activateHold(formalReservation.id, holdData);
      if (!success) {
        setState("limit_exceeded");
        return;
      }
      navigate(`/apartar/${formalReservation.id}/provisional-activado`, { replace: true });
    } catch {
      setState("error");
    }
  };

  if (state === "limit_exceeded") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 md:px-6 py-16 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning/15 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Has alcanzado el límite de apartados provisionales
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Solo puedes tener {MAX_HOLDS_PER_CLIENT} apartados provisionales activos al mismo
            tiempo. Completa el pago de alguno o espera a que expire para apartar una nueva
            unidad.
          </p>
          <button
            type="button"
            onClick={() => navigate("/en-adquisicion")}
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver mis apartados activos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/oferta/${formalReservation.offerId}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la oferta
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Datos cifrados</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Fase 1 · Reservar tu unidad
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Activa tu apartado provisional
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bloquearemos ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN en tu tarjeta de
            crédito por {HOLD_DAYS} días naturales. No es un cobro — es una retención que se
            libera cuando completes tu pago o expira automáticamente.
          </p>
        </header>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              ¿Qué es una retención de tarjeta?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Es el mismo mecanismo que usan los hoteles cuando bloquean un monto al hacer
              check-in. El dinero queda reservado pero NO se cobra. Si decides avanzar, harás
              la transferencia por separado y el hold se libera. Si decides no avanzar, el
              hold expira y tu crédito vuelve a estar disponible. En ningún caso te cobramos
              esos ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")}.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Datos de tu tarjeta de crédito
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre del titular *
              </label>
              <input
                type="text"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                placeholder="COMO APARECE EN LA TARJETA"
                disabled={state !== "idle"}
                className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50 uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Número de tarjeta *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumberDisplay}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                disabled={state !== "idle"}
                className="w-full h-12 px-3 rounded-lg bg-card border-2 border-border text-base text-foreground font-mono tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vencimiento *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiryMonth}
                    onChange={(e) =>
                      setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    placeholder="MM"
                    maxLength={2}
                    disabled={state !== "idle"}
                    className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground font-mono tabular-nums text-center focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                  <span className="text-muted-foreground">/</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiryYear}
                    onChange={(e) =>
                      setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    placeholder="YY"
                    maxLength={2}
                    disabled={state !== "idle"}
                    className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground font-mono tabular-nums text-center focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  CVC *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  disabled={state !== "idle"}
                  className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground font-mono tabular-nums text-center focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            disabled={state !== "idle"}
            className="w-4 h-4 mt-0.5 accent-primary flex-shrink-0 disabled:opacity-50"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            Acepto que se retengan{" "}
            <strong className="text-foreground">
              ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN
            </strong>{" "}
            en mi tarjeta de crédito por {HOLD_DAYS} días naturales. Entiendo que es una
            retención (hold), no un cobro, y que durante este periodo recibiré el contrato
            preliminar para revisión. Si no completo mi pago en el plazo, la unidad se libera
            y la retención expira automáticamente.
          </span>
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid || state !== "idle"}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === "idle" && (
            <>
              <Lock className="w-4 h-4" />
              Activar apartado provisional
            </>
          )}
          {state === "validating_limit" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validando…
            </>
          )}
          {state === "processing" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando retención…
            </>
          )}
          {state === "error" && (
            <>
              <AlertCircle className="w-4 h-4" />
              Reintentar
            </>
          )}
        </button>

        {state === "error" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>Hubo un error procesando tu tarjeta. Verifica los datos e inténtalo de nuevo.</p>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-success/5 border border-success/20 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-success" />
          <p className="leading-relaxed">
            Tus datos se procesan de forma cifrada bajo estándar PCI-DSS. SOZU no almacena tu
            número de tarjeta completo, únicamente los últimos 4 dígitos para tu referencia.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReservarPage;
