import { supabase } from "@/integrations/supabase/client";

/**
 * Valor total de una unidad = precio de lista + bodegas + estacionamientos.
 *
 * Regla de negocio (2026-08-14): la tarjeta de Inventario muestra **el valor total y
 * punto**, sin desglose. El desglose (qué es bodega, qué estacionamiento, cuál viene
 * incluido) se ve al generar la oferta. Antes la tarjeta mostraba solo
 * `propiedades.precio_lista`, así que el agente cotizaba un número y al abrir la
 * oferta le aparecía otro — p. ej. V-503 BELLARA (Monócolo): $9,381,714.05 en la
 * tarjeta contra $9,535,014.05 con su bodega incluida.
 *
 * Costo de cada producto = `productos_servicios.precio_lista` (precio por m²) × `m2`.
 * Se suman **todos** los activos, incluidos o no: no todas las unidades traen los
 * mismos productos y el agente necesita el total de lo que sí trae esa unidad.
 */
export interface ExtrasUnidad {
  /** Suma de bodegas + estacionamientos activos de la propiedad. */
  total: number;
  bodegas: number;
  estacionamientos: number;
}

const VACIO: ExtrasUnidad = { total: 0, bodegas: 0, estacionamientos: 0 };

/** Costo de los productos de una lista de propiedades, en un solo viaje por tabla. */
export async function fetchExtrasPorPropiedad(
  propiedadIds: number[],
): Promise<Map<number, ExtrasUnidad>> {
  const mapa = new Map<number, ExtrasUnidad>();
  const ids = [...new Set(propiedadIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return mapa;

  // Waterfall explícito: el embed anidado de PostgREST falla en silencio en estas tablas.
  const [bodegasRes, estacionamientosRes] = await Promise.all([
    (supabase as any)
      .from("bodegas")
      .select("id_propiedad, m2, id_producto")
      .in("id_propiedad", ids)
      .eq("activo", true),
    (supabase as any)
      .from("estacionamientos")
      .select("id_propiedad, m2, id_producto")
      .in("id_propiedad", ids)
      .eq("activo", true),
  ]);

  const bodegas = (bodegasRes?.data ?? []) as any[];
  const estacionamientos = (estacionamientosRes?.data ?? []) as any[];
  if (bodegas.length === 0 && estacionamientos.length === 0) return mapa;

  const productoIds = [
    ...new Set(
      [...bodegas, ...estacionamientos]
        .map((f) => f.id_producto)
        .filter((v) => v != null),
    ),
  ];
  const precioM2 = new Map<number, number>();
  if (productoIds.length > 0) {
    const { data: productos } = await (supabase as any)
      .from("productos_servicios")
      .select("id, precio_lista")
      .in("id", productoIds);
    for (const p of (productos as any[]) ?? []) {
      precioM2.set(p.id, Number(p.precio_lista ?? 0));
    }
  }

  const acumular = (filas: any[], campo: "bodegas" | "estacionamientos") => {
    for (const f of filas) {
      const costo = (f.id_producto != null ? precioM2.get(f.id_producto) ?? 0 : 0) * Number(f.m2 ?? 0);
      if (!costo) continue;
      const actual = mapa.get(f.id_propiedad) ?? { ...VACIO };
      actual[campo] += costo;
      actual.total += costo;
      mapa.set(f.id_propiedad, actual);
    }
  };
  acumular(bodegas, "bodegas");
  acumular(estacionamientos, "estacionamientos");

  return mapa;
}

export interface ExtraUnidad {
  id: string;
  tipo: "bodega" | "estacionamiento";
  nombre: string;
  costo: number;
}

/**
 * Extras de una unidad con su detalle. Lo usa el detalle previo a la oferta, que sí
 * desglosa; la tarjeta del listado solo muestra el total (`fetchExtrasPorPropiedad`).
 * Misma fórmula en los dos casos: precio por m² del producto × m² del producto.
 */
export async function fetchExtrasDetalleUnidad(
  propiedadId: number | null | undefined,
): Promise<ExtraUnidad[]> {
  if (!propiedadId) return [];
  const [bodegasRes, estacionamientosRes] = await Promise.all([
    (supabase as any)
      .from("bodegas")
      .select("id, nombre, m2, productos_servicios!bodegas_id_producto_fkey(precio_lista)")
      .eq("id_propiedad", propiedadId)
      .eq("activo", true),
    (supabase as any)
      .from("estacionamientos")
      .select("id, nombre, m2, productos_servicios!estacionamientos_id_producto_fkey(precio_lista)")
      .eq("id_propiedad", propiedadId)
      .eq("activo", true),
  ]);

  const mapear = (filas: any[], tipo: ExtraUnidad["tipo"]): ExtraUnidad[] =>
    (filas || []).map((f: any) => ({
      id: `${tipo}-${f.id}`,
      tipo,
      nombre: f.nombre as string,
      costo: ((f.productos_servicios as any)?.precio_lista || 0) * (f.m2 || 0),
    }));

  return [
    ...mapear(bodegasRes?.data, "bodega"),
    ...mapear(estacionamientosRes?.data, "estacionamiento"),
  ];
}

/** Extras de una sola propiedad. Atajo sobre `fetchExtrasPorPropiedad`. */
export async function fetchExtrasUnidad(propiedadId: number | null | undefined): Promise<ExtrasUnidad> {
  if (!propiedadId) return { ...VACIO };
  const mapa = await fetchExtrasPorPropiedad([propiedadId]);
  return mapa.get(propiedadId) ?? { ...VACIO };
}

/** Valor total a mostrar en tarjetas y encabezados de unidad. */
export function precioTotalUnidad(
  precioLista: number | null | undefined,
  extras?: ExtrasUnidad | null,
): number {
  return Number(precioLista ?? 0) + Number(extras?.total ?? 0);
}
