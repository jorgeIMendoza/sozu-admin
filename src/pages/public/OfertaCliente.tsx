import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { OfertaComercial, Agent } from "@/lib/offer-types";
import { formatPropertyTitle } from "@/lib/offer-types";
import PublicShell from "@/components/offer/PublicShell";
import OfferGallery from "@/components/offer/OfferGallery";
import OfferPropertyDetails from "@/components/offer/OfferPropertyDetails";
import OfferFloorPlanLarge from "@/components/offer/OfferFloorPlanLarge";
import OfferPaymentPlansComparator from "@/components/offer/OfferPaymentPlansComparator";
import OfferConstructionProgress from "@/components/offer/OfferConstructionProgress";
import OfferAmenities from "@/components/offer/OfferAmenities";
import AgentCard from "@/components/offer/AgentCard";
import AgentSignature from "@/components/offer/AgentSignature";
import DevelopmentPresenceSection from "@/components/offer/DevelopmentPresenceSection";
import FormalReservationGateModal from "@/components/offer/FormalReservationGateModal";
const sozuLogo = "/sozu-logo.png";

// ─── Mock assets locales ─────────────────────────────────────────────────────
import obra1 from "@/assets/obra-daiku-1.jpg";
import obra2 from "@/assets/obra-daiku-2.jpg";
import obra3 from "@/assets/obra-daiku-3.jpg";
import obra4 from "@/assets/obra-daiku-4.jpg";
import planoImg from "@/assets/plano-arquitectonico.png";

// ─── Mock data: Monócolo · NORA I · T-701 ───────────────────────────────────
// TODO: reemplazar con fetch de DB por ofertaId

const MOCK_AGENT: Agent = {
  id: "AGT-RAMON",
  fullName: "Ramón Escobar",
  firstName: "Ramón",
  title: "Agente Inmobiliario Senior · SOZU",
  photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face&q=80",
  phone: "+52 33 1013 7670",
  email: "joseramon.escobar@sozu.com",
  whatsapp: "523310137670",
  brokerage: "SOZU",
  isAllied: false,
  yearsExperience: 7,
  unitsManagedInProject: 12,
  languages: ["Español", "Inglés"],
  responseTimeAvg: "Responde en menos de 30 min",
  specialization: "Preventa Zona Norte Guadalajara",
  bio: "Llevo 7 años acompañando a familias e inversionistas en la decisión más importante de su patrimonio. Mi compromiso: cero presión, máxima claridad.",
};

const LIST_PRICE = 7_622_830.76;

const MOCK_OFFER: OfertaComercial = {
  id: "O-002383",
  agentId: "AGT-RAMON",
  status: "active",
  generatedAt: "2026-05-25T10:00:00Z",
  validUntil: "2026-05-30T23:59:59Z",
  property: {
    projectName: "Monócolo",
    buildingName: "TEMPO",
    unitModel: "NORA I",
    unitNumber: "T-701",
    level: 7,
    view: "Country",
    area: 90.32,
    listPrice: LIST_PRICE,
    pricePerM2: 84_398.04,
    bedrooms: 2,
    bathrooms: 2,
    halfBathrooms: 0,
    parkingSpots: 2,
    parkingType: "Normal",
    hasBalcony: true,
  },
  paymentPlans: [
    {
      id: "F1", name: "F1",
      finalPrice: 7_622_830.76, discountPct: 0, discountAmount: 0,
      downPaymentPct: 20, downPaymentAmount: 1_524_566.15,
      installments: { count: 48, monthlyAmount: 47_642.69 },
      installmentsPct: 30, finalPaymentPct: 50, finalPaymentAmount: 3_811_415.38,
    },
    {
      id: "F2", name: "F2",
      finalPrice: 7_394_145.84, discountPct: 3, discountAmount: 228_684.92,
      downPaymentPct: 25, downPaymentAmount: 1_848_536.46,
      installments: { count: 48, monthlyAmount: 61_617.88 },
      installmentsPct: 40, finalPaymentPct: 35, finalPaymentAmount: 2_587_951.04,
    },
    {
      id: "F3", name: "F3",
      finalPrice: 7_241_689.22, discountPct: 5, discountAmount: 381_141.54,
      downPaymentPct: 30, downPaymentAmount: 2_172_506.77,
      installments: { count: 48, monthlyAmount: 75_434.26 },
      installmentsPct: 50, finalPaymentPct: 20, finalPaymentAmount: 1_448_337.84,
    },
    {
      id: "F4", name: "F4",
      finalPrice: 7_089_232.61, discountPct: 7, discountAmount: 533_598.15,
      downPaymentPct: 40, downPaymentAmount: 2_835_693.04,
      installments: { count: 48, monthlyAmount: 73_846.17 },
      installmentsPct: 50, finalPaymentPct: 10, finalPaymentAmount: 708_923.26,
    },
    {
      id: "F5", name: "F5",
      finalPrice: 6_860_547.68, discountPct: 10, discountAmount: 762_283.08,
      downPaymentPct: 70, downPaymentAmount: 4_802_383.38,
      installmentsPct: 0, finalPaymentPct: 30, finalPaymentAmount: 2_058_164.31,
    },
    {
      id: "F6", name: "F6",
      finalPrice: 6_479_406.15, discountPct: 15, discountAmount: 1_143_424.61,
      downPaymentPct: 90, downPaymentAmount: 5_831_465.53,
      installmentsPct: 0, finalPaymentPct: 10, finalPaymentAmount: 647_940.61,
    },
  ],
  gallery: [
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85",
    "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=1200&q=85",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=85",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=85",
  ],
  floorPlanUrl: planoImg,
  materialsPaletteUrl: "https://images.unsplash.com/photo-1615875605825-5eb9bb5d52ac?w=800&q=80",
  highlights: [
    "Vista Country en piso 7 — sin obstrucciones",
    "Modelo NORA I con acabados premium europeos",
    "Cocina integral con barra desayunador",
    "Walk-in closet en recámara principal",
    "Balcón con vista despejada al campo de golf",
    "Doble cajón de estacionamiento incluido",
  ],
  amenities: [
    "Roof garden con alberca",
    "Gimnasio equipado",
    "Salón de usos múltiples",
    "Coworking y sala de juntas",
    "Cuarto de yoga y meditación",
    "Seguridad y vigilancia 24/7",
    "Lobby con concierge",
    "Área de mascotas",
  ],
  location: {
    address: "Mar Egeo 1594, Country Club, 44610 Guadalajara, Jal.",
    lat: 20.7046191,
    lng: -103.3685474,
    nearby: [
      "Andares · 5 min",
      "Plaza Patria · 7 min",
      "Tec de Monterrey · 10 min",
      "Aeropuerto · 22 min",
    ],
  },
  estimatedDelivery: "2028-06-30T00:00:00",
  constructionProgress: 28,
  constructionLastUpdated: "12 Mayo 2026",
  constructionVideoUrl: "https://www.youtube.com/embed/KQf-8tqXAQ8",
  constructionVideoTitle: "AVANCE DE OBRA · MAYO 2026 · MONÓCOLO",
  constructionDescription:
    "Avance en armado de columnas de niveles superiores. Cimbra y colado de trabes principales en perímetro. Cuadrilla completa trabajando en estructura del cuerpo central.",
  constructionMilestones: [
    { phase: "Cimentación", pct: 5, done: true },
    { phase: "Estructura", pct: 28, done: true },
    { phase: "Albañilería", pct: 60, done: false },
    { phase: "Instalaciones", pct: 80, done: false },
    { phase: "Acabados", pct: 95, done: false },
    { phase: "Entrega", pct: 100, done: false },
  ],
  constructionPhotos: [
    { src: obra1, alt: "Armado de columnas vista panorámica" },
    { src: obra2, alt: "Trabajos en altura sobre columnas" },
    { src: obra3, alt: "Cuadrilla trabajando en columnas" },
    { src: obra4, alt: "Cimbra y trabes en perímetro" },
  ],
  development: {
    website: "https://monocolocountry.mx",
    tagline: "Vive Country como nunca antes",
    logoUrl: "/development-logos/monocolo-black.png",
    logoUrlInverse: "/development-logos/monocolo-white.png",
    legalName: "Monócolo Country Residences",
    socials: {
      instagram: "monocolo.country",
      facebook: "monocolocountry",
      youtube: "@monocolocountry",
    },
    instagramPosts: [
      { id: "p1", imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80", caption: "Última visita guiada del mes. ¡Cupos limitados! 🏙️", likes: 247, permalink: "#" },
      { id: "p2", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", caption: "Nuevo render de la zona de roof garden. Cada detalle pensado.", likes: 189, permalink: "#" },
      { id: "p3", imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80", caption: "Avance de obra mayo 2026. Vamos al 28% ✨", likes: 412, permalink: "#" },
      { id: "p4", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80", caption: "Modelo NORA I — Acabados premium en cada espacio.", likes: 156, permalink: "#" },
      { id: "p5", imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80", caption: "Vista Country desde el piso 7. Mirá lo que ves cada mañana.", likes: 328, permalink: "#" },
      { id: "p6", imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&q=80", caption: "Diseñado para vivir, no solo para habitar.", likes: 203, permalink: "#" },
    ],
    showroom: {
      address: "São Paulo 1912",
      city: "Guadalajara",
      state: "Jal.",
      zipCode: "44630",
      country: "México",
      googleMapsUrl: "https://maps.app.goo.gl/vgBaRDXEFq8VLWyA9",
      googleMapsEmbedUrl: "https://www.google.com/maps?q=Sao+Paulo+1912+Providencia+Guadalajara&output=embed",
      schedule: [
        { daysLabel: "Lunes a viernes", hours: "10:00 - 19:00", note: "Última visita 18:30" },
        { daysLabel: "Sábado", hours: "10:00 - 17:00" },
        { daysLabel: "Domingo", hours: "Previa cita" },
      ],
      notes: "Estacionamiento gratuito disponible · Recepción en lobby",
      bookingCtaLabel: "Agendar visita",
    },
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfertaCliente() {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(MOCK_OFFER.paymentPlans[0].id);

  // TODO: fetch real offer by ofertaId from DB
  const offer = MOCK_OFFER;
  const agent = MOCK_AGENT;

  const isCliente = !!user && profile?.rol_id === 23;

  if (!offer) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Oferta no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Esta oferta puede haber expirado o el enlace es incorrecto. Contacta a tu asesor para obtener uno nuevo.
          </p>
        </div>
      </PublicShell>
    );
  }

  const daysToExpiry = Math.ceil(
    (new Date(offer.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = offer.status === "expired" || daysToExpiry < 0;
  const isReserved = offer.status === "pre_reserved" || offer.status === "converted_to_account";
  const ctaDisabled = isExpired || isReserved;

  const expiryBadgeClass = daysToExpiry <= 2 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  const selectedPlan = offer.paymentPlans.find((p) => p.id === selectedPlanId) ?? offer.paymentPlans[0];

  return (
    <PublicShell agent={agent}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-32 space-y-6">

        {/* ── Offer header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <span>Oferta {offer.id}</span>
              <span aria-hidden>·</span>
              <span>
                Expedida{" "}
                {new Date(offer.generatedAt).toLocaleDateString("es-MX", {
                  day: "numeric", month: "short",
                })}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {formatPropertyTitle(offer.property)}
            </h1>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{offer.location.address}</span>
            </p>
          </div>
          {!isExpired && daysToExpiry >= 0 && (
            <div className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${expiryBadgeClass}`}>
              <Calendar className="w-3.5 h-3.5" />
              {daysToExpiry === 0 ? "Vence hoy" : `Vence en ${daysToExpiry} día${daysToExpiry === 1 ? "" : "s"}`}
            </div>
          )}
        </div>

        {/* ── Gallery ── */}
        <OfferGallery images={offer.gallery} videoUrl={offer.videoUrl} developmentName={offer.property.projectName} />

        {/* ── Agent card (digital yard sign) ── */}
        <AgentCard agent={agent} offerId={offer.id} offerLabel={formatPropertyTitle(offer.property)} />

        {/* ── Banner: existing client ── */}
        {isCliente && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-lg">👤</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Ya tienes cuenta en SOZU{profile?.nombre ? `, ${profile.nombre.split(" ")[0]}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Puedes apartar esta unidad directamente desde tu portal sin ingresar tus datos nuevamente.
              </p>
              <button onClick={() => navigate("/admin/portal-cliente/inicio")} className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                Ir a mi portal <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Property details ── */}
        <OfferPropertyDetails property={offer.property} materialsPaletteUrl={offer.materialsPaletteUrl} />

        {/* ── Floor plan ── */}
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

        {/* ── Payment plans ── */}
        <OfferPaymentPlansComparator
          plans={offer.paymentPlans}
          listPrice={offer.property.listPrice}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
        />

        {/* ── Highlights ── */}
        {offer.highlights.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Esto la hace especial</h2>
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
        )}

        {/* ── Construction progress ── */}
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

        {/* ── Amenities ── */}
        <OfferAmenities amenities={offer.amenities} />

        {/* ── Location ── */}
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Ubicación</h2>
          </div>
          <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-3 bg-muted">
            <iframe
              src={`https://www.google.com/maps?q=${offer.location.lat},${offer.location.lng}&z=15&output=embed`}
              className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Mapa"
            />
          </div>
          <p className="text-sm text-foreground mb-3">{offer.location.address}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">A poca distancia</p>
          <div className="flex flex-wrap gap-2">
            {offer.location.nearby.map((n, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-medium">{n}</span>
            ))}
          </div>
        </div>

        {/* ── Development presence (Instagram, showroom, redes) ── */}
        {offer.development && (
          <DevelopmentPresenceSection
            development={offer.development}
            developmentName={offer.property.projectName}
            agent={agent}
          />
        )}

        {/* ── Agent signature ── */}
        <AgentSignature agent={agent} />

        {/* ── Co-branding footer ── */}
        <div className="rounded-2xl border border-border bg-muted/40 p-6 md:p-8 text-center space-y-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-muted-foreground">
            Una oferta de
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-8">
            <div className="flex flex-col items-center gap-2">
              {offer.development?.logoUrl ? (
                <img src={offer.development.logoUrl} alt={offer.property.projectName} className="h-8 md:h-10 w-auto object-contain dark:invert" />
              ) : (
                <span className="text-xl font-bold text-foreground">{offer.property.projectName}</span>
              )}
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                {offer.development?.legalName ?? offer.property.projectName}
              </span>
            </div>
            <div className="hidden md:block w-px h-10 bg-border" />
            <div className="md:hidden h-px w-10 bg-border" />
            <div className="flex flex-col items-center gap-2">
              <img src={sozuLogo} alt="SOZU" className="h-7 md:h-8 w-auto object-contain dark:invert" />
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                Comercializador
              </span>
            </div>
          </div>
          {offer.development?.website && (
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              SOZU es el comercializador autorizado de {offer.property.projectName}. Para información
              oficial del desarrollo, visita{" "}
              <a href={offer.development.website} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                {offer.development.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>.
            </p>
          )}
        </div>

        {/* ── Offer metadata footer ── */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Oferta {offer.id} · Expedida el{" "}
            {new Date(offer.generatedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Vigencia:{" "}
            {new Date(offer.validUntil).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Sticky CTA footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {ctaDisabled
                ? isExpired ? "Oferta vencida" : "Unidad ya pre-apartada"
                : isCliente ? "Ver opciones en tu portal"
                : "Apartar esta unidad"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {formatPropertyTitle(offer.property)} · {selectedPlan?.name}
            </p>
          </div>
          <p className="md:hidden text-[11px] text-muted-foreground text-center truncate">
            {formatPropertyTitle(offer.property)}
          </p>
          <div className="flex md:flex-shrink-0">
            {isCliente ? (
              <button onClick={() => navigate("/admin/portal-cliente/inicio")} className="w-full md:w-auto h-11 px-4 md:px-6 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                Ir a mi portal <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={ctaDisabled ? undefined : () => setGateModalOpen(true)}
                disabled={ctaDisabled}
                className={`w-full md:w-auto h-11 px-4 md:px-6 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  ctaDisabled
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isExpired ? "Oferta vencida" : isReserved ? "No disponible" : (
                  <>Apartar esta unidad <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <FormalReservationGateModal
        open={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        offer={offer}
        onStartFormal={() => {
          setGateModalOpen(false);
          navigate(`/oferta/${ofertaId}/datos`);
        }}
      />
    </PublicShell>
  );
}
