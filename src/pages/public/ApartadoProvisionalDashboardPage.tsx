import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferById } from "@/lib/offers/offer-data";
import { useAgentById } from "@/lib/offers/agent-data";
import { calculateCountdown } from "@/lib/offers/hold-countdown";
import PublicShell from "@/components/offer/PublicShell";
import ApartadoSummaryCard from "@/components/apartado-provisional/ApartadoSummaryCard";
import HoldCountdownCard from "@/components/apartado-provisional/HoldCountdownCard";
import CompletarApartadoButton from "@/components/apartado-provisional/CompletarApartadoButton";
import AsesorContactPanel from "@/components/apartado-provisional/AsesorContactPanel";
import ContratoPreliminarReadSection from "@/components/apartado-provisional/ContratoPreliminarReadSection";
import DocumentosRequeridosCard from "@/components/apartado-provisional/DocumentosRequeridosCard";
import ProvisionalNotificationsCard from "@/components/apartado-provisional/ProvisionalNotificationsCard";
import CancelarApartadoButton from "@/components/apartado-provisional/CancelarApartadoButton";
import { Clock, AlertCircle, Home } from "lucide-react";

const ExpiredView = ({ formalReservationId }: { formalReservationId: string }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-bold text-foreground mb-2">
          Tu apartado provisional expiró
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Pasaron los 5 días sin completar el pago. La unidad quedó liberada para otros clientes y
          la retención en tu tarjeta de crédito se ha devuelto automáticamente.
        </p>
        <div className="rounded-xl border border-border bg-muted/20 p-3 mb-5 text-left">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ID Apartado</p>
          <p className="text-sm font-mono font-semibold text-foreground mt-0.5">
            {formalReservationId}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mb-3"
        >
          <Home className="w-4 h-4" />
          Explorar unidades disponibles
        </button>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Si la unidad sigue disponible, puedes iniciar un nuevo apartado con una nueva oferta. Ten
          en cuenta que precios y condiciones pueden haber cambiado.
        </p>
      </div>
    </div>
  );
};

const ApartadoProvisionalDashboardPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );
  const offer = useOfferById(formalReservation?.offerId ?? "");
  const agent = useAgentById(offer?.agentId ?? "");

  useEffect(() => {
    if (formalReservation) {
      const completedStatuses = ["pago_recibido", "expediente_en_curso", "expediente_completo"];
      if (completedStatuses.includes(formalReservation.status)) {
        navigate(`/en-adquisicion/${formalReservation.id}/expediente`, { replace: true });
      }
      if (formalReservation.status === "provisional_cancelado") {
        navigate(`/apartado-provisional/${formalReservation.id}/liberado`, { replace: true });
      }
    }
  }, [formalReservation, navigate]);

  if (!formalReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Apartado no encontrado</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!formalReservation.hold) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-sm font-semibold text-foreground">Apartado sin hold activo</p>
          <p className="text-xs text-muted-foreground">
            Este apartado no tiene una retención activa de tarjeta.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const countdown = calculateCountdown(formalReservation.hold.expiresAt);
  if (countdown.isExpired || formalReservation.status === "provisional_expirado") {
    return <ExpiredView formalReservationId={formalReservation.id} />;
  }

  return (
    <PublicShell
      agent={agent ?? undefined}
      developmentLogoUrl={offer?.development?.logoUrl ?? offer?.development?.logoUrlInverse}
      developmentName={offer?.property.projectName}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Page title row */}
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <h1 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Apartado provisional activo
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            <ApartadoSummaryCard formalReservation={formalReservation} />
            <HoldCountdownCard hold={formalReservation.hold} />
            <CompletarApartadoButton formalReservation={formalReservation} />
            <AsesorContactPanel formalReservation={formalReservation} />
            <ProvisionalNotificationsCard formalReservation={formalReservation} />
            <CancelarApartadoButton formalReservation={formalReservation} />
          </aside>

          <section className="space-y-4">
            <ContratoPreliminarReadSection formalReservation={formalReservation} />
            <DocumentosRequeridosCard />
          </section>
        </div>
      </div>
    </PublicShell>
  );
};

export default ApartadoProvisionalDashboardPage;
