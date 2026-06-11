import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useOfferById, useOfferStore, formatMXN } from "@/lib/offers/offer-data";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import { supabase } from "@/integrations/supabase/client";
import ProspectCaptureForm from "@/components/capture/ProspectCaptureForm";
import PublicShell from "@/components/offer/PublicShell";
import DevelopmentLogo from "@/components/offer/DevelopmentLogo";

const ApartarDirectoCapturePage = () => {
  const { offerToken } = useParams<{ offerToken: string }>();
  const navigate = useNavigate();

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
    navigate(`/reservar/${formalReservationId}/wizard`);
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

  const specs = [
    offer.property.area,
    offer.property.bedrooms ? `${offer.property.bedrooms} rec.` : null,
    offer.property.bathrooms ? `${offer.property.bathrooms} baños` : null,
  ].filter(Boolean) as string[];

  return (
    <PublicShell
      noFooter
      agent={agent}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
    >

      {/* ── DESKTOP: split panel ── */}
      <div className="hidden lg:grid lg:grid-cols-[420px_1fr] lg:h-[calc(100vh-56px)]">

        {/* Left — property showcase */}
        <div className="relative flex flex-col border-r border-border overflow-hidden">

          {/* Subtle tinted bg */}
          <div className="absolute inset-0 bg-muted/[0.07] pointer-events-none" />

          <div className="relative flex flex-col h-full px-12 py-10">

            {/* Logo — centered top */}
            <div className="flex justify-center mb-10">
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

            {/* Property identity — centered, flex-1 */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 min-h-0">

              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.32em] font-semibold text-muted-foreground/40">
                  Unidad
                </p>
                <h2 className="text-[2.6rem] font-bold text-foreground leading-none tracking-tight">
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
            </div>

            {/* Price block — bottom anchor */}
            <div className="mt-8 pt-7 border-t border-border/50 text-center">
              <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40 mb-2.5">
                Precio de lista
              </p>
              <p className="text-[2.8rem] font-bold tabular-nums text-foreground leading-none tracking-tight">
                {formatMXN(offer.property.listPrice)}
              </p>
            </div>


          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center px-12 overflow-y-auto">
          <div className="w-full max-w-[360px] py-8">
            <ProspectCaptureForm
              offer={offer}
              context="formal_direct"
              defaultEmail={offer.prospectEmail}
              onComplete={handleComplete}
            />
          </div>
        </div>
      </div>

      {/* ── MOBILE: normal scroll ── */}
      <div className="lg:hidden px-4 py-6 space-y-5 max-w-md mx-auto">

        {/* Property card — centered */}
        <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-3.5">

          {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
            <div className="flex justify-center">
              <div className="h-8 flex items-center justify-center">
                <DevelopmentLogo
                  development={offer.development}
                  developmentName={offer.property.projectName}
                  variant="section"
                  className="!h-full"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40">
              Unidad
            </p>
            <p className="text-2xl font-bold text-foreground leading-tight">
              {offer.property.unitModel}
            </p>
            <p className="text-xs text-muted-foreground">{offer.property.unitNumber}</p>
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {specs.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border/40">
            <p className="text-[9px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/40 mb-1">
              Precio de lista
            </p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {formatMXN(offer.property.listPrice)}
            </p>
          </div>
        </div>

        <ProspectCaptureForm
          offer={offer}
          context="formal_direct"
          defaultEmail={offer.prospectEmail}
          onComplete={handleComplete}
        />
      </div>

    </PublicShell>
  );
};

export default ApartarDirectoCapturePage;
