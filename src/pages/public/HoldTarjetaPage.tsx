import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CreditCard, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import OfferFlowShell from "@/components/offer/OfferFlowShell";
import { useOfertaFlowStore } from "@/lib/offer-flow-store";

function formatCardNumber(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function HoldTarjetaPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { activateHold } = useOfertaFlowStore();

  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rawCard = cardNumber.replace(/\s/g, "");

  const validate = () => {
    const e: Record<string, string> = {};
    if (holderName.trim().length < 3) e.holderName = "Ingresa el nombre como aparece en la tarjeta";
    if (rawCard.length !== 16) e.cardNumber = "Número de tarjeta inválido";
    const [mm, yy] = expiry.split("/");
    const month = parseInt(mm ?? "0");
    if (!mm || !yy || yy.length < 2 || month < 1 || month > 12) e.expiry = "Fecha inválida (MM/AA)";
    if (cvc.length < 3) e.cvc = "CVC inválido";
    if (!accepted) e.terms = "Debes aceptar los términos de la retención";
    return e;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    // TODO: call Stripe/Conekta API to create PaymentIntent with capture_method: "manual"
    setTimeout(() => {
      const last4 = rawCard.slice(-4);
      activateHold(last4);
      setLoading(false);
      navigate(`/oferta/${offerId}/confirmacion`);
    }, 2000);
  };

  return (
    <OfferFlowShell
      currentStep={2}
      title="Activa la retención"
      onBack={() => navigate(`/oferta/${offerId}/tipo-comprador`)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">

        {/* Info banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-foreground">$10,000 MXN · 5 días · No es un cobro</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Es el mismo mecanismo que usan los hoteles al hacer check-in: el monto queda
              bloqueado en tu línea de crédito pero no se cobra. Si no avanzas, expira solo.
            </p>
          </div>
        </div>

        {/* Card form */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Datos de tu tarjeta
            </h2>
          </div>

          {/* Holder name */}
          <div>
            <label htmlFor="holderName" className="text-[11px] text-muted-foreground font-medium mb-1 block">
              Nombre del titular
            </label>
            <input
              id="holderName"
              type="text"
              autoComplete="cc-name"
              placeholder="Como aparece en la tarjeta"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {errors.holderName && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.holderName}</p>}
          </div>

          {/* Card number */}
          <div>
            <label htmlFor="cardNumber" className="text-[11px] text-muted-foreground font-medium mb-1 block">
              Número de tarjeta
            </label>
            <div className="relative">
              <input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className="w-full h-11 pl-3 pr-10 rounded-xl border border-border bg-background text-[13px] tabular-nums tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            {errors.cardNumber && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.cardNumber}</p>}
          </div>

          {/* Expiry + CVC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="expiry" className="text-[11px] text-muted-foreground font-medium mb-1 block">
                Vencimiento
              </label>
              <input
                id="expiry"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              {errors.expiry && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.expiry}</p>}
            </div>
            <div>
              <label htmlFor="cvc" className="text-[11px] text-muted-foreground font-medium mb-1 block">
                CVC / CVV
              </label>
              <input
                id="cvc"
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              {errors.cvc && <p role="alert" className="text-[11px] text-destructive mt-1">{errors.cvc}</p>}
            </div>
          </div>

          {/* PCI note */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Lock className="w-3 h-3 shrink-0" />
            No almacenamos tu número completo. Cumplimos estándar PCI-DSS.
          </div>
        </div>

        {/* Terms checkbox */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  accepted ? "bg-primary border-primary" : "border-border bg-background"
                }`}
              >
                {accepted && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Entiendo que se bloqueará{" "}
              <span className="font-semibold text-foreground">$10,000 MXN</span> en mi tarjeta
              por 5 días naturales. Si no avanzo, el hold expira solo sin ningún cargo.
            </p>
          </label>
          {errors.terms && (
            <div role="alert" className="flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <p className="text-[11px] text-destructive">{errors.terms}</p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full motion-safe:animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Activar retención y apartar
              </>
            )}
          </button>
        </div>
      </form>
    </OfferFlowShell>
  );
}
