import sozuLogo from "@/assets/sozu-logo.png";
import AmenitiesGridSection from "@/components/offer/AmenitiesGridSection";
import PaymentPlansComparatorSection from "@/components/offer/PaymentPlansComparatorSection";
import Tour360Section from "@/components/offer/Tour360Section";
import AgentCard from "@/components/offer/AgentCard";
import CustomerAccountView from "@/components/offer/CustomerAccountView";
import DevelopmentLogo from "@/components/offer/DevelopmentLogo";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentById } from "@/lib/offers/agent-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import {
  formatPropertyTitle,
  useInjectOffer,
  useOfferById,
  useOfferStore,
} from "@/lib/offers/offer-data";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { AlertCircle, Building2, Calendar, ChevronRight, ExternalLink, Facebook, Globe, Home, Instagram, Landmark, Loader2, MapPin, ScanEye, Sparkles, UserRound, Youtube } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type TabId = "unidad" | "esquemas" | "desarrollo" | "asesor";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "unidad",     label: "La Unidad",        icon: Home },
  { id: "esquemas",   label: "Esquemas de Pago", icon: Landmark },
  { id: "desarrollo", label: "El Desarrollo",    icon: Sparkles },
  { id: "asesor",     label: "Tu Asesor",        icon: UserRound },
];

type DevelopmentSocials = { instagram?: string; facebook?: string; youtube?: string };

function socialHref(base: string, value: string): string {
  return value.startsWith("http") ? value : `${base}${value}`;
}

function instagramDisplay(value: string): string {
  if (!value.startsWith("http")) return `@${value}`;
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    return parts.length > 0 ? `@${parts[0]}` : value;
  } catch {
    return value;
  }
}

function DevelopmentSocialLinks({ socials, variant = "desktop" }: {
  socials?: DevelopmentSocials | null;
  variant?: "mobile" | "desktop";
}) {
  if (!socials) return null;
  const { instagram, facebook, youtube } = socials;
  if (!instagram && !facebook && !youtube) return null;

  const linkBase =
    variant === "mobile"
      ? "flex-1 min-w-[120px] h-10 inline-flex items-center justify-center gap-2 px-3 rounded-md bg-card border border-border text-xs font-semibold transition-colors"
      : "inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border text-xs font-semibold transition-colors";

  return (
    <div className={`flex flex-wrap gap-2${variant === "desktop" ? " mt-4 justify-center" : ""}`}>
      {instagram && (
        <a href={socialHref("https://www.instagram.com/", instagram)} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30`}>
          <Instagram className="w-4 h-4" />{instagramDisplay(instagram)}
        </a>
      )}
      {facebook && (
        <a href={socialHref("https://www.facebook.com/", facebook)} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30`}>
          <Facebook className="w-4 h-4" />Facebook
        </a>
      )}
      {youtube && (
        <a href={socialHref("https://www.youtube.com/", youtube)} target="_blank" rel="noopener noreferrer"
           className={`${linkBase} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`}>
          <Youtube className="w-4 h-4" />YouTube
        </a>
      )}
    </div>
  );
}

const OfferPage = () => {
  const { offerId, reservationId } = useParams<{ offerId: string; reservationId?: string }>();
  const { data: offerResult, isLoading: dbLoading } = useOfferFromDB(offerId ?? "");
  const dbOffer = offerResult?.offer ?? null;
  const dbAgent = offerResult?.agent ?? null;
  const mockOffer = useOfferById(offerId ?? "");
  const offer = dbOffer ?? (import.meta.env.DEV ? mockOffer : null);
  const injectOffer = useInjectOffer();

  useEffect(() => {
    if (dbOffer) injectOffer(dbOffer);
  }, [dbOffer, injectOffer]);

  const mockAgent = useAgentById(offer?.agentId ?? "");
  const agent = dbAgent ?? mockAgent;
  const navigate = useNavigate();
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("unidad");

  const preReservation = useOfferStore((s) =>
    s.preReservations.find(
      (pr) => pr.offerId === offerId && (pr.status === "active" || pr.status === "applied")
    )
  );
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.preReservationId === preReservation?.id)
  );

  // Scroll al tope al cambiar de pestaña (evita quedar a media página).
  const changeTab = (id: TabId) => {
    setActiveTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleTabs = useMemo(() => {
    if (!offer) return [] as typeof TABS;
    return TABS.filter(({ id }) => {
      if (import.meta.env.DEV) return true;
      if (id === "asesor") return !!agent;
      return true;
    });
  }, [offer, agent]);

  const handleCtaClick = () => {
    if (reservationId) {
      navigate(`/reservar/${reservationId}`);
    } else {
      setGateModalOpen(true);
    }
  };

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
  // Apartado deshabilitado hasta integrar Stripe: se oculta el botón "Apartar".
  // Cambiar a true cuando el flujo de pago/hold esté en producción.
  const APARTADO_HABILITADO = false;

  // Precisión completa (hasta 2 decimales): sin redondear/cortar para que
  // precio, metraje y $/m² reconcilien exacto entre sí.
  const formattedPrice = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(offer.property.listPrice);

  const ctaLabel = isExpired ? "Oferta vencida" : isReserved ? "No disponible" : "Apartar esta unidad";

  const hasPaymentPlans = !!(offer.paymentPlans && offer.paymentPlans.length > 0);

  return (
    <PublicShell agent={agent} noFooter>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="lg:grid lg:grid-cols-[1fr_324px] lg:gap-8 lg:items-start">

          {/* ── MAIN CONTENT ── */}
          <div className="min-w-0">

            {/* Header / identidad (solo mobile; en desktop la identidad vive en el card derecho) */}
            <header className="mb-4 md:mb-0 empty:hidden">
              {/* ── MOBILE: compacto - logo pequeño + modelo + dirección + precio ── */}
              <div className="md:hidden flex flex-col items-center text-center">
                {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
                  <div className="h-8 flex items-center justify-center mb-3">
                    <DevelopmentLogo
                      development={offer.development}
                      developmentName={offer.property.projectName}
                      variant="section"
                      className="!h-full"
                    />
                  </div>
                )}
                <h1 className="font-serif text-2xl font-semibold tracking-[0.02em] leading-[1.1] text-foreground mb-2">
                  {offer.property.unitModel} {offer.property.unitNumber}
                </h1>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2.5">
                  <MapPin className="w-3 h-3 shrink-0 opacity-60" />
                  {offer.location.address}
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground leading-none tracking-tight">
                  {formattedPrice}
                </p>
                {!!offer.property.pricePerM2 && offer.property.area && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1 tabular-nums">
                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(offer.property.pricePerM2)} /m²
                  </p>
                )}
              </div>

            </header>

            {/* Expired banner - slim, solo mobile (en desktop lo comunica el card derecho) */}
            {isExpired && (
              <div className="lg:hidden rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2 flex items-center gap-2 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <p className="text-[12px] text-destructive leading-snug">
                  <span className="font-semibold">Esta oferta ya venció.</span>{" "}
                  <span className="text-muted-foreground">Contacta a tu asesor para una actualizada.</span>
                </p>
              </div>
            )}

            {/* ── TABS ── */}
            <Tabs value={activeTab} onValueChange={(v) => changeTab(v as TabId)}>
              {/* Tab bar sticky - mismo lenguaje visual que el menú de Inmuebles (portal cobranza) */}
              <div className="sticky top-14 z-30 -mx-4 md:-mx-6 px-4 md:px-6 bg-background/90 backdrop-blur-xl">
                <TabsList className="flex w-full h-auto justify-start gap-0 bg-transparent p-0 rounded-none border-b border-border">
                  {visibleTabs.map((t) => {
                    const Icon = t.icon;
                    return (
                      <TabsTrigger
                        key={t.id}
                        value={t.id}
                        className="flex-1 min-w-0 flex items-center justify-center md:justify-start gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-2 md:px-4 py-2.5 text-[13px] font-medium text-muted-foreground shadow-none transition-colors duration-100 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-primary/5 data-[state=active]:shadow-none hover:text-foreground hover:bg-muted/50"
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{t.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* ── TAB: LA UNIDAD ── */}
              <TabsContent value="unidad" className="mt-6 space-y-5 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300">
                {/* Galería */}
                <OfferGallery
                  images={offer.gallery}
                  captions={offer.galleryCaptions}
                  videoUrl={offer.videoUrl}
                />

                {/* Detalles */}
                <OfferPropertyDetails
                  property={offer.property}
                  bodegas={offer.bodegas}
                  estacionamientos={offer.estacionamientos}
                  clabeStp={offer.clabeStp}
                />

                {/* Recorre tu unidad (Tour 360) - antes del plano */}
                {offer.tour360 ? (
                  <div id="tour-360">
                    <Tour360Section
                      tour={offer.tour360}
                      developmentName={offer.property.projectName}
                      propertyLabel={`${offer.property.unitModel} ${offer.property.unitNumber}`}
                    />
                  </div>
                ) : import.meta.env.DEV ? (
                  <div id="tour-360" className="rounded-md border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/20">
                      <ScanEye className="w-3.5 h-3.5 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">Recorre tu unidad</h3>
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
                ) : null}

                {/* Plano */}
                {offer.floorPlanUrl || offer.planoUbicacionUrl ? (
                  <OfferFloorPlanLarge
                    imageUrl={offer.floorPlanUrl}
                    unitArea={offer.property.area}
                    bedrooms={offer.property.bedrooms}
                    bathrooms={offer.property.bathrooms}
                    view={offer.property.view}
                    floor={offer.property.level}
                    planoUbicacionUrl={offer.planoUbicacionUrl}
                    planoUbicacionRegiones={offer.planoUbicacionRegiones}
                    highlightUnit={offer.unitDepto}
                    fullPropertyNumber={offer.property.unitNumber}
                  />
                ) : import.meta.env.DEV ? (
                  <div className="rounded-md border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/20">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">Plano arquitectónico</h3>
                    </div>
                    <div className="p-5">
                      <div className="aspect-[4/3] rounded-md bg-gradient-to-br from-muted/50 to-muted/20 flex flex-col items-center justify-center gap-3 border border-border/30">
                        <svg className="w-16 h-16 text-muted-foreground/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0020.25 14.25V3M3.75 3h16.5M3.75 3H2.25m1.5 0h.375m15.75 0H21m-1.5 0h-.375M9 7.5h6M9 10.5h6M9 13.5h3" />
                        </svg>
                        <p className="text-xs text-muted-foreground/50 text-center px-8">
                          El plano será cargado por el equipo del proyecto.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

              </TabsContent>

              {/* ── TAB: ESQUEMAS DE PAGO ── */}
              <TabsContent value="esquemas" className="mt-6 space-y-5 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300">
                <OfferPaymentPlansComparator
                  offerId={offer.id}
                  plans={offer.paymentPlans}
                  listPrice={offer.property.listPrice}
                />
                {hasPaymentPlans && (
                  <PaymentPlansComparatorSection plans={offer.paymentPlans} />
                )}
              </TabsContent>

              {/* ── TAB: EL DESARROLLO ── */}
              <TabsContent value="desarrollo" className="mt-6 space-y-5 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300">
                {/* Amenidades */}
                {offer.amenitiesEnriched && offer.amenitiesEnriched.length > 0 ? (
                  <AmenitiesGridSection amenities={offer.amenitiesEnriched} />
                ) : (
                  <OfferAmenities amenities={offer.amenities} />
                )}

                {/* Avance de obra */}
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

                {/* Ubicación + Showroom */}
                <OfferLocation location={offer.location} showroom={offer.development?.showroom} />

                {/* Sitio web + redes (mobile) */}
                {offer.development && (
                  <div className="lg:hidden space-y-3">
                    {offer.development.website && (
                      <a
                        href={offer.development.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3.5 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors group"
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
              </TabsContent>

              {/* ── TAB: TU ASESOR ── */}
              <TabsContent value="asesor" className="mt-6 space-y-5 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300">
                {agent ? (
                  <AgentCard agent={agent} offerId={offer.id} offerLabel={formatPropertyTitle(offer.property)} />
                ) : import.meta.env.DEV ? (
                  <div className="rounded-md border border-border bg-card overflow-hidden">
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
                          Tu asesor estará disponible en esta oferta próximamente.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>

          </div>{/* /main content */}

          {/* ── RIGHT ASIDE ── */}
          <aside className="hidden lg:block sticky top-20 self-start">
            <div className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="p-5 space-y-0">

                {/* Identidad: logo + modelo + dirección (siempre visible, sticky) */}
                <div className="pb-4 border-b border-border/60">
                  {offer.development && (offer.development.logoUrl || offer.development.logoUrlInverse) && (
                    <div className="h-9 flex items-center justify-center mb-3">
                      <DevelopmentLogo
                        development={offer.development}
                        developmentName={offer.property.projectName}
                        variant="section"
                        className="!h-full"
                      />
                    </div>
                  )}
                  <p className="font-serif text-[19px] font-semibold tracking-[0.03em] text-foreground leading-snug text-center">
                    {offer.property.unitModel} {offer.property.unitNumber}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug text-center line-clamp-2">
                    {offer.location.address}
                  </p>

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

                {/* Precio - centrado */}
                <div className="py-4 border-b border-border/60 text-center">
                  <p className="text-[9px] uppercase tracking-[0.24em] font-bold text-muted-foreground/55 mb-1.5">
                    Precio de lista
                  </p>
                  <p className="text-[1.75rem] font-bold tabular-nums text-foreground leading-none tracking-tight">
                    {formattedPrice}
                  </p>
                  {!!offer.property.pricePerM2 && offer.property.area && (
                    <p className="text-[11px] font-semibold text-success mt-1.5 tabular-nums">
                      {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(offer.property.pricePerM2)} /m²
                    </p>
                  )}
                </div>

                {/* Datos clave - Entrega | Expedición (fechas completas, centradas) */}
                <div className="grid grid-cols-2 gap-4 py-4 border-b border-border/60">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calendar className="w-3 h-3 shrink-0 text-primary/60" />
                      <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/60">Entrega</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {offer.estimatedDelivery
                        ? new Date(offer.estimatedDelivery).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "Por definir"}
                    </p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Calendar className="w-3 h-3 shrink-0 text-primary/60" />
                      <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/60">Expedición</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {new Date(offer.generatedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* CTA - ocultar en links con reservationId (flujo digital, Stripe pendiente) */}
                {!reservationId && (
                  <div className="pt-4">
                    {isExpired ? (
                      <div className="rounded-md bg-destructive/8 border border-destructive/20 px-3 py-3 text-center space-y-1.5">
                        <p className="text-xs font-semibold text-destructive">Oferta vencida</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Contacta a tu asesor para recibir una oferta actualizada.
                        </p>
                      </div>
                    ) : APARTADO_HABILITADO ? (
                      <>
                        <button
                          onClick={ctaDisabled ? undefined : handleCtaClick}
                          disabled={ctaDisabled}
                          className={`w-full h-11 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                            ctaDisabled
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-transform"
                          }`}
                        >
                          {ctaLabel}
                          {!ctaDisabled && !isReserved && <ChevronRight className="w-4 h-4" />}
                        </button>
                        {!ctaDisabled && (
                          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                            Apartado reembolsable · Sin compromiso
                          </p>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
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

      {/* ── FOOTER UNIFICADO - sello empresarial (fondo oscuro, siempre visible) ── */}
      <footer className={`mt-8 bg-zinc-900 text-zinc-400 ${!reservationId && APARTADO_HABILITADO ? "mb-20 lg:mb-0" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {/* Presentado por */}
          <div className="flex flex-col items-center text-center">
            <p className="text-[8px] uppercase tracking-[0.32em] font-semibold text-zinc-500 mb-4">
              Una oferta presentada por
            </p>
            <div className="flex items-center justify-center gap-6 md:gap-10">
              {offer.development?.developerName && (
                <>
                  {/* Desarrolladora (constructora del proyecto) - clic → sitio oficial */}
                  <a
                    href={offer.development.developerWebsite ?? undefined}
                    target={offer.development.developerWebsite ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center gap-2 ${offer.development.developerWebsite ? "hover:opacity-80 transition-opacity" : "pointer-events-none"}`}
                  >
                    <div className="h-6 md:h-7 flex items-center justify-center">
                      {offer.development.developerLogoUrl ? (
                        <img
                          src={offer.development.developerLogoUrl}
                          alt={offer.development.developerName}
                          className="h-5 md:h-6 w-auto object-contain brightness-0 invert"
                        />
                      ) : (
                        <span className="text-base md:text-lg font-bold text-white tracking-tight">
                          {offer.development.developerName}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide">
                      Desarrolla · {offer.development.developerName}
                    </span>
                  </a>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-4 bg-zinc-700" />
                    <span className="text-[8px] font-semibold text-zinc-600 uppercase tracking-[0.2em]">con</span>
                    <div className="w-px h-4 bg-zinc-700" />
                  </div>
                </>
              )}
              {/* Comercializador SOZU - clic → sozu.com */}
              <a
                href="https://www.sozu.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="h-6 md:h-7 flex items-center justify-center">
                  <img src={sozuLogo} alt="SOZU" className="h-5 md:h-6 w-auto object-contain brightness-0 invert" />
                </div>
                <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide">
                  Comercializa · SOZU
                </span>
              </a>
            </div>
          </div>

          {/* Línea legal */}
          <div className="mt-5 pt-4 border-t border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-center md:text-left">
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              SOZU © 2026 · Comercializador autorizado{offer.development ? ` de ${offer.development.legalName ?? offer.property.projectName}` : ""}. Oferta personal e intransferible.
            </p>
            <p className="text-[9px] text-zinc-500 leading-relaxed">
              Oferta informativa · No constituye contrato de compraventa · Sujeta a disponibilidad · Precios en MXN
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA - solo con apartado habilitado (el aviso de vencida ya sale arriba) */}
      {!reservationId && APARTADO_HABILITADO && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border">
          <div className="px-4 py-3">
            <button
              onClick={ctaDisabled ? undefined : handleCtaClick}
              disabled={ctaDisabled}
              className={`w-full h-11 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                ctaDisabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {ctaLabel}
              {!ctaDisabled && !isReserved && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {!reservationId && (
        <FormalReservationGateModal
          open={gateModalOpen}
          onClose={() => setGateModalOpen(false)}
          offer={offer}
          onStartFormal={() => navigate(`/reservar/${offer.id}/datos`)}
        />
      )}
    </PublicShell>
  );
};

export default OfferPage;
