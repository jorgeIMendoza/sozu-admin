import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferStore, useOfferById, formatMXN } from "@/lib/offers/offer-data";
import {
  CheckCircle2,
  Download,
  ArrowRight,
  MessageCircle,
  Sparkles,
  Mail,
} from "lucide-react";

const FormalReservationSuccessPage = () => {
  const params = useParams<{ preReservationId?: string; formalReservationId?: string }>();
  const navigate = useNavigate();

  const reservations = useFormalReservationStore((s) => s.reservations);
  const formalReservation = params.formalReservationId
    ? reservations.find((r) => r.id === params.formalReservationId)
    : params.preReservationId
    ? reservations.find((r) => r.preReservationId === params.preReservationId)
    : undefined;

  const preReservation = useOfferStore((s) =>
    formalReservation?.preReservationId
      ? s.preReservations.find((pr) => pr.id === formalReservation.preReservationId)
      : undefined
  );
  const offer = useOfferById(formalReservation?.offerId ?? "");

  if (!formalReservation || formalReservation.status !== "completed" || !offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display text-xl font-semibold text-foreground">
            No encontramos tu apartado formal
          </h1>
          <p className="text-sm text-muted-foreground">
            El link puede haber expirado o no completaste el proceso.
          </p>
          <button
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const property = offer.property;
  const development = offer.development;
  const propertyLabel = `${development?.legalName ?? property.projectName} · ${property.unitNumber}`;

  const plan = offer.paymentPlans.find((p) => p.id === formalReservation.selectedPlanId);
  const appliedAmount = formalReservation.appliedAmountMXN ?? 0;
  const hadPreReservation = appliedAmount > 0;
  const downPayment = plan?.downPaymentAmount ?? 0;
  const remainingDownPayment = Math.max(0, downPayment - appliedAmount);

  const signedAt =
    formalReservation.contractSignature?.signedAt ?? formalReservation.completedAt;
  const dueDate = signedAt ? new Date(signedAt) : new Date();
  dueDate.setDate(dueDate.getDate() + 15);

  const userEmail = formalReservation.personalData?.email ?? "tu correo registrado";

  const goBack = () => {
    if (formalReservation.preReservationId) {
      navigate(`/mi-pre-apartado/${formalReservation.preReservationId}`);
    } else {
      navigate(`/oferta/${formalReservation.offerId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Apartado formal · {formalReservation.id}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            ¡Apartado formal completado!
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Tu propiedad <strong className="text-foreground">{propertyLabel}</strong> está
            formalmente apartada a tu nombre.
          </p>
        </div>

        {/* Card propiedad */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex gap-4">
            {offer.gallery?.[0] && (
              <img
                src={offer.gallery[0]}
                alt={propertyLabel}
                className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider">
                Apartada a tu nombre
              </span>
              <p className="text-base font-bold text-foreground">{propertyLabel}</p>
              {plan && (
                <p className="text-xs text-muted-foreground">
                  Plan elegido:{" "}
                  <span className="font-semibold text-foreground">{plan.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Resumen financiero
          </p>
          <div className="space-y-3">
            {hadPreReservation && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pre-apartado aplicado</span>
                <span className="font-semibold text-success tabular-nums">
                  +{formatMXN(appliedAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Enganche total acordado</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatMXN(downPayment)}
              </span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {hadPreReservation
                    ? "Por pagar para completar enganche"
                    : "Enganche por pagar"}
                </p>
                <p className="text-[11px] text-warning">
                  Antes del{" "}
                  {dueDate.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {formatMXN(remainingDownPayment)}
              </span>
            </div>
          </div>
        </div>

        {/* Email mock */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Te enviamos un email con el contrato firmado y los próximos pasos a{" "}
            <strong className="text-foreground">{userEmail}</strong>.
          </p>
        </div>

        {/* CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={goBack}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {preReservation ? "Volver a mi pre-apartado" : "Volver a la oferta"}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => console.log("Descargar contrato firmado")}
            className="h-12 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar contrato firmado
          </button>
        </div>

        {/* Cards informativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">¿Qué sigue?</p>
            </div>
            <ol className="space-y-2.5">
              {[
                `Completa el saldo del enganche antes del ${dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.`,
                `Pagos mensuales conforme al plan ${plan?.name ?? "elegido"}.`,
                "Recibirás actualizaciones de obra periódicas.",
                "Al completar pagos: firma de escritura ante notario.",
              ].map((text, idx) => (
                <li key={idx} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      idx === 0
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className={idx === 0 ? "text-foreground font-medium" : ""}>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-success" />
              <p className="text-sm font-semibold text-foreground">¿Dudas? Tu agente</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Luz Ochoa te acompaña en esta etapa. Responde por WhatsApp en menos de 2 horas
              hábiles.
            </p>
            <button className="w-full h-10 rounded-xl bg-success text-success-foreground text-xs font-semibold hover:bg-success/90 transition-colors flex items-center justify-center gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              Escribir por WhatsApp
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FormalReservationSuccessPage;
