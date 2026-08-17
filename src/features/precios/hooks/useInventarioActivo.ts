import { useMemo } from "react";
import type { Modelo, Propiedad, Proyecto, Torre } from "../types/dominio";
import {
  useInventarioStore,
  type IndicesProyecto,
} from "../stores/inventarioStore";
import { useMotorStore } from "../stores/motorStore";

/**
 * Inventario real del proyecto activo, en la forma que el módulo consumía del
 * mock.
 *
 * Los catorce archivos del módulo leían `PROPIEDADES`, `TORRES_POR_ID`, etc.
 * como constantes de módulo. Estos selectores les dan lo mismo, pero del
 * inventario cargado y acotado al proyecto que está seleccionado, que es el
 * único que esas pantallas muestran.
 *
 * Vive aparte de `inventarioStore` para no crear un ciclo de importación:
 * `motorStore` ya depende del store de inventario, y aquí se necesitan los dos.
 */

const SIN_PROPIEDADES: Propiedad[] = [];
const SIN_TORRES: Torre[] = [];
const SIN_MODELOS: Modelo[] = [];

export function useIdProyectoActivo(): string {
  return useMotorStore((s) => s.idProyectoActivo);
}

/** Proyectos comercializados por SOZU. */
export function useProyectosPrecios(): Proyecto[] {
  return useInventarioStore((s) => s.proyectos);
}

/** El proyecto activo, ya resuelto. `null` mientras carga la lista. */
export function useProyectoActivo(): Proyecto | null {
  const id = useIdProyectoActivo();
  const proyectos = useProyectosPrecios();
  return useMemo(
    () => proyectos.find((p) => p.id_proyecto === id) ?? null,
    [proyectos, id],
  );
}

export function usePropiedadesActivas(): Propiedad[] {
  const id = useIdProyectoActivo();
  const porProyecto = useInventarioStore((s) => s.porProyecto);
  return porProyecto[id]?.propiedades ?? SIN_PROPIEDADES;
}

export function useTorresActivas(): Torre[] {
  const id = useIdProyectoActivo();
  const porProyecto = useInventarioStore((s) => s.porProyecto);
  return porProyecto[id]?.torres ?? SIN_TORRES;
}

export function useModelosActivos(): Modelo[] {
  const id = useIdProyectoActivo();
  const porProyecto = useInventarioStore((s) => s.porProyecto);
  return porProyecto[id]?.modelos ?? SIN_MODELOS;
}

const INDICES_VACIOS: IndicesProyecto = {
  torresPorId: {},
  modelosPorId: {},
  propiedadesPorId: {},
};

/** `torresPorId`, `modelosPorId` y `propiedadesPorId` del proyecto activo. */
export function useIndicesActivos(): IndicesProyecto {
  const id = useIdProyectoActivo();
  const indices = useInventarioStore((s) => s.indices);
  return indices[id] ?? INDICES_VACIOS;
}

/**
 * Extras que el inventario del proyecto activo realmente usa.
 *
 * El mock traía una lista fija de quince características. El catálogo real
 * (`caracteristicas`) es más amplio y cada desarrollo usa un subconjunto, así
 * que tarifar sobre lo que de verdad aparece evita una tabla de factores llena
 * de renglones que no aplican a ninguna unidad.
 */
export function useExtrasDelProyecto(): string[] {
  const propiedades = usePropiedadesActivas();
  return useMemo(
    () =>
      Array.from(new Set(propiedades.flatMap((p) => p.caracteristicas_extra))).sort(),
    [propiedades],
  );
}
