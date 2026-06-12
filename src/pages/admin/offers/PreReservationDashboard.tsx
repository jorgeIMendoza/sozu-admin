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
import { useOfferStore, useOfferById, formatMXN, formatPropertyTitle } from "@/lib/offers/offer-data";
import { useAuthStore, useCurrentSession } from "@/lib/offers/auth-data";
import { useAgentById } from "@/lib/offers/agent-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";
import CountdownTimer from "@/components/admin/offers/offer/CountdownTimer";
import RetentionStateStepper from "@/components/admin/offers/offer/RetentionStateStepper";
import AgentCard from "@/components/admin/offers/offer/AgentCard";
import PreReservationTimeline from "@/components/admin/offers/offer/PreReservationTimeline";
import CancelPreReservationFlow from "@/components/admin/offers/offer/CancelPreReservationFlow";
import AdvanceToFormalModal from "@/components/admin/offers/offer/AdvanceToFormalModal";
import TimeTravelControl from "@/components/admin/offers/offer/TimeTravelControl";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  Building2,
  Calendar,
  Receipt,
  AlertCircle,
} from "lucide-react";


const PreReservationDashboard = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const session = useCurrentSession();
  const logout = useAuthStore((s) => s.logout);

  const reservation = useOfferStore((s) =>
    s.preReservations.find((r) => r.id === reservationId)
  );
  const offer = useOfferById(reservation?.offerId ?? "");
  const agent = useAgentById(offer?.agentId ?? "");
  const cancelPreReservation = useOfferStore((s) => s.cancelPreReservation);
  const createCancellationFeedback = useOfferStore((s) => s.createCancellationFeedback);

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.preReservationId === reservationId)
  );
  const isFormalCompleted = formalReservation?.status === "completed";


  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // ── Guard de auth: redirige a /acceder si no hay sesión activa ──
  useEffect(() => {
    if (!session && reservationId && reservationId !== ":reservationId") {
      navigate(
        `/acceder?redirect=${encodeURIComponent(`/mi-pre-apartado/${reservationId}`)}`,
        { replace: true }
      );
    }
  }, [session, reservationId, navigate]);

  if (!reservation || !offer) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Pre-apartado no encontrado</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta URL espera un folio real (ej. <span className="font-mono text-foreground">PRE-XXXXX</span>),
            no el placeholder <span className="font-mono">:reservationId</span>. Para generar uno,
            completa el flujo desde una oferta.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => navigate("/oferta/O-002383")}
              className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Ir a la oferta de prueba
            </button>
            <button
              onClick={() => navigate("/")}
              className="h-10 px-5 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </PublicShell>
    );
  }

  const interestedPlan = reservation.interestedPlanId
    ? offer.paymentPlans.find((p) => p.id === reservation.interestedPlanId)
    : undefined;

  const propertyLabel = formatPropertyTitle(offer.property);

  // ── Verificación de propiedad: la sesión debe corresponder al prospecto del pre-apartado ──
  if (session && reservation.prospectId !== session.prospectId) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-5">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold mb-2">No tienes acceso a este pre-apartado</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este pre-apartado pertenece a otra persona. Si crees que es un error, contacta a tu
            agente.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </PublicShell>
    );
  }

  // ── Vista APPLIED ──
  if (reservation.status === "applied") {
    return (
      <PublicShell agent={agent}>
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-12">
          <StatusBanner
            icon={Check}
            tone="success"
            title="Has avanzado al apartado formal"
            subtitle={`Tu pre-apartado de ${propertyLabel} fue convertido exitosamente. Tu agente te contactará para los siguientes pasos.`}
            ctaLabel="Ver tu cuenta de cobranza"
            onCta={() => navigate("/")}
          />
        </div>
      </PublicShell>
    );
  }

  // ── Vista CANCELLED_REFUNDED ──
  if (reservation.status === "cancelled_refunded") {
    return (
      <PublicShell agent={agent}>
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-12">
          <StatusBanner
            icon={AlertCircle}
            tone="neutral"
            title="Pre-apartado cancelado"
            subtitle={`Tu reembolso de ${formatMXN(reservation.amountMXN)} fue procesado. Aparecerá en tu tarjeta entre 3 y 5 días hábiles.`}
            ctaLabel="Volver a la oferta"
            onCta={() => navigate(`/oferta/${offer.id}`)}
          />
        </div>
      </PublicShell>
    );
  }

  // ── Vista EXPIRED ──
  if (reservation.status === "expired") {
    return (
      <PublicShell agent={agent}>
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-12">
          <StatusBanner
            icon={Calendar}
            tone="neutral"
            title="Tu pre-apartado venció"
            subtitle={`Liberamos la retención de ${formatMXN(reservation.amountMXN)}. Si sigues interesado, contacta a tu agente para una nueva oferta.`}
            ctaLabel="Volver a la oferta"
            onCta={() => navigate(`/oferta/${offer.id}`)}
          />
        </div>
      </PublicShell>
    );
  }

  // ── Vista ACTIVE (principal) ──
  return (
    <PublicShell agent={agent}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-32 md:pb-12 space-y-6">
        {isFormalCompleted && formalReservation && (
          <div className="rounded-2xl border border-success/30 bg-success/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                🎉 Apartado formal completado
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Tu propiedad está apartada a tu nombre. Folio {formalReservation.id}.
              </p>
            </div>
            <button
              onClick={() =>
                navigate(`/mi-pre-apartado/${reservation.id}/apartar-formal/exito`)
              }
              className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-success hover:underline flex-shrink-0"
            >
              Ver detalle →
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Tu pre-apartado · {reservation.id}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1.5">{propertyLabel}</h1>
          </div>
          {session && (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 flex-shrink-0"
            >
              Cerrar sesión
            </button>
          )}
        </div>

        {/* Countdown + Monto retenido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CountdownTimer endDate={reservation.reservationExpiresAt} />

          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Monto retenido</h3>
            </div>
            <div className="text-3xl md:text-4xl font-bold tabular-nums">
              {formatMXN(reservation.amountMXN)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              En tarjeta {(reservation.cardBrand ?? "card").toUpperCase()} termina en{" "}
              <span className="tabular-nums">{reservation.cardLast4 ?? "****"}</span>
            </p>
            {isFormalCompleted && formalReservation?.completedAt ? (
              <p className="text-xs text-success font-semibold mt-auto pt-3 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Aplicado al enganche el{" "}
                {new Date(formalReservation.completedAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : (
              <p className="text-xs text-success font-semibold mt-auto pt-3">
                100% reembolsable en cualquier momento
              </p>
            )}

          </div>
        </div>

        {/* Estado de la retención */}
        <RetentionStateStepper activeState="held" />

        {/* Tu unidad */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                Tu unidad
              </p>
            </div>
            <button
              onClick={() => navigate(`/oferta/${offer.id}`)}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Ver oferta completa
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-4">
            {offer.gallery?.[0] && (
              <img
                src={offer.gallery[0]}
                alt={propertyLabel}
                className="w-24 h-24 md:w-28 md:h-28 rounded-xl object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 divide-y divide-border">
              <PropRow label="Proyecto" value={offer.property.projectName} />
              <PropRow label="Modelo" value={offer.property.unitModel} />
              <PropRow label="Unidad" value={offer.property.unitNumber} />
              <PropRow label="Área" value={`${offer.property.area} m²`} />
            </div>
          </div>
        </div>

        {/* Plan de interés */}
        {interestedPlan && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                  Plan de tu interés
                </p>
                <h3 className="text-base font-semibold mt-1">{interestedPlan.name}</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-[11px] font-semibold">
                <AlertCircle className="w-3 h-3" />
                Por confirmar con tu agente
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PlanCell
                label="Precio final"
                value={formatMXN(interestedPlan.finalPrice)}
              />
              <PlanCell
                label={`Enganche ${interestedPlan.downPaymentPct}%`}
                value={formatMXN(interestedPlan.downPaymentAmount)}
              />
              <PlanCell
                label={`A la entrega ${interestedPlan.finalPaymentPct}%`}
                value={formatMXN(interestedPlan.finalPaymentAmount)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-4">
              Este es el plan que viste antes de pre-apartar. Tu agente lo confirmará contigo en la
              llamada de seguimiento. Puedes cambiar a otro de los 7 esquemas en cualquier momento
              antes del apartado formal.
            </p>
          </div>
        )}

        {/* Agent card */}
        {agent && <AgentCard agent={agent} offerId={offer.id} />}

        {/* Timeline */}
        <PreReservationTimeline reservation={reservation} offer={offer} agent={agent} />

        {/* Time-travel control (solo dev) */}
        {import.meta.env.DEV && <TimeTravelControl />}

        {/* Comprobante */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Comprobante del pre-apartado
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <ReceiptRow label="Folio" value={reservation.id} mono />
            <ReceiptRow label="Oferta" value={offer.id} mono />
            <ReceiptRow
              label="Creado"
              value={new Date(reservation.createdAt).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <ReceiptRow label="Autorización" value={reservation.authorizationCode ?? "—"} mono />
          </div>
        </div>
      </div>

      {/* Sticky CTAs */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border md:relative md:bg-transparent md:backdrop-blur-none md:border-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 md:pb-12 flex flex-col-reverse md:flex-row gap-3">
          <button
            onClick={() => setShowCancelModal(true)}
            className="md:flex-1 h-11 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-destructive/40 hover:text-destructive transition-colors"
          >
            Cancelar pre-apartado
          </button>
          {isFormalCompleted ? (
            <button
              onClick={() =>
                navigate(`/mi-pre-apartado/${reservation.id}/apartar-formal/exito`)
              }
              className="md:flex-[2] h-11 rounded-xl bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Ver mi apartado formal
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowAdvanceModal(true)}
              className="md:flex-[2] h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              Avanzar al apartado formal
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>

      {/* Modals */}
      <CancelPreReservationFlow
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={async () => {
          cancelPreReservation(reservation.id);
        }}
        onRecordFeedback={(input) => {
          createCancellationFeedback({
            reservationId: reservation.id,
            prospectId: reservation.prospectId,
            primaryReason: input.primaryReason,
            subReason: input.subReason,
            freeFormFeedback: input.freeFormFeedback,
            outcome: input.outcome,
          });
        }}
        amountMXN={reservation.amountMXN}
        cardLast4={reservation.cardLast4}
        propertyLabel={propertyLabel}
        daysRemaining={Math.max(
          0,
          Math.ceil(
            (new Date(reservation.reservationExpiresAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )}
        reservationId={reservation.id}
        offerId={offer.id}
        agent={agent}
      />

      <AdvanceToFormalModal
        open={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        agent={agent}
        offerId={offer.id}
        preReservation={reservation}
      />
    </PublicShell>
  );
};

// ── Sub-components ──

const PropRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 text-sm">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground tabular-nums">{value}</span>
  </div>
);

const PlanCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-muted/40 p-3">
    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
      {label}
    </p>
    <p className="text-sm font-bold text-foreground tabular-nums mt-1">{value}</p>
  </div>
);

const ReceiptRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-sm font-medium text-foreground mt-0.5 ${mono ? "tabular-nums font-mono" : ""}`}>
      {value}
    </p>
  </div>
);

const StatusBanner = ({
  icon: Icon,
  tone,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: typeof Check;
  tone: "success" | "neutral";
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
}) => {
  const bgClass =
    tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5 ${bgClass}`}>
        <Icon className="w-8 h-8" strokeWidth={2.5} />
      </div>
      <h1 className="text-xl md:text-2xl font-bold mb-3">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-6">
        {subtitle}
      </p>
      <button
        onClick={onCta}
        className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
      >
        {ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PreReservationDashboard;
