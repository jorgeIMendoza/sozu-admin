import { supabase } from "@/integrations/supabase/client";

export interface BodegaIncluida {
  id: number;
  nombre: string;
  m2: number;
  /** Costo = productos_servicios.precio_lista (precio por m²) × bodega.m2 */
  costo: number;
}

/**
 * Costo de las bodegas con `es_incluido = true` de una propiedad.
 *
 * Regla de negocio: una bodega incluida NO se cobra por separado, pero su valor
 * SÍ suma al precio de la unidad. El precio final de la oferta / cuenta de cobranza
 * se calcula como `(precio_lista_depa + Σ costo_bodega_incluida) × (1 + %descuento/100)`.
 *
 * El precio por m² de la bodega vive en `productos_servicios.precio_lista`
 * (vía `bodegas.id_producto`). Bodega incluida sin producto → costo 0.
 */
export async function getBodegasIncluidasCosto(
  propiedadId: number,
): Promise<{ total: number; bodegas: BodegaIncluida[] }> {
  if (!propiedadId) return { total: 0, bodegas: [] };

  const { data: rows } = await (supabase as any)
    .from("bodegas")
    .select("id, nombre, m2, id_producto")
    .eq("id_propiedad", propiedadId)
    .eq("es_incluido", true)
    .eq("activo", true);

  const bodegasRows = ((rows as any[]) ?? []);
  if (bodegasRows.length === 0) return { total: 0, bodegas: [] };

  // Precio por m² de cada bodega desde su producto (waterfall, sin embed).
  const productoIds = [
    ...new Set(bodegasRows.map((b) => b.id_producto).filter((v) => v != null)),
  ];
  const precioByProducto: Record<number, number> = {};
  if (productoIds.length > 0) {
    const { data: prods } = await (supabase as any)
      .from("productos_servicios")
      .select("id, precio_lista")
      .in("id", productoIds);
    for (const p of (prods as any[]) ?? []) {
      precioByProducto[p.id] = Number(p.precio_lista ?? 0);
    }
  }

  const bodegas: BodegaIncluida[] = bodegasRows.map((b) => {
    const m2 = Number(b.m2 ?? 0);
    const precioM2 = b.id_producto != null ? precioByProducto[b.id_producto] ?? 0 : 0;
    return { id: b.id, nombre: b.nombre ?? "", m2, costo: precioM2 * m2 };
  });
  const total = bodegas.reduce((s, b) => s + b.costo, 0);
  return { total, bodegas };
}
