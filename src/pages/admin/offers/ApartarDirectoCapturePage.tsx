import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOfferById, useOfferStore } from "@/lib/offers/offer-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useAgentById } from "@/lib/offers/agent-data";
import ProspectCaptureForm from "@/components/admin/offers/capture/ProspectCaptureForm";

const ApartarDirectoCapturePage = () => {
  const { offerToken } = useParams<{ offerToken: string }>();
  const navigate = useNavigate();

  const offer = useOfferById(offerToken ?? "");
  const agent = useAgentById(offer?.agentId ?? "");

  const createProspect = useOfferStore((s) => s.createProspect);
  const findProspectByEmail = useOfferStore((s) => s.findProspectByEmail);
  const setActiveProspect = useOfferStore((s) => s.setActiveProspect);
  const setPendingFlow = useOfferStore((s) => s.setPendingFlow);
  const initiateFormalReservation = useFormalReservationStore(
    (s) => s.initiateFormalReservation
  );
  const reservations = useFormalReservationStore((s) => s.reservations);

  useEffect(() => {
    if (!offer) navigate("/");
  }, [offer, navigate]);

  if (!offer) return null;

  const agentName = agent?.fullName;

  const proceedDirectlyToWizard = (prospectId: string) => {
    const existing = reservations.find(
      (r) => r.prospectId === prospectId && r.offerId === offer.id
    );
    let formalReservationId: string;
    if (existing) {
      formalReservationId = existing.id;
    } else {
      const fr = initiateFormalReservation({
        preReservationId: null,
        prospectId,
        offerId: offer.id,
        agentId: offer.agentId ?? "AGT-RAMON",
        appliedAmountMXN: 0,
      });
      formalReservationId = fr.id;
    }
    navigate(`/apartar/${formalReservationId}/wizard`);
  };

  const handleComplete = (data: { fullName: string; email: string; phone: string }) => {
    const existing = findProspectByEmail(data.email);
    if (existing?.verificationStatus === "verified") {
      setActiveProspect(existing.id);
      proceedDirectlyToWizard(existing.id);
      return;
    }

    const prospect = createProspect({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      source: "formal_direct",
    });

    setPendingFlow(prospect.id, {
      type: "formal_direct",
      offerId: offer.id,
      initiatedAt: new Date().toISOString(),
    });

    navigate(`/verificar-email/${prospect.id}`);
  };

  return (
    <ProspectCaptureForm
      offer={offer}
      agentName={agentName}
      context="formal_direct"
      onBack={() => navigate(`/oferta/${offer.id}`)}
      onComplete={handleComplete}
    />
  );
};

export default ApartarDirectoCapturePage;
