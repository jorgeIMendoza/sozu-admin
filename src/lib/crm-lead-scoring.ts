export type ScoreBreakdown = {
  score: number;
  label: string;
  reasons: string[];
  recommendation: string;
};

export type LeadIntelligenceInput = {
  contact: any;
  attribution?: any | null;
  notes?: any[];
  tasks?: any[];
  appointments?: any[];
  deals?: any[];
  conversionEvents?: any[];
  campaignQuality?: number | null;
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function computeFitScore(input: LeadIntelligenceInput): ScoreBreakdown {
  const c = input.contact ?? {};
  let s = 30;
  const reasons: string[] = [];

  if (c.development_id) { s += 12; reasons.push("Desarrollo de interés definido"); }
  if (c.budget_range && c.budget_range !== "low") { s += 10; reasons.push(`Presupuesto: ${c.budget_range}`); }
  if (c.buying_intent === "high") { s += 15; reasons.push("Intención alta"); }
  else if (c.buying_intent === "medium") { s += 8; }
  if (c.timeline_to_buy === "0-3m") { s += 12; reasons.push("Timeline corto (0-3m)"); }
  else if (c.timeline_to_buy === "3-6m") { s += 6; }
  if (c.financing_need) { s += 4; }
  if (c.email && c.phone && c.full_name) { s += 6; reasons.push("Datos completos"); }
  else { reasons.push("Datos incompletos"); }
  if (input.campaignQuality != null) {
    const cq = Math.round((input.campaignQuality - 50) / 5);
    s += cq;
    if (input.campaignQuality >= 70) reasons.push("Campaña de origen de alta calidad");
  }
  const score = clamp(s);
  let label = "Bad fit";
  if (score >= 75) label = "Strong fit";
  else if (score >= 55) label = "Good fit";
  else if (score >= 40) label = "Weak fit";

  return {
    score, label, reasons,
    recommendation:
      score >= 70 ? "Priorizar contacto inmediato y agendar cita"
      : score >= 45 ? "Calificar mejor antes de invertir tiempo comercial"
      : "Descalificar o nurturing largo plazo",
  };
}

export function computeEngagementScore(input: LeadIntelligenceInput): ScoreBreakdown {
  const notes = input.notes?.length ?? 0;
  const tasksDone = (input.tasks ?? []).filter((t) => t.status === "completed").length;
  const appts = input.appointments?.length ?? 0;
  const apptsAttended = (input.appointments ?? []).filter((a) => a.status === "attended").length;
  const deals = input.deals?.length ?? 0;

  let s = 0;
  const reasons: string[] = [];
  s += Math.min(notes * 5, 20);
  if (notes) reasons.push(`${notes} notas`);
  s += Math.min(tasksDone * 6, 18);
  if (tasksDone) reasons.push(`${tasksDone} tareas completadas`);
  s += Math.min(appts * 8, 24);
  if (appts) reasons.push(`${appts} citas creadas`);
  s += apptsAttended * 10;
  if (apptsAttended) reasons.push(`${apptsAttended} citas asistidas`);
  if (deals) { s += 10; reasons.push("Deal asociado"); }

  const d = daysSince(input.contact?.last_activity_at);
  if (d != null && d <= 1) s += 8;
  else if (d != null && d <= 7) s += 4;

  const score = clamp(s);
  let label = "Low engagement";
  if (score >= 70) label = "Highly engaged";
  else if (score >= 40) label = "Engaged";
  else if (score >= 20) label = "Light engagement";

  return {
    score, label, reasons,
    recommendation:
      score >= 65 ? "Mover a etapa comercial avanzada"
      : score >= 35 ? "Mantener cadencia de seguimiento"
      : "Activar secuencia de re-engagement",
  };
}

export function computeRecencyScore(input: LeadIntelligenceInput): ScoreBreakdown {
  const c = input.contact ?? {};
  const dContact = daysSince(c.last_contacted_at);
  const dActivity = daysSince(c.last_activity_at);
  const dCreated = daysSince(c.created_at);
  let s = 100;
  const reasons: string[] = [];

  if (dActivity == null && dContact == null) { s -= 40; reasons.push("Sin actividad ni contacto registrado"); }
  else {
    const d = Math.min(dActivity ?? 999, dContact ?? 999);
    if (d <= 1) reasons.push("Actividad muy reciente");
    else if (d <= 3) s -= 10;
    else if (d <= 7) s -= 25;
    else if (d <= 14) s -= 45;
    else s -= 70;
    if (d > 7) reasons.push(`Sin contacto desde hace ${d}d`);
  }
  if (dCreated != null && dCreated > 1 && !c.last_contacted_at) {
    s -= 20;
    reasons.push("Lead nuevo nunca contactado");
  }

  const score = clamp(s);
  let label = "Fresh";
  if (score < 30) label = "Stale";
  else if (score < 60) label = "Cooling";

  return {
    score, label, reasons,
    recommendation:
      score < 30 ? "Reactivar hoy o marcar como perdido"
      : score < 60 ? "Programar siguiente contacto en 48h"
      : "Mantener cadencia habitual",
  };
}

export function computeAttributionScore(input: LeadIntelligenceInput): ScoreBreakdown {
  const a = input.attribution ?? {};
  const hasUTM = !!(a.first_touch_source || a.last_touch_source);
  const hasClickId = !!(a.fbclid || a.gclid);
  const hasCampaign = !!(a.meta_campaign_id || a.google_campaign_id);
  const hasPlatform = !!input.contact?.source_platform;
  const hasConvEvent = (input.conversionEvents?.length ?? 0) > 0;

  let s = 20;
  const reasons: string[] = [];
  if (hasUTM) { s += 25; reasons.push("UTM completo"); } else reasons.push("UTM faltante");
  if (hasClickId) { s += 25; reasons.push("Click ID presente"); } else reasons.push("Sin click ID");
  if (hasCampaign) { s += 12; reasons.push("Campaña asociada"); }
  if (hasPlatform) s += 8;
  if (hasConvEvent) { s += 10; reasons.push("Conversion events registrados"); }

  const score = clamp(s);
  let label = "Tracking ok";
  if (score < 40) label = "Tracking broken";
  else if (score < 70) label = "Tracking partial";

  return {
    score, label, reasons,
    recommendation:
      score < 40 ? "Revisar UTM en landings + captura de fbclid/gclid"
      : score < 70 ? "Completar capa de tracking (click IDs)"
      : "Tracking saludable",
  };
}

const STAGE_POINTS: Record<string, number> = {
  new: 5, qualified: 25, appointment_scheduled: 40, appointment_attended: 55,
  offer_sent: 65, reservation: 78, contract: 88, down_payment: 95, won: 100, lost: 0,
};

export function computeCrmProgressScore(input: LeadIntelligenceInput): ScoreBreakdown {
  const c = input.contact ?? {};
  const deals = input.deals ?? [];
  let s = 0;
  const reasons: string[] = [];

  if (c.last_contacted_at) { s += 10; reasons.push("Contactado"); }
  if (c.lead_status === "qualified") { s += 15; reasons.push("Calificado"); }
  const maxStage = deals.map((d) => STAGE_POINTS[d.deal_stage] ?? 0).reduce((a, b) => Math.max(a, b), 0);
  if (maxStage) {
    s = Math.max(s, maxStage);
    const top = deals.reduce(
      (best, d) => (STAGE_POINTS[d.deal_stage] ?? 0) > (STAGE_POINTS[best?.deal_stage ?? "new"] ?? 0) ? d : best,
      deals[0],
    );
    reasons.push(`Deal en etapa: ${top.deal_stage}`);
  }
  const score = clamp(s);
  let label = "Top of funnel";
  if (score >= 90) label = "Won / near won";
  else if (score >= 70) label = "Bottom funnel";
  else if (score >= 40) label = "Mid funnel";

  return {
    score, label, reasons,
    recommendation:
      score >= 70 ? "Acelerar cierre"
      : score >= 30 ? "Empujar a siguiente etapa"
      : "Calificar y agendar cita",
  };
}

export type LeadIntelligence = {
  final_score: number;
  label: string;
  fit: ScoreBreakdown;
  engagement: ScoreBreakdown;
  recency: ScoreBreakdown;
  attribution: ScoreBreakdown;
  crm_progress: ScoreBreakdown;
  reasons: string[];
  recommendation: string;
  risks: string[];
  data_source: "mock";
};

export function computeLeadIntelligence(input: LeadIntelligenceInput): LeadIntelligence {
  const fit = computeFitScore(input);
  const engagement = computeEngagementScore(input);
  const recency = computeRecencyScore(input);
  const attribution = computeAttributionScore(input);
  const crm = computeCrmProgressScore(input);

  const final =
    fit.score * 0.3 + engagement.score * 0.2 + recency.score * 0.2 +
    attribution.score * 0.1 + crm.score * 0.2;
  const final_score = clamp(final);

  const risks: string[] = [];
  if (recency.score < 40) risks.push("Lead enfriándose por falta de seguimiento");
  if (attribution.score < 40) risks.push("Tracking incompleto — riesgo de atribución");
  if (fit.score < 40) risks.push("Bad fit — bajo retorno esperado");
  if (engagement.score < 25 && crm.score >= 40) risks.push("Avance CRM sin engagement real");

  let label = "Cold";
  if (final_score >= 75 && recency.score >= 40) label = "Hot";
  else if (final_score >= 55) label = "Warm";
  else if (final_score >= 35) label = "Nurture";
  else label = "Cold";

  if (crm.score >= 70) label = "Sales ready";
  if (recency.score < 30 && fit.score >= 60) label = "At risk";
  if (attribution.score < 40 && fit.score >= 50) label = "Tracking issue";
  if (fit.score < 35) label = "Bad fit";
  if (engagement.score < 20 && final_score < 50) label = "Needs follow-up";
  if (fit.score >= 70 && input.contact?.buying_intent === "high") label = "High intent";

  let recommendation = "Mantener cadencia";
  if (label === "Hot" || label === "High intent") recommendation = "Contactar hoy, agendar cita inmediata";
  else if (label === "At risk") recommendation = "Reactivar urgente con llamada personalizada";
  else if (label === "Tracking issue") recommendation = "Cerrar gap de tracking antes de invertir más";
  else if (label === "Sales ready") recommendation = "Mover a cierre con asesor senior";
  else if (label === "Bad fit") recommendation = "Descalificar y archivar";
  else if (label === "Needs follow-up") recommendation = "Crear tarea de follow-up esta semana";
  else if (label === "Nurture") recommendation = "Incluir en secuencia de nurturing";

  return {
    final_score, label, fit, engagement, recency, attribution, crm_progress: crm,
    reasons: [...fit.reasons.slice(0, 2), ...engagement.reasons.slice(0, 2), ...recency.reasons.slice(0, 1)],
    recommendation, risks, data_source: "mock",
  };
}

export const LEAD_LABEL_TONE: Record<string, string> = {
  Hot: "bg-red-500/15 text-red-700 dark:text-red-400",
  "High intent": "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Warm: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Sales ready": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Nurture: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "At risk": "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "Tracking issue": "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "Needs follow-up": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  "Bad fit": "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  Cold: "bg-muted text-muted-foreground",
};

export type AdvisorLoad = {
  user_id: string;
  name: string;
  active_leads: number;
  pending_tasks: number;
  lead_to_appt_rate: number;
  appt_to_reservation_rate: number;
  development_specialty?: string | null;
};

export type RoutingRecommendation = {
  recommended_owner_id: string;
  recommended_owner_name: string;
  reason: string;
  score: number;
  fallback: boolean;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function recommendOwner(
  lead: any,
  advisors: AdvisorLoad[],
  intel?: LeadIntelligence,
): RoutingRecommendation | null {
  if (!advisors.length) return null;
  const scored = advisors.map((a) => {
    let s = 50;
    const reasons: string[] = [];
    s -= Math.min(a.active_leads, 50) * 0.6;
    if (a.active_leads < 10) reasons.push("carga baja");
    s += a.lead_to_appt_rate * 25;
    s += a.appt_to_reservation_rate * 20;
    if (a.development_specialty && lead.development_id && a.development_specialty === lead.development_id) {
      s += 20;
      reasons.push("especialización desarrollo");
    }
    if (intel && intel.label === "Hot" && a.appt_to_reservation_rate > 0.2) {
      s += 10;
      reasons.push("alta tasa de cierre para lead caliente");
    }
    return { advisor: a, score: clampScore(s), reasons };
  });
  scored.sort((x, y) => y.score - x.score);
  const best = scored[0];
  const reason = best.reasons.length ? best.reasons.join(" + ") : "round-robin por menor carga";
  return {
    recommended_owner_id: best.advisor.user_id,
    recommended_owner_name: best.advisor.name,
    reason,
    score: best.score,
    fallback: !best.reasons.length,
  };
}
