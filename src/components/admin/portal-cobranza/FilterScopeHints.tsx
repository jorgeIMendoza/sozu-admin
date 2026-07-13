import { Info } from 'lucide-react';

/**
 * Pastillas de INFORMACIÓN (no de estado) que marcan el alcance de los filtros en
 * los dashboards de cobranza (Inmuebles / Complementos). Color azul "info" +
 * icono ℹ para distinguirlas de los badges de estado (Crítico, En riesgo, etc.).
 * Proyecto y Dueño filtran SIEMPRE todas las secciones.
 *  - GlobalTag:  la sección muestra el total; NO depende del filtro Año/Mes.
 *  - AnioMesTag: la sección SÍ responde al filtro Año/Mes.
 * El detalle extra va en el `title` nativo (hover).
 */
const PILL =
  'inline-flex shrink-0 cursor-help items-center gap-1 rounded-full border px-1.5 py-[1px] align-middle ' +
  'text-[9px] font-semibold uppercase tracking-wide ' +
  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300';

export function GlobalTag() {
  return (
    <span title="Total. No depende de Año/Mes. Proyecto y Dueño sí filtran esta sección." className={PILL}>
      <Info className="h-2.5 w-2.5" strokeWidth={2.5} />
      Global
    </span>
  );
}

export function AnioMesTag() {
  return (
    <span title="Responde al filtro de Año/Mes (además de Proyecto y Dueño)." className={PILL}>
      <Info className="h-2.5 w-2.5" strokeWidth={2.5} />
      Año/Mes
    </span>
  );
}
