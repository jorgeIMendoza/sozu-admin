// ── Types for offer landing page ──

export interface Agent {
  id: string;
  fullName: string;
  firstName: string;
  title: string;
  photoUrl: string;
  phone: string;
  email: string;
  whatsapp: string;
  brokerage?: string;
  brokerageLogo?: string;
  isAllied?: boolean;
  yearsExperience?: number;
  unitsManagedInProject?: number;
  languages?: string[];
  responseTimeAvg?: string;
  specialization?: string;
  bio?: string;
}

export interface PaymentPlan {
  id: string;
  name: string;
  finalPrice: number;
  discountPct: number;
  discountAmount: number;
  downPaymentPct: number;
  downPaymentAmount: number;
  installments?: { count: number; monthlyAmount: number; endDate?: string };
  installmentsPct: number;
  finalPaymentPct: number;
  finalPaymentAmount: number;
}

export interface PropertyDetails {
  projectName: string;
  buildingName: string;
  unitModel: string;
  unitNumber: string;
  level: number;
  view: string;
  area: number;
  interiorArea?: number;
  exteriorArea?: number;
  listPrice: number;
  pricePerM2: number;
  bedrooms: number;
  bathrooms: number;
  halfBathrooms: number;
  parkingSpots: number;
  parkingType: string;
  hasBalcony?: boolean;
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
}

export interface OfertaComercial {
  id: string;
  agentId: string;
  status: "active" | "expired" | "pre_reserved" | "converted_to_account";
  generatedAt: string;
  validUntil: string;
  property: PropertyDetails;
  paymentPlans: PaymentPlan[];
  gallery: string[];
  videoUrl?: string;
  floorPlanUrl?: string;
  materialsPaletteUrl?: string;
  amenities: string[];
  highlights: string[];
  location: { address: string; lat: number; lng: number; nearby: string[] };
  estimatedDelivery: string;
  constructionProgress: number;
  constructionMilestones: { phase: string; pct: number; done: boolean }[];
  constructionLastUpdated?: string;
  constructionVideoUrl?: string;
  constructionVideoTitle?: string;
  constructionPhotos?: { src: string; alt: string }[];
  constructionDescription?: string;
  development?: DevelopmentInfo;
}

// ── Helpers ──

export function formatMXN(amount: number): string {
  return `$${amount.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPropertyTitle(p: PropertyDetails): string {
  return `${p.projectName} · ${p.unitModel} ${p.unitNumber}`;
}

export function buildAgentWhatsAppLink(agent: Agent, message?: string): string {
  const phone = (agent.whatsapp ?? agent.phone).replace(/\D/g, "");
  const msg = message ?? `Hola ${agent.firstName}, tengo interés en una oferta de SOZU.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildAgentPhoneLink(agent: Agent): string {
  return `tel:${agent.phone.replace(/\s+/g, "")}`;
}

export function buildAgentEmailLink(agent: Agent, subject?: string): string {
  const subj = subject ?? "Consulta sobre oferta SOZU";
  return `mailto:${agent.email}?subject=${encodeURIComponent(subj)}`;
}
