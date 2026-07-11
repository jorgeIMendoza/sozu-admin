/**
 * Pastillas que marcan el alcance de los filtros en los dashboards de cobranza
 * (Inmuebles / Complementos). Proyecto y Dueño filtran SIEMPRE todas las secciones.
 *  - GlobalTag:  la sección muestra el total; NO depende del filtro Año/Mes.
 *  - AnioMesTag: la sección SÍ responde al filtro Año/Mes.
 * El detalle extra va en el `title` nativo (hover), sin popover.
 */
export function GlobalTag() {
  return (
    <span
      title="Total. No depende de Año/Mes. Proyecto y Dueño sí filtran esta sección."
      className="inline-flex shrink-0 cursor-help items-center rounded-full border border-border/70 bg-muted px-1.5 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      Global
    </span>
  );
}

export function AnioMesTag() {
  return (
    <span
      title="Responde al filtro de Año/Mes (además de Proyecto y Dueño)."
      className="inline-flex shrink-0 cursor-help items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-wide text-primary"
    >
      Año/Mes
    </span>
  );
}
