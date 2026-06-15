// Phase 2G-Mock — Executive Decision Intelligence helpers.
// Pure functions. No real APIs. data_source = "mock".

import { enrichDeal, totals as fcTotals, type EnrichedDeal, type DealLike } from "@/lib/crm-forecasting";

export type HealthState = "healthy" | "watch" | "at_risk" | "critical";

export type DecisionCategory =
  | "marketing" | "crm" | "sales_ops" | "revenue" | "tracking" | "builder";

export type Decision = {
  id: string;
  dedupe_key: string;
  category: DecisionCategory;
  priority_score: number; // 0-100
  title: string;
  why_it_matters: string;
  recommended_action: string;
  impact_estimate: string;
  related_contact_id?: string | null;
  related_deal_id?: string | null;
  related_campaign_id?: string | null;
  related_advisor_id?: string | null;
  due_urgency: "today" | "this_week" | "this_month";
};

export type DashboardInputs = {
  contacts: any[];
  deals: DealLike[];
  appointments: any[];
  tasks: any[];
  campaigns: any[];
  insights: any[];
  drafts: any[];
  alerts: any[];
};

function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }

export function calculateBusinessHealthScore(input: DashboardInputs) {
  const enriched = input.deals.map(enrichDeal);
  const open = enriched.filter(d => d.is_open);
  const weighted = open.reduce((s, d) => s + d.weighted, 0);
  const atRisk = open.filter(d => d.risk_level === "high" || d.risk_level === "critical")
    .reduce((s, d) => s + d.value_safe, 0);

  // Revenue forecast health
  const totalOpenValue = open.reduce((s, d) => s + d.value_safe, 0);
  const revenueHealth = totalOpenValue > 0 ? Math.max(0, 100 - Math.round((atRisk / totalOpenValue) * 100)) : 70;

  // SLA health: % of contacts with last_contacted <= 2d
  const activeContacts = input.contacts.filter(c => !["lost", "unqualified"].includes(c.lead_status));
  const onTrack = activeContacts.filter(c => {
    if (!c.last_contacted_at) return false;
    return (Date.now() - new Date(c.last_contacted_at).getTime()) < 2 * 86400000;
  }).length;
  const slaHealth = pct(onTrack, Math.max(activeContacts.length, 1));

  // Lead quality health
  const recent = activeContacts.filter(c => (Date.now() - new Date(c.created_at).getTime()) < 30 * 86400000);
  const ql = recent.filter(c => ["qualified", "engaged"].includes(c.lead_status)).length;
  const leadHealth = pct(ql, Math.max(recent.length, 1));

  // Campaign quality health (mock: CPL bands)
  let goodCamps = 0, totalCamps = 0;
  const insByCamp = new Map<string, { spend: number; leads: number }>();
  input.insights.forEach((r: any) => {
    const k = r.campaign_id; if (!k) return;
    const cur = insByCamp.get(k) ?? { spend: 0, leads: 0 };
    cur.spend += Number(r.spend ?? 0); cur.leads += r.leads ?? 0;
    insByCamp.set(k, cur);
  });
  insByCamp.forEach(v => {
    if (v.leads >= 3) { totalCamps++; if (v.spend / v.leads < 1200) goodCamps++; }
  });
  const campaignHealth = pct(goodCamps, Math.max(totalCamps, 1)) || 60;

  // Attribution health: approximated from contact_attribution shape in caller
  const attributionHealth = 70;

  // Pipeline velocity health
  const stalled = enriched.filter(d => d.is_open && (d.risk_level === "high" || d.risk_level === "critical")).length;
  const velocityHealth = open.length ? Math.max(0, 100 - Math.round((stalled / open.length) * 100)) : 80;

  const composite = Math.round(
    revenueHealth * 0.30 +
    slaHealth * 0.20 +
    leadHealth * 0.15 +
    campaignHealth * 0.15 +
    attributionHealth * 0.10 +
    velocityHealth * 0.10
  );

  const label: HealthState =
    composite >= 80 ? "healthy" :
    composite >= 60 ? "watch" :
    composite >= 40 ? "at_risk" : "critical";

  return {
    score: composite,
    label,
    components: {
      revenue: revenueHealth,
      sla: slaHealth,
      lead_quality: leadHealth,
      campaign_quality: campaignHealth,
      attribution: attributionHealth,
      velocity: velocityHealth,
    },
    metrics: { weighted_pipeline: weighted, revenue_at_risk: atRisk },
    data_source: "mock" as const,
  };
}

export function buildDecisionQueue(input: DashboardInputs): Decision[] {
  const out: Decision[] = [];
  const enriched = input.deals.map(enrichDeal);

  // Hot leads without follow-up
  input.contacts.forEach(c => {
    if (!["qualified", "engaged"].includes(c.lead_status)) return;
    const last = c.last_contacted_at ? new Date(c.last_contacted_at).getTime() : 0;
    const staleDays = (Date.now() - last) / 86400000;
    if (staleDays > 2) {
      out.push({
        id: `hot-${c.id}`,
        dedupe_key: `hot_lead_stale:${c.id}`,
        category: "crm",
        priority_score: Math.min(95, 70 + Math.round(staleDays * 2)),
        title: `Hot lead sin seguimiento: ${c.full_name}`,
        why_it_matters: `Lead caliente ${Math.round(staleDays)}d sin contacto — riesgo de pérdida.`,
        recommended_action: "Contactar hoy y crear tarea de follow-up.",
        impact_estimate: "Recupera probabilidad de cierre del lead caliente.",
        related_contact_id: c.id,
        related_advisor_id: c.contact_owner,
        due_urgency: "today",
      });
    }
  });

  // Stalled high-value deals
  enriched.filter(d => d.is_open && d.weighted > 100000 && (d.risk_level === "high" || d.risk_level === "critical"))
    .forEach(d => {
      out.push({
        id: `stalled-${d.id}`,
        dedupe_key: `deal_stalled:${d.id}`,
        category: "revenue",
        priority_score: Math.min(98, 60 + Math.round(d.weighted / 50000)),
        title: `Deal estancado de alto valor`,
        why_it_matters: `Weighted ${Math.round(d.weighted).toLocaleString("es-MX")} MXN en etapa ${d.deal_stage} hace ${d.days_in_stage}d.`,
        recommended_action: d.recommended_action,
        impact_estimate: `Revenue en riesgo: ${Math.round(d.value_safe).toLocaleString("es-MX")} MXN`,
        related_deal_id: d.id,
        related_contact_id: d.contact_id ?? null,
        related_advisor_id: d.deal_owner ?? null,
        due_urgency: "this_week",
      });
    });

  // Campaign spend without pipeline
  const insByCamp = new Map<string, { spend: number; leads: number }>();
  input.insights.forEach((r: any) => {
    const k = r.campaign_id; if (!k) return;
    const cur = insByCamp.get(k) ?? { spend: 0, leads: 0 };
    cur.spend += Number(r.spend ?? 0); cur.leads += r.leads ?? 0;
    insByCamp.set(k, cur);
  });
  input.campaigns.forEach(camp => {
    const v = insByCamp.get(camp.id);
    if (!v) return;
    if (v.spend > 5000 && v.leads === 0) {
      out.push({
        id: `noleads-${camp.id}`,
        dedupe_key: `campaign_spend_no_pipeline:${camp.id}`,
        category: "marketing",
        priority_score: 80,
        title: `Campaña gastando sin pipeline: ${camp.campaign_name}`,
        why_it_matters: `${Math.round(v.spend).toLocaleString("es-MX")} MXN gastados, 0 leads en 30d.`,
        recommended_action: "Pausar y revisar segmentación / creatividad.",
        impact_estimate: `Ahorro potencial ${Math.round(v.spend).toLocaleString("es-MX")} MXN.`,
        related_campaign_id: camp.id,
        due_urgency: "this_week",
      });
    }
  });

  // Drafts ready (campaign builder)
  input.drafts.filter(d => d.status === "approved" || d.status === "ready_to_publish").slice(0, 5).forEach(d => {
    out.push({
      id: `draft-${d.id}`,
      dedupe_key: `draft_ready:${d.id}`,
      category: "builder",
      priority_score: 55,
      title: `Draft listo: ${d.campaign_name}`,
      why_it_matters: "Aprobado y pendiente de publicar (mock).",
      recommended_action: "Revisar checklist y publicar (mock).",
      impact_estimate: `Budget ${Math.round(Number(d.budget ?? 0)).toLocaleString("es-MX")} MXN.`,
      due_urgency: "this_week",
    });
  });

  // Open alerts mapped to decisions
  input.alerts.slice(0, 20).forEach((a: any) => {
    const score = a.severity === "critical" ? 85 : a.severity === "warning" ? 60 : 30;
    out.push({
      id: `alert-${a.id}`,
      dedupe_key: `alert:${a.id}`,
      category: a.alert_type?.includes("campaign") ? "marketing"
        : a.alert_type?.includes("conv") || a.alert_type?.includes("tracking") ? "tracking"
        : a.alert_type?.includes("advisor") || a.alert_type?.includes("sla") ? "sales_ops"
        : "crm",
      priority_score: score,
      title: a.title,
      why_it_matters: a.description ?? "",
      recommended_action: a.recommendation ?? "Revisar y resolver.",
      impact_estimate: "Ver detalle en alertas.",
      related_contact_id: a.related_contact_id,
      related_campaign_id: a.related_campaign_id,
      related_deal_id: a.related_deal_id,
      due_urgency: a.severity === "critical" ? "today" : "this_week",
    });
  });

  // Dedupe + sort
  const seen = new Set<string>();
  const deduped: Decision[] = [];
  out.sort((a, b) => b.priority_score - a.priority_score).forEach(d => {
    if (seen.has(d.dedupe_key)) return;
    seen.add(d.dedupe_key);
    deduped.push(d);
  });
  return deduped.slice(0, 50);
}

export function detectTopRisks(input: DashboardInputs) {
  const enriched = input.deals.map(enrichDeal);
  const risks: Array<{ title: string; severity: HealthState; detail: string }> = [];

  const atRiskValue = enriched.filter(d => d.is_open && (d.risk_level === "high" || d.risk_level === "critical"))
    .reduce((s, d) => s + d.value_safe, 0);
  if (atRiskValue > 0) {
    risks.push({
      title: "Revenue en riesgo en pipeline activo",
      severity: atRiskValue > 500000 ? "critical" : "at_risk",
      detail: `${Math.round(atRiskValue).toLocaleString("es-MX")} MXN en deals estancados.`,
    });
  }

  const hotStale = input.contacts.filter(c =>
    ["qualified", "engaged"].includes(c.lead_status)
    && (!c.last_contacted_at || (Date.now() - new Date(c.last_contacted_at).getTime()) > 2 * 86400000)
  ).length;
  if (hotStale > 0) {
    risks.push({
      title: "Leads calientes sin seguimiento",
      severity: hotStale > 10 ? "critical" : "at_risk",
      detail: `${hotStale} leads hot >2d sin contacto.`,
    });
  }

  const overdueTasks = input.tasks.filter((t: any) =>
    t.status === "pending" && t.due_date && new Date(t.due_date).getTime() < Date.now()
  ).length;
  if (overdueTasks > 0) {
    risks.push({
      title: "Tareas vencidas",
      severity: overdueTasks > 20 ? "critical" : "watch",
      detail: `${overdueTasks} tareas pendientes pasadas.`,
    });
  }

  return risks.slice(0, 6);
}

export function detectTopOpportunities(input: DashboardInputs) {
  const opps: Array<{ title: string; detail: string }> = [];
  const enriched = input.deals.map(enrichDeal);

  // High-weighted near-close deals
  const close = enriched.filter(d => d.is_open && ["reservation", "contract", "down_payment"].includes(d.deal_stage))
    .sort((a, b) => b.weighted - a.weighted).slice(0, 3);
  close.forEach(d => {
    opps.push({
      title: `Cierre cercano: deal ${d.id.slice(0, 8)}`,
      detail: `Weighted ${Math.round(d.weighted).toLocaleString("es-MX")} MXN en ${d.deal_stage}.`,
    });
  });

  // Best campaigns
  const insByCamp = new Map<string, { spend: number; leads: number; ql: number }>();
  input.insights.forEach((r: any) => {
    const k = r.campaign_id; if (!k) return;
    const cur = insByCamp.get(k) ?? { spend: 0, leads: 0, ql: 0 };
    cur.spend += Number(r.spend ?? 0); cur.leads += r.leads ?? 0; cur.ql += r.qualified_leads ?? 0;
    insByCamp.set(k, cur);
  });
  const winners = input.campaigns.map(c => {
    const v = insByCamp.get(c.id) ?? { spend: 0, leads: 0, ql: 0 };
    const cpql = v.ql ? v.spend / v.ql : Infinity;
    return { name: c.campaign_name, cpql, ql: v.ql };
  }).filter(c => c.ql >= 3).sort((a, b) => a.cpql - b.cpql).slice(0, 2);
  winners.forEach(w => {
    opps.push({
      title: `Escalar campaña: ${w.name}`,
      detail: `CPQL ${Math.round(w.cpql).toLocaleString("es-MX")} con ${w.ql} QL.`,
    });
  });

  return opps.slice(0, 6);
}

export function recommendExecutiveActions(decisions: Decision[]) {
  return decisions.slice(0, 7).map(d => ({
    title: d.title,
    action: d.recommended_action,
    category: d.category,
    priority: d.priority_score,
  }));
}

export function generateWeeklyDigestMock(input: DashboardInputs) {
  const enriched = input.deals.map(enrichDeal);
  const t = fcTotals(enriched);
  const health = calculateBusinessHealthScore(input);
  const risks = detectTopRisks(input);
  const opps = detectTopOpportunities(input);
  const queue = buildDecisionQueue(input);
  const totalSpend = input.insights.reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
  const totalLeads = input.insights.reduce((s: number, r: any) => s + (r.leads ?? 0), 0);
  return {
    data_source: "mock" as const,
    generated_at: new Date().toISOString(),
    summary: `Business health: ${health.score}/100 (${health.label}). Weighted pipeline ${Math.round(t.weighted).toLocaleString("es-MX")} MXN, ${queue.length} decisiones pendientes.`,
    marketing: { spend: totalSpend, leads: totalLeads, cpl: totalLeads ? Math.round(totalSpend / totalLeads) : null },
    revenue: t,
    wins: opps.slice(0, 3),
    risks: risks.slice(0, 4),
    top_actions: recommendExecutiveActions(queue),
    health,
  };
}

export function buildExecutiveSummary(input: DashboardInputs) {
  const digest = generateWeeklyDigestMock(input);
  const lines: string[] = [];
  lines.push(`Resumen ejecutivo (mock data — generado ${new Date().toLocaleDateString("es-MX")})`);
  lines.push("");
  lines.push(digest.summary);
  lines.push("");
  lines.push(`Marketing: spend ${Math.round(digest.marketing.spend).toLocaleString("es-MX")} MXN · ${digest.marketing.leads} leads · CPL ${digest.marketing.cpl ?? "-"}.`);
  lines.push(`Revenue: weighted ${Math.round(digest.revenue.weighted).toLocaleString("es-MX")} · base ${Math.round(digest.revenue.base).toLocaleString("es-MX")} · won ${Math.round(digest.revenue.won).toLocaleString("es-MX")}.`);
  if (digest.risks.length) {
    lines.push("");
    lines.push("Top riesgos:");
    digest.risks.forEach(r => lines.push(`• ${r.title} — ${r.detail}`));
  }
  if (digest.top_actions.length) {
    lines.push("");
    lines.push("Acciones prioritarias:");
    digest.top_actions.forEach(a => lines.push(`• [${a.category}] ${a.title} — ${a.action}`));
  }
  return lines.join("\n");
}

export function scoreDecisionPriority(d: Partial<Decision>): number {
  return Math.max(0, Math.min(100, d.priority_score ?? 50));
}

export const HEALTH_TONE: Record<HealthState, string> = {
  healthy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  watch: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const CATEGORY_TONE: Record<DecisionCategory, string> = {
  marketing: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  crm: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sales_ops: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  revenue: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  tracking: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  builder: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
};
