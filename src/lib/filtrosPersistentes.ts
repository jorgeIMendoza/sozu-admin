/**
 * Filtros de tabla que sobreviven la navegación.
 *
 * Los filtros son ajustes del usuario, no estado efímero de la pantalla: entrar al detalle de
 * una cuenta y volver, o recargar, no debe borrar lo que acababa de capturar. Se guardan en
 * `localStorage` y se limpian **solo** por decisión explícita:
 *
 *   - el usuario cierra sesión  → `limpiarTodosLosFiltros()` desde el flujo de logout, o
 *   - el usuario los limpia     → botón "Limpiar filtros" de cada pantalla.
 *
 * Incluye el estado de la tabla (página y orden), que es parte de "dónde iba" el usuario.
 *
 * Convención de clave: `filtros:<portal>_<menu>`. El prefijo permite barrer todo en el logout
 * sin depender de que la pantalla se haya montado — con páginas lazy, un registro en memoria
 * dejaría fuera los filtros de las que nunca se abrieron en esa sesión.
 */

export const PREFIJO_FILTROS = 'filtros:';

/** Claves anteriores a esta convención. Se barren igual para no dejarlas huérfanas. */
const CLAVES_LEGADAS = [
  'pcobranza_cuentas_cobranza_filters', // store zustand del inbox de cobranza
  'validacion-pagos-filtros',           // persistencia ad hoc previa de Validación de Pagos
];

/** Limpiezas en memoria de stores ya montados (zustand u otros). */
const limpiadores: Array<() => void> = [];

export function registrarLimpiadorDeFiltros(limpiar: () => void): void {
  limpiadores.push(limpiar);
}

/**
 * Lee los filtros guardados y los mezcla sobre los iniciales.
 *
 * Se mezcla en vez de reemplazar para que agregar un filtro nuevo no rompa a quien ya tenía
 * algo guardado: las claves que falten toman su valor inicial.
 */
export function leerFiltros<T extends object>(clave: string, iniciales: T): T {
  try {
    const crudo = localStorage.getItem(PREFIJO_FILTROS + clave);
    if (!crudo) return iniciales;
    const guardado = JSON.parse(crudo);
    if (!guardado || typeof guardado !== 'object') return iniciales;
    return { ...iniciales, ...guardado } as T;
  } catch {
    return iniciales;
  }
}

export function guardarFiltros<T extends object>(clave: string, valores: T): void {
  try {
    localStorage.setItem(PREFIJO_FILTROS + clave, JSON.stringify(valores));
  } catch {
    // Storage lleno o bloqueado: los filtros siguen vivos en memoria, solo no sobreviven al F5.
  }
}

export function borrarFiltros(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO_FILTROS + clave);
  } catch {
    // no-op
  }
}

/**
 * Borra los filtros de todas las pantallas. Va en el logout: no deben sobrevivir a un cambio
 * de usuario en la misma computadora.
 */
export function limpiarTodosLosFiltros(): void {
  for (const limpiar of limpiadores) {
    try { limpiar(); } catch { /* un store roto no debe frenar a los demás */ }
  }
  try {
    const claves = Object.keys(localStorage).filter(
      (k) => k.startsWith(PREFIJO_FILTROS) || CLAVES_LEGADAS.includes(k),
    );
    claves.forEach((k) => localStorage.removeItem(k));
  } catch {
    // no-op
  }
}
