import { fmtMXN } from "@/lib/crm-lib";

export type Platform = "meta_ads" | "google_ads" | "tiktok_ads" | "manual";

export const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  manual: "Manual",
  crm: "CRM",
};

export type DateRange = "7d" | "30d" | "90d" | "ytd";
export const RANGE_LABEL: Record<DateRange, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  ytd: "Año en curso",
};

export function rangeToSince(range: DateRange): string {
  if (range === "ytd") {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}
export function rangeToPrevSince(range: DateRange): { since: string; until: string } {
  if (range === "ytd") {
    const d = new Date();
    const start = new Date(d.getFullYear() - 1, 0, 1);
    const end = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
    return { since: start.toISOString().slice(0, 10), until: end.toISOString().slice(0, 10) };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const until = new Date(Date.now() - days * 86400000);
  const since = new Date(until.getTime() - days * 86400000);
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

export type InsightRow = {
  date: string;
  platform: string;
  campaign_id: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  link_clicks?: number | null;
  reach?: number | null;
  frequency?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  leads: number | null;
  qualified_leads: number | null;
  appointments: number | null;
  reservations: number | null;
  contracts: number | null;
  down_payments: number | null;
  revenue?: number | null;
  conversions?: number | null;
};

export type KpiBundle = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  cpl: number;
  qualified_leads: number;
  cpql: number;
  appointments: number;
  cpa: number;
  attended: number;
  cp_attended: number;
  reservations: number;
  cp_reservation: number;
  contracts: number;
  cp_contract: number;
  down_payments: number;
  cp_down: number;
  revenue: number;
  conv_rate: number;
};

export function sumInsights(rows: InsightRow[]): KpiBundle {
  const spend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const leads = rows.reduce((s, r) => s + (r.leads ?? 0), 0);
  const ql = rows.reduce((s, r) => s + (r.qualified_leads ?? 0), 0);
  const appts = rows.reduce((s, r) => s + (r.appointments ?? 0), 0);
  const res = rows.reduce((s, r) => s + (r.reservations ?? 0), 0);
  const cont = rows.reduce((s, r) => s + (r.contracts ?? 0), 0);
  const dp = rows.reduce((s, r) => s + (r.down_payments ?? 0), 0);
  const rev = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend, impressions, clicks,
    ctr: impressions ? clicks / impressions : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    leads, cpl: leads ? spend / leads : 0,
    qualified_leads: ql, cpql: ql ? spend / ql : 0,
    appointments: appts, cpa: appts ? spend / appts : 0,
    attended: 0, cp_attended: 0,
    reservations: res, cp_reservation: res ? spend / res : 0,
    contracts: cont, cp_contract: cont ? spend / cont : 0,
    down_payments: dp, cp_down: dp ? spend / dp : 0,
    revenue: rev,
    conv_rate: clicks ? leads / clicks : 0,
  };
}

export function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return (curr - prev) / prev;
}

export function fmtPct(v: number, digits = 2) {
  return `${(v * 100).toFixed(digits)}%`;
}
export function fmtNum(v: number) {
  return new Intl.NumberFormat("es-MX").format(v);
}
export { fmtMXN };

export const FUNNEL_STAGES = [
  { id: "awareness", label: "Awareness" },
  { id: "consideration", label: "Consideration" },
  { id: "conversion", label: "Conversion" },
  { id: "retention", label: "Retention" },
] as const;

export const CAMPAIGN_STATUS = ["active", "paused", "archived"] as const;
