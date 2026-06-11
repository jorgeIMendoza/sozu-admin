import sozuLogo from "@/assets/sozu-logo.png";
import AmenitiesGridSection from "@/components/offer/AmenitiesGridSection";
import LifestyleCountryClubSection from "@/components/offer/LifestyleCountryClubSection";
import PaymentPlansComparatorSection from "@/components/offer/PaymentPlansComparatorSection";
import Tour360Section from "@/components/offer/Tour360Section";
import AgentCard from "@/components/offer/AgentCard";
import CustomerAccountView from "@/components/offer/CustomerAccountView";
import DevelopmentLogo from "@/components/offer/DevelopmentLogo";
import DevelopmentPresenceSection from "@/components/offer/DevelopmentPresenceSection";
import FormalReservationGateModal from "@/components/offer/FormalReservationGateModal";
import OfferAmenities from "@/components/offer/OfferAmenities";
import OfferConstructionProgress from "@/components/offer/OfferConstructionProgress";
import OfferFloorPlanLarge from "@/components/offer/OfferFloorPlanLarge";
import OfferGallery from "@/components/offer/OfferGallery";
import OfferLocation from "@/components/offer/OfferLocation";
import OfferPaymentPlansComparator from "@/components/offer/OfferPaymentPlansComparator";
import OfferPropertyDetails from "@/components/offer/OfferPropertyDetails";
import PreReservationActiveView from "@/components/offer/PreReservationActiveView";
import PublicShell from "@/components/offer/PublicShell";
import { useAgentById } from "@/lib/offers/agent-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import {
  formatPropertyTitle,
  useInjectOffer,
  useOfferById,
  useOfferStore,
} from "@/lib/offers/offer-data";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { AlertCircle, Calendar, ChevronRight, ExternalLink, Facebook, Globe, Instagram, Loader2, MapPin, Sparkles, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const NAV_SECTIONS = [
  { id: "gallery",       label: "Galería" },
  { id: "agent",         label: "Asesor" },
  { id: "details",       label: "La unidad" },
  { id: "floor-plan",    label: "Plano" },
  { id: "tour-360",      label: "Tour 360°" },
  { id: "payment-plans", label: "Esquemas" },
  { id: "highlights",    label: "Destacados" },
  { id: "construction",  label: "Avance obra" },
  { id: "amenities",     label: "Amenidades" },
  { id: "location",      label: "Ubicación" },
  { id: "development",   label: "Showroom" },
] as const;

const SCROLL_OFFSET = 80;

type DevelopmentSocials = { instagram?: string; facebook?: string; youtube?: string };

function DevelopmentSocialLinks({ socials, variant = "desktop" }: {
  socials?: DevelopmentSocials | null;
  variant?: "mobile" | "desktop";
}) {
  if (!socials) return null;
  const { instagram, facebook, youtube } = socials;
  if (!instagram && !facebook && !youtube) return null;

  const linkBase =
    variant === "mobile"
      ? "flex-1 min-w-[120px] h-10 inline-flex items-center justify-center gap-2 px-3 rounded-xl bg-card border border-border text-xs font-semibold transition-colors"
      : "inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border text-xs font-semibold transition-colors";

  return (
    <div className={`flex flex-wrap gap-2${variant === "desktop" ? " mt-4 justify-center" : ""}`}>
      {instagram && (
        <a href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30`}>
          <Instagram className="w-4 h-4" />@{instagram}
        </a>
      )}
      {facebook && (
        <a href={`https://www.facebook.com/${facebook}`} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30`}>
          <Facebook className="w-4 h-4" />Facebook
        </a>
      )}
      {youtube && (
        <a href={`https://www.youtube.com/${youtube}`} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`}>
          <Youtube className="w-4 h-4" />YouTube
        </a>
      )}
    </div>
  );
}

const OfferPage = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const { data: offerResult, isLoading: dbLoading } = useOfferFromDB(offerId ?? "");
  const dbOffer = offerResult?.offer ?? null;
  const dbAgent = offerResult?.agent ?? null;
  const mockOffer = useOfferById(offerId ?? "");
  const offer = dbOffer ?? mockOffer;
  const injectOffer = useInjectOffer();

  useEffect(() => {
    if (dbOffer) injectOffer(dbOffer);
  }, [dbOffer, injectOffer]);

  const mockAgent = useAgentById(offer?.agentId ?? "");
  const agent = dbAgent ?? mockAgent;
  const navigate = useNavigate();
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("gallery");
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set());
  const galleryRef = useRef<HTMLDivElement>(null);

  const preReservation = useOfferStore((s) =>
    s.preReservations.find(
      (pr) => pr.offerId === offerId && (pr.status === "active" || pr.status === "applied")
    )
  );
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.preReservationId === preReservation?.id)
  );

  useEffect(() => {
    if (!offer) return;
    const observers: IntersectionObserver[] = [];

    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
            setRevealedSections((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          }
        },
        { rootMargin: `-${SCROLL_OFFSET}px 0px -45% 0px`, threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [offer]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSection(id);
  };

  const sectionClass = (id: string) =>
    `scroll-mt-20 transition-[opacity,transform] duration-500 ease-out ${
      revealedSections.has(id) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }`;

  if (dbLoading) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando oferta…</p>
        </div>
      </PublicShell>
    );
  }

  if (!offer) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Oferta no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Esta oferta puede haber expirado o el link es incorrecto. Contacta a tu asesor para una nueva.
          </p>
        </div>
      </PublicShell>
    );
  }

  if (formalReservation?.status === "completed" && preReservation) {
    return (
      <CustomerAccountView offer={offer} preReservation={preReservation} formalReservation={formalReservation} />
    );
  }

  if (preReservation && preReservation.status === "active") {
    return <PreReservationActiveView offer={offer} preReservation={preReservation} />;
  }

  const daysToExpiry = Math.ceil(
    (new Date(offer.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = offer.status === "expired" || daysToExpiry < 0;
  const isReserved = offer.status === "pre_reserved" || offer.status === "converted_to_account";
  const ctaDisabled = isExpired || isReserved;

  const urgencyLevel: "normal" | "soon" | "imminent" =
    daysToExpiry < 1 ? "imminent" : daysToExpiry <= 3 ? "soon" : "normal";
  const urgencyClass =
    urgencyLevel === "imminent"
      ? "bg-destructive/15 text-destructive border border-destructive/40 font-bold animate-pulse"
      : urgencyLevel === "soon"
      ? "bg-warning/20 text-warning-foreground border border-warning/40 font-bold"
      : "bg-warning/10 text-warning-foreground border border-warning/30";
  const expiryLabel =
    daysToExpiry < 1 ? "Vence hoy" : daysToExpiry === 1 ? "Vence mañana" : `Vence en ${daysToExpiry} días`;

  const expeditionLabel = new Date(offer.generatedAt)
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "");

  const formattedPrice = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(offer.property.listPrice);

  const ctaLabel = isExpired ? "Oferta vencida" : isReserved ? "No disponible" : "Apartar esta unidad";

  return (
    <PublicShell
      agent={agent}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
      navSections={NAV_SECTIONS as unknown as { id: string; label: string }[]}
      onNavClick={scrollToSection}
      activeSectionId={activeSection}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="lg:grid lg:grid-cols-[180px_1fr_268px] lg:gap-8 lg:items-start">

          {/* ── LEFT NAV ── */}
          <aside className="hidden lg:block sticky top-20 self-start">
            <p className="text-[8.5px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40 mb-4 pl-2">
              Contenido
            </p>
            <nav className="space-y-0.5">
              {NAV_SECTIONS.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-left flex items-center py-2 px-2.5 rounded-lg transition-all duration-150 group ${
                      isActive
                        ? "bg-primary/8 text-primary"
                        : "hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`text-[13px] leading-snug transition-colors duration-150 ${
                        isActive
                          ? "font-semibold text-primary"
                          : "text-muted-foreground/70 group-hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Website below nav */}
            {offer.development?.website && (
              <a
                href={offer.development.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted/40 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Sitio web</p>
                  <p className="text-[11px] font-semibold text-foreground truncate">
                    {offer.development.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </a>
            )}
          </aside>

          {/* ── MAIN CONTENT ── */}
          <div className="space-y-5 min-w-0">

            {/* Header */}
            <header>
              {/* ── DESKTOP: logo centrado + modelo pequeño arriba + dirección ── */}
              {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) ? (
                <div className="hidden md:flex flex-col items-center text-center mb-4">
                  <p className="text-[9px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/50 mb-2">
                    {offer.property.unitModel} · {offer.property.unitNumber}
                  </p>
                  <div className="h-24 flex items-center justify-center mb-2">
                    <DevelopmentLogo
                      development={offer.development}
                      developmentName={offer.property.projectName}
                      variant="section"
                      className="!h-full"
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {offer.location.address}
                  </p>
                </div>
              ) : (
                <div className="hidden md:block mb-5">
                  <div className="flex items-center gap-1.5 mb-4 text-[9px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/50 min-w-0">
                    <span className="shrink-0">SOZU</span>
                    <span className="text-muted-foreground/25 shrink-0">/</span>
                    <span className="truncate">{offer.property.projectName}</span>
                    <span className="text-muted-foreground/25 shrink-0">/</span>
                    <span className="shrink-0">{offer.property.unitNumber}</span>
                  </div>
                  <h1 className="text-[2.75rem] font-bold leading-[1.1] tracking-tight text-foreground mb-3">
                    {formatPropertyTitle(offer.property)}
                  </h1>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {offer.location.address}
                  </p>
                </div>
              )}

              {/* ── MOBILE: centrado — logo + modelo + dirección ── */}
              <div className="md:hidden mb-4 flex flex-col items-center text-center">
                {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
                  <div className="h-9 flex items-center justify-center mb-5">
                    <DevelopmentLogo
                      development={offer.development}
                      developmentName={offer.property.projectName}
                      variant="section"
                      className="h-9"
                    />
                  </div>
                )}
                <h1 className="font-serif text-[1.75rem] font-semibold tracking-[0.02em] leading-[1.1] text-foreground mb-5">
                  {offer.property.unitModel} {offer.property.unitNumber}
                </h1>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-4">
                  <MapPin className="w-3 h-3 shrink-0 opacity-60" />
                  {offer.location.address}
                </p>
              </div>

              {/* Separator */}
              <div className="border-t border-border/50 mb-3" />

              {/* Meta bar */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="font-mono text-[10px] text-muted-foreground/40 tracking-[0.1em]">
                  {offer.id}
                </span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                <span className="text-[11px] text-muted-foreground/55">
                  Expedida {expeditionLabel}
                </span>
                {!isExpired && daysToExpiry >= 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${urgencyClass}`}>
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

            {/* GALLERY */}
            <div id="gallery" ref={galleryRef} className={sectionClass("gallery")}>
              <OfferGallery
                images={offer.gallery}
                captions={offer.galleryCaptions}
                videoUrl={offer.videoUrl}
                tour360Id={offer.tour360 ? "tour-360" : undefined}
              />
            </div>

            {/* AGENT */}
            <div id="agent" className={sectionClass("agent")}>
              {agent ? (
                <AgentCard agent={agent} offerId={offer.id} offerLabel={formatPropertyTitle(offer.property)} />
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="bg-muted/30 border-b border-border/50 px-5 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                      Tu asesor comercial
                    </p>
                  </div>
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded-lg w-2/3 animate-pulse" />
                      <div className="h-3 bg-muted rounded-lg w-1/2 animate-pulse" />
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Tu asesor SOZU estará disponible en esta oferta próximamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DETAILS */}
            <div id="details" className={sectionClass("details")}>
              <OfferPropertyDetails
                property={offer.property}
                parkingSlots={offer.parkingSlots}
                materialsPaletteUrl={offer.materialsPaletteUrl}
              />
            </div>

            {/* FLOOR PLAN */}
            <div id="floor-plan" className={sectionClass("floor-plan")}>
              {offer.floorPlanUrl ? (
                <OfferFloorPlanLarge
                  imageUrl={offer.floorPlanUrl}
                  unitArea={offer.property.area}
                  bedrooms={offer.property.bedrooms}
                  bathrooms={offer.property.bathrooms}
                  view={offer.property.view}
                  floor={offer.property.level}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20.25v-15m6 15v-15M3.75 9h16.5M3.75 15h16.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-muted-foreground">Plano arquitectónico</p>
                      <p className="text-[11px] text-muted-foreground/60">Próximamente disponible</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 flex flex-col items-center justify-center gap-3 border border-border/30">
                      <svg className="w-16 h-16 text-muted-foreground/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0020.25 14.25V3M3.75 3h16.5M3.75 3H2.25m1.5 0h.375m15.75 0H21m-1.5 0h-.375M9 7.5h6M9 10.5h6M9 13.5h3" />
                      </svg>
                      <p className="text-xs text-muted-foreground/50 text-center px-8">
                        El plano será cargado por el equipo del proyecto.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TOUR 360 */}
            {offer.tour360 ? (
              <Tour360Section
                tour={offer.tour360}
                developmentName={offer.property.projectName}
                propertyLabel={`${offer.property.unitModel} ${offer.property.unitNumber}`}
              />
            ) : (
              <div id="tour-360" className={`${sectionClass("tour-360")} rounded-2xl border border-dashed border-border bg-muted/20 overflow-hidden`}>
                <div className="px-5 py-4 border-b border-border/40 bg-muted/10 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-muted-foreground">Recorrido virtual 360°</p>
                    <p className="text-[11px] text-muted-foreground/60">Próximamente disponible</p>
                  </div>
                </div>
                <div className="aspect-video bg-gradient-to-br from-muted/40 to-muted/20 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground/50 text-center px-8">
                    El recorrido virtual será agregado en breve por el equipo de {offer.property.projectName}.
                  </p>
                </div>
              </div>
            )}

            {/* PAYMENT PLANS */}
            <div id="payment-plans" className={`${sectionClass("payment-plans")} space-y-5`}>
              <OfferPaymentPlansComparator
                offerId={offer.id}
                plans={offer.paymentPlans}
                listPrice={offer.property.listPrice}
              />
              {offer.paymentPlans && offer.paymentPlans.length > 0 && (
                <PaymentPlansComparatorSection plans={offer.paymentPlans} />
              )}
            </div>

            {/* HIGHLIGHTS */}
            <div id="highlights" className={sectionClass("highlights")}>
              {offer.highlights && offer.highlights.length > 0 ? (
                <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Esto la hace especial</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {offer.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground/40" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Esto la hace especial</h3>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                        <div className={`h-3 rounded-full bg-muted-foreground/15 ${i === 1 ? "w-3/4" : i === 2 ? "w-1/2" : "w-2/3"}`} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-3 leading-relaxed">
                    Las características destacadas serán agregadas próximamente por el asesor.
                  </p>
                </div>
              )}
            </div>

            {/* CONSTRUCTION */}
            <div id="construction" className={sectionClass("construction")}>
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
            </div>

            {/* AMENITIES */}
            <div id="amenities" className={sectionClass("amenities")}>
              {offer.amenitiesEnriched && offer.amenitiesEnriched.length > 0 ? (
                <AmenitiesGridSection amenities={offer.amenitiesEnriched} />
              ) : (
                <OfferAmenities amenities={offer.amenities} />
              )}
            </div>

            {/* LOCATION */}
            <div id="location" className={sectionClass("location")}>
              <OfferLocation location={offer.location} />
            </div>

            <LifestyleCountryClubSection zoneName="Country Club" />

            {/* DEVELOPMENT */}
            <div id="development" className={sectionClass("development")}>
              {offer.development ? (
                <DevelopmentPresenceSection
                  development={offer.development}
                  developmentName={offer.property.projectName}
                  agent={agent}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 mb-2">
                    Información del desarrollo
                  </p>
                  <p className="text-sm font-bold text-foreground/70">{offer.property.projectName}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    Redes sociales, showroom y sitio web disponibles próximamente.
                  </p>
                </div>
              )}
            </div>

            {/* Mobile-only: social links + website (on desktop shown in aside/nav) */}
            {offer.development && (
              <div className="lg:hidden space-y-3">
                {offer.development.website && (
                  <a
                    href={offer.development.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Sitio web oficial</p>
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {offer.development.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </a>
                )}
                <DevelopmentSocialLinks socials={offer.development.socials} variant="mobile" />
              </div>
            )}

            {/* Footer logos */}
            {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
              <div className="rounded-2xl overflow-hidden border border-border/50">
                <div className="bg-gradient-to-br from-muted/40 to-muted/10 px-6 py-6 text-center border-b border-border/40">
                  <p className="text-[8.5px] uppercase tracking-[0.3em] font-semibold text-muted-foreground/50 mb-5">
                    Una oferta presentada por
                  </p>
                  <div className="flex items-center justify-center gap-8 md:gap-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 flex items-center justify-center">
                        <DevelopmentLogo development={offer.development} developmentName={offer.property.projectName} variant="footer" />
                      </div>
                      <span className="text-[10px] font-medium text-foreground/60">
                        {offer.development.legalName ?? offer.property.projectName}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-px h-7 bg-border/60" />
                      <span className="text-[8px] font-semibold text-muted-foreground/35 uppercase tracking-widest">con</span>
                      <div className="w-px h-7 bg-border/60" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 flex items-center justify-center">
                        <img src={sozuLogo} alt="SOZU" className="h-7 w-auto object-contain dark:invert" />
                      </div>
                      <span className="text-[10px] font-medium text-foreground/60">Comercializador</span>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-2.5 bg-muted/5 text-center">
                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                    SOZU es comercializador autorizado de {offer.property.projectName}. Oferta personal e intransferible.
                  </p>
                </div>
              </div>
            )}


          </div>{/* /main content */}

          {/* ── RIGHT ASIDE ── */}
          <aside className="hidden lg:block sticky top-20 self-start">
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">


              <div className="p-5 space-y-0">

                {/* Project logo + unit model */}
                <div className="pb-4 border-b border-border/60">
                  <div className="flex flex-col items-center text-center gap-5 mb-1">
                    {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) ? (
                      <div className="h-4 md:h-6 flex items-center justify-center">
                        <DevelopmentLogo
                          development={offer.development}
                          developmentName={offer.property.projectName}
                          variant="footer"
                          className="h-4 md:h-6"
                        />
                      </div>
                    ) : (
                      <p className="text-[9px] uppercase tracking-[0.24em] font-bold text-primary/70">
                        {offer.property.projectName}
                      </p>
                    )}
                    <p className="font-serif text-[19px] font-semibold tracking-[0.03em] text-foreground leading-snug">
                      {offer.property.unitModel} {offer.property.unitNumber}
                    </p>
                  </div>

                  {/* Quick specs row */}
                  {offer.property.area && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                      {[
                        offer.property.area,
                        `${offer.property.bedrooms} rec`,
                        `${offer.property.bathrooms} baños`,
                      ].map((spec) => (
                        <span
                          key={spec}
                          className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price block */}
                <div className="py-4 border-b border-border/60">
                  <p className="text-[9px] uppercase tracking-[0.24em] font-bold text-muted-foreground/55 mb-1">
                    Precio de lista
                  </p>
                  <p className="text-[1.75rem] font-bold tabular-nums text-foreground leading-none tracking-tight">
                    {formattedPrice}
                  </p>
                  {offer.property.pricePerM2 && offer.property.area && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1 tabular-nums">
                      {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(offer.property.pricePerM2)} /m²
                    </p>
                  )}
                </div>

                {/* Delivery + expiry */}
                <div className="py-3.5 space-y-2 border-b border-border/60">
                  {offer.estimatedDelivery && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                      <span>
                        Entrega{" "}
                        {new Date(offer.estimatedDelivery).toLocaleDateString("es-MX", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {!isExpired && daysToExpiry >= 0 && (
                    <div className={`flex items-center gap-2 text-[11px] ${
                      urgencyLevel === "imminent"
                        ? "text-destructive font-semibold"
                        : urgencyLevel === "soon"
                        ? "text-warning-foreground font-semibold"
                        : "text-muted-foreground"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        urgencyLevel === "imminent"
                          ? "bg-destructive animate-pulse"
                          : urgencyLevel === "soon"
                          ? "bg-warning"
                          : "bg-muted-foreground/30"
                      }`} />
                      {expiryLabel}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="pt-4">
                  <button
                    onClick={ctaDisabled ? undefined : () => setGateModalOpen(true)}
                    disabled={ctaDisabled}
                    className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      ctaDisabled
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-transform"
                    }`}
                  >
                    {ctaLabel}
                    {!ctaDisabled && !isExpired && !isReserved && <ChevronRight className="w-4 h-4" />}
                  </button>
                  {!ctaDisabled && (
                    <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                      Apartado reembolsable · Sin compromiso
                    </p>
                  )}
                </div>
              </div>

              {/* Offer ID */}
              <div className="px-5 py-2 border-t border-border/40 bg-muted/15">
                <p className="font-mono text-[9px] text-muted-foreground/30 tracking-widest text-center">
                  {offer.id}
                </p>
              </div>
            </div>
            {/* Social links below aside card */}
            <DevelopmentSocialLinks socials={offer.development?.socials} />
          </aside>

        </div>{/* /lg:grid */}
      </div>{/* /max-w-7xl */}

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="px-4 py-3">
          <button
            onClick={ctaDisabled ? undefined : () => setGateModalOpen(true)}
            disabled={ctaDisabled}
            className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              ctaDisabled
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {ctaLabel}
            {!ctaDisabled && !isExpired && !isReserved && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <FormalReservationGateModal
        open={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        offer={offer}
        onStartFormal={() => navigate(`/reservar/${offer.id}/datos`)}
      />
    </PublicShell>
  );
};

export default OfferPage;
