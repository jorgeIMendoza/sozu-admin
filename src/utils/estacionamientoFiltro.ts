/**
 * Filtro de estacionamiento por CANTIDAD de cajones, compartido por las pantallas de
 * inventario (portal agente, inmobiliarias, portal personal) para que las tres hablen
 * igual.
 *
 * Las opciones no se hardcodean: salen del inventario que se está consultando
 * (`filter_options.estacionamientos` de la RPC, o el universo local cuando la pantalla
 * filtra en cliente). Con el inventario de hoy eso da 1 y 2 cajones; el día que entre
 * un proyecto con 3 o 4, aparecen solas. El 0 solo se ofrece si de verdad hay unidades
 * sin cajón, para no dejar una opción que nunca devuelve resultados.
 */

/** Valor del select: "todos" o la cantidad exacta de cajones como string ("0", "1", …). */
export type FiltroEstacionamiento = string;

export const ESTACIONAMIENTO_TODOS: FiltroEstacionamiento = 'todos';

/** 0 → "Sin estacionamiento" · 1 → "1 cajón" · n → "n cajones". */
export function etiquetaCajones(n: number): string {
  if (n <= 0) return 'Sin estacionamiento';
  return n === 1 ? '1 cajón' : `${n} cajones`;
}

/** Opciones del select a partir de las cantidades presentes en el inventario. */
export function opcionesEstacionamiento(
  cantidades: readonly number[] | null | undefined,
): { value: FiltroEstacionamiento; label: string }[] {
  const unicas = [...new Set((cantidades ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0))]
    .sort((a, b) => a - b);
  return [
    { value: ESTACIONAMIENTO_TODOS, label: 'Todos' },
    ...unicas.map((n) => ({ value: String(n), label: etiquetaCajones(n) })),
  ];
}

/**
 * Normaliza lo que venga guardado de sesiones anteriores. El filtro era un sí/no
 * ("si" / "no"), valores que ya no significan una cantidad: se caen a "todos" en vez de
 * dejar al usuario con un filtro que no puede ver ni quitar desde el select.
 */
export function normalizarFiltroEstacionamiento(valor: unknown): FiltroEstacionamiento {
  if (typeof valor !== 'string') return ESTACIONAMIENTO_TODOS;
  return /^\d+$/.test(valor) ? valor : ESTACIONAMIENTO_TODOS;
}

/** Valor del select → parámetro de la RPC (`estacionamientos`). */
export function filtroACantidades(valor: FiltroEstacionamiento): number[] | undefined {
  const n = Number(valor);
  return /^\d+$/.test(valor) && Number.isFinite(n) ? [n] : undefined;
}

/** Etiqueta visible → cantidad. Para selects que trabajan con labels (MultiSelectFilter). */
export function cantidadDesdeEtiqueta(
  etiqueta: string,
  cantidades: readonly number[] | null | undefined,
): number | null {
  const match = (cantidades ?? []).find((n) => etiquetaCajones(Number(n)) === etiqueta);
  return match == null ? null : Number(match);
}
