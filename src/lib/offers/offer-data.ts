import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ── Tipos del dominio ──

export type OfferStatus =
  | "active"
  | "pre_reserved"
  | "converted_to_account"
  | "expired";

export type PreReservationStatus =
  | "active"
  | "applied"
  | "cancelled_refunded"
  | "expired";

export type CancellationReason =
  | "found_other_property"
  | "price_too_high"
  | "payment_plan_doesnt_work"
  | "need_more_time"
  | "unresolved_doubts"
  | "life_situation_changed"
  | "not_right_moment"
  | "other";

export type CancellationOutcome =
  | "cancelled"
  | "retained"
  | "contacted_agent";

export interface CancellationFeedback {
  id: string;
  reservationId: string;
  prospectId: string;
  primaryReason: CancellationReason;
  subReason?: string;
  freeFormFeedback?: string;
  outcome: CancellationOutcome;
  createdAt: string;
  completedAt?: string;
}

// Capturados por Luz en la llamada de seguimiento, no en el form inicial
export type ProspectIntent = "live" | "rent" | "invest";
export type BudgetRange = "2-3M" | "3-4M" | "4-5M" | "5M+" | "8M+";
export type TimingHorizon = "immediate" | "3-months" | "6-months" | "exploring";

export interface PaymentPlan {
  id: string;
  name: string;
  type: "escalonado" | "standard";
  isPersonalized?: boolean;
  finalPrice: number;
  discountPct: number;
  discountAmount: number;
  downPaymentPct: number;
  downPaymentAmount: number;
  installments?: {
    count: number;
    monthlyAmount: number;
    endDate?: string;
  };
  finalPaymentPct: number;
  finalPaymentAmount: number;
  installmentsPct: number;
  /** Apartado fijo ($20,000). Se descuenta del enganche. undefined = sin desglose. */
  apartado?: number;
  /** Enganche neto = downPaymentAmount − apartado (lo que paga tras el apartado). */
  downPaymentNetAmount?: number;
}

export interface InstagramPost {
  id: string;
  imageUrl: string;
  caption?: string;
  likes?: number;
  postedAt?: string;
  permalink?: string;
}

export interface DevelopmentSocials {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

export interface ShowroomSchedule {
  daysLabel: string;
  hours: string;
  note?: string;
}

export interface ShowroomInfo {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  googleMapsUrl: string;
  googleMapsEmbedUrl?: string;
  schedule?: ShowroomSchedule[];
  notes?: string;
  bookingCtaLabel?: string;
}

export interface DevelopmentInfo {
  website?: string;
  socials?: DevelopmentSocials;
  instagramPosts?: InstagramPost[];
  tagline?: string;
  logoUrl?: string;
  logoUrlInverse?: string;
  legalName?: string;
  showroom?: ShowroomInfo;
  // ── 18.11.B: diferenciación y confianza ──
  developer?: Developer;
  thesis?: DevelopmentThesis[];
  marketAnalysis?: MarketAnalysis;
  salesMetrics?: SalesMetrics;
  testimonials?: Testimonial[];
  recognitions?: DevelopmentRecognition[];
  downloadableAssets?: DownloadableAsset[];
  // ── 18.11.C: otras unidades disponibles ──
  availableUnits?: SimilarUnit[];
}

export interface SimilarUnit {
  id: string;
  /** Código visible al cliente, ej: "T-1208" */
  label: string;
  /** Modelo del departamento, ej: "NORA I", "NORA II" */
  modelName: string;
  floorLevel: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  view: string;
  /** Precio desde (en F1 o el esquema base) */
  priceFrom: number;
  thumbnailUrl: string;
  /** URL relativo a la oferta de esta unidad */
  offerUrl: string;
}

// ── 18.11.B: tipos de diferenciación y confianza ──

export interface Developer {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  projectsDelivered: number;
  yearsActive: number;
  founderName?: string;
  founderTitle?: string;
  founderQuote?: string;
  founderPhotoUrl?: string;
}

export interface DevelopmentThesis {
  iconName: string;
  title: string;
  description: string;
}

export interface PricePerSqmDataPoint {
  year: number;
  pricePerSqm: number;
}

export interface ComparableZone {
  name: string;
  avgPricePerSqm: number;
}

export interface RentalEstimate {
  monthlyRentMxn: number;
  annualROI: number;
}

export interface MarketAnalysis {
  zoneName: string;
  pricePerSqmHistory: PricePerSqmDataPoint[];
  projectedPricePerSqmAtDelivery?: number;
  deliveryYear?: number;
  comparableZones?: ComparableZone[];
  rentalEstimate?: RentalEstimate;
}

export interface SalesMetrics {
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  unitsSoldLast6Months?: number;
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorPhotoUrl?: string;
  unitBought?: string;
  quote: string;
  date: string;
  verified: boolean;
}

export interface DevelopmentRecognition {
  id: string;
  title: string;
  awardedBy: string;
  year: number;
}

export type DownloadableAssetType = "brochure" | "floor_plan_hires" | "materials_spec" | "legal_doc";

export interface DownloadableAsset {
  id: string;
  type: DownloadableAssetType;
  label: string;
  description: string;
  fileUrl: string;
  fileSizeMb?: number;
  fileFormat?: string;
}

export interface PropertyDetails {
  projectName: string;
  buildingName: string;
  unitModel: string;
  unitNumber: string;
  level: number;
  view: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  halfBathrooms: number;
  parkingSpots: number;
  parkingType: string;
  hasBalcony: boolean;
  listPrice: number;
  pricePerM2: number;
}

export interface OfertaComercial {
  id: string;
  shortLink: string;
  propertyId: string;
  /** Email del prospecto/cliente vinculado al crear la oferta. Pre-llena y bloquea el campo email en el flujo de captura de datos. */
  prospectEmail?: string;
  property: PropertyDetails;
  estimatedDelivery: string;
  highlights: string[];
  gallery: string[];
  /** 18.11.D: captions descriptivos por imagen del carousel, alineados por índice. */
  galleryCaptions?: string[];
  videoUrl?: string;
  floorPlanUrl?: string;
  materialsPaletteUrl?: string;
  constructionProgress: number;
  constructionMilestones: { phase: string; pct: number; done: boolean }[];
  constructionLastUpdated?: string;
  constructionVideoUrl?: string;
  constructionVideoTitle?: string;
  constructionPhotos?: { src: string; alt: string }[];
  constructionDescription?: string;
  amenities: string[];
  location: { address: string; lat: number; lng: number; nearby: string[] };
  paymentPlans: PaymentPlan[];
  generatedAt: string;
  generatedBy: string;
  agentId: string;
  validUntil: string;
  status: OfferStatus;
  development?: DevelopmentInfo;
  // ── 18.11.A: experiencias enriquecidas (opcionales) ──
  tour360?: Tour360;
  parkingSlots?: ParkingSlot[];
  parkingLevelLayouts?: ParkingLevelLayout[];
  amenitiesEnriched?: Amenity[];
  // ── Extras reales de la unidad (tablas bodegas / estacionamientos) ──
  bodegas?: OfertaBodega[];
  estacionamientos?: OfertaEstacionamiento[];
  /** CLABE STP temporal del apartado (propiedades.clabe_stp_tmp_apartado). undefined → ocultar. */
  clabeStp?: string;
  /** Meses restantes de mensualidades (hoy→entrega−1 mes) desde RPC. Para nota legal. */
  mesesRestantes?: number;
}

/** Bodega vinculada a la propiedad de la oferta (tabla `bodegas`). */
export interface OfertaBodega {
  id: number;
  nombre: string;
  ubicacion?: string;
  m2?: number;
  incluido: boolean;
}

/** Estacionamiento vinculado a la propiedad de la oferta (tabla `estacionamientos`). */
export interface OfertaEstacionamiento {
  id: number;
  nombre: string;
  ubicacion?: string;
  m2?: number;
  incluido: boolean;
  /** Nombre del tipo desde `tipos_estacionamiento` (Normal, Tandem, Doble, Carlift). */
  tipo?: string;
}

// ── 18.11.A: tipos de experiencias enriquecidas ──

export type Tour360Provider = "kuula" | "matterport" | "other";

export interface Tour360 {
  provider: Tour360Provider;
  embedUrl: string;
  fallbackUrl?: string;
  durationEstimate?: string;
}

export type ParkingFormat = "standard" | "tandem";

export interface ParkingSlot {
  id: string;
  format: ParkingFormat;
  level: string;
  dimensionsM: { width: number; length: number };
  stepsToElevator: number;
  hasEVCharger: boolean;
  tandemWith?: { ownership: "client" | "neighbor"; slotId: string };
  gridPosition: { col: number; row: number };
}

export interface ParkingLevelLayout {
  level: string;
  gridCols: number;
  gridRows: number;
  totalSlots: number;
}

export interface AmenityImage {
  url: string;
  caption?: string;
}

export type AmenityCardSize = "large" | "medium" | "small";

export interface Amenity {
  id: string;
  name: string;
  shortDescription: string;
  longDescription?: string;
  images: AmenityImage[];
  size: AmenityCardSize;
  iconName: string;
}

export interface PendingFlow {
  type: "formal_direct" | "pre_reservation";
  offerId: string;
  interestedPlanId?: string;
  initiatedAt: string;
}

export interface Prospect {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  intent?: ProspectIntent;
  budget?: BudgetRange;
  timing?: TimingHorizon;
  notes?: string;
  source?: "pre_reservation" | "formal_direct" | "manual" | "import";
  createdAt: string;
  verificationStatus: "pending" | "verified";
  verifiedAt: string | null;
  pendingFlow: PendingFlow | null;
}

export interface PreReservation {
  id: string;
  offerId: string;
  prospectId: string;
  propertyId: string;
  amountMXN: number;
  status: PreReservationStatus;
  interestedPlanId?: string;
  originatingAgentId: string;
  createdAt: string;
  reservationExpiresAt: string;
  cardLast4?: string;
  cardBrand?: string;
  authorizationCode?: string;
  cancelledAt?: string;
  appliedAt?: string;
}

// ── Mock: Daiku 508 ÉBANO con los 7 esquemas reales ──

const MONOCOLO_LIST_PRICE = 7622830.76;

const monocoloPaymentPlans: PaymentPlan[] = [
  {
    id: "F1",
    name: "F1",
    type: "standard",
    finalPrice: 7622830.76,
    discountPct: 0,
    discountAmount: 0,
    downPaymentPct: 20,
    downPaymentAmount: 1524566.15,
    installments: { count: 48, monthlyAmount: 47642.69 },
    finalPaymentPct: 50,
    finalPaymentAmount: 3811415.38,
    installmentsPct: 30,
  },
  {
    id: "F2",
    name: "F2",
    type: "standard",
    finalPrice: 7394145.84,
    discountPct: 3,
    discountAmount: 228684.92,
    downPaymentPct: 25,
    downPaymentAmount: 1848536.46,
    installments: { count: 48, monthlyAmount: 61617.88 },
    finalPaymentPct: 35,
    finalPaymentAmount: 2587951.04,
    installmentsPct: 40,
  },
  {
    id: "F3",
    name: "F3",
    type: "standard",
    finalPrice: 7241689.22,
    discountPct: 5,
    discountAmount: 381141.54,
    downPaymentPct: 30,
    downPaymentAmount: 2172506.77,
    installments: { count: 48, monthlyAmount: 75434.26 },
    finalPaymentPct: 20,
    finalPaymentAmount: 1448337.84,
    installmentsPct: 50,
  },
  {
    id: "F4",
    name: "F4",
    type: "standard",
    finalPrice: 7089232.61,
    discountPct: 7,
    discountAmount: 533598.15,
    downPaymentPct: 40,
    downPaymentAmount: 2835693.04,
    installments: { count: 48, monthlyAmount: 73846.17 },
    finalPaymentPct: 10,
    finalPaymentAmount: 708923.26,
    installmentsPct: 50,
  },
  {
    id: "F5",
    name: "F5",
    type: "standard",
    finalPrice: 6860547.68,
    discountPct: 10,
    discountAmount: 762283.08,
    downPaymentPct: 70,
    downPaymentAmount: 4802383.38,
    finalPaymentPct: 30,
    finalPaymentAmount: 2058164.31,
    installmentsPct: 0,
  },
  {
    id: "F6",
    name: "F6",
    type: "standard",
    finalPrice: 6479406.15,
    discountPct: 15,
    discountAmount: 1143424.61,
    downPaymentPct: 90,
    downPaymentAmount: 5831465.53,
    finalPaymentPct: 10,
    finalPaymentAmount: 647940.61,
    installmentsPct: 0,
  },
];

const initialOffers: OfertaComercial[] = [
  {
    id: "O-002383",
    shortLink: "/oferta/O-002383",
    propertyId: "monocolo-t701",
    prospectEmail: "ana.garcia@ejemplo.com",
    property: {
      projectName: "Monócolo",
      buildingName: "TEMPO",
      unitModel: "NORA I",
      unitNumber: "T-701",
      level: 7,
      view: "Country",
      area: 90.32,
      bedrooms: 2,
      bathrooms: 2,
      halfBathrooms: 0,
      parkingSpots: 2,
      parkingType: "Normal",
      hasBalcony: true,
      listPrice: MONOCOLO_LIST_PRICE,
      pricePerM2: 84398.04,
    },
    estimatedDelivery: "2028-06-30T00:00:00",
    highlights: [
      "Vista Country en piso 7",
      "Modelo NORA I con acabados premium",
      "Cocina integral con barra desayunador",
      "Walk-in closet en recámara principal",
      "Balcón con vista despejada",
      "Doble cajón de estacionamiento",
    ],
    gallery: [
      "/images/daiku/exterior.jpg",
      "/images/daiku/sala.jpg",
      "/images/daiku/cocina.jpg",
      "/images/daiku/recamara-principal.jpg",
      "/images/daiku/recamara-secundaria.jpg",
      "/images/daiku/bano.jpg",
      "/images/daiku/lavanderia.jpg",
      "/images/daiku/vista-ciudad.jpg",
      "/images/daiku/torres.jpg",
      "/images/daiku/amenidad-sky-lounge.jpg",
      "/images/daiku/amenidad-alberca.png",
      "/images/daiku/amenidad-jacuzzi.png",
      "/images/daiku/amenidad-poolbar.jpg",
      "/images/daiku/amenidad-bar-rooftop.jpg",
      "/images/daiku/amenidad-firepit.jpg",
      "/images/daiku/amenidad-lounge.jpg",
      "/images/daiku/amenidad-gym.jpg",
      "/images/daiku/amenidad-yoga.jpg",
      "/images/daiku/amenidad-kids.png",
    ],
    // 18.11.D: captions descriptivos del carousel (alineados por índice con gallery)
    galleryCaptions: [
      "Fachada principal vista poniente",
      "Sala-comedor · Modelo NORA I",
      "Cocina integral con barra desayunador",
      "Recámara principal con walk-in closet",
      "Segunda recámara",
      "Baño principal · Acabados premium",
      "Cuarto de lavado integrado",
      "Vista despejada hacia la ciudad",
      "Conjunto de torres Daiku",
      "Sky lounge en el rooftop",
      "Alberca con vista panorámica",
      "Jacuzzi en el rooftop",
      "Pool bar al aire libre",
      "Bar rooftop al atardecer",
      "Firepit lounge para tardes frescas",
      "Lounge interior con doble altura",
      "Gimnasio completamente equipado",
      "Cuarto de yoga con luz natural",
      "Área kids con juegos seguros",
    ],
    videoUrl: "/videos/daiku-recorrido.mp4",
    floorPlanUrl: "/images/daiku/plano-nora.png",
    materialsPaletteUrl: "https://images.unsplash.com/photo-1615875605825-5eb9bb5d52ac?w=800",
    constructionProgress: 28,
    constructionLastUpdated: "12 Mayo 2026",
    constructionVideoUrl: "https://www.youtube.com/embed/KQf-8tqXAQ8",
    constructionVideoTitle: "AVANCE DE OBRA · MAYO 2026 · DAIKU",
    constructionDescription:
      "Avance en armado de columnas de niveles superiores. Cimbra y colado de trabes principales en perímetro. Cuadrilla completa trabajando en estructura del cuerpo central.",
    constructionPhotos: [
      { src: "/images/obra/obra-daiku-1.jpg", alt: "Armado de columnas vista panorámica" },
      { src: "/images/obra/obra-daiku-2.jpg", alt: "Trabajos en altura sobre columnas" },
      { src: "/images/obra/obra-daiku-3.jpg", alt: "Cuadrilla trabajando en columnas" },
      { src: "/images/obra/obra-daiku-4.jpg", alt: "Cimbra y trabes en perímetro" },
    ],
    constructionMilestones: [
      { phase: "Cimentación", pct: 5, done: true },
      { phase: "Estructura", pct: 28, done: true },
      { phase: "Albañilería", pct: 60, done: false },
      { phase: "Instalaciones", pct: 80, done: false },
      { phase: "Acabados", pct: 95, done: false },
      { phase: "Entrega", pct: 100, done: false },
    ],
    amenities: [
      "Roof garden con alberca",
      "Gimnasio equipado",
      "Salón de usos múltiples",
      "Coworking",
      "Cuarto de yoga",
      "Seguridad 24/7",
      "Lobby con concierge",
    ],
    location: {
      address: "Mar Egeo 1594, Country Club, 44610 Guadalajara, Jal.",
      lat: 20.7046191,
      lng: -103.3685474,
      nearby: ["Andares (5 min)", "Plaza Patria (7 min)", "Tec de Monterrey (10 min)", "Aeropuerto (25–35 min según tráfico)"],
    },
    paymentPlans: monocoloPaymentPlans,
    generatedAt: "2026-06-03T10:00:00",
    generatedBy: "Ramón Escobar",
    agentId: "AGT-RAMON",
    validUntil: "2026-07-03T23:59:59",
    status: "active",
    development: {
      website: "https://monocolocountry.mx",
      tagline: "Vive Country como nunca antes",
      logoUrl: "https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/object/public/documentos/projects/images/1773856633615.png",
      logoUrlInverse: undefined,
      legalName: "Monócolo Country Residences",
      socials: {
        instagram: "monocolo.country",
        facebook: "monocolocountry",
        youtube: "@monocolocountry",
      },
      instagramPosts: [
        { id: "post-1", imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80", caption: "Última visita guiada del mes. ¡Cupos limitados! 🏙️", likes: 247, postedAt: "2026-05-08T18:30:00", permalink: "https://www.instagram.com/p/example1/" },
        { id: "post-2", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", caption: "Nuevo render de la zona de roof garden. Cada detalle pensado.", likes: 189, postedAt: "2026-05-05T15:45:00", permalink: "https://www.instagram.com/p/example2/" },
        { id: "post-3", imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80", caption: "Avance de obra mayo 2026. Vamos al 28% ✨", likes: 412, postedAt: "2026-05-02T11:20:00", permalink: "https://www.instagram.com/p/example3/" },
        { id: "post-4", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80", caption: "Modelo NORA I — Acabados premium en cada espacio.", likes: 156, postedAt: "2026-04-28T14:10:00", permalink: "https://www.instagram.com/p/example4/" },
        { id: "post-5", imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80", caption: "Vista Country desde el piso 7. Mirá lo que ves cada mañana.", likes: 328, postedAt: "2026-04-22T09:30:00", permalink: "https://www.instagram.com/p/example5/" },
        { id: "post-6", imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&q=80", caption: "Diseñado para vivir, no solo para habitar.", likes: 203, postedAt: "2026-04-15T17:00:00", permalink: "https://www.instagram.com/p/example6/" },
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
      // ── 18.11.B: diferenciación y confianza (demo) ──
      developer: {
        id: "daiku",
        name: "Daiku Desarrollos",
        logoUrl: "https://placehold.co/240x80/png?text=DAIKU",
        description: "Desarrolladora boutique con foco en proyectos residenciales premium en Guadalajara y Cd. de México. Enfocados en entregas a tiempo y diseño curado.",
        projectsDelivered: 8,
        yearsActive: 12,
        founderName: "Arq. Carlos Mendoza",
        founderTitle: "Fundador · Director General",
        founderQuote: "En Daiku no construimos edificios, construimos los hogares donde las familias van a vivir las próximas tres décadas. Cada decisión de diseño, materiales y ubicación pasa por ese filtro.",
        founderPhotoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400",
      },
      thesis: [
        { iconName: "MapPin", title: "Country Club mantiene la plusvalía más estable de Guadalajara", description: "Zona consolidada con escuelas premium, clubes deportivos y conectividad. El precio por m² se ha apreciado consistentemente 7-9% anual los últimos 5 años." },
        { iconName: "Pencil", title: "Diseño firmado por Atelier Hidrokal", description: "Estudio premiado por proyectos en CDMX, Guadalajara y Monterrey. Cada unidad de Monócolo tiene cocina integral, walk-in closet y vista despejada como standard." },
        { iconName: "Sparkles", title: "Materiales premium importados", description: "Paleta exclusiva con pisos de mármol Calacatta, herrería europea, encimeras de cuarzo Silestone y carpinterías de madera certificada." },
      ],
      marketAnalysis: {
        zoneName: "Country Club, Guadalajara",
        pricePerSqmHistory: [
          { year: 2021, pricePerSqm: 58000 },
          { year: 2022, pricePerSqm: 64000 },
          { year: 2023, pricePerSqm: 71000 },
          { year: 2024, pricePerSqm: 78000 },
          { year: 2025, pricePerSqm: 84000 },
          { year: 2026, pricePerSqm: 84400 },
        ],
        projectedPricePerSqmAtDelivery: 108000,
        deliveryYear: 2028,
        comparableZones: [
          { name: "Providencia", avgPricePerSqm: 76000 },
          { name: "Andares", avgPricePerSqm: 92000 },
          { name: "Lomas del Country", avgPricePerSqm: 81000 },
        ],
        rentalEstimate: { monthlyRentMxn: 38000, annualROI: 6.0 },
      },
      salesMetrics: {
        totalUnits: 96,
        soldUnits: 47,
        reservedUnits: 5,
        availableUnits: 44,
        unitsSoldLast6Months: 8,
      },
      testimonials: [
        { id: "testimonial_1", authorName: "Ana Lucía Hernández", authorPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", unitBought: "T-1402", quote: "Ramón nos acompañó desde la primera visita al showroom hasta la firma. Lo que más valoramos fue que nunca sintió que nos estuvieran vendiendo — siempre respondió preguntas con datos.", date: "2026-03-15", verified: true },
        { id: "testimonial_2", authorName: "Roberto Solís", authorPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400", unitBought: "T-908", quote: "Compramos como inversión. El proceso del apartado fue claro y los esquemas de financiamiento se adaptaron a nuestro flujo. La unidad ya está en renta y rinde lo que estimaron.", date: "2025-11-08", verified: true },
        { id: "testimonial_3", authorName: "María José Vargas y Luis Quintero", authorPhotoUrl: "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400", unitBought: "T-1206", quote: "Nos mudamos en mayo. Las amenidades superaron expectativas — el roof garden se ha vuelto nuestro lugar favorito los fines de semana. El concierge conoce a todos los residentes.", date: "2026-05-22", verified: true },
      ],
      recognitions: [
        { id: "rec_1", title: "Mejor desarrollo de preventa 2025", awardedBy: "Premios Top Real Estate México", year: 2025 },
      ],
      downloadableAssets: [
        { id: "brochure_main", type: "brochure", label: "Brochure ejecutivo", description: "Documento completo con información del desarrollo, planos, amenidades y términos comerciales.", fileUrl: "https://example.com/monocolo-brochure-2026.pdf", fileSizeMb: 4.2, fileFormat: "PDF" },
        { id: "floor_plan_hires", type: "floor_plan_hires", label: "Plano arquitectónico HD", description: "Plano detallado de tu unidad NORA I T-701 en alta resolución para imprimir y discutir en mesa.", fileUrl: "https://example.com/monocolo-t701-plano-hd.pdf", fileSizeMb: 1.8, fileFormat: "PDF" },
        { id: "materials_spec", type: "materials_spec", label: "Ficha técnica de materiales", description: "Especificaciones de acabados, marcas, dimensiones y certificaciones de los materiales incluidos.", fileUrl: "https://example.com/monocolo-materiales-2026.pdf", fileSizeMb: 2.1, fileFormat: "PDF" },
      ],
      // ── 18.11.C: otras unidades disponibles en Monócolo ──
      availableUnits: [
        {
          id: "monocolo-t-1208",
          label: "T-1208",
          modelName: "NORA II",
          floorLevel: 12,
          areaSqm: 105.4,
          bedrooms: 2,
          bathrooms: 2,
          view: "Country",
          priceFrom: 8420000,
          thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
          offerUrl: "/oferta/O-002384",
        },
        {
          id: "monocolo-t-805",
          label: "T-805",
          modelName: "NORA I",
          floorLevel: 8,
          areaSqm: 90.32,
          bedrooms: 2,
          bathrooms: 2,
          view: "Country",
          priceFrom: 7480000,
          thumbnailUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
          offerUrl: "/oferta/O-002389",
        },
        {
          id: "monocolo-t-1601",
          label: "T-1601",
          modelName: "NORA III",
          floorLevel: 16,
          areaSqm: 142.8,
          bedrooms: 3,
          bathrooms: 3,
          view: "Andares",
          priceFrom: 12780000,
          thumbnailUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
          offerUrl: "/oferta/O-002392",
        },
        {
          id: "monocolo-t-403",
          label: "T-403",
          modelName: "NORA I",
          floorLevel: 4,
          areaSqm: 90.32,
          bedrooms: 2,
          bathrooms: 2,
          view: "Mixto",
          priceFrom: 7290000,
          thumbnailUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
          offerUrl: "/oferta/O-002378",
        },
      ],
    },
    // ── 18.11.A: experiencias enriquecidas (demo) ──
    tour360: {
      provider: "kuula",
      embedUrl: "https://kuula.co/share/collection/7TNZ0?logo=0&info=0&fs=1&vr=1&sd=1&initload=0&thumbs=1",
      durationEstimate: "8-12 minutos",
    },
    parkingSlots: [
      {
        id: "E-127",
        format: "standard",
        level: "Sótano 1",
        dimensionsM: { width: 2.4, length: 5.0 },
        stepsToElevator: 12,
        hasEVCharger: false,
        gridPosition: { col: 3, row: 2 },
      },
      {
        id: "E-128",
        format: "standard",
        level: "Sótano 1",
        dimensionsM: { width: 2.4, length: 5.0 },
        stepsToElevator: 13,
        hasEVCharger: true,
        gridPosition: { col: 4, row: 2 },
      },
    ],
    parkingLevelLayouts: [
      { level: "Sótano 1", gridCols: 12, gridRows: 6, totalSlots: 64 },
    ],
    amenitiesEnriched: [
      {
        id: "roof_garden",
        name: "Roof garden con alberca",
        shortDescription: "Vista 360° de Guadalajara, área de asoleadero y bar",
        longDescription:
          "Roof garden de 800 m² en el piso 24, con alberca infinity de 18m, áreas verdes con vegetación nativa, asoleadero con camastros premium, bar exterior con sombras y zonas de comedor al aire libre. Acceso exclusivo para residentes.",
        images: [
          // SWAP POINT: sustituir con renders reales del desarrollo
          { url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200", caption: "Vista del roof garden al atardecer" },
          { url: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200", caption: "Alberca infinity" },
          { url: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1200", caption: "Asoleadero" },
        ],
        size: "large",
        iconName: "Waves",
      },
      {
        id: "gimnasio",
        name: "Gimnasio equipado",
        shortDescription: "Equipo Technogym, áreas de cardio y fuerza, vestidores con regaderas",
        images: [
          { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200" },
          { url: "https://images.unsplash.com/photo-1571388208497-71bedc66e932?w=1200" },
        ],
        size: "medium",
        iconName: "Dumbbell",
      },
      {
        id: "coworking",
        name: "Coworking",
        shortDescription: "Espacios privados y comunes, salas de juntas con TV, café gratis",
        images: [
          { url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200" },
          { url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200" },
        ],
        size: "medium",
        iconName: "Laptop",
      },
      {
        id: "yoga",
        name: "Cuarto de yoga",
        shortDescription: "Sala con piso de bambú, espejos y equipo incluido",
        images: [{ url: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200" }],
        size: "small",
        iconName: "Flower2",
      },
      {
        id: "salon_usos",
        name: "Salón de usos múltiples",
        shortDescription: "Para eventos privados, capacidad 60 personas, cocina equipada",
        images: [{ url: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200" }],
        size: "small",
        iconName: "Users",
      },
      {
        id: "lobby",
        name: "Lobby con concierge",
        shortDescription: "Recepción 24/7, recepción de paquetería, valet parking opcional",
        images: [{ url: "https://images.unsplash.com/photo-1564540583246-934409427776?w=1200" }],
        size: "medium",
        iconName: "Bell",
      },
      {
        id: "seguridad",
        name: "Seguridad 24/7",
        shortDescription: "Control de acceso, CCTV, vigilancia interna y perimetral",
        images: [{ url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200" }],
        size: "small",
        iconName: "Shield",
      },
    ],
  },
];

// ── Store ──

interface OfferState {
  offers: OfertaComercial[];
  prospects: Prospect[];
  activeProspectId: string | null;
  preReservations: PreReservation[];
  cancellationFeedbacks: CancellationFeedback[];
  selectedPlanByOffer: Record<string, string>;
  setSelectedPlan: (offerId: string, planId: string) => void;
  createProspect: (
    data: Omit<Prospect, "id" | "createdAt" | "verificationStatus" | "verifiedAt" | "pendingFlow">
  ) => Prospect;
  setActiveProspect: (id: string | null) => void;
  getActiveProspect: () => Prospect | null;
  findProspectByEmail: (email: string) => Prospect | null;
  setPendingFlow: (prospectId: string, pendingFlow: PendingFlow) => void;
  clearPendingFlow: (prospectId: string) => void;
  verifyProspect: (prospectId: string) => Prospect | null;
  createPreReservation: (input: {
    offerId: string;
    prospectId: string;
    propertyId: string;
    amountMXN?: number;
    interestedPlanId?: string;
    cardLast4?: string;
    cardBrand?: string;
  }) => PreReservation;
  cancelPreReservation: (id: string) => void;
  applyPreReservation: (id: string) => void;
  updateProspectQualitative: (
    id: string,
    data: Partial<Pick<Prospect, "intent" | "budget" | "timing" | "notes">>
  ) => void;
  createCancellationFeedback: (input: {
    reservationId: string;
    prospectId: string;
    primaryReason: CancellationReason;
    subReason?: string;
    freeFormFeedback?: string;
    outcome: CancellationOutcome;
  }) => CancellationFeedback;
  addOrUpdateOffer: (offer: OfertaComercial) => void;
  reset: () => void;
}

export const useOfferStore = create<OfferState>()(
  persist((set, get) => ({
  offers: structuredClone(initialOffers),
  prospects: [],
  activeProspectId: null,
  preReservations: [],
  cancellationFeedbacks: [],
  selectedPlanByOffer: {},
  setSelectedPlan: (offerId, planId) => {
    set((s) => ({ selectedPlanByOffer: { ...s.selectedPlanByOffer, [offerId]: planId } }));
  },
  createProspect: (data) => {
    const existing = get().prospects.find(
      (p) => p.email.toLowerCase() === data.email.toLowerCase()
    );
    if (existing) {
      set({ activeProspectId: existing.id });
      return existing;
    }
    const prospect: Prospect = {
      ...data,
      id: `PRO-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      verificationStatus: "pending",
      verifiedAt: null,
      pendingFlow: null,
    };
    set((s) => ({ prospects: [...s.prospects, prospect], activeProspectId: prospect.id }));
    return prospect;
  },
  setActiveProspect: (id) => set({ activeProspectId: id }),
  getActiveProspect: () => {
    const s = get();
    return s.prospects.find((p) => p.id === s.activeProspectId) ?? null;
  },
  findProspectByEmail: (email) =>
    get().prospects.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null,
  setPendingFlow: (prospectId, pendingFlow) => {
    set((s) => ({
      prospects: s.prospects.map((p) => (p.id === prospectId ? { ...p, pendingFlow } : p)),
    }));
  },
  clearPendingFlow: (prospectId) => {
    set((s) => ({
      prospects: s.prospects.map((p) =>
        p.id === prospectId ? { ...p, pendingFlow: null } : p
      ),
    }));
  },
  verifyProspect: (prospectId) => {
    const now = new Date().toISOString();
    let result: Prospect | null = null;
    set((s) => {
      const prospects = s.prospects.map((p) => {
        if (p.id !== prospectId) return p;
        const updated: Prospect = {
          ...p,
          verificationStatus: "verified",
          verifiedAt: now,
        };
        result = updated;
        return updated;
      });
      return { prospects, activeProspectId: prospectId };
    });
    return result;
  },
  createPreReservation: (input) => {
    const now = new Date();
    const resvExpires = new Date(now);
    resvExpires.setDate(resvExpires.getDate() + 15);

    const offer = get().offers.find((o) => o.id === input.offerId);
    const originatingAgentId = offer?.agentId ?? "AGT-RAMON";

    const reservation: PreReservation = {
      id: `PRE-${Date.now().toString(36).toUpperCase()}`,
      offerId: input.offerId,
      prospectId: input.prospectId,
      propertyId: input.propertyId,
      amountMXN: input.amountMXN ?? 5000,
      status: "active",
      interestedPlanId: input.interestedPlanId,
      originatingAgentId,
      createdAt: now.toISOString(),
      reservationExpiresAt: resvExpires.toISOString(),
      cardLast4: input.cardLast4,
      cardBrand: input.cardBrand,
      authorizationCode: `AUTH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    };

    set((s) => ({
      preReservations: [...s.preReservations, reservation],
      offers: s.offers.map((o) =>
        o.id === input.offerId && o.status === "active" ? { ...o, status: "pre_reserved" } : o
      ),
    }));
    return reservation;
  },
  cancelPreReservation: (id) => {
    set((s) => {
      const updatedReservations = s.preReservations.map((r) =>
        r.id === id
          ? { ...r, status: "cancelled_refunded" as const, cancelledAt: new Date().toISOString() }
          : r
      );
      const cancelled = updatedReservations.find((r) => r.id === id);
      const stillReserved = cancelled
        ? updatedReservations.some((r) => r.offerId === cancelled.offerId && r.status === "active")
        : false;
      const updatedOffers = cancelled && !stillReserved
        ? s.offers.map((o) =>
            o.id === cancelled.offerId && o.status === "pre_reserved" ? { ...o, status: "active" as const } : o
          )
        : s.offers;
      return { preReservations: updatedReservations, offers: updatedOffers };
    });
  },
  applyPreReservation: (id) => {
    set((s) => {
      const updatedReservations = s.preReservations.map((r) =>
        r.id === id ? { ...r, status: "applied" as const, appliedAt: new Date().toISOString() } : r
      );
      const applied = updatedReservations.find((r) => r.id === id);
      const updatedOffers = applied
        ? s.offers.map((o) =>
            o.id === applied.offerId ? { ...o, status: "converted_to_account" as const } : o
          )
        : s.offers;
      return { preReservations: updatedReservations, offers: updatedOffers };
    });
  },
  updateProspectQualitative: (id, data) => {
    set((s) => ({
      prospects: s.prospects.map((p) => (p.id === id ? { ...p, ...data } : p)),
    }));
  },
  createCancellationFeedback: (input) => {
    const now = new Date().toISOString();
    const feedback: CancellationFeedback = {
      id: `FB-${Date.now().toString(36).toUpperCase()}`,
      reservationId: input.reservationId,
      prospectId: input.prospectId,
      primaryReason: input.primaryReason,
      subReason: input.subReason,
      freeFormFeedback: input.freeFormFeedback,
      outcome: input.outcome,
      createdAt: now,
      completedAt: now,
    };
    set((s) => ({ cancellationFeedbacks: [...s.cancellationFeedbacks, feedback] }));
    return feedback;
  },
  addOrUpdateOffer: (offer: OfertaComercial) =>
    set((s) => ({
      offers: s.offers.some((o) => o.id === offer.id)
        ? s.offers.map((o) => (o.id === offer.id ? offer : o))
        : [...s.offers, offer],
    })),
  reset: () =>
    set({
      offers: structuredClone(initialOffers),
      prospects: [],
      activeProspectId: null,
      preReservations: [],
      cancellationFeedbacks: [],
      selectedPlanByOffer: {},
    }),
  }), {
    name: "sozu-offer-flow-v2",
    storage: createJSONStorage(() => sessionStorage),
  })
);

// ── Selectors ──

export function getOfferById(id: string): OfertaComercial | undefined {
  return useOfferStore.getState().offers.find((o) => o.id === id);
}

export function useOfferById(id: string): OfertaComercial | undefined {
  return useOfferStore((s) => s.offers.find((o) => o.id === id));
}

// Called from pages that load DB offers — injects into store so useOfferById can find it
export function useInjectOffer() {
  return useOfferStore((s) => s.addOrUpdateOffer);
}

export function useSelectedPlanId(offerId: string): string | undefined {
  return useOfferStore((s) => s.selectedPlanByOffer[offerId]);
}

// ── Helpers ──

export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPropertyTitle(p: PropertyDetails): string {
  return `${p.projectName} · ${p.unitModel} ${p.unitNumber}`;
}
