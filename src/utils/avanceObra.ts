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

export interface StageRow extends Milestone {
  /** Avance PROPIO de la etapa (0-100 dentro de su banda), coherente con el % global. */
  ownPct: number;
}

/**
 * Reescala cada etapa a su propio 0-100 dentro de su banda del % global.
 * El `pct` del milestone es el umbral global acumulado al terminar esa etapa.
 * Fuente de verdad compartida entre la oferta digital y el portal agente.
 */
export function deriveStages(progress: number): StageRow[] {
  return DEFAULT_MILESTONES.map((m, i) => {
    const prev = i === 0 ? 0 : DEFAULT_MILESTONES[i - 1].pct;
    const band = m.pct - prev;
    const ownPct = band <= 0
      ? (progress >= m.pct ? 100 : 0)
      : Math.round(Math.min(100, Math.max(0, ((progress - prev) / band) * 100)));
    return { ...m, ownPct, done: ownPct >= 100 };
  });
}

/** Etapa actual = primera etapa aún no terminada (o la última terminada). */
export function currentStageOf(stages: StageRow[]): string {
  return stages.find((m) => m.ownPct < 100)?.phase
    ?? [...stages].reverse().find((m) => m.done)?.phase
    ?? "—";
}
