import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOfferById, useOfferStore } from "@/lib/offers/offer-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";

const ApartarDirectoContinuarPage = () => {
  const { offerToken } = useParams<{ offerToken: string }>();
  const navigate = useNavigate();

  const offer = useOfferById(offerToken ?? "");
  const prospect = useOfferStore((s) =>
    s.prospects.find((p) => p.id === s.activeProspectId)
  );
  const clearPendingFlow = useOfferStore((s) => s.clearPendingFlow);
  const initiateFormalReservation = useFormalReservationStore(
    (s) => s.initiateFormalReservation
  );
  const reservations = useFormalReservationStore((s) => s.reservations);

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!offer || !prospect) {
      navigate("/", { replace: true });
      return;
    }
    if (prospect.verificationStatus !== "verified") {
      navigate(`/verificar-email/${prospect.id}`, { replace: true });
      return;
    }
    ran.current = true;

    const existing = reservations.find(
      (r) => r.prospectId === prospect.id && r.offerId === offer.id
    );

    let formalReservationId: string;
    if (existing) {
      formalReservationId = existing.id;
    } else {
      const fr = initiateFormalReservation({
        preReservationId: null,
        prospectId: prospect.id,
        offerId: offer.id,
        agentId: offer.agentId ?? "AGT-RAMON",
        appliedAmountMXN: 0,
      });
      formalReservationId = fr.id;
    }

    clearPendingFlow(prospect.id);

    // 18.10.A: el cliente va directo de la verificación de email al hold de tarjeta.
    // Se elimina el wizard intermedio de Tipo + Identidad (que se re-montará en 18.10.B como
    // bloque "Completar apartado" post-hold).
    navigate(`/reservar/${formalReservationId}/wizard`, { replace: true });
  }, [offer, prospect, navigate, reservations, initiateFormalReservation, clearPendingFlow]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <h1 className="text-lg md:text-xl font-bold text-foreground">Preparando tu reserva…</h1>
      </div>
    </div>
  );
};

export default ApartarDirectoContinuarPage;
