export type DealStage =
  | "new" | "qualified" | "appointment_scheduled" | "appointment_attended"
  | "offer_sent" | "reservation" | "contract" | "down_payment" | "won" | "lost";

export const STAGE_PROBABILITY: Record<string, number> = {
  new: 0.05, contacted: 0.10, qualified: 0.20, appointment_scheduled: 0.30,
  appointment_attended: 0.40, offer_sent: 0.50, reservation: 0.65,
  contract: 0.80, down_payment: 0.95, won: 1.00, lost: 0.00,
};

export const STAGE_ORDER: DealStage[] = [
  "new", "qualified", "appointment_scheduled", "appointment_attended",
  "offer_sent", "reservation", "contract", "down_payment", "won", "lost",
];

export function stageProbability(stage?: string | null): number {
  if (!stage) return 0;
  return STAGE_PROBABILITY[stage] ?? 0;
}

export type Scenario = "conservative" | "base" | "aggressive";

export function scenarioProbability(stage: string | null | undefined, scenario: Scenario): number {
  const base = stageProbability(stage);
  if (scenario === "conservative") return Math.max(0, base * 0.7);
  if (scenario === "aggressive") return Math.min(1, base * 1.2);
  return base;
}

export type DealLike = {
  id: string;
  value: number | null;
  deal_stage: string;
  development_id?: string | null;
  deal_owner?: string | null;
  source_campaign_id?: string | null;
  source_platform?: string | null;
  created_at?: string | null;
  expected_close_date?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  contact_id?: string | null;
};

export type EnrichedDeal = DealLike & {
  value_safe: number;
  probability: number;
  weighted: number;
  conservative: number;
  base: number;
  aggressive: number;
  is_won: boolean;
  is_lost: boolean;
  is_open: boolean;
  days_in_stage: number;
  deal_age_days: number;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_reason: string;
  recommended_action: string;
};

function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

const STAGE_BUDGET_DAYS: Record<string, number> = {
  new: 2, qualified: 5, appointment_scheduled: 7, appointment_attended: 7,
  offer_sent: 10, reservation: 14, contract: 21, down_payment: 21,
};

export function enrichDeal(d: DealLike): EnrichedDeal {
  const value = Number(d.value ?? 0);
  const p = stageProbability(d.deal_stage);
  const is_won = d.deal_stage === "won";
  const is_lost = d.deal_stage === "lost";
  const is_open = !is_won && !is_lost;
  const days_in_stage = daysSince(d.created_at);
  const deal_age_days = daysSince(d.created_at);
  const budget = STAGE_BUDGET_DAYS[d.deal_stage] ?? 14;
  let risk_level: EnrichedDeal["risk_level"] = "low";
  let reason = "Dentro de SLA.";
  let action = "Continuar seguimiento.";
  if (is_open) {
    if (days_in_stage > budget * 2) { risk_level = "critical"; reason = `Estancado ${days_in_stage}d en ${d.deal_stage} (>2x SLA).`; action = "Escalar o cerrar como perdido."; }
    else if (days_in_stage > budget) { risk_level = "high"; reason = `Sobre SLA en ${d.deal_stage} (${days_in_stage}/${budget}d).`; action = "Llamar hoy y registrar próxima acción."; }
    else if (days_in_stage > budget * 0.7) { risk_level = "medium"; reason = `Aproximando SLA (${days_in_stage}/${budget}d).`; action = "Confirmar siguiente paso."; }
    if (value >= 5_000_000 && risk_level === "low") action = "Deal alto valor — priorizar seguimiento.";
  }
  return {
    ...d,
    value_safe: value,
    probability: p,
    weighted: value * p,
    conservative: value * scenarioProbability(d.deal_stage, "conservative"),
    base: value * scenarioProbability(d.deal_stage, "base"),
    aggressive: value * scenarioProbability(d.deal_stage, "aggressive"),
    is_won, is_lost, is_open,
    days_in_stage, deal_age_days,
    risk_level, risk_reason: reason, recommended_action: action,
  };
}

export type GroupBy = "development_id" | "deal_owner" | "source_campaign_id" | "source_platform" | "deal_stage" | "month";

export function groupForecast(deals: EnrichedDeal[], by: GroupBy) {
  const map = new Map<string, {
    key: string; deals: number; pipeline: number; weighted: number;
    conservative: number; base: number; aggressive: number;
    won: number; lost: number; open: number; avg_deal: number;
  }>();
  for (const d of deals) {
    let key: string;
    if (by === "month") {
      const dt = d.created_at ? new Date(d.created_at) : new Date();
      key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    } else {
      key = (d as any)[by] ?? "unattributed";
    }
    const cur = map.get(key) ?? { key, deals: 0, pipeline: 0, weighted: 0, conservative: 0, base: 0, aggressive: 0, won: 0, lost: 0, open: 0, avg_deal: 0 };
    cur.deals += 1;
    cur.pipeline += d.is_open ? d.value_safe : 0;
    cur.weighted += d.is_open ? d.weighted : 0;
    cur.conservative += d.is_open ? d.conservative : 0;
    cur.base += d.is_open ? d.base : 0;
    cur.aggressive += d.is_open ? d.aggressive : 0;
    if (d.is_won) cur.won += d.value_safe;
    if (d.is_lost) cur.lost += d.value_safe;
    if (d.is_open) cur.open += d.value_safe;
    map.set(key, cur);
  }
  const rows = Array.from(map.values()).map(r => ({ ...r, avg_deal: r.deals ? Math.round((r.pipeline + r.won) / r.deals) : 0 }));
  rows.sort((a, b) => b.weighted - a.weighted);
  return rows;
}

export function totals(deals: EnrichedDeal[]) {
  let pipeline = 0, weighted = 0, conservative = 0, base = 0, aggressive = 0, won = 0, lost = 0, open_count = 0;
  for (const d of deals) {
    if (d.is_open) { pipeline += d.value_safe; weighted += d.weighted; conservative += d.conservative; base += d.base; aggressive += d.aggressive; open_count += 1; }
    if (d.is_won) won += d.value_safe;
    if (d.is_lost) lost += d.value_safe;
  }
  const at_risk = deals.filter(d => d.is_open && (d.risk_level === "high" || d.risk_level === "critical"));
  const at_risk_value = at_risk.reduce((s, d) => s + d.weighted, 0);
  const avg_deal_size = open_count ? Math.round(pipeline / open_count) : 0;
  return { pipeline, weighted, conservative, base, aggressive, won, lost, open_count, at_risk_count: at_risk.length, at_risk_value, avg_deal_size };
}

export function stalledDeals(deals: EnrichedDeal[]) {
  return deals.filter(d => d.is_open && (d.risk_level === "high" || d.risk_level === "critical"))
    .sort((a, b) => b.weighted - a.weighted);
}

export function fmtMoney(n: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
}

export const RISK_TONE: Record<EnrichedDeal["risk_level"], string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const SCENARIO_TONE: Record<Scenario, string> = {
  conservative: "text-slate-700 dark:text-slate-300",
  base: "text-blue-700 dark:text-blue-400",
  aggressive: "text-emerald-700 dark:text-emerald-400",
};
