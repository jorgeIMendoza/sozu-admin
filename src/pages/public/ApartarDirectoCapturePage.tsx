import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  RESERVATION_TOKEN_PARAM,
  parseReservationToken,
  withReservationToken,
} from "@/lib/offers/reservation-token";
import { useOfferById, useOfferStore } from "@/lib/offers/offer-data";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import { supabase } from "@/integrations/supabase/client";
import ProspectCaptureForm from "@/components/capture/ProspectCaptureForm";
import PublicShell from "@/components/offer/PublicShell";
import OfferFooter from "@/components/offer/OfferFooter";

const ApartarDirectoCapturePage = () => {
  const { offerToken } = useParams<{ offerToken: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Credencial del link personal del cliente: sin ella las RPC públicas no responden.
  const reservationToken = parseReservationToken(searchParams.get(RESERVATION_TOKEN_PARAM));

  const isNumericToken = !!offerToken && !isNaN(parseInt(offerToken, 10));
  const mockOffer = useOfferById(offerToken ?? "");
  const { data: dbOfferResult, isLoading: dbLoading } = useOfferFromDB(offerToken ?? "");
  const offer = isNumericToken ? (dbOfferResult?.offer ?? null) : (mockOffer ?? null);
  const mockAgent = useAgentById(offer?.agentId ?? "");
  const [agentFromDB, setAgentFromDB] = useState<Agent | undefined>(undefined);
  const agentOfferId = offer?.id;
  useEffect(() => {
    if (!agentOfferId) return;
    (async () => {
      const { data: oferta } = await supabase
        .from("ofertas").select("email_creador").eq("id", agentOfferId).single();
      if (!oferta?.email_creador) return;
      const { data: usuario } = await supabase
        .from("usuarios").select("id_persona").eq("email", oferta.email_creador).single();
      if (!usuario?.id_persona) return;
      const { data: persona } = await supabase
        .from("personas").select("nombre_legal, telefono, clave_pais_telefono").eq("id", usuario.id_persona).single();
      if (!persona?.nombre_legal) return;
      const countryCode = (persona.clave_pais_telefono ?? "+52").replace("+", "");
      const rawPhone = (persona.telefono ?? "").replace(/\s/g, "");
      setAgentFromDB({
        id: "", fullName: persona.nombre_legal,
        firstName: persona.nombre_legal.split(" ")[0],
        title: "", photoUrl: "", email: "",
        phone: rawPhone ? `${persona.clave_pais_telefono ?? "+52"} ${persona.telefono ?? ""}` : "",
        whatsapp: rawPhone ? `${countryCode}${rawPhone}` : "",
        isAllied: true,
      });
    })();
  }, [agentOfferId]);
  const agent = agentFromDB ?? mockAgent ?? undefined;

  const createProspect = useOfferStore((s) => s.createProspect);
  const findProspectByEmail = useOfferStore((s) => s.findProspectByEmail);
  const setActiveProspect = useOfferStore((s) => s.setActiveProspect);
  const verifyProspect = useOfferStore((s) => s.verifyProspect);
  const initiateFormalReservation = useFormalReservationStore(
    (s) => s.initiateFormalReservation
  );
  const reservations = useFormalReservationStore((s) => s.reservations);

  useEffect(() => {
    if (isNumericToken && dbLoading) return;
    if (!offer) navigate("/");
  }, [offer, navigate, isNumericToken, dbLoading]);

  if (isNumericToken && dbLoading) return null;
  if (!offer) return null;

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
    navigate(withReservationToken(`/reservar/${formalReservationId}/wizard`, reservationToken));
  };

  // Paso 1: persiste nombre/teléfono del lead en BD (RPC SECURITY DEFINER anon).
  // El usuario confirma/corrige sus datos antes de continuar. Si la RPC no existe
  // aún, no bloquea: los datos igual viajan en memoria al resto del flujo.
  const handleSaveData = async (data: { fullName: string; phoneDigits: string; countryCode: string }) => {
    if (!offer) return false;
    try {
      const { data: ok, error } = await (supabase as any).rpc("update_lead_datos", {
        p_oferta_id: Number(offer.id),
        p_nombre: data.fullName,
        p_telefono: data.phoneDigits,
        // Sin token la RPC devuelve false y no escribe nada (fallo cerrado).
        p_token: reservationToken,
      });
      return !error && ok !== false;
    } catch {
      return false;
    }
  };

  const handleComplete = (data: { fullName: string; email: string; phone: string }) => {
    const existing = findProspectByEmail(data.email);
    if (existing) {
      if (existing.verificationStatus !== "verified") verifyProspect(existing.id);
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
    verifyProspect(prospect.id);
    proceedDirectlyToWizard(prospect.id);
  };

  return (
    <PublicShell
      noFooter
      agent={agent}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
    >
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
        {/* Form top-align — sin panel de propiedad (ya se mostró en la oferta) */}
        <div className="flex-1 flex items-start justify-center px-4 py-4">
          <div className="w-full max-w-[380px]">
            <ProspectCaptureForm
              offer={offer}
              context="formal_direct"
              defaultEmail={offer.prospectEmail}
              defaultFullName={offer.prospectName}
              defaultPhone={offer.prospectPhone}
              defaultDialCode={offer.prospectDialCode}
              onSaveData={handleSaveData}
              onComplete={handleComplete}
            />
          </div>
        </div>

        <OfferFooter offer={offer} />
      </div>
    </PublicShell>
  );
};

export default ApartarDirectoCapturePage;
