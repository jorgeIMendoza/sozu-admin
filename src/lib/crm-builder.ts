// Campaign Builder types and utilities (ported from sozu-crm)

export const BUILDER_OBJECTIVES = [
  { id: "leads", label: "Generar leads" },
  { id: "appointments", label: "Citas" },
  { id: "qualified_leads", label: "Leads calificados" },
  { id: "reservations", label: "Apartados" },
  { id: "contracts", label: "Contratos" },
  { id: "down_payments", label: "Enganches" },
] as const;

export const FUNNEL_STAGE_FOR_OBJECTIVE: Record<string, string> = {
  leads: "tofu",
  appointments: "mofu",
  qualified_leads: "mofu",
  reservations: "bofu",
  contracts: "bofu",
  down_payments: "bofu",
};

export const DRAFT_STATUSES = [
  "incomplete",
  "draft",
  "ready_for_review",
  "pending_approval",
  "approved",
  "rejected",
  "revision_requested",
  "ready_to_publish_mock",
  "blocked_real_publish",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_STATUS_TONE: Record<string, string> = {
  incomplete: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  ready_for_review: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
  revision_requested: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  ready_to_publish_mock: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  blocked_real_publish: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  published: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export type DraftPayload = {
  development_id: string | null;
  development_name?: string;
  objective: string;
  platform: "meta_ads" | "google_ads" | "both";
  budget_type: "daily" | "lifetime";
  budget: number;
  start_date: string;
  end_date: string;
  audience: {
    persona: string;
    location: string;
    interests: string;
    intent: "low" | "medium" | "high";
    purchase_type: string;
  };
  offer: {
    hook: string;
    differentiator: string;
    cta: string;
    landing_url: string;
  };
  meta?: {
    objective: string;
    campaign_name: string;
    ad_set_name: string;
    placements: string[];
    optimization_event: string;
    primary_texts: string[];
    headlines: string[];
    descriptions: string[];
    cta: string;
    pixel_capi_checklist: Record<string, boolean>;
  };
  google?: {
    campaign_type: string;
    campaign_name: string;
    ad_group_name: string;
    keywords: string[];
    negative_keywords: string[];
    headlines: string[];
    descriptions: string[];
    final_url: string;
    conversion_action_checklist: Record<string, boolean>;
    gclid_checklist: Record<string, boolean>;
  };
  utms: { source: string; medium: string; campaign: string; content: string; term: string };
};

export type ValidationIssue = { level: "error" | "warning" | "info"; field: string; message: string };

export function validateDraft(d: DraftPayload, platform: "meta" | "google"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!d.development_id) issues.push({ level: "error", field: "development", message: "Desarrollo no asociado" });
  if (!d.objective) issues.push({ level: "error", field: "objective", message: "Funnel stage no asociado" });
  if (!d.budget || d.budget <= 0) issues.push({ level: "error", field: "budget", message: "Presupuesto inválido" });
  if (!d.offer.landing_url || !/^https?:\/\//.test(d.offer.landing_url))
    issues.push({ level: "error", field: "landing_url", message: "Landing URL ausente o sin http(s)" });
  if (!d.utms.source || !d.utms.medium || !d.utms.campaign)
    issues.push({ level: "error", field: "utms", message: "UTMs incompletos (source/medium/campaign)" });
  if (platform === "meta") {
    if (!d.meta?.optimization_event) issues.push({ level: "error", field: "meta.event", message: "Evento de conversión Meta sin definir" });
    if (!d.meta?.primary_texts?.length) issues.push({ level: "warning", field: "meta.copy", message: "Sin primary texts" });
    if (!d.meta?.headlines?.length) issues.push({ level: "warning", field: "meta.headlines", message: "Sin headlines" });
  }
  if (platform === "google") {
    if (!d.google?.headlines?.length || d.google.headlines.length < 3)
      issues.push({ level: "warning", field: "google.headlines", message: "Recomendado 3+ headlines" });
    if (!d.google?.descriptions?.length) issues.push({ level: "warning", field: "google.descriptions", message: "Sin descriptions" });
    if (!d.google?.final_url) issues.push({ level: "error", field: "google.final_url", message: "Final URL ausente" });
  }
  return issues;
}

export type ReadinessBreakdown = {
  score: number;
  weights: Record<string, { weight: number; passed: boolean }>;
  errors: number;
  warnings: number;
  status: DraftStatus;
};

export function computeReadiness(d: DraftPayload, issues: ValidationIssue[]): ReadinessBreakdown {
  const checks: Record<string, { weight: number; passed: boolean }> = {
    development: { weight: 10, passed: !!d.development_id },
    objective: { weight: 8, passed: !!d.objective },
    platform: { weight: 6, passed: !!d.platform },
    budget: { weight: 8, passed: !!d.budget && d.budget > 0 },
    dates: { weight: 4, passed: !!d.start_date && !!d.end_date },
    audience: { weight: 8, passed: !!d.audience.persona && !!d.audience.location },
    offer: { weight: 10, passed: !!d.offer.hook && !!d.offer.cta },
    landing: { weight: 8, passed: !!d.offer.landing_url && /^https?:\/\//.test(d.offer.landing_url) },
    utms: { weight: 10, passed: !!d.utms.source && !!d.utms.medium && !!d.utms.campaign },
    meta_copy: {
      weight: 8,
      passed: d.platform === "google_ads" ? true : !!d.meta?.primary_texts?.filter(Boolean).length,
    },
    meta_event: {
      weight: 6,
      passed: d.platform === "google_ads" ? true : !!d.meta?.optimization_event,
    },
    google_copy: {
      weight: 6,
      passed: d.platform === "meta_ads" ? true : (d.google?.headlines?.length ?? 0) >= 3,
    },
    google_url: {
      weight: 4,
      passed: d.platform === "meta_ads" ? true : !!d.google?.final_url,
    },
  };
  let score = 0;
  let totalWeight = 0;
  Object.values(checks).forEach((c) => { totalWeight += c.weight; if (c.passed) score += c.weight; });
  const pct = Math.round((score / Math.max(1, totalWeight)) * 100);
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;
  let status: DraftStatus = "draft";
  if (errors > 0 || pct < 50) status = "incomplete";
  else if (pct >= 90 && warnings === 0) status = "ready_for_review";
  else status = "draft";
  return { score: pct, weights: checks, errors, warnings, status };
}
