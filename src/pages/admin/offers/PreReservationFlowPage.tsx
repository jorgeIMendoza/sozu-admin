/**
 * @deprecated F.3.C — Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useOfferById,
  useOfferStore,
  useSelectedPlanId,
  formatMXN,
  formatPropertyTitle,
  type OfertaComercial,
  type PaymentPlan,
} from "@/lib/offers/offer-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";
import { useAuthStore } from "@/lib/offers/auth-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import RetentionStateStepper from "@/components/admin/offers/offer/RetentionStateStepper";
import AgentSignature from "@/components/admin/offers/offer/AgentSignature";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  ShieldCheck,
  Lock,
  Wallet,
  Loader2,
} from "lucide-react";

type StepId = "contact" | "card" | "success";
const STEPS: StepId[] = ["contact", "card", "success"];

const inputCls =
  "w-full h-11 px-3 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors";

const primaryBtn = (active: boolean) =>
  `mt-6 w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
    active
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-muted text-muted-foreground cursor-not-allowed"
  }`;

function detectCardBrand(num: string): string {
  const clean = num.replace(/\D/g, "");
  if (clean.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "mastercard";
  if (/^3[47]/.test(clean)) return "amex";
  return "card";
}

function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
}

function formatExp(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
    {children}
  </div>
);

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium text-foreground ${mono ? "tabular-nums" : ""}`}>
      {value}
    </span>
  </div>
);

// ── Step components ──

interface ContactStepProps {
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  offer: OfertaComercial;
  agent?: Agent;
  selectedPlan?: PaymentPlan;
  canAdvance: boolean;
  onNext: () => void;
}

const ContactStep = ({
  fullName,
  setFullName,
  email,
  setEmail,
  phone,
  setPhone,
  offer,
  agent,
  selectedPlan,
  canAdvance,
  onNext,
}: ContactStepProps) => (
  <>
    <h1 className="text-xl md:text-2xl font-bold mb-2">Empecemos por lo básico</h1>
    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
      Vas a pre-apartar{" "}
      <span className="font-semibold text-foreground">
        {formatPropertyTitle(offer.property)}
      </span>
      . Solo necesitamos saber cómo contactarte —{" "}
      <span className="font-semibold text-foreground">{agent?.firstName ?? "tu agente"}</span> te
      contactará en las próximas 24 horas para acompañarte.
    </p>

    {selectedPlan && (
      <div className="mb-6 flex items-start gap-3 p-3.5 rounded-xl border border-success/30 bg-success/5">
        <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-4 h-4 text-success" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">
            Esquema que estás explorando:{" "}
            <span className="text-success">{selectedPlan.name}</span>
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
            Tu asesora retomará este esquema en la llamada. Puedes cambiarlo en cualquier
            momento.
          </p>
        </div>
      </div>
    )}

    <div className="space-y-4">
      <Field label="Nombre completo">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          type="text"
          placeholder="Juan Pérez García"
          className={inputCls}
          maxLength={100}
        />
      </Field>
      <Field label="Email">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="juan@email.com"
          className={inputCls}
          maxLength={255}
        />
      </Field>
      <Field label="Teléfono celular">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="33 1234 5678"
          className={inputCls}
          maxLength={20}
        />
      </Field>
    </div>

    <button
      onClick={onNext}
      disabled={!canAdvance}
      className={primaryBtn(canAdvance)}
    >
      Continuar
      <ArrowRight className="w-4 h-4" />
    </button>

    <p className="mt-4 text-[11px] text-center text-muted-foreground leading-relaxed">
      Tus datos se manejan conforme al Aviso de Privacidad de SOZU.
    </p>
  </>
);

interface CardStepProps {
  cardName: string;
  setCardName: (v: string) => void;
  cardNumber: string;
  setCardNumber: (v: string) => void;
  cardExp: string;
  setCardExp: (v: string) => void;
  cardCvv: string;
  setCardCvv: (v: string) => void;
  acceptTerms: boolean;
  setAcceptTerms: (v: boolean) => void;
  canAdvance: boolean;
  submitting: boolean;
  onSubmit: () => void;
}

const CardStep = ({
  cardName,
  setCardName,
  cardNumber,
  setCardNumber,
  cardExp,
  setCardExp,
  cardCvv,
  setCardCvv,
  acceptTerms,
  setAcceptTerms,
  canAdvance,
  submitting,
  onSubmit,
}: CardStepProps) => (
  <>
    <h1 className="text-xl md:text-2xl font-bold mb-2">Asegura tu unidad</h1>
    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
      Vamos a retener <span className="font-semibold text-foreground">$5,000 MXN</span> en tu
      tarjeta. <span className="font-semibold text-foreground">No es un cobro firme.</span>
    </p>

    <div className="rounded-xl border border-success/30 bg-success/5 p-4 mb-6">
      <div className="flex gap-3">
        <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        <ul className="space-y-2 text-xs leading-relaxed text-foreground">
          <li>
            <span className="font-semibold">
              Es una retención reembolsable, no un cargo firme.
            </span>
          </li>
          <li>
            Cancela cuando quieras durante los 15 días: el monto se libera al 100%.
          </li>
          <li>
            Si avanzas con el apartado formal,{" "}
            <span className="font-semibold">los $5,000 se aplican a tu enganche.</span>
          </li>
        </ul>
      </div>
    </div>

    <div className="space-y-4">
      <Field label="Nombre del titular">
        <input
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          type="text"
          placeholder="JUAN PEREZ GARCIA"
          className={`${inputCls} uppercase`}
          maxLength={60}
        />
      </Field>
      <Field label="Número de tarjeta">
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            type="text"
            inputMode="numeric"
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`${inputCls} pl-10 tabular-nums`}
          />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiración">
          <input
            value={cardExp}
            onChange={(e) => setCardExp(formatExp(e.target.value))}
            type="text"
            inputMode="numeric"
            placeholder="MM/AA"
            maxLength={5}
            className={`${inputCls} tabular-nums`}
          />
        </Field>
        <Field label="CVV">
          <input
            value={cardCvv}
            onChange={(e) =>
              setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            type="text"
            inputMode="numeric"
            placeholder="123"
            maxLength={4}
            className={`${inputCls} tabular-nums`}
          />
        </Field>
      </div>
    </div>

    <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={acceptTerms}
        onChange={(e) => setAcceptTerms(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
      />
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        Acepto que la pre-autorización{" "}
        <span className="font-semibold text-foreground">
          no constituye contrato de compraventa
        </span>
        . La retención es{" "}
        <span className="font-semibold text-foreground">
          reembolsable al 100% en cualquier momento
        </span>{" "}
        durante la vigencia del pre-apartado (15 días naturales). Acepto el Aviso de
        Privacidad y los Términos del Pre-Apartado SOZU.
      </span>
    </label>

    <button
      onClick={onSubmit}
      disabled={!canAdvance || submitting}
      className={primaryBtn(canAdvance && !submitting)}
    >
      {submitting ? (
        <>Procesando retención…</>
      ) : (
        <>
          <Lock className="w-4 h-4" />
          Retener $5,000 MXN
        </>
      )}
    </button>

    <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
      <Lock className="w-3 h-3" />
      Conexión cifrada · Procesado por SOZU
    </p>
  </>
);

interface SuccessStepProps {
  offer: OfertaComercial;
  agent?: Agent;
  reservationId: string;
  prospectName: string;
  selectedPlan?: PaymentPlan;
}

const SuccessStep = ({ offer, agent, reservationId, prospectName, selectedPlan }: SuccessStepProps) => {
  const navigate = useNavigate();
  const resvEnd = new Date(Date.now() + 15 * 24 * 3600 * 1000);
  const firstName = prospectName.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-success" strokeWidth={3} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-2">¡Listo, {firstName}!</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tu pre-apartado fue exitoso.{" "}
          <span className="font-semibold text-foreground">
            {formatPropertyTitle(offer.property)}
          </span>{" "}
          queda apartada para ti durante los próximos 15 días.
        </p>
      </div>

      <RetentionStateStepper activeState="held" />

      <div className="rounded-2xl border border-border bg-card p-5">
        <Row label="Folio" value={reservationId} mono />
        <Row label="Oferta" value={offer.id} mono />
        <Row label="Unidad" value={formatPropertyTitle(offer.property)} />
        <Row label="Monto retenido" value={`${formatMXN(5000)} MXN`} mono />
        {selectedPlan && <Row label="Esquema de interés" value={selectedPlan.name} />}
        <Row
          label="Vigencia hasta"
          value={resvEnd.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
        <Row label="Política" value="Reembolsable en cualquier momento" />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold mb-3">Próximos pasos</h3>
        <ul className="space-y-2 text-xs leading-relaxed text-foreground">
          <li>· Recibirás un correo de confirmación con todos los detalles.</li>
          <li>
            ·{" "}
            <span className="font-semibold">
              {agent?.fullName ?? "Tu agente"} (tu agente) te contactará
            </span>{" "}
            en las próximas 24 horas
            {selectedPlan ? (
              <>
                {" "}
                para platicarte sobre el{" "}
                <span className="font-semibold">{selectedPlan.name}</span>
              </>
            ) : null}
            .
          </li>
          <li>· Revisa el contrato y consulta con quien necesites.</li>
          <li>
            · Puedes cancelar y recuperar tus $5,000 en cualquier momento durante los 15 días.
          </li>
          <li>· Si decides avanzar, los $5,000 se aplican a tu enganche.</li>
        </ul>
      </div>

      {agent && (
        <AgentSignature agent={agent} label="Tu pre-apartado está siendo atendido por" />
      )}

      <div className="space-y-3">
        <button
          onClick={() => navigate(`/mi-pre-apartado/${reservationId}`)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Ver mi pre-apartado
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(`/oferta/${offer.id}`)}
          className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          Volver a la oferta
        </button>
      </div>
    </div>
  );
};

const PreReservationFlowPage = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const offer = useOfferById(offerId ?? "");
  const agent = useAgentById(offer?.agentId ?? "");
  const selectedPlanId = useSelectedPlanId(offerId ?? "");
  const navigate = useNavigate();
  const createProspect = useOfferStore((s) => s.createProspect);
  const findProspectByEmail = useOfferStore((s) => s.findProspectByEmail);
  const setActiveProspect = useOfferStore((s) => s.setActiveProspect);
  const setPendingFlow = useOfferStore((s) => s.setPendingFlow);
  const clearPendingFlow = useOfferStore((s) => s.clearPendingFlow);
  const activeProspect = useOfferStore((s) =>
    s.prospects.find((p) => p.id === s.activeProspectId)
  );
  const createPreReservation = useOfferStore((s) => s.createPreReservation);
  const createSessionForProspect = useAuthStore((s) => s.createSessionForProspect);
  const initiateFormalReservation = useFormalReservationStore((s) => s.initiateFormalReservation);
  const [transitioningToFormal, setTransitioningToFormal] = useState(false);

  const [step, setStep] = useState<StepId>("contact");
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [resultId, setResultId] = useState<string | null>(null);

  // ── 18.8: Reanudación post-verificación ──
  // Si llega un prospect verificado con pendingFlow pre_reservation matching, saltar a card
  useEffect(() => {
    if (
      activeProspect &&
      activeProspect.verificationStatus === "verified" &&
      activeProspect.pendingFlow?.type === "pre_reservation" &&
      activeProspect.pendingFlow?.offerId === offerId &&
      step === "contact"
    ) {
      setFullName(activeProspect.fullName);
      setEmail(activeProspect.email);
      setPhone(activeProspect.phone);
      setStep("card");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProspect?.id, activeProspect?.verificationStatus, offerId]);

  if (!offer) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Oferta no encontrada</h1>
          <p className="text-sm text-muted-foreground mb-6">
            El link puede haber expirado o ser incorrecto. Prueba con{" "}
            <a href="/oferta/O-002383" className="text-primary font-medium underline">
              /offer/O-002383
            </a>{" "}
            o contacta a tu agente.
          </p>
          <button
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      </PublicShell>
    );
  }

  const selectedPlan = selectedPlanId
    ? offer.paymentPlans.find((p) => p.id === selectedPlanId)
    : undefined;

  const stepIdx = STEPS.indexOf(step);
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const canAdvanceContact =
    fullName.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.replace(/\D/g, "").length >= 10;

  const canAdvanceCard =
    cardName.trim().length >= 3 &&
    cardNumber.replace(/\D/g, "").length >= 15 &&
    /^\d{2}\/\d{2}$/.test(cardExp) &&
    cardCvv.length >= 3 &&
    acceptTerms;

  const handleNext = () => {
    if (step !== "contact") return;
    if (!canAdvanceContact) return;

    const normalizedEmail = email.trim().toLowerCase();

    // 18.8: si ya existe un prospect verificado con este email, saltar verificación
    const existing = findProspectByEmail(normalizedEmail);
    if (existing?.verificationStatus === "verified") {
      setActiveProspect(existing.id);
      setStep("card");
      return;
    }

    // Crear prospect (o reutilizar) y mandar a verificación
    const prospect = createProspect({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.replace(/\D/g, ""),
      source: "pre_reservation",
    });

    setPendingFlow(prospect.id, {
      type: "pre_reservation",
      offerId: offer.id,
      interestedPlanId: selectedPlanId,
      initiatedAt: new Date().toISOString(),
    });

    navigate(`/verificar-email/${prospect.id}`);
  };
  const handleBack = () => {
    if (step === "card") setStep("contact");
  };

  const handleSubmit = () => {
    if (!canAdvanceCard || submitting) return;
    setSubmitting(true);

    setTimeout(() => {
      // 18.8: reutilizar prospect verificado activo si existe; de lo contrario crear (legacy path)
      const prospect =
        activeProspect && activeProspect.email.toLowerCase() === email.trim().toLowerCase()
          ? activeProspect
          : createProspect({
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.replace(/\D/g, ""),
              source: "pre_reservation",
            });

      const last4 = cardNumber.replace(/\D/g, "").slice(-4);
      const brand = detectCardBrand(cardNumber);

      const reservation = createPreReservation({
        offerId: offer.id,
        prospectId: prospect.id,
        propertyId: offer.propertyId,
        cardLast4: last4,
        cardBrand: brand,
        interestedPlanId: selectedPlanId,
      });

      // ── Auto-login: el pre-cliente queda autenticado al éxito ──
      createSessionForProspect({
        prospectId: prospect.id,
        email: prospect.email,
        fullName: prospect.fullName,
      });

      setResultId(reservation.id);
      setSubmitting(false);
      clearPendingFlow(prospect.id);

      // ── Intent detection: si el usuario inició desde "Apartar esta unidad" ──
      const intent = sessionStorage.getItem("sozu_pre_reservation_intent");
      const offerIdFromIntent = sessionStorage.getItem("sozu_pre_reservation_offer_id");

      if (intent === "formal" && offerIdFromIntent === offer.id) {
        sessionStorage.removeItem("sozu_pre_reservation_intent");
        sessionStorage.removeItem("sozu_pre_reservation_offer_id");

        setTransitioningToFormal(true);

        // Iniciar formal reservation y saltar al wizard
        initiateFormalReservation({
          preReservationId: reservation.id,
          prospectId: prospect.id,
          offerId: offer.id,
          agentId: offer.agentId,
          appliedAmountMXN: 5000,
        });

        setTimeout(() => {
          navigate(`/mi-pre-apartado/${reservation.id}/apartar-formal`, { replace: true });
        }, 1400);
        return;
      }

      setStep("success");
    }, 1500);
  };

  if (transitioningToFormal) {
    return (
      <PublicShell agent={agent}>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-sm text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Preparando tu apartado formal…
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              En unos segundos comenzaremos con la captura de tus datos.
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell agent={agent}>
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            {step !== "success" ? (
              <button
                onClick={
                  step === "contact"
                    ? () => navigate(`/oferta/${offer.id}`)
                    : handleBack
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {step === "contact" ? "Volver a la oferta" : "Atrás"}
              </button>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              Paso {stepIdx + 1} de {STEPS.length}
            </span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 md:px-6 py-6 pb-16">
        {step === "contact" && (
          <ContactStep
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            offer={offer}
            agent={agent}
            selectedPlan={selectedPlan}
            canAdvance={canAdvanceContact}
            onNext={handleNext}
          />
        )}
        {step === "card" && (
          <CardStep
            cardName={cardName}
            setCardName={setCardName}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            cardExp={cardExp}
            setCardExp={setCardExp}
            cardCvv={cardCvv}
            setCardCvv={setCardCvv}
            acceptTerms={acceptTerms}
            setAcceptTerms={setAcceptTerms}
            canAdvance={canAdvanceCard}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
        {step === "success" && resultId && (
          <SuccessStep
            offer={offer}
            agent={agent}
            reservationId={resultId}
            prospectName={fullName}
            selectedPlan={selectedPlan}
          />
        )}
      </div>
    </PublicShell>
  );
};

export default PreReservationFlowPage;
