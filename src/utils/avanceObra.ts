// Avance de obra: NO existe en DB, se calcula al vuelo desde las fechas del
// proyecto (misma lógica que la oferta digital en use-offer-db.ts).

export interface Milestone {
  phase: string;
  pct: number;
  done: boolean;
}

export const DEFAULT_MILESTONES: Milestone[] = [
  { phase: "Cimentación", pct: 5, done: false },
  { phase: "Estructura", pct: 28, done: false },
  { phase: "Albañilería", pct: 55, done: false },
  { phase: "Instalaciones", pct: 75, done: false },
  { phase: "Acabados", pct: 90, done: false },
  { phase: "Entrega", pct: 100, done: false },
];

/** % de avance = proporción de tiempo transcurrido entre lanzamiento y entrega. */
export function calcProgressFromDates(inicio?: string | null, entrega?: string | null): number {
  if (!inicio || !entrega) return 0;
  const start = new Date(inicio).getTime();
  const end = new Date(entrega).getTime();
  const now = Date.now();
  if (!(end > start)) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export function applyProgressToMilestones(pct: number): Milestone[] {
  return DEFAULT_MILESTONES.map((m) => ({ ...m, done: pct >= m.pct }));
}
