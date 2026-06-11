import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import {
  useFormalReservationStore,
  countActiveHoldsForClient,
  getClientIdentifier,
  MAX_HOLDS_PER_CLIENT,
} from "@/lib/offers/formal-reservation-data";
import { useOfferById, formatMXN } from "@/lib/offers/offer-data";
import { useAgentById } from "@/lib/offers/agent-data";
import { processCardHold, detectCardBrand, HOLD_AMOUNT_MXN, HOLD_DAYS } from "@/lib/offers/card-hold-processor";
import PublicShell from "@/components/offer/PublicShell";
import DevelopmentLogo from "@/components/offer/DevelopmentLogo";
import {
  AlertCircle,
  Info,
  Lock,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
// loadStripe solo cuando hay key — para no cargar el SDK sin propósito
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

type ProcessState = "idle" | "validating" | "processing" | "limit_exceeded" | "error";

const formatCardNumber = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, 16).match(/.{1,4}/g)?.join(" ") ?? "";

const formatExpiry = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const CardForm = ({
  formalReservationId,
  navigate,
}: {
  formalReservationId: string;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const allReservations = useFormalReservationStore((s) => s.reservations);
  const activateHold = useFormalReservationStore((s) => s.activateHold);
  const formalReservation = allReservations.find((r) => r.id === formalReservationId);

  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<ProcessState>("idle");

  const cardDigits = cardNumber.replace(/\D/g, "");
  const [expiryMonth, expiryYear] = expiry.split("/");

  const isFormValid =
    holderName.trim().length >= 3 &&
    cardDigits.length === 16 &&
    /^(0[1-9]|1[0-2])$/.test(expiryMonth ?? "") &&
    /^\d{2}$/.test(expiryYear ?? "") &&
    /^\d{3,4}$/.test(cvc) &&
    acceptedTerms;

  const handleSubmit = async () => {
    if (!isFormValid || state !== "idle" || !formalReservation) return;

    setState("validating");
    await new Promise((r) => setTimeout(r, 400));

    const clientId = getClientIdentifier(formalReservation);
    const activeHolds = countActiveHoldsForClient(allReservations, clientId, formalReservationId);
    if (activeHolds >= MAX_HOLDS_PER_CLIENT) { setState("limit_exceeded"); return; }

    setState("processing");
    try {
      const stripe = stripePromise ? await stripePromise : null;

      if (stripe) {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "create-hold-payment-intent",
          { body: { formalReservationId, amountCents: HOLD_AMOUNT_MXN * 100, currency: "mxn" } }
        );
        if (invokeError) throw new Error(invokeError.message);

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          data.clientSecret,
          {
            payment_method: {
              card: {
                number: cardDigits,
                exp_month: parseInt(expiryMonth ?? "12", 10),
                exp_year: 2000 + parseInt(expiryYear ?? "28", 10),
                cvc,
              },
              billing_details: { name: holderName.trim() },
            },
          }
        );
        if (stripeError) throw new Error(stripeError.message);

        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + HOLD_DAYS);

        const holdData = {
          holdAuthorizationId: paymentIntent!.id,
          cardLast4: cardDigits.slice(-4),
          cardBrand: detectCardBrand(cardDigits),
          amountMXN: HOLD_AMOUNT_MXN,
          activatedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: "active" as const,
          releasedAt: null,
        };

        const success = activateHold(formalReservationId, holdData);
        if (!success) { setState("limit_exceeded"); return; }
        navigate(`/reservar/${formalReservationId}/provisional-activado`, { replace: true });
        return;
      }

      // Fallback mock — solo cuando no hay VITE_STRIPE_PUBLISHABLE_KEY configurada
      const holdData = await processCardHold({
        cardNumber: cardDigits,
        cardHolderName: holderName.trim(),
        expiryMonth: expiryMonth ?? "12",
        expiryYear: expiryYear ?? "28",
        cvc,
      });

      const success = activateHold(formalReservationId, holdData);
      if (!success) { setState("limit_exceeded"); return; }

      navigate(`/reservar/${formalReservationId}/provisional-activado`, { replace: true });
    } catch {
      setState("error");
    }
  };

  if (state === "limit_exceeded") {
    return (
      <div className="text-center space-y-4 py-10">
        <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-warning" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Límite de {MAX_HOLDS_PER_CLIENT} apartados activos alcanzado
        </p>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Completa el pago de uno o espera a que expire para continuar.
        </p>
      </div>
    );
  }

  const inputClass = (valid?: boolean) =>
    `w-full h-11 px-3 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground/40
     focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/15 transition-colors disabled:opacity-50
     ${valid === false ? "border-destructive focus:ring-destructive/15" : "border-border"}`;

  return (
    <form
      autoComplete="on"
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      className="space-y-4"
    >
      {/* Holder name */}
      <div className="space-y-1.5">
        <label htmlFor="cc-name" className="text-xs font-semibold text-foreground">
          Nombre del titular <span className="text-destructive">*</span>
        </label>
        <input
          id="cc-name"
          name="ccname"
          type="text"
          autoComplete="cc-name"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value.toUpperCase())}
          placeholder="NOMBRE EN LA TARJETA"
          disabled={state !== "idle"}
          className={inputClass() + " uppercase"}
        />
      </div>

      {/* Card number */}
      <div className="space-y-1.5">
        <label htmlFor="cc-number" className="text-xs font-semibold text-foreground">
          Número de tarjeta <span className="text-destructive">*</span>
        </label>
        <input
          id="cc-number"
          name="cardnumber"
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          placeholder="0000 0000 0000 0000"
          maxLength={19}
          disabled={state !== "idle"}
          className={inputClass() + " tabular-nums tracking-wider font-mono"}
        />
      </div>

      {/* Expiry + CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="cc-exp" className="text-xs font-semibold text-foreground">
            Vencimiento <span className="text-destructive">*</span>
          </label>
          <input
            id="cc-exp"
            name="ccexp"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/AA"
            maxLength={5}
            disabled={state !== "idle"}
            className={inputClass() + " tabular-nums font-mono text-center"}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cc-csc" className="text-xs font-semibold text-foreground">
            CVC <span className="text-destructive">*</span>
          </label>
          <input
            id="cc-csc"
            name="cvc"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="123"
            maxLength={4}
            disabled={state !== "idle"}
            className={inputClass() + " tabular-nums font-mono text-center"}
          />
        </div>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          disabled={state !== "idle"}
          className="w-4 h-4 mt-0.5 accent-primary shrink-0 disabled:opacity-50"
        />
        <span className="text-[11px] text-muted-foreground leading-relaxed">
          Acepto la retención de{" "}
          <strong className="text-foreground">
            ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN
          </strong>{" "}
          en mi tarjeta de crédito por {HOLD_DAYS} días naturales. Entiendo que es una
          retención (hold), no un cargo, y se libera automáticamente si no completo el pago.
        </span>
      </label>

      {state === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Error procesando la tarjeta. Verifica los datos e intenta de nuevo.
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || state !== "idle"}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
      >
        {state === "idle" && <><Lock className="w-4 h-4" />Activar apartado provisional</>}
        {state === "validating" && <><Loader2 className="w-4 h-4 motion-safe:animate-spin" />Validando…</>}
        {state === "processing" && <><Loader2 className="w-4 h-4 motion-safe:animate-spin" />Procesando retención…</>}
        {state === "error" && <><AlertCircle className="w-4 h-4" />Reintentar</>}
      </button>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Cifrado PCI-DSS con Stripe. SOZU no almacena el número completo de tu tarjeta,
          solo los últimos 4 dígitos para tu referencia.
        </p>
      </div>
    </form>
  );
};

const ReservarPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  const offer = useOfferById(formalReservation?.offerId ?? "");
  const agent = useAgentById(offer?.agentId ?? "");

  if (!formalReservation || !offer || !formalReservationId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Cargando…
      </div>
    );
  }

  const specs = [
    offer.property.area,
    offer.property.bedrooms ? `${offer.property.bedrooms} rec.` : null,
    offer.property.bathrooms ? `${offer.property.bathrooms} baños` : null,
  ].filter(Boolean) as string[];

  return (
    <PublicShell
      noFooter
      agent={agent ?? undefined}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
    >

      {/* ── DESKTOP: split panel ── */}
      <div className="hidden lg:grid lg:grid-cols-[420px_1fr] lg:h-[calc(100vh-56px)]">

        {/* Left — property context */}
        <div className="relative flex flex-col border-r border-border overflow-hidden">
          <div className="absolute inset-0 bg-muted/[0.07] pointer-events-none" />

          <div className="relative flex flex-col h-full px-12 py-10">

            {/* Logo centered top */}
            <div className="flex justify-center mb-8">
              {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) ? (
                <div className="h-11 flex items-center justify-center">
                  <DevelopmentLogo
                    development={offer.development}
                    developmentName={offer.property.projectName}
                    variant="section"
                    className="!h-full"
                  />
                </div>
              ) : (
                <p className="text-[10px] uppercase tracking-[0.32em] font-bold text-muted-foreground/40">
                  {offer.property.projectName}
                </p>
              )}
            </div>

            {/* Center content — flex-1 */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 min-h-0">

              {/* Property identity */}
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.32em] font-semibold text-muted-foreground/40">
                  Unidad
                </p>
                <h2 className="text-[2.2rem] font-bold text-foreground leading-none tracking-tight">
                  {offer.property.unitModel}
                </h2>
                <p className="text-sm text-muted-foreground font-medium">
                  {offer.property.unitNumber}
                </p>
              </div>

              {specs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {specs.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-medium text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/60"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {offer.location?.address && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {offer.location.address}
                </p>
              )}

              {/* Hold amount hero */}
              <div className="w-full pt-5 border-t border-border/50 text-center">
                <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40 mb-2">
                  Retención a autorizar
                </p>
                <p className="text-[2.8rem] font-bold tabular-nums text-foreground leading-none tracking-tight">
                  {formatMXN(HOLD_AMOUNT_MXN)}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                  MXN · {HOLD_DAYS} días · no es un cobro
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Right — card form */}
        <div className="flex items-center justify-center px-12 overflow-y-auto">
          <div className="w-full max-w-[380px] py-8 space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                Datos de tu tarjeta de crédito
              </h1>
              <p className="text-[13px] text-muted-foreground">
                Solo para autorizar la retención. No se realiza ningún cargo.
              </p>
            </div>
            <CardForm
              formalReservationId={formalReservationId}
              navigate={navigate}
            />
          </div>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="lg:hidden px-4 py-6 space-y-5 max-w-md mx-auto">

        <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-3">
          {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
            <div className="flex justify-center">
              <div className="h-8">
                <DevelopmentLogo
                  development={offer.development}
                  developmentName={offer.property.projectName}
                  variant="section"
                  className="!h-full"
                />
              </div>
            </div>
          )}
          <div>
            <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40">Unidad</p>
            <p className="text-2xl font-bold text-foreground">{offer.property.unitModel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{offer.property.unitNumber}</p>
          </div>
          <div className="border-t border-border/40 pt-3">
            <p className="text-[9px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/40 mb-1">
              Retención a autorizar
            </p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {formatMXN(HOLD_AMOUNT_MXN)}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {HOLD_DAYS} días · no es un cobro
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-primary/[0.06] border border-primary/15">
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-foreground">¿Qué es una retención de tarjeta?</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Es el mismo mecanismo que usan los hoteles cuando bloquean un monto al hacer
              check-in. El dinero queda reservado pero <strong className="text-foreground">NO se cobra</strong>.
              Si decides avanzar, harás la transferencia por separado y el hold se libera.
              Si decides no avanzar, el hold expira y tu crédito vuelve a estar disponible.
              En ningún caso te cobramos esos ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")}.
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-foreground">Datos de tu tarjeta de crédito</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Solo para autorizar la retención. No se realiza ningún cargo.
          </p>
        </div>

        <CardForm
          formalReservationId={formalReservationId}
          navigate={navigate}
        />
      </div>

    </PublicShell>
  );
};

export default ReservarPage;
