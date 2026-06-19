import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOfferById, useOfferStore, formatPropertyTitle } from "@/lib/offers/offer-data";
import FormalReservationGateModal from "@/components/admin/offers/offer/FormalReservationGateModal";
import { useAgentById } from "@/lib/offers/agent-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";
import OfferGallery from "@/components/admin/offers/offer/OfferGallery";
import OfferPropertyDetails from "@/components/admin/offers/offer/OfferPropertyDetails";
import OfferFloorPlanLarge from "@/components/admin/offers/offer/OfferFloorPlanLarge";
import OfferPaymentPlansComparator from "@/components/admin/offers/offer/OfferPaymentPlansComparator";
import OfferConstructionProgress from "@/components/admin/offers/offer/OfferConstructionProgress";
import OfferAmenities from "@/components/admin/offers/offer/OfferAmenities";
import Tour360Section from "@/components/admin/offers/offer/Tour360Section";
import AmenitiesGridSection from "@/components/admin/offers/offer/AmenitiesGridSection";
// @deprecated 18.11.E — eliminado por retro comercial:
// import EstacionamientoSection from "@/components/admin/offers/offer/EstacionamientoSection";
// import PorQueDesarrolloSection from "@/components/admin/offers/offer/PorQueDesarrolloSection";
// import AnalisisInversionSection from "@/components/admin/offers/offer/AnalisisInversionSection";
// import ValidacionSocialSection from "@/components/admin/offers/offer/ValidacionSocialSection";
// import DescargasSection from "@/components/admin/offers/offer/DescargasSection";
// import CalculadoraCapacidadPagoSection from "@/components/admin/offers/offer/CalculadoraCapacidadPagoSection";
// import OtrasUnidadesSection from "@/components/admin/offers/offer/OtrasUnidadesSection";
import PaymentPlansComparatorSection from "@/components/admin/offers/offer/PaymentPlansComparatorSection";
import OfferStickyMiniHeader from "@/components/admin/offers/offer/OfferStickyMiniHeader";
import OfferLocation from "@/components/admin/offers/offer/OfferLocation";
import DevelopmentPresenceSection from "@/components/admin/offers/offer/DevelopmentPresenceSection";
import AgentCard from "@/components/admin/offers/offer/AgentCard";
import AgentSignature from "@/components/admin/offers/offer/AgentSignature";
import DevelopmentLogo from "@/components/admin/offers/offer/DevelopmentLogo";
import PreReservationActiveView from "@/components/admin/offers/offer/PreReservationActiveView";
import CustomerAccountView from "@/components/admin/offers/offer/CustomerAccountView";
import sozuLogo from "@/assets/sozu-logo.png";
import { MapPin, Calendar, Sparkles, ChevronRight, AlertCircle } from "lucide-react";

const OfferLandingPage = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const offer = useOfferById(offerId ?? "");
  const agent = useAgentById(offer?.agentId ?? "");
  const navigate = useNavigate();
  const [gateModalOpen, setGateModalOpen] = useState(false);
  // 18.11.E: state de recomendación eliminado junto con la calculadora
  const galleryRef = useRef<HTMLDivElement>(null);


  const preReservation = useOfferStore((s) =>
    s.preReservations.find(
      (pr) => pr.offerId === offerId && (pr.status === "active" || pr.status === "applied")
    )
  );
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.preReservationId === preReservation?.id)
  );


  if (!offer) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Oferta no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Esta oferta puede haber expirado o el link es incorrecto. Contacta a tu asesor para
            una nueva.
          </p>
        </div>
      </PublicShell>
    );
  }

  // ── Router de estado: una URL, tres layouts ──
  if (formalReservation?.status === "completed" && preReservation) {
    return (
      <CustomerAccountView
        offer={offer}
        preReservation={preReservation}
        formalReservation={formalReservation}
      />
    );
  }

  if (preReservation && preReservation.status === "active") {
    return <PreReservationActiveView offer={offer} preReservation={preReservation} />;
  }




  const daysToExpiry = Math.ceil(
    (new Date(offer.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = offer.status === "expired" || daysToExpiry < 0;
  const isReserved =
    offer.status === "pre_reserved" || offer.status === "converted_to_account";
  const ctaDisabled = isExpired || isReserved;

  // 18.11.D: tres niveles de urgencia para el badge de vigencia
  const urgencyLevel: "normal" | "soon" | "imminent" =
    daysToExpiry < 1 ? "imminent" : daysToExpiry <= 3 ? "soon" : "normal";
  const urgencyClass =
    urgencyLevel === "imminent"
      ? "bg-destructive/15 text-destructive border border-destructive/40 font-bold animate-pulse"
      : urgencyLevel === "soon"
      ? "bg-warning/20 text-warning-foreground border border-warning/40 font-bold"
      : "bg-warning/10 text-warning-foreground border border-warning/30";
  const expiryLabel =
    daysToExpiry < 1
      ? "Vence hoy"
      : daysToExpiry === 1
      ? "Vence mañana"
      : `Vence en ${daysToExpiry} días`;

  const stickyTitle = isReserved
    ? "Unidad ya pre-apartada"
    : isExpired
    ? "Oferta vencida"
    : "Apartar con $5,000 reembolsables";

  const expeditionLabel = new Date(offer.generatedAt)
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "");

  return (
    <PublicShell agent={agent}>
      {/* 18.11.E: Mini-header sticky simplificado — solo logo del desarrollo */}
      <OfferStickyMiniHeader offer={offer} triggerRef={galleryRef} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-32 space-y-6">
        {/* 18.11.D: Header unificado de la oferta */}
        <header>
          {/* Breadcrumb sutil */}
          <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            <span className="truncate">{offer.property.projectName}</span>
            <span aria-hidden>›</span>
            <span className="truncate">{offer.property.unitNumber}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{offer.property.unitModel}</span>
          </div>

          {/* Título prominente */}
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            {formatPropertyTitle(offer.property)}
          </h1>

          {/* Dirección con pin */}
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{offer.location.address}</span>
          </p>

          {/* Strip discreto con número de oferta + vigencia */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Oferta {offer.id}</span>
            <span aria-hidden>·</span>
            <span>Expedida {expeditionLabel}</span>
            {!isExpired && daysToExpiry >= 0 && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${urgencyClass}`}
                >
                  {urgencyLevel === "imminent" ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Calendar className="w-3 h-3" />
                  )}
                  {expiryLabel}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Galería */}
        <div ref={galleryRef}>
          <OfferGallery
            images={offer.gallery}
            captions={offer.galleryCaptions}
            videoUrl={offer.videoUrl}
            development={offer.development}
            developmentName={offer.property.projectName}
            tour360Id={offer.tour360 ? "recorrido-360" : undefined}
          />
        </div>

        {/* 18.11.E: PorQueDesarrolloSection eliminada por retro comercial */}

        {/* AgentCard prominente — patrón "digital yard sign" */}
        {agent && (
          <AgentCard
            agent={agent}
            offerId={offer.id}
            offerLabel={formatPropertyTitle(offer.property)}
          />
        )}

        {/* Datos de la propiedad (18.11.E: incluye fila de estacionamiento) */}
        <OfferPropertyDetails
          property={offer.property}
          parkingSlots={offer.parkingSlots}
          materialsPaletteUrl={offer.materialsPaletteUrl}
        />


        {offer.floorPlanUrl && (
          <OfferFloorPlanLarge
            imageUrl={offer.floorPlanUrl}
            unitArea={offer.property.area}
            bedrooms={offer.property.bedrooms}
            bathrooms={offer.property.bathrooms}
            view={offer.property.view}
            floor={offer.property.level}
          />
        )}

        {/* 18.11.E: EstacionamientoSection eliminada — info movida a OfferPropertyDetails */}

        {/* 18.11.A: Recorrido 360° */}
        {offer.tour360 && (
          <Tour360Section
            tour={offer.tour360}
            developmentName={offer.property.projectName}
            propertyLabel={`${offer.property.unitModel} ${offer.property.unitNumber}`}
          />
        )}

        {/* 18.11.E: CalculadoraCapacidadPagoSection eliminada por retro comercial */}

        {/* Comparador de esquemas */}
        <OfferPaymentPlansComparator
          offerId={offer.id}
          plans={offer.paymentPlans}
          listPrice={offer.property.listPrice}
        />

        {/* 18.11.C: Comparador lado a lado — después de esquemas */}
        {offer.paymentPlans && offer.paymentPlans.length > 0 && (
          <PaymentPlansComparatorSection plans={offer.paymentPlans} />
        )}

        {/* 18.11.E: AnalisisInversionSection eliminada por retro comercial (riesgo legal) */}


        {/* Highlights */}
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Esto la hace especial</h3>
          </div>
          <ul className="space-y-2.5">
            {offer.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <OfferConstructionProgress
          progress={offer.constructionProgress}
          milestones={offer.constructionMilestones}
          estimatedDelivery={offer.estimatedDelivery}
          lastUpdated={offer.constructionLastUpdated}
          videoUrl={offer.constructionVideoUrl}
          videoTitle={offer.constructionVideoTitle}
          photos={offer.constructionPhotos}
          description={offer.constructionDescription}
        />

        {/* 18.11.A: amenidades con renders; fallback a lista plana legacy */}
        {offer.amenitiesEnriched && offer.amenitiesEnriched.length > 0 ? (
          <AmenitiesGridSection amenities={offer.amenitiesEnriched} />
        ) : (
          <OfferAmenities amenities={offer.amenities} />
        )}

        {/* 18.11.E: ValidacionSocialSection eliminada por retro comercial (sin testimonios reales) */}

        <OfferLocation location={offer.location} />

        {offer.development && (
          <DevelopmentPresenceSection
            development={offer.development}
            developmentName={offer.property.projectName}
            agent={agent}
          />
        )}

        {/* 18.11.E: OtrasUnidadesSection y DescargasSection eliminadas por retro comercial */}


        {/* AgentSignature al final */}
        {agent && <AgentSignature agent={agent} />}

        {/* Co-branding final */}
        {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
          <div className="rounded-2xl border border-border bg-muted/40 p-6 md:p-8 text-center space-y-5">
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-muted-foreground">
              Una oferta de
            </p>

            <div className="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-8">
              <div className="flex flex-col items-center gap-2">
                <DevelopmentLogo
                  development={offer.development}
                  developmentName={offer.property.projectName}
                  variant="footer"
                />
                <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                  {offer.development.legalName ?? offer.property.projectName}
                </span>
              </div>

              <div className="hidden md:block w-px h-10 bg-border" />
              <div className="md:hidden h-px w-10 bg-border" />

              <div className="flex flex-col items-center gap-2">
                <img
                  src={sozuLogo}
                  alt="SOZU"
                  className="h-7 md:h-8 w-auto object-contain dark:invert"
                />
                <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                  Comercializador
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              SOZU es el comercializador autorizado de {offer.property.projectName}. Para información
              oficial del desarrollo, visita{" "}
              {offer.development.website
                ? offer.development.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
                : "el sitio del desarrollador"}.
            </p>
          </div>
        )}

        {/* Footer informativo de la oferta */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Oferta {offer.id} · Expedida el{" "}
            {new Date(offer.generatedAt).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Vigencia:{" "}
            {new Date(offer.validUntil).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Sticky CTA — dual: pre-apartar (secundario) + apartar formal (primario) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          {/* Identificación — desktop a la izquierda; mobile compacta arriba */}
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {ctaDisabled ? stickyTitle : "Apartar esta unidad"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {formatPropertyTitle(offer.property)}
            </p>
          </div>
          <p className="md:hidden text-[11px] text-muted-foreground text-center truncate">
            {formatPropertyTitle(offer.property)}
          </p>

          {/* CTA único */}
          <div className="flex md:flex-shrink-0">
            <button
              onClick={ctaDisabled ? undefined : () => setGateModalOpen(true)}
              disabled={ctaDisabled}
              className={`w-full md:w-auto h-11 px-4 md:px-6 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                ctaDisabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 cta-shimmer"
              }`}
            >
              {isExpired ? (
                "Oferta vencida"
              ) : isReserved ? (
                "No disponible"
              ) : (
                <>
                  Apartar esta unidad
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <FormalReservationGateModal
        open={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        offer={offer}
        onStartFormal={() => navigate(`/apartar/${offer.id}/datos`)}
      />
    </PublicShell>
  );
};

export default OfferLandingPage;
