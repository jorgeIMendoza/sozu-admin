// Avance de obra — FUENTE ÚNICA DE VERDAD:
//   proyectos.id_estatus_proyecto → estatus_proyecto.porcentaje_avance
// El % NO se calcula por fechas (la fecha de entrega es variable). Se toma del
// estatus/etapa que el admin fija en "Editar Proyecto". Todos los portales
// (oferta digital, portal cliente, socio bancario, inventario agente) consumen
// estos helpers para hablar el mismo idioma.

export interface Milestone {
  phase: string;
  pct: number;
  done: boolean;
}

/** Etapa del catálogo estatus_proyecto con su % de avance efectivo. */
export interface EtapaEstatus {
  id: number;
  nombre: string;
  porcentaje: number;
}

/**
 * Normaliza las filas de `estatus_proyecto` a EtapaEstatus, ordenadas por avance.
 * `porcentaje` = columna `porcentaje_avance`; si aún no existe (DDL pendiente)
 * cae al legacy `round(id / total * 100)` para no romper nada mientras se aplica.
 */
export function mapEstatusCatalog(
  rows: Array<{ id: number; nombre: string; porcentaje_avance?: number | null }>,
): EtapaEstatus[] {
  const total = rows.length || 13;
  return rows
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      porcentaje: r.porcentaje_avance ?? Math.round((r.id / total) * 100),
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje || a.id - b.id);
}

/** % global = avance de la etapa seleccionada del proyecto (fuente única). */
export function progressFromEstatus(etapas: EtapaEstatus[], idEstatus?: number | null): number {
  if (!idEstatus) return 0;
  const sel = etapas.find((e) => e.id === idEstatus);
  return sel ? Math.min(100, Math.max(0, Math.round(sel.porcentaje))) : 0;
}

/** Catálogo de etapas como milestones (sin marcar `done`; usar deriveStages). */
export function milestonesFromEstatus(etapas: EtapaEstatus[]): Milestone[] {
  return etapas.map((e) => ({ phase: e.nombre, pct: e.porcentaje, done: false }));
}

export const DEFAULT_MILESTONES: Milestone[] = [
  { phase: "Cimentación", pct: 5, done: false },
  { phase: "Estructura", pct: 28, done: false },
  { phase: "Albañilería", pct: 55, done: false },
  { phase: "Instalaciones", pct: 75, done: false },
  { phase: "Acabados", pct: 90, done: false },
  { phase: "Entrega", pct: 100, done: false },
];

/**
 * @deprecated El avance NO se calcula por fechas (la entrega es variable).
 * Usar `progressFromEstatus` sobre el catálogo estatus_proyecto. Se conserva
 * solo como fallback histórico; no usar en código nuevo.
 */
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
  /** % acumulado (hito) de la etapa; sirve como número mostrado en el roadmap. */
  ownPct: number;
}

/**
 * Modelo DISCRETO alineado con el catálogo estatus_proyecto: cada etapa es un
 * hito con su % acumulado (`pct`). `progress` = % de la etapa SELECCIONADA.
 *   - etapas con pct < progress → terminadas (done)
 *   - la etapa seleccionada (pct == progress) → ACTUAL (no done, la marca isCurrent)
 *   - etapas con pct > progress → pendientes
 * Así "Etapa actual" coincide exactamente con el estatus elegido en Editar Proyecto.
 */
export function deriveStages(progress: number, milestones: Milestone[] = DEFAULT_MILESTONES): StageRow[] {
  return milestones.map((m) => ({
    ...m,
    ownPct: m.pct,
    done: m.pct < progress,
  }));
}

/** Etapa actual = primera etapa aún no terminada = la etapa seleccionada. */
export function currentStageOf(stages: StageRow[]): string {
  return stages.find((m) => !m.done)?.phase
    ?? [...stages].reverse().find((m) => m.done)?.phase
    ?? "—";
}
