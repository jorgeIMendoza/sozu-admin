import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { processCardHold, detectCardBrand, HOLD_AMOUNT_MXN, HOLD_DAYS } from "@/lib/offers/card-hold-processor";
import { AlertCircle, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

type ProcessState = "idle" | "processing" | "error";

const formatCardNumber = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, 16).match(/.{1,4}/g)?.join(" ") ?? "";

const formatExpiry = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

type Apartado = {
  id: string;
  email: string;
  nombre: string | null;
  hold_status: string;
  activo: boolean;
};

export default function HoldApartadoPage() {
  const { apartadoId } = useParams<{ apartadoId: string }>();
  const navigate = useNavigate();

  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [state, setState] = useState<ProcessState>("idle");

  useEffect(() => {
    if (!apartadoId) { setLoadError("Link inválido."); setLoadingPage(false); return; }

    (async () => {
      const { data, error } = await (supabase as any)
        .from("apartados_provisionales")
        .select("id, email, nombre, hold_status, activo")
        .eq("id", apartadoId)
        .maybeSingle();

      if (error || !data) { setLoadError("Este link no existe o ya no es válido."); setLoadingPage(false); return; }
      if (!data.activo) { setLoadError("Este link ha sido desactivado."); setLoadingPage(false); return; }
      if (data.hold_status === "autorizado") {
        navigate(`/reservar/${apartadoId}/confirmacion`, { replace: true });
        return;
      }

      setApartado(data);
      if (data.nombre) setHolderName(data.nombre.toUpperCase());
      setLoadingPage(false);
    })();
  }, [apartadoId, navigate]);

  const cardDigits = cardNumber.replace(/\D/g, "");
  const [expiryMonth, expiryYear] = expiry.split("/");

  const isFormValid =
    holderName.trim().length >= 3 &&
    cardDigits.length === 16 &&
    /^(0[1-9]|1[0-2])$/.test(expiryMonth ?? "") &&
    /^\d{2}$/.test(expiryYear ?? "") &&
    /^\d{3,4}$/.test(cvc) &&
    acceptedTerms;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!isFormValid || state !== "idle" || !apartado) return;

    setState("processing");
    try {
      let paymentIntentId: string | null = null;
      let activatedAt: string;
      let expiresAt: string;

      const stripe = stripePromise ? await stripePromise : null;

      if (stripe) {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "create-hold-payment-intent",
          { body: { formalReservationId: apartadoId, amountCents: HOLD_AMOUNT_MXN * 100, currency: "mxn" } }
        );
        if (invokeError) throw new Error(invokeError.message);

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          data.clientSecret,
          {
            payment_method: {
              card: ({
                number: cardDigits,
                exp_month: parseInt(expiryMonth ?? "12", 10),
                exp_year: 2000 + parseInt(expiryYear ?? "28", 10),
                cvc,
              } as any),
              billing_details: { name: holderName.trim() },
            },
          }
        );
        if (stripeError) throw new Error(stripeError.message);
        paymentIntentId = paymentIntent!.id;
      } else {
        // Mock — solo cuando VITE_STRIPE_PUBLISHABLE_KEY está vacío
        const holdData = await processCardHold({
          cardNumber: cardDigits,
          cardHolderName: holderName.trim(),
          expiryMonth: expiryMonth ?? "12",
          expiryYear: expiryYear ?? "28",
          cvc,
        });
        paymentIntentId = holdData.holdAuthorizationId;
      }

      const now = new Date();
      const exp = new Date(now);
      exp.setDate(exp.getDate() + HOLD_DAYS);
      activatedAt = now.toISOString();
      expiresAt = exp.toISOString();

      const { error: updateError } = await (supabase as any)
        .from("apartados_provisionales")
        .update({
          stripe_payment_intent_id: paymentIntentId,
          hold_status: "autorizado",
          hold_activado_at: activatedAt,
          hold_expira_at: expiresAt,
          updated_at: activatedAt,
        })
        .eq("id", apartado.id);

      if (updateError) throw new Error(updateError.message);

      navigate(`/reservar/${apartadoId}/confirmacion`, { replace: true });
    } catch {
      setState("error");
    }
  };

  const inputClass =
    "w-full h-11 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-50";

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !apartado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-base font-semibold text-foreground">Link inválido</h1>
        <p className="text-[13px] text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center mb-6">
          <span className="text-primary-foreground text-[11px] font-bold">SZ</span>
        </div>
        <h1 className="text-xl font-bold text-foreground leading-tight">Apartado provisional</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Bloquea la unidad con una retención de{" "}
          <span className="font-semibold text-foreground">${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN</span>{" "}
          por {HOLD_DAYS} días. No es un cargo.
        </p>
      </div>

      <div className="flex-1 px-5 pb-10">
        {/* Info banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3 mb-5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-foreground">
              ${HOLD_AMOUNT_MXN.toLocaleString("es-MX")} MXN · {HOLD_DAYS} días · No es un cobro
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Es el mismo mecanismo que usan los hoteles al hacer check-in: el monto queda
              bloqueado en tu línea de crédito pero no se cobra. Si no avanzas, expira solo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card form */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Datos de tu tarjeta
              </h2>
            </div>

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
                className={inputClass + " uppercase"}
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
                className={inputClass + " tabular-nums tracking-wider font-mono"}
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
                  className={inputClass + " tabular-nums font-mono text-center"}
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
                  className={inputClass + " tabular-nums font-mono text-center"}
                />
              </div>
            </div>

            {/* PCI */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <Lock className="w-3 h-3 shrink-0" />
              Cifrado PCI-DSS con Stripe. SOZU no almacena el número completo.
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
            {state === "processing" && <><Loader2 className="w-4 h-4 animate-spin" />Procesando retención…</>}
            {state === "error" && <><AlertCircle className="w-4 h-4" />Reintentar</>}
          </button>
        </form>
      </div>
    </div>
  );
}
