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

// =================================================================
// Fase 2 · CRM (contactos, deals, citas, tareas, secuencias, etc.)
// =================================================================

export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  working: "En trabajo",
  nurturing: "Nurturing",
  qualified: "Calificado",
  unqualified: "No calificado",
  recycled: "Reciclado",
};

export const LIFECYCLE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Calificado",
  appointment: "Cita",
  reservation: "Reserva",
  contract: "Contrato",
  customer: "Cliente",
  lost: "Perdido",
};

export const DEAL_STAGES: { id: CrmDeal["deal_stage"]; label: string; tone: string }[] = [
  { id: "lead",        label: "Lead",        tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  { id: "qualified",   label: "Calificado",  tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { id: "proposal",    label: "Propuesta",   tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  { id: "negotiation", label: "Negociación", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "won",         label: "Ganado",      tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "lost",        label: "Perdido",     tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
];

export const DEVELOPMENTS = [
  { id: "dv1", name: "Vivenza · CDMX" },
  { id: "dv2", name: "Reserva 360 · GDL" },
  { id: "dv3", name: "Altea · QRO" },
];

export const CRM_OWNERS = [
  { id: "u1", name: "Karla Ríos",    email: "karla@sozu.com" },
  { id: "u2", name: "Miguel Castro", email: "miguel@sozu.com" },
  { id: "u3", name: "Paola Téllez",  email: "paola@sozu.com" },
];

export interface CrmContactFull extends CrmContact {
  development_id: string | null;
  lead_status: string;
  contact_owner: string | null;
  last_activity_at: string | null;
  next_task_at: string | null;
  lead_score: number;
}

export const MOCK_CONTACTS_FULL: CrmContactFull[] = MOCK_CONTACTS.map((c, i) => ({
  ...c,
  development_id: ["dv1","dv2","dv1","dv3","dv1","dv2"][i] ?? null,
  lead_status:    ["new","working","qualified","new","qualified","nurturing"][i] ?? "new",
  contact_owner:  ["u1","u2","u1",null,"u3","u2"][i] ?? null,
  last_activity_at: daysAgo(i * 0.7),
  next_task_at: i % 2 === 0 ? daysAgo(-1 - i) : null,
  lead_score: [82, 65, 91, 22, 88, 45][i] ?? 50,
}));

export const leadScoreColor = (s: number) =>
  s >= 80 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  : s >= 50 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  : "bg-rose-500/15 text-rose-700 dark:text-rose-300";

// ------------------------- Citas -------------------------------------------
export interface CrmAppointment {
  id: string;
  contact_id: string;
  development_id: string | null;
  appointment_type: "call" | "video" | "showroom" | "site_visit";
  scheduled_at: string;
  status: "scheduled" | "attended" | "no_show" | "rescheduled" | "cancelled";
  assigned_to: string | null;
}
export const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", attended: "Asistió", no_show: "No show",
  rescheduled: "Reprogramada", cancelled: "Cancelada",
};
export const APPT_TYPE_LABEL: Record<string, string> = {
  call: "Llamada", video: "Videollamada", showroom: "Showroom", site_visit: "Visita en obra",
};
export const MOCK_APPOINTMENTS: CrmAppointment[] = [
  { id: "ap1", contact_id: "c1", development_id: "dv1", appointment_type: "showroom",  scheduled_at: daysAgo(-1),   status: "scheduled", assigned_to: "u1" },
  { id: "ap2", contact_id: "c2", development_id: "dv2", appointment_type: "video",     scheduled_at: daysAgo(-0.3), status: "scheduled", assigned_to: "u2" },
  { id: "ap3", contact_id: "c3", development_id: "dv1", appointment_type: "site_visit",scheduled_at: daysAgo(0.5),  status: "attended",  assigned_to: "u1" },
  { id: "ap4", contact_id: "c5", development_id: "dv1", appointment_type: "showroom",  scheduled_at: daysAgo(2),    status: "attended",  assigned_to: "u3" },
  { id: "ap5", contact_id: "c4", development_id: "dv3", appointment_type: "call",      scheduled_at: daysAgo(4),    status: "no_show",   assigned_to: "u2" },
];

// ------------------------- Tareas ------------------------------------------
export interface CrmTask {
  id: string;
  title: string;
  contact_id: string | null;
  deal_id: string | null;
  due_at: string;
  status: "open" | "done" | "overdue";
  priority: "low" | "medium" | "high";
  owner_id: string | null;
}
export const MOCK_TASKS: CrmTask[] = [
  { id: "t1", title: "Llamada de bienvenida",       contact_id: "c1", deal_id: null, due_at: daysAgo(-0.5), status: "open",    priority: "high",   owner_id: "u1" },
  { id: "t2", title: "Enviar brochure Reserva 360", contact_id: "c2", deal_id: "d2", due_at: daysAgo(-1),   status: "open",    priority: "medium", owner_id: "u2" },
  { id: "t3", title: "Follow-up post visita",       contact_id: "c3", deal_id: "d3", due_at: daysAgo(1),    status: "overdue", priority: "high",   owner_id: "u1" },
  { id: "t4", title: "Confirmar contrato",          contact_id: "c5", deal_id: "d4", due_at: daysAgo(2),    status: "done",    priority: "high",   owner_id: "u3" },
  { id: "t5", title: "Recuperar lead frío",         contact_id: "c4", deal_id: null, due_at: daysAgo(-3),   status: "open",    priority: "low",    owner_id: "u2" },
];

// ------------------------- Secuencias --------------------------------------
export interface CrmSequence {
  id: string; name: string; channel: "email" | "whatsapp" | "mixto";
  steps: number; enrolled: number; active: boolean; reply_rate: number;
}
export const MOCK_SEQUENCES: CrmSequence[] = [
  { id: "sq1", name: "Bienvenida Vivenza",        channel: "email",    steps: 5, enrolled: 124, active: true,  reply_rate: 0.21 },
  { id: "sq2", name: "Re-enganche frío 30d",      channel: "whatsapp", steps: 3, enrolled:  58, active: true,  reply_rate: 0.34 },
  { id: "sq3", name: "Post visita showroom",      channel: "mixto",    steps: 4, enrolled:  42, active: true,  reply_rate: 0.41 },
  { id: "sq4", name: "Cerrado perdido · win-back",channel: "email",    steps: 6, enrolled:  91, active: false, reply_rate: 0.08 },
];

// ------------------------- Routing -----------------------------------------
export interface CrmRoutingRule {
  id: string; name: string; criteria: string; assign_to: string;
  priority: number; active: boolean;
}
export const MOCK_ROUTING_RULES: CrmRoutingRule[] = [
  { id: "r1", name: "Round robin general",       criteria: "Cualquier fuente",            assign_to: "Equipo comercial", priority: 100, active: true },
  { id: "r2", name: "Meta Ads → Karla",          criteria: "source_platform = meta_ads",  assign_to: "Karla Ríos",       priority: 10,  active: true },
  { id: "r3", name: "Google Ads · GDL → Miguel", criteria: "source = google · dev = GDL", assign_to: "Miguel Castro",    priority: 20,  active: true },
  { id: "r4", name: "Score >= 80 → Paola",       criteria: "lead_score >= 80",            assign_to: "Paola Téllez",     priority: 5,   active: true },
];

// ------------------------- Automatización ----------------------------------
export interface CrmAutomationRule {
  id: string; name: string; trigger: string; action: string; active: boolean; runs_30d: number;
}
export const MOCK_AUTOMATION_RULES: CrmAutomationRule[] = [
  { id: "au1", name: "Asignar tarea al alta",          trigger: "Contacto creado",            action: "Crear tarea 'Primera llamada' a 1h", active: true, runs_30d: 312 },
  { id: "au2", name: "Enrolar Bienvenida",             trigger: "Lifecycle = lead",           action: "Enrolar en secuencia 'Bienvenida Vivenza'", active: true, runs_30d: 287 },
  { id: "au3", name: "Notificar pipeline > 3M",        trigger: "Deal value > 3,000,000 MXN", action: "Notificar a director comercial",      active: true, runs_30d: 14 },
  { id: "au4", name: "Escalar sin follow-up 48h",      trigger: "Sin actividad 48h",          action: "Crear escalación crítica",            active: true, runs_30d: 41 },
  { id: "au5", name: "Cerrar perdido tras 90d frío",   trigger: "Sin actividad 90d",          action: "Mover a 'lost' + win-back",           active: false, runs_30d: 0 },
];

// ------------------------- Escalaciones ------------------------------------
export interface CrmEscalation {
  id: string; contact_id: string; reason: string; severity: "critical" | "warning";
  age_hours: number; assigned_to: string | null; status: "open" | "resolved";
  created_at: string;
}
export const MOCK_ESCALATIONS: CrmEscalation[] = [
  { id: "es1", contact_id: "c1", reason: "Sin follow-up >48h",      severity: "critical", age_hours: 54, assigned_to: "u1",  status: "open",     created_at: daysAgo(2) },
  { id: "es2", contact_id: "c3", reason: "Cita reprogramada 2x",    severity: "warning",  age_hours: 30, assigned_to: "u1",  status: "open",     created_at: daysAgo(1.2) },
  { id: "es3", contact_id: "c4", reason: "Sin propietario asignado",severity: "warning",  age_hours: 72, assigned_to: null,  status: "open",     created_at: daysAgo(3) },
  { id: "es4", contact_id: "c5", reason: "Deal sin próxima tarea",  severity: "critical", age_hours: 96, assigned_to: "u3",  status: "resolved", created_at: daysAgo(4) },
];

// ------------------------- Lead Intelligence -------------------------------
export interface LeadIntelRow {
  contact_id: string; full_name: string; lead_score: number;
  intent: "alto" | "medio" | "bajo"; signals: string[];
  recommended_action: string;
}
export const MOCK_LEAD_INTEL: LeadIntelRow[] = [
  { contact_id: "c3", full_name: "Carla Méndez",  lead_score: 91, intent: "alto",  signals: ["3 visitas a oferta", "Descargó brochure", "Respondió WhatsApp"], recommended_action: "Agendar visita en obra esta semana" },
  { contact_id: "c5", full_name: "Elena Vargas",  lead_score: 88, intent: "alto",  signals: ["Cita asistida", "Solicitó plan de pagos"],                       recommended_action: "Enviar propuesta formal" },
  { contact_id: "c1", full_name: "Andrea Robles", lead_score: 82, intent: "alto",  signals: ["Click en CTA Meta", "Llenó formulario"],                          recommended_action: "Primera llamada de calificación" },
  { contact_id: "c2", full_name: "Bruno Sánchez", lead_score: 65, intent: "medio", signals: ["Open email x2"],                                                  recommended_action: "Reenviar comparativo de modelos" },
  { contact_id: "c6", full_name: "Fernanda Soto", lead_score: 45, intent: "medio", signals: ["Vio página de precios"],                                          recommended_action: "Nurturing 30 días" },
  { contact_id: "c4", full_name: "Diego Ortiz",   lead_score: 22, intent: "bajo",  signals: ["Sin actividad reciente"],                                         recommended_action: "Mover a win-back" },
];

// ------------------------- Agent performance -------------------------------
export interface AgentPerfRow {
  owner_id: string; name: string;
  contacts: number; appointments: number; deals_open: number; deals_won: number;
  pipeline: number; revenue_won: number; response_min: number;
}
export const MOCK_AGENT_PERF: AgentPerfRow[] = [
  { owner_id: "u1", name: "Karla Ríos",    contacts: 84, appointments: 22, deals_open: 18, deals_won: 6, pipeline:  9_200_000, revenue_won: 12_300_000, response_min: 14 },
  { owner_id: "u2", name: "Miguel Castro", contacts: 67, appointments: 17, deals_open: 12, deals_won: 4, pipeline:  6_800_000, revenue_won:  8_950_000, response_min: 28 },
  { owner_id: "u3", name: "Paola Téllez",  contacts: 71, appointments: 26, deals_open: 21, deals_won: 9, pipeline: 11_500_000, revenue_won: 15_700_000, response_min:  9 },
];

// ------------------------- Sales operations --------------------------------
export interface SalesOpsKpi { label: string; value: string; hint?: string }
export const MOCK_SALES_OPS: { kpis: SalesOpsKpi[]; pipelineByStage: { stage: string; count: number; value: number }[]; conversionFunnel: { step: string; value: number }[] } = {
  kpis: [
    { label: "Tasa de conversión Lead → Cita", value: "23.4%", hint: "vs 19.8% mes previo" },
    { label: "Velocidad promedio del deal",    value: "38 d",  hint: "Lead → Contrato" },
    { label: "Ticket promedio",                value: "$2.87M",hint: "Cerrado ganado · 30d" },
    { label: "SLA primer contacto",            value: "92%",   hint: "< 30 min" },
  ],
  pipelineByStage: DEAL_STAGES.map((s) => {
    const ds = MOCK_DEALS.filter((d) => d.deal_stage === s.id);
    return { stage: s.label, count: ds.length, value: ds.reduce((x, d) => x + d.value, 0) };
  }),
  conversionFunnel: [
    { step: "Leads",         value: 412 },
    { step: "Calificados",   value: 184 },
    { step: "Citas",         value:  96 },
    { step: "Propuestas",    value:  47 },
    { step: "Reservas",      value:  22 },
    { step: "Contratos",     value:  14 },
  ],
};

// ------------------------- Helpers de lookup -------------------------------
export const contactById      = (id: string) => MOCK_CONTACTS_FULL.find((c) => c.id === id);
export const ownerName        = (id: string | null) => CRM_OWNERS.find((o) => o.id === id)?.name ?? "Sin asignar";
export const developmentName  = (id: string | null) => DEVELOPMENTS.find((d) => d.id === id)?.name ?? "—";
