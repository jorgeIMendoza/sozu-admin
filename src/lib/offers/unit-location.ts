/**
 * Geometría y lecturas de la sección "Ubicación de tu departamento" de la oferta
 * digital (`components/offer/OfferUnitLocation.tsx`).
 *
 * Vive aparte del componente porque es la parte que se puede equivocar en
 * silencio: el nivel llega como texto libre desde `propiedades.numero_piso`
 * ('11', 'PB', ' 7 '), el total desde una columna `character` con padding, y la
 * ventana de niveles decide qué se dibuja cuando el edificio no cabe en la card.
 * Reglas tomadas del `BuildingDiagram` de la app del cliente.
 */

/** Niveles que se pintan a la vez; el resto del edificio se omite. */
export const MAX_NIVELES_VISIBLES = 8;

/**
 * Nivel numérico de la unidad, o null si no hay uno que ubicar.
 *
 * `numero_piso` es texto en BD: 'PB' (planta baja) y los vacíos devuelven null
 * para que la sección no se monte, en lugar de dibujar un edificio de NaN pisos.
 */
export function parseNivel(level?: number | string | null): number | null {
  if (level == null) return null;
  if (typeof level === "number") return Number.isFinite(level) && level > 0 ? level : null;
  const digits = level.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Total de niveles del edificio (`edificios.numero_pisos`, de tipo `character`:
 * llega con padding y a veces vacío). Nunca menor al nivel de la unidad — un
 * total mal capturado dejaría a la unidad fuera del edificio dibujado.
 */
export function resolveTotalNiveles(totalPisos: number | null | undefined, nivel: number): number {
  return totalPisos != null && Number.isFinite(totalPisos) && totalPisos >= nivel ? totalPisos : nivel;
}

/**
 * Niveles a dibujar, de arriba hacia abajo. Con edificios altos se recorta a una
 * ventana de `MAX_NIVELES_VISIBLES` que SIEMPRE contiene el nivel de la unidad
 * (tres niveles de aire encima cuando hay de dónde).
 */
export function nivelesVisibles(nivel: number, total: number): number[] {
  if (total <= MAX_NIVELES_VISIBLES) {
    return Array.from({ length: total }, (_, i) => total - i);
  }
  const top = Math.min(Math.max(nivel + 3, MAX_NIVELES_VISIBLES), total);
  const bottom = Math.min(Math.max(top - MAX_NIVELES_VISIBLES + 1, 1), total);
  return Array.from({ length: top - bottom + 1 }, (_, i) => top - i);
}

/** Fila del corte del edificio, de arriba hacia abajo. */
export type FilaEdificio =
  /** Azotea con pretil: solo cuando la ventana llega al último nivel real. */
  | { tipo: "azotea" }
  /** Niveles que la ventana no alcanza a mostrar. `count` > 0. */
  | { tipo: "salto"; count: number }
  | { tipo: "nivel"; n: number }
  | { tipo: "planta-baja" };

/**
 * Filas del corte del edificio.
 *
 * La ventana de 8 niveles obliga a declarar lo que NO se ve: sin esto, un
 * edificio de 26 pisos se dibujaba con la azotea encima del nivel 10 y la planta
 * baja pegada al nivel 3, y el corte afirmaba "son 10 pisos". Las filas `salto`
 * son la marca de continuidad ("+16 niveles"), y la azotea solo se pinta cuando
 * de verdad estamos viendo la punta del edificio.
 */
export function filasEdificio(nivel: number, total: number): FilaEdificio[] {
  const niveles = nivelesVisibles(nivel, total);
  const top = niveles[0];
  const bottom = niveles[niveles.length - 1];
  const filas: FilaEdificio[] = [];

  if (top >= total) filas.push({ tipo: "azotea" });
  else filas.push({ tipo: "salto", count: total - top });

  for (const n of niveles) filas.push({ tipo: "nivel", n });

  if (bottom > 1) filas.push({ tipo: "salto", count: bottom - 1 });
  filas.push({ tipo: "planta-baja" });

  return filas;
}

/**
 * ¿El número de propiedad sigue la convención `nivel*100 + posición`?
 *
 * Gobierna si se puede dibujar la rejilla de respaldo: solo con la convención
 * los vecinos que se pintan ('701', '702', …) existen de verdad. En edificios
 * como VITA ('V-504' en el nivel 7) la rejilla inventaba una serie 70x ajena al
 * edificio y resaltaba dentro de ella una celda '504' que no pertenecía a la
 * serie, así que ahí no se dibuja nada.
 */
export function unidadSigueConvencion(unitNumber: string, nivel: number): boolean {
  const digits = Number((unitNumber ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(digits) || digits <= 0) return false;
  const porNivel = digits - nivel * 100;
  return porNivel >= 1 && porNivel <= 40;
}

/**
 * Posición de la unidad dentro de su nivel, a partir del número de propiedad.
 * Convención `nivel*100 + posición` (709 → nivel 7, posición 9); si no aplica se
 * usan los últimos dos dígitos. Solo alimenta la rejilla de respaldo que se
 * dibuja cuando el nivel no tiene plano cargado.
 */
export function posicionEnNivel(unitNumber: string, nivel: number): number {
  const digits = Number((unitNumber ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(digits) || digits <= 0) return 1;
  const porNivel = digits - nivel * 100;
  if (porNivel >= 1 && porNivel <= 40) return porNivel;
  const ultimos2 = digits % 100;
  return ultimos2 >= 1 ? ultimos2 : 1;
}
