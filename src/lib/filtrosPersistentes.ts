import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Filtros de tabla que sobreviven la navegación. **Único mecanismo del proyecto.**
 *
 * Los filtros son ajustes del usuario, no estado efímero de la pantalla: entrar al detalle de
 * una cuenta y volver, o recargar, no debe borrar lo que acababa de capturar. Se guardan en
 * `localStorage` y se limpian **solo** por decisión explícita:
 *
 *   - el usuario cierra sesión  → `limpiarTodosLosFiltros()` desde el flujo de logout, o
 *   - el usuario los limpia     → botón "Limpiar filtros" de cada pantalla.
 *
 * Incluye el estado de la tabla (página, orden, pestaña), que es parte de "dónde iba".
 *
 * ## Por qué un store y no `useState` + efecto de guardado
 *
 * Con `useState` hay dos fuentes de verdad —el estado y el storage— sincronizadas a mano por un
 * efecto: agregar un filtro obliga a tocar el objeto inicial, el efecto y su lista de
 * dependencias, y olvidar cualquiera de los tres deja un filtro que no persiste sin que nada
 * falle. Aquí el store **es** la fuente de verdad y `persist` se encarga del resto.
 *
 * `useFiltro(clave)` devuelve el mismo par `[valor, setValor]` que `useState`, así que sustituye
 * línea por línea y los `setX(v)` y `setX(prev => ...)` existentes siguen funcionando igual.
 *
 * ## Convención de clave
 *
 * `filtros:<portal>_<menu>`. El logout barre por prefijo en vez de por registro en memoria: con
 * páginas lazy, un registro dejaría fuera los filtros de las pantallas que nunca se abrieron en
 * esa sesión, y se limpiarían a medias según por dónde hubiera navegado el usuario.
 */

export const PREFIJO_FILTROS = 'filtros:';

/** Claves anteriores a esta convención. Se barren igual para no dejarlas huérfanas. */
const CLAVES_LEGADAS = [
  'pcobranza_cuentas_cobranza_filters', // store previo del inbox de cobranza
  'validacion-pagos-filtros',           // localStorage ad hoc previo de Validación de Pagos
];

/** Limpiezas en memoria de los stores ya montados. */
const limpiadores: Array<() => void> = [];

export function registrarLimpiadorDeFiltros(limpiar: () => void): void {
  limpiadores.push(limpiar);
}

// `Set` no sobrevive a JSON.stringify (queda como {}). Se etiqueta al guardar y se reconstruye
// al leer, para que las pantallas que filtran con Set no tengan que convertir a arreglo.
const MARCA_SET = '__set';

const storageFiltros = createJSONStorage(() => localStorage, {
  replacer: (_clave, valor) =>
    valor instanceof Set ? { [MARCA_SET]: Array.from(valor) } : valor,
  reviver: (_clave, valor) =>
    valor && typeof valor === 'object' && MARCA_SET in (valor as object)
      ? new Set((valor as Record<string, unknown[]>)[MARCA_SET])
      : valor,
});

interface EstadoFiltros<T> {
  valores: T;
  setValor: <K extends keyof T>(clave: K, valor: T[K] | ((previo: T[K]) => T[K])) => void;
  reset: () => void;
}

export interface StoreFiltros<T extends object> {
  /** Reemplazo directo de `useState`: `const [v, setV] = useFiltro('searchTerm')`. */
  useFiltro: <K extends keyof T>(clave: K) => readonly [T[K], (valor: T[K] | ((previo: T[K]) => T[K])) => void];
  /** Deja todos los filtros en su valor inicial. Para el botón "Limpiar filtros". */
  reset: () => void;
  /** Lectura puntual fuera de React (por ejemplo para exportar con los filtros activos). */
  leer: () => T;
}

/**
 * Crea el store de filtros de una pantalla.
 *
 * @param clave      identificador del menú, sin prefijo: `pcobranza_relacion_pagos`.
 * @param iniciales  valores por defecto. Se mezclan sobre lo guardado, así que agregar un filtro
 *                   nuevo no rompe a quien ya tenía algo en storage: lo que falte toma su valor
 *                   inicial.
 */
export function crearStoreFiltros<T extends object>(clave: string, iniciales: T): StoreFiltros<T> {
  const useStore = create<EstadoFiltros<T>>()(
    persist(
      (set) => ({
        valores: { ...iniciales },
        setValor: (k, valor) =>
          set((estado) => ({
            valores: {
              ...estado.valores,
              [k]: typeof valor === 'function'
                ? (valor as (previo: T[typeof k]) => T[typeof k])(estado.valores[k])
                : valor,
            },
          })),
        reset: () => set({ valores: { ...iniciales } }),
      }),
      {
        name: PREFIJO_FILTROS + clave,
        storage: storageFiltros,
        partialize: (estado) => ({ valores: estado.valores }),
        merge: (guardado, actual) => ({
          ...actual,
          valores: { ...iniciales, ...((guardado as { valores?: Partial<T> })?.valores ?? {}) },
        }),
      },
    ),
  );

  registrarLimpiadorDeFiltros(() => {
    useStore.getState().reset();
    useStore.persist?.clearStorage?.();
  });

  // Se suscribe solo a la clave pedida: cambiar un filtro no re-renderiza por los demás.
  function useFiltro<K extends keyof T>(k: K) {
    const valor = useStore((estado) => estado.valores[k]);
    const setValor = useStore((estado) => estado.setValor);
    const set = useCallback(
      (nuevo: T[K] | ((previo: T[K]) => T[K])) => setValor(k, nuevo),
      [k, setValor],
    );
    return [valor, set] as const;
  }

  return {
    useFiltro,
    reset: () => useStore.getState().reset(),
    leer: () => useStore.getState().valores,
  };
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
