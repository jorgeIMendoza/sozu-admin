import type { KpiBundle } from "@/lib/crm-marketing";
import { fmtMXN, fmtNum, fmtPct } from "@/lib/crm-marketing";

export type CampaignAgg = {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  development_id: string | null;
  data_source: string;
  mapping_status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  qualified_leads: number;
  appointments: number;
  reservations: number;
  contracts: number;
  down_payments: number;
  revenue: number;
};

export function aggregateInsightsByCampaign(
  insights: any[],
  campaigns: any[]
): CampaignAgg[] {
  const byCamp = new Map<string, CampaignAgg>();
  for (const c of campaigns) {
    byCamp.set(c.id, {
      campaign_id: c.id,
      campaign_name: c.campaign_name ?? "—",
      platform: c.platform,
      development_id: c.development_id ?? null,
      data_source: c.data_source ?? "mock",
      mapping_status: c.mapping_status ?? "unmapped",
      spend: 0, impressions: 0, clicks: 0,
      leads: 0, qualified_leads: 0, appointments: 0,
      reservations: 0, contracts: 0, down_payments: 0, revenue: 0,
    });
  }
  for (const r of insights) {
    const c = byCamp.get(r.campaign_id);
    if (!c) continue;
    c.spend += Number(r.spend ?? 0);
    c.impressions += Number(r.impressions ?? 0);
    c.clicks += Number(r.clicks ?? 0);
    c.leads += Number(r.leads ?? 0);
    c.qualified_leads += Number(r.qualified_leads ?? 0);
    c.appointments += Number(r.appointments ?? 0);
    c.reservations += Number(r.reservations ?? 0);
    c.contracts += Number(r.contracts ?? 0);
    c.down_payments += Number(r.down_payments ?? 0);
    c.revenue += Number(r.revenue ?? 0);
  }
  return Array.from(byCamp.values());
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }
function inverseScore(value: number, ideal: number, worst: number) {
  if (value <= ideal) return 100;
  if (value >= worst) return 0;
  return clamp(100 - ((value - ideal) / (worst - ideal)) * 100);
}
function ratioScore(value: number, ideal: number, worst: number) {
  if (value >= ideal) return 100;
  if (value <= worst) return 0;
  return clamp(((value - worst) / (ideal - worst)) * 100);
}

export type CampaignScore = {
  campaign_id: string;
  cpl_score: number;
  cpql_score: number;
  appointment_score: number;
  crm_progress_score: number;
  attribution_score: number;
  cost_efficiency_score: number;
  lead_quality_score: number;
  final_score: number;
  label: "Winner" | "Scale candidate" | "Watch" | "Waste" | "Tracking issue" | "Sales follow-up issue" | "High quality / low volume" | "Cheap but low quality" | "Insufficient data";
};

export function scoreCampaign(
  c: CampaignAgg,
  benchmarks: { cpl: number; cpql: number; leadToAppt: number; apptToReservation: number }
): CampaignScore {
  const cpl = c.leads ? c.spend / c.leads : 0;
  const cpql = c.qualified_leads ? c.spend / c.qualified_leads : 0;
  const leadToAppt = c.leads ? c.appointments / c.leads : 0;
  const apptToRes = c.appointments ? c.reservations / c.appointments : 0;
  const qualRate = c.leads ? c.qualified_leads / c.leads : 0;

  const cpl_score = c.leads ? inverseScore(cpl, benchmarks.cpl * 0.6, benchmarks.cpl * 2.5) : 0;
  const cpql_score = c.qualified_leads ? inverseScore(cpql, benchmarks.cpql * 0.6, benchmarks.cpql * 2.5) : 0;
  const appointment_score = c.leads ? ratioScore(leadToAppt, benchmarks.leadToAppt, benchmarks.leadToAppt * 0.2) : 0;
  const crm_progress_score = c.appointments ? ratioScore(apptToRes, benchmarks.apptToReservation, benchmarks.apptToReservation * 0.2) : 0;
  const attribution_score = c.mapping_status === "mapped" ? 100 : 40;
  const cost_efficiency_score = c.spend ? (cpl_score + cpql_score) / 2 : 0;
  const lead_quality_score = c.leads ? ratioScore(qualRate, 0.35, 0.05) : 0;

  const final_score = Math.round(
    cpl_score * 0.18 +
    cpql_score * 0.18 +
    appointment_score * 0.18 +
    crm_progress_score * 0.18 +
    attribution_score * 0.08 +
    cost_efficiency_score * 0.1 +
    lead_quality_score * 0.1
  );

  let label: CampaignScore["label"] = "Watch";
  if (c.leads < 3 && c.spend < benchmarks.cpl * 2) label = "Insufficient data";
  else if (final_score >= 80 && c.leads >= 5) label = "Winner";
  else if (final_score >= 65 && c.qualified_leads >= 2) label = "Scale candidate";
  else if (c.leads >= 8 && qualRate < 0.1) label = "Cheap but low quality";
  else if (cpl > benchmarks.cpl * 1.5 && qualRate > 0.4) label = "High quality / low volume";
  else if (c.leads >= 5 && leadToAppt < benchmarks.leadToAppt * 0.3) label = "Sales follow-up issue";
  else if (c.mapping_status !== "mapped" && c.leads >= 3) label = "Tracking issue";
  else if (final_score < 35) label = "Waste";

  return {
    campaign_id: c.campaign_id,
    cpl_score: Math.round(cpl_score),
    cpql_score: Math.round(cpql_score),
    appointment_score: Math.round(appointment_score),
    crm_progress_score: Math.round(crm_progress_score),
    attribution_score: Math.round(attribution_score),
    cost_efficiency_score: Math.round(cost_efficiency_score),
    lead_quality_score: Math.round(lead_quality_score),
    final_score,
    label,
  };
}

export const DEFAULT_BENCHMARKS = {
  cpl: 250,
  cpql: 800,
  leadToAppt: 0.25,
  apptToReservation: 0.18,
};

export type AttributionRow = {
  contact_id: string;
  full_name: string;
  source_platform: string | null;
  first_touch_source: string | null;
  last_touch_source: string | null;
  utm_campaign: string | null;
  has_utm: boolean;
  has_clickid: boolean;
  has_campaign_link: boolean;
  created_at: string;
};

export function buildAttributionRows(contacts: any[]): AttributionRow[] {
  return contacts.map((c: any) => {
    const a = c.contact_attribution?.[0] ?? {};
    const has_utm = !!(a.first_touch_source || a.last_touch_source || a.first_touch_campaign);
    const has_clickid = !!(a.fbclid || a.gclid || a.gbraid || a.wbraid || a.msclkid);
    const has_campaign_link = !!(a.meta_campaign_id || a.google_campaign_id || a.first_touch_campaign);
    return {
      contact_id: c.id,
      full_name: c.full_name,
      source_platform: c.source_platform,
      first_touch_source: a.first_touch_source ?? null,
      last_touch_source: a.last_touch_source ?? null,
      utm_campaign: a.first_touch_campaign ?? a.last_touch_campaign ?? null,
      has_utm, has_clickid, has_campaign_link,
      created_at: c.created_at,
    };
  });
}

export type AgentPerf = {
  user_id: string;
  name: string;
  leads_assigned: number;
  leads_contacted: number;
  leads_no_followup: number;
  appointments_scheduled: number;
  appointments_attended: number;
  reservations: number;
  contracts: number;
  down_payments: number;
  revenue: number;
  avg_first_contact_minutes: number | null;
  overdue_tasks: number;
  lead_to_appt_rate: number;
  appt_to_reservation_rate: number;
};

export function aggregateAgentPerf(
  contacts: any[],
  appointments: any[],
  deals: any[],
  tasks: any[],
  profiles: any[]
): AgentPerf[] {
  const nameOf = new Map<string, string>(profiles.map(p => [p.id, p.full_name ?? p.email ?? "—"]));
  const ownerIds = new Set<string>();
  contacts.forEach(c => c.contact_owner && ownerIds.add(c.contact_owner));
  appointments.forEach(a => a.assigned_to && ownerIds.add(a.assigned_to));
  deals.forEach(d => d.deal_owner && ownerIds.add(d.deal_owner));

  const today = new Date().toISOString().slice(0, 10);

  const rows: AgentPerf[] = Array.from(ownerIds).map(uid => {
    const myContacts = contacts.filter(c => c.contact_owner === uid);
    const myAppts = appointments.filter(a => a.assigned_to === uid);
    const myDeals = deals.filter(d => d.deal_owner === uid || d.closer_id === uid);
    const myTasks = tasks.filter(t => t.assigned_to === uid);

    const contacted = myContacts.filter(c => c.last_contacted_at).length;
    const noFollow = myContacts.filter(c => !c.last_contacted_at).length;
    const apptAtt = myAppts.filter(a => a.status === "attended").length;
    const res = myDeals.filter(d => ["reservation","contract","down_payment","won"].includes(d.deal_stage)).length;
    const cont = myDeals.filter(d => ["contract","down_payment","won"].includes(d.deal_stage)).length;
    const dp = myDeals.filter(d => ["down_payment","won"].includes(d.deal_stage)).length;
    const won = myDeals.filter(d => d.deal_stage === "won");
    const revenue = won.reduce((s, d) => s + Number(d.value ?? 0), 0);

    const firstContacts = myContacts
      .filter(c => c.last_contacted_at && c.created_at)
      .map(c => (new Date(c.last_contacted_at).getTime() - new Date(c.created_at).getTime()) / 60000);
    const avgMin = firstContacts.length ? firstContacts.reduce((s, v) => s + v, 0) / firstContacts.length : null;

    const overdue = myTasks.filter(t => t.due_date && t.due_date < today && t.status !== "done").length;

    return {
      user_id: uid,
      name: nameOf.get(uid) ?? uid.slice(0, 8),
      leads_assigned: myContacts.length,
      leads_contacted: contacted,
      leads_no_followup: noFollow,
      appointments_scheduled: myAppts.length,
      appointments_attended: apptAtt,
      reservations: res,
      contracts: cont,
      down_payments: dp,
      revenue,
      avg_first_contact_minutes: avgMin,
      overdue_tasks: overdue,
      lead_to_appt_rate: myContacts.length ? myAppts.length / myContacts.length : 0,
      appt_to_reservation_rate: myAppts.length ? res / myAppts.length : 0,
    };
  });
  return rows.sort((a, b) => b.revenue - a.revenue || b.reservations - a.reservations);
}

export function scoreLabelTone(label: CampaignScore["label"]) {
  switch (label) {
    case "Winner": return "bg-emerald-500/15 text-emerald-700";
    case "Scale candidate": return "bg-blue-500/15 text-blue-700";
    case "High quality / low volume": return "bg-indigo-500/15 text-indigo-700";
    case "Watch": return "bg-slate-500/15 text-slate-700";
    case "Sales follow-up issue": return "bg-amber-500/15 text-amber-700";
    case "Tracking issue": return "bg-amber-500/15 text-amber-700";
    case "Cheap but low quality": return "bg-orange-500/15 text-orange-700";
    case "Waste": return "bg-red-500/15 text-red-700";
    case "Insufficient data": return "bg-muted text-muted-foreground";
  }
}

export function summarizeKpiToCpDown(k: KpiBundle, ctx: { appointments_attended: number; reservations: number; contracts: number; down_payments: number; revenue: number }) {
  const cp = (v: number) => (v ? k.spend / v : 0);
  return {
    cp_attended: cp(ctx.appointments_attended),
    cp_reservation: cp(ctx.reservations),
    cp_contract: cp(ctx.contracts),
    cp_down: cp(ctx.down_payments),
    revenue: ctx.revenue,
    roas: k.spend ? ctx.revenue / k.spend : 0,
  };
}

export { fmtMXN, fmtNum, fmtPct };
