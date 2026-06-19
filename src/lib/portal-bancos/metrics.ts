import type { BankLead, LeadStatus, LeadHealth } from "./bank-leads";
import { PIPELINE_ORDER, STATUS_DESCRIPTORS, deriveHealth } from "./bank-leads";

/** Shape mínimo de agente para estadísticas (id/nombre/activo). */
interface AgentLike { id: string; name: string; active: boolean }

export const STAGE_PROBABILITY: Record<LeadStatus, number> = {
  nuevo: 0.10, asignado: 0.15, contactado: 0.25, en_evaluacion: 0.40,
  pre_aprobado: 0.60, oferta_vinculante: 0.80, en_coordinacion: 0.90,
  formalizado: 1.0, rechazado: 0, desistido: 0,
};

export const SLA_CONTACT_HOURS = 24;

function deepestPipelineIndex(lead: BankLead): number {
  let maxIdx = -1;
  const consider = (s?: LeadStatus) => { if (!s) return; const i = PIPELINE_ORDER.indexOf(s); if (i > maxIdx) maxIdx = i; };
  consider(lead.status);
  for (const a of lead.activity) { consider(a.from); consider(a.to); }
  return maxIdx;
}

export interface FunnelStage { status: LeadStatus; label: string; count: number; conversionFromPrev: number | null }

export function computeFunnel(leads: BankLead[]): FunnelStage[] {
  const reached = PIPELINE_ORDER.map((_, k) => leads.filter((l) => deepestPipelineIndex(l) >= k).length);
  return PIPELINE_ORDER.map((status, k) => ({
    status, label: STATUS_DESCRIPTORS[status].label, count: reached[k],
    conversionFromPrev: k === 0 ? null : reached[k - 1] === 0 ? 0 : Math.round((reached[k] / reached[k - 1]) * 100),
  }));
}

export interface WinRate { won: number; lost: number; closed: number; rate: number }
export function computeWinRate(leads: BankLead[]): WinRate {
  const won = leads.filter((l) => l.status === "formalizado").length;
  const lost = leads.filter((l) => l.status === "rechazado" || l.status === "desistido").length;
  const closed = won + lost;
  return { won, lost, closed, rate: closed === 0 ? 0 : Math.round((won / closed) * 100) };
}

function firstContactTs(lead: BankLead): string | null {
  const cs = lead.activity.filter((a) => a.type === "contacto" || (a.type === "status_change" && a.to === "contactado"));
  return cs.length === 0 ? null : cs.reduce((min, a) => (a.ts < min ? a.ts : min), cs[0].ts);
}

export interface ContactSLA { contactedCount: number; avgHours: number | null; withinSlaPct: number | null }
export function computeContactSLA(leads: BankLead[]): ContactSLA {
  const wc = leads.map((l) => {
    const ts = firstContactTs(l);
    if (!ts) return null;
    return Math.max(0, (new Date(ts).getTime() - new Date(l.createdAt).getTime()) / 3600000);
  }).filter((h): h is number => h !== null);
  if (wc.length === 0) return { contactedCount: 0, avgHours: null, withinSlaPct: null };
  const avg = wc.reduce((a, b) => a + b, 0) / wc.length;
  const within = wc.filter((h) => h <= SLA_CONTACT_HOURS).length;
  return { contactedCount: wc.length, avgHours: Math.round(avg * 10) / 10, withinSlaPct: Math.round((within / wc.length) * 100) };
}

export function computeVolume(leads: BankLead[]) {
  const fundedVolume = leads.filter((l) => l.status === "formalizado").reduce((s, l) => s + l.credit.montoFinanciar, 0);
  const active = leads.filter((l) => !STATUS_DESCRIPTORS[l.status].isTerminal);
  const weightedPipeline = active.reduce((s, l) => s + l.credit.montoFinanciar * STAGE_PROBABILITY[l.status], 0);
  return { fundedVolume, weightedPipeline: Math.round(weightedPipeline), activeLeads: active.length };
}

export function computeByProject(leads: BankLead[]) {
  const map = new Map<string, { count: number; volume: number }>();
  for (const l of leads) {
    const cur = map.get(l.property.project) ?? { count: 0, volume: 0 };
    cur.count += 1; cur.volume += l.credit.montoFinanciar;
    map.set(l.property.project, cur);
  }
  return [...map.entries()].map(([project, v]) => ({ project, ...v })).sort((a, b) => b.count - a.count);
}

export interface AgentStats { agentId: string; name: string; active: boolean; activos: number; urgentes: number; formalizados: number; winRate: number }

export function computeByAgent(leads: BankLead[], agents: AgentLike[]): AgentStats[] {
  return agents.map((a) => {
    const mine = leads.filter((l) => l.assignedAgentId === a.id);
    const activos = mine.filter((l) => !STATUS_DESCRIPTORS[l.status].isTerminal).length;
    const urgentes = mine.filter((l) => { const h = deriveHealth(l); return h === "en_riesgo" || h === "detenido"; }).length;
    const formalizados = mine.filter((l) => l.status === "formalizado").length;
    const wr = computeWinRate(mine);
    return { agentId: a.id, name: a.name, active: a.active, activos, urgentes, formalizados, winRate: wr.rate };
  });
}

export function computeLossReasons(leads: BankLead[]) {
  const map = new Map<string, number>();
  for (const l of leads) {
    if ((l.status === "rechazado" || l.status === "desistido") && l.closeReason)
      map.set(l.closeReason, (map.get(l.closeReason) ?? 0) + 1);
  }
  return [...map.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export function computeHealthDistribution(leads: BankLead[]): Record<LeadHealth, number> {
  const dist: Record<LeadHealth, number> = { en_tiempo: 0, en_riesgo: 0, detenido: 0 };
  for (const l of leads) {
    if (STATUS_DESCRIPTORS[l.status].isTerminal) continue;
    dist[deriveHealth(l)] += 1;
  }
  return dist;
}