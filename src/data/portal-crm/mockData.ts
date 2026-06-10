// Mock data para el Portal CRM Sozu (Fase 1).
// Conserva los nombres del proyecto origen "SOZU Campaign Studio" para que las
// vistas porteadas funcionen sin tocar la lógica.

export const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

export const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-MX").format(n || 0);

export const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`;

export const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export const relTime = (iso: string) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
};

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86400_000).toISOString();

// ------------------------- Contactos --------------------------------------
export interface CrmContact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  source_platform: string | null;
  source_name: string | null;
  lifecycle_stage: string;
  created_at: string;
}

export const MOCK_CONTACTS: CrmContact[] = [
  { id: "c1", full_name: "Andrea Robles",  email: "andrea@example.com",  phone: "+5215511110001", normalized_email: "andrea@example.com",  normalized_phone: "5215511110001", source_platform: "meta_ads",   source_name: "MX · Vivenza · Awareness", lifecycle_stage: "lead",       created_at: daysAgo(1) },
  { id: "c2", full_name: "Bruno Sánchez",  email: "bruno@example.com",   phone: "+5215511110002", normalized_email: "bruno@example.com",   normalized_phone: "5215511110002", source_platform: "google_ads", source_name: "GDL · Reserva 360 · Search", lifecycle_stage: "qualified",  created_at: daysAgo(3) },
  { id: "c3", full_name: "Carla Méndez",   email: "carla@example.com",   phone: "+5215511110003", normalized_email: "carla@example.com",   normalized_phone: "5215511110003", source_platform: "meta_ads",   source_name: "MX · Vivenza · Conversion", lifecycle_stage: "appointment",created_at: daysAgo(5) },
  { id: "c4", full_name: "Diego Ortiz",    email: "diego@example.com",   phone: "+5215511110004", normalized_email: "diego@example.com",   normalized_phone: "5215511110004", source_platform: null,         source_name: null, lifecycle_stage: "lead",       created_at: daysAgo(7) },
  { id: "c5", full_name: "Elena Vargas",   email: "elena@example.com",   phone: "+5215511110005", normalized_email: "elena@example.com",   normalized_phone: "5215511110005", source_platform: "meta_ads",   source_name: "MX · Vivenza · Awareness", lifecycle_stage: "reservation",created_at: daysAgo(10) },
  { id: "c6", full_name: "Fernanda Soto",  email: "andrea@example.com",  phone: "+5215511110006", normalized_email: "andrea@example.com",  normalized_phone: "5215511110006", source_platform: "google_ads", source_name: "GDL · Reserva 360 · Search", lifecycle_stage: "lead",       created_at: daysAgo(12) },
];

export const MOCK_CONTACT_ATTRIBUTION = [
  { contact_id: "c1", first_touch_source: "meta",   first_touch_medium: "cpc", first_touch_campaign: "MX · Vivenza · Awareness",  fbclid: "fb_aaa", gclid: null },
  { contact_id: "c2", first_touch_source: "google", first_touch_medium: "cpc", first_touch_campaign: "GDL · Reserva 360 · Search", fbclid: null,     gclid: "gc_bbb" },
  { contact_id: "c3", first_touch_source: "meta",   first_touch_medium: "cpc", first_touch_campaign: "MX · Vivenza · Conversion", fbclid: "fb_ccc", gclid: null },
  { contact_id: "c5", first_touch_source: "meta",   first_touch_medium: "cpc", first_touch_campaign: "MX · Vivenza · Awareness",  fbclid: "fb_ddd", gclid: null },
];

// ------------------------- Deals -------------------------------------------
export interface CrmDeal {
  id: string;
  contact_id: string;
  deal_stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  value: number;
  development_id: string | null;
}

export const MOCK_DEALS: CrmDeal[] = [
  { id: "d1", contact_id: "c1", deal_stage: "qualified",  value:  2_400_000, development_id: "dv1" },
  { id: "d2", contact_id: "c2", deal_stage: "proposal",   value:  3_150_000, development_id: "dv2" },
  { id: "d3", contact_id: "c3", deal_stage: "negotiation",value:  1_980_000, development_id: "dv1" },
  { id: "d4", contact_id: "c5", deal_stage: "won",        value:  4_120_000, development_id: "dv1" },
  { id: "d5", contact_id: "c4", deal_stage: "lost",       value:  1_750_000, development_id: "dv2" },
];

// ------------------------- Campañas e insights -----------------------------
export const MOCK_CAMPAIGNS = [
  { id: "cmp1", campaign_name: "MX · Vivenza · Awareness",   platform: "meta_ads",   development_id: "dv1" },
  { id: "cmp2", campaign_name: "MX · Vivenza · Conversion",  platform: "meta_ads",   development_id: "dv1" },
  { id: "cmp3", campaign_name: "GDL · Reserva 360 · Search", platform: "google_ads", development_id: "dv2" },
  { id: "cmp4", campaign_name: "QRO · Altea · Display",      platform: "google_ads", development_id: "dv3" },
];

export const MOCK_INSIGHTS_30D = [
  { campaign_id: "cmp1", platform: "meta_ads",   date: daysAgo(2),  spend:  18000, leads: 24, qualified_leads: 9,  appointments: 4, reservations: 1 },
  { campaign_id: "cmp2", platform: "meta_ads",   date: daysAgo(4),  spend:  22000, leads: 31, qualified_leads: 12, appointments: 6, reservations: 2 },
  { campaign_id: "cmp3", platform: "google_ads", date: daysAgo(6),  spend:  15000, leads: 18, qualified_leads: 7,  appointments: 3, reservations: 1 },
  { campaign_id: "cmp4", platform: "google_ads", date: daysAgo(8),  spend:   9000, leads:  6, qualified_leads: 1,  appointments: 0, reservations: 0 },
  { campaign_id: "cmp1", platform: "meta_ads",   date: daysAgo(12), spend:  12000, leads: 14, qualified_leads: 5,  appointments: 2, reservations: 0 },
];

// ------------------------- Alertas -----------------------------------------
export interface CrmAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  alert_type: string;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  metric_name?: string | null;
  current_value?: number | null;
  previous_value?: number | null;
  status: "open" | "reviewed";
  related_contact_id?: string | null;
  related_campaign_id?: string | null;
  related_deal_id?: string | null;
  created_at: string;
}

export const MOCK_ALERTS: CrmAlert[] = [
  { id: "a1", severity: "critical", alert_type: "cpl_spike", title: "CPL +180% vs. semana anterior", description: "Meta · MX Vivenza Awareness", recommendation: "Pausar adsets con CPL > $900", metric_name: "CPL", current_value: 980, previous_value: 350, status: "open", related_campaign_id: "cmp1", created_at: daysAgo(0.2) },
  { id: "a2", severity: "warning",  alert_type: "spend_no_leads", title: "Gasto sin leads CRM", description: "QRO · Altea · Display lleva 8 días sin atribución en CRM.", recommendation: "Revisar UTMs y mapeo de campañas.", status: "open", related_campaign_id: "cmp4", created_at: daysAgo(1) },
  { id: "a3", severity: "warning",  alert_type: "no_followup", title: "Lead sin follow-up >48h", description: "Andrea Robles · sin actividad desde el alta.", recommendation: "Asignar al asesor de guardia.", status: "open", related_contact_id: "c1", created_at: daysAgo(1.5) },
  { id: "a4", severity: "info",     alert_type: "discrepancy", title: "Meta reporta 31 leads, CRM 28", description: "MX · Vivenza · Conversion", status: "open", related_campaign_id: "cmp2", created_at: daysAgo(2) },
  { id: "a5", severity: "critical", alert_type: "tracking_gap", title: "% sin UTM > 25%", description: "33% de los leads de los últimos 7 días llegaron sin UTM.", status: "open", created_at: daysAgo(3) },
  { id: "a6", severity: "info",     alert_type: "conversion_event", title: "Eventos simulated en Meta CAPI", description: "5 eventos en modo simulated por falta de access token.", status: "reviewed", created_at: daysAgo(5) },
];

// ------------------------- Conversion events --------------------------------
export interface ConversionEvent {
  id: string;
  event_name: string;
  event_time: string;
  meta_status: "sent" | "simulated" | "failed" | "pending" | "skipped";
  google_status: "sent" | "simulated" | "failed" | "pending" | "skipped";
  consent_status: "granted" | "denied" | "unknown";
  event_value: number | null;
  contact: { id: string; full_name: string } | null;
  last_error?: string | null;
}

export const MOCK_CONVERSION_EVENTS: ConversionEvent[] = [
  { id: "ce1", event_name: "Lead",         event_time: daysAgo(0.1), meta_status: "simulated", google_status: "simulated", consent_status: "granted", event_value: null,    contact: { id: "c1", full_name: "Andrea Robles" } },
  { id: "ce2", event_name: "Appointment",  event_time: daysAgo(0.5), meta_status: "sent",      google_status: "sent",      consent_status: "granted", event_value: null,    contact: { id: "c3", full_name: "Carla Méndez" } },
  { id: "ce3", event_name: "Reservation",  event_time: daysAgo(2),   meta_status: "sent",      google_status: "pending",   consent_status: "granted", event_value: 4120000, contact: { id: "c5", full_name: "Elena Vargas" } },
  { id: "ce4", event_name: "Qualified",    event_time: daysAgo(3),   meta_status: "failed",    google_status: "skipped",   consent_status: "unknown", event_value: null,    contact: { id: "c2", full_name: "Bruno Sánchez" }, last_error: "Token Meta caducado" },
  { id: "ce5", event_name: "Lead",         event_time: daysAgo(4),   meta_status: "simulated", google_status: "simulated", consent_status: "granted", event_value: null,    contact: { id: "c4", full_name: "Diego Ortiz" } },
  { id: "ce6", event_name: "Lead",         event_time: daysAgo(6),   meta_status: "sent",      google_status: "sent",      consent_status: "denied",  event_value: null,    contact: { id: "c6", full_name: "Fernanda Soto" } },
];

export const CRM_ORG_NAME = "SOZU · Demo";
