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
  /** Apartado del proyecto (`proyectos.monto_apartado`). Se descuenta del enganche. undefined = sin desglose. */
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
  // ── Desarrolladora (constructora que lleva el proyecto; entidad tipo 3) ──
  developerName?: string;
  developerLogoUrl?: string;
  developerWebsite?: string;
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
  /** Nombre legal del prospecto/cliente vinculado. Pre-llena el campo nombre en la captura de datos. */
  prospectName?: string;
  /** Teléfono (solo dígitos) del prospecto/cliente vinculado. Pre-llena el campo teléfono. */
  prospectPhone?: string;
  /** Lada internacional del prospecto (ej. "+52"). Pre-selecciona el país en el campo teléfono. */
  prospectDialCode?: string;
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
  /** Id del esquema de pago seleccionado en la oferta (para resaltar su precio). */
  selectedPlanId?: string;
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
  /**
   * CLABE STP para pagar. Prioridad: `cuentas_cobranza.clabe_stp` (dedicada de la
   * cuenta, existe tras el primer pago) → `propiedades.clabe_stp_tmp_apartado`
   * (temporal/universal del apartado). undefined → ocultar.
   */
  clabeStp?: string;
  /**
   * La oferta ya tiene cuenta de cobranza activa: la unidad tiene dueño y ya no
   * se comercializa (implica `status: "converted_to_account"`).
   */
  hasCuentaCobranza?: boolean;
  /** Meses restantes de mensualidades (hoy→entrega−1 mes) desde RPC. Para nota legal. */
  mesesRestantes?: number;
  /**
   * Monto del apartado de la unidad (`propiedades.monto_apartado`), vía RPC. Es el
   * mismo número que se cobra en el flujo de pago. `0` = el proyecto no cobra
   * apartado; undefined → `APARTADO_DEFAULT_MXN`.
   */
  apartadoAmount?: number;
  /** Plano del nivel (edificios_niveles_planos.imagen_url) para señalar la ubicación de la unidad. */
  planoUbicacionUrl?: string;
  /** Regiones/polígonos del plano de nivel (edificios_niveles_planos.regiones) para resaltar la unidad. */
  planoUbicacionRegiones?: any[];
  /** Número de depto derivado (numero_propiedad − piso) para el match del resaltado en el plano. */
  unitDepto?: string;
  /**
   * Total de niveles del edificio (`edificios.numero_pisos`) para dibujar el corte
   * del edificio a escala. Solo se envía si la oferta muestra el piso.
   */
  totalPisos?: number;
}

/** Esquema de pago de una bodega, tomado de la oferta de producto del mismo lead. */
export interface OfertaBodegaPago {
  /** % de enganche (esquemas_pago.porcentaje_enganche). */
  pctEnganche: number;
  /** % a la entrega (esquemas_pago.porcentaje_entrega). */
  pctEntrega: number;
  /** % en mensualidades (esquemas_pago.porcentaje_mensualidades). */
  pctMensualidades: number;
  /** Número de mensualidades (esquemas_pago.numero_mensualidades). */
  numMensualidades: number;
  /** CLABE STP de la bodega (ofertas.clabe_stp_tmp_producto). undefined → ocultar. */
  clabeStp?: string;
}

/** Bodega vinculada a la propiedad de la oferta (tabla `bodegas`). */
export interface OfertaBodega {
  id: number;
  nombre: string;
  ubicacion?: string;
  m2?: number;
  incluido: boolean;
  /** Producto al que pertenece (bodegas.id_producto) — enlaza con su oferta/esquema. */
  idProducto?: number;
  /** Costo de la bodega = productos_servicios.precio_lista (precio/m²) × m². */
  costo?: number;
  /** Esquema de pago + CLABE de la bodega (oferta de producto del mismo lead). */
  pago?: OfertaBodegaPago;
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

// El catálogo de ofertas vive en la BD: `OfferPage` lo inyecta en el store con
// `useInjectOffer` al resolver la oferta con `useOfferFromDB`.
const initialOffers: OfertaComercial[] = [];

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
