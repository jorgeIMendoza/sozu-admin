import type { LucideIcon } from "lucide-react";

export const LEAD_STATUS = [
  "new", "contacted", "engaged", "qualified", "unqualified", "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const LIFECYCLE_STAGE = [
  "lead", "mql", "sql", "opportunity", "customer", "evangelist",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGE)[number];

export const DEAL_STAGES = [
  { id: "new", label: "Nuevo" },
  { id: "qualified", label: "Calificado" },
  { id: "appointment_scheduled", label: "Cita agendada" },
  { id: "appointment_attended", label: "Cita asistida" },
  { id: "offer_sent", label: "Oferta" },
  { id: "reservation", label: "Reserva" },
  { id: "contract", label: "Contrato" },
  { id: "down_payment", label: "Enganche" },
  { id: "won", label: "Ganado" },
  { id: "lost", label: "Perdido" },
] as const;
export type DealStage = (typeof DEAL_STAGES)[number]["id"];

export const APPT_STATUS = [
  "scheduled", "attended", "no_show", "cancelled", "rescheduled",
] as const;

export const TASK_STATUS = ["pending", "in_progress", "completed", "cancelled"] as const;

export const leadStatusLabel: Record<string, string> = {
  new: "Nuevo", contacted: "Contactado", engaged: "Engaged",
  qualified: "Calificado", unqualified: "No calificado", lost: "Perdido",
};
export const lifecycleLabel: Record<string, string> = {
  lead: "Lead", mql: "MQL", sql: "SQL", opportunity: "Oportunidad",
  customer: "Cliente", evangelist: "Evangelista",
};
export const apptStatusLabel: Record<string, string> = {
  scheduled: "Agendada", attended: "Asistida", no_show: "No asistió",
  cancelled: "Cancelada", rescheduled: "Reagendada",
};
export const taskStatusLabel: Record<string, string> = {
  pending: "Pendiente", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada",
};

export function fmtMXN(n: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(Number(n ?? 0));
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function relTime(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace instantes";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return fmtDate(iso);
}

export function leadScoreColor(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    new: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    qualified: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    appointment_scheduled: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
    appointment_attended: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    offer_sent: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    reservation: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    contract: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    down_payment: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    won: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    lost: "bg-destructive/15 text-destructive",
  };
  return map[stage] ?? "bg-muted text-muted-foreground";
}

export type IconType = LucideIcon;
