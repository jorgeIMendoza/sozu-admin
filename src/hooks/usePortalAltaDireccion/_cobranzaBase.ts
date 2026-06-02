import { supabase } from "@/integrations/supabase/client";

/**
 * Pipeline compartido para los 4 hooks de Análisis de Cobranza.
 *
 * Definiciones (alineadas con `useCobrosPorGestionar` y los hooks legacy):
 *  - **Emitido**: cuenta cerró venta (`fecha_compra IS NOT NULL`). El derecho
 *    de cobro ya nació, exista o no factura timbrada formalmente.
 *  - **Cobrado**: `es_pagada_comision_venta = true` (con o sin
 *    `fecha_pago_comision`).
 *  - **Por cobrar**: emitida sin cobrar.
 *  - **Vencido > 30 d**: emitida sin cobrar con `fecha_compra` hace más de
 *    30 días.
 *  - **Monto de comisión** = `precio_final × porcentaje_comision_venta / 100
 *    × (1.16 si iva_incluido)`.
 *  - **Desarrollador (titular)** = `propiedad.id_entidad_relacionada_dueno`
 *    → `entidades_relacionadas.id_persona` → `personas`.
 *  - **Días desde emisión** = `today - fecha_compra` (proxy: la emisión
 *    formal se marca con `fecha_actualizacion` cuando se timbra, pero
 *    como el universo "facturado formalmente" hoy es ~1 cuenta, usamos
 *    `fecha_compra` que es la referencia operativa para el derecho de
 *    cobro).
 */

const PAGE_SIZE = 1000;

export type TipoCobranza = "Propiedad" | "Producto" | "Servicio";

export interface CobranzaRow {
  id_cuenta: number;
  tipo: TipoCobranza;
  monto_comision: number;
  fecha_compra: string | null;     // ISO date
  fecha_pago_comision: string | null;
  es_pagada: boolean;
  id_proyecto: number | null;
  id_persona_desarrollador: number | null;
  desarrollador_nombre: string;
  dias_desde_emision: number | null;  // null si aún no se ha "emitido" (sin fecha_compra)
}

export interface CobranzaBaseDataset {
  rows: CobranzaRow[];
  /** Mapa de id_proyecto → nombre para filtros / displays. */
  proyectosMap: Map<number, string>;
}

export async function fetchCobranzaBase(): Promise<CobranzaBaseDataset> {
  // 1) Cuentas activas, sin padre, paginadas.
  const cuentas: Array<any> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        "id, id_oferta, id_propiedad, precio_final, porcentaje_comision_venta, iva_incluido, fecha_compra, fecha_pago_comision, es_pagada_comision_venta",
      )
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    cuentas.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (offset > 100_000) break;
  }
  if (cuentas.length === 0) {
    return { rows: [], proyectosMap: new Map() };
  }

  // 2) Ofertas — id_propiedad fallback + id_producto para deducir tipo.
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const ofertas: Array<any> = [];
  for (let i = 0; i < ofertaIds.length; i += PAGE_SIZE) {
    const slice = ofertaIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto")
      .in("id", slice);
    if (error) throw error;
    ofertas.push(...((data || []) as Array<any>));
  }
  const ofPropMap = new Map<number, number | null>(
    ofertas.map((o) => [o.id as number, (o.id_propiedad ?? null) as number | null]),
  );
  const ofProductoMap = new Map<number, number | null>(
    ofertas.map((o) => [o.id as number, (o.id_producto ?? null) as number | null]),
  );

  // 2b) Productos → categoría (Producto vs Servicio).
  const productoIds = Array.from(
    new Set(ofertas.map((o) => o.id_producto).filter((v): v is number => !!v)),
  );
  const { data: prodRows } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const productoTipoMap = new Map<number, "Producto" | "Servicio">(
    ((prodRows || []) as Array<any>).map((p) => {
      const cat = (p.categorias_producto?.nombre ?? "").toLowerCase();
      return [p.id as number, cat === "servicios" ? "Servicio" : "Producto"];
    }),
  );

  // 3) Propiedades → id_entidad_relacionada_dueno + id_edificio_modelo.
  const propIds = Array.from(
    new Set(
      cuentas
        .map((c) => c.id_propiedad ?? (c.id_oferta ? ofPropMap.get(c.id_oferta) : null) ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  const propsRows: Array<any> = [];
  for (let i = 0; i < propIds.length; i += PAGE_SIZE) {
    const slice = propIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("propiedades")
      .select("id, id_entidad_relacionada_dueno, id_edificio_modelo")
      .in("id", slice);
    if (error) throw error;
    propsRows.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(propsRows.map((p) => [p.id, p]));

  // 4) edificios_modelos → id_edificio → id_proyecto.
  const emIds = Array.from(
    new Set(propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
  );
  const { data: emRows } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_edificio")
        .in("id", emIds)) as any)
    : { data: [] };
  const emEdMap = new Map<number, number | null>(
    ((emRows || []) as Array<any>).map((e) => [e.id as number, (e.id_edificio ?? null) as number | null]),
  );
  const edIds = Array.from(
    new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
  );
  const { data: edRows } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const edProyMap = new Map<number, number | null>(
    ((edRows || []) as Array<any>).map((e) => [e.id as number, (e.id_proyecto ?? null) as number | null]),
  );
  const projIds = Array.from(
    new Set(((edRows || []) as Array<any>).map((e) => e.id_proyecto).filter((v): v is number => !!v)),
  );
  const { data: projRows } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const proyectosMap = new Map<number, string>(
    ((projRows || []) as Array<any>).map((p) => [p.id as number, p.nombre as string]),
  );

  // 5) Entidades relacionadas → id_persona → personas.
  const entIds = Array.from(
    new Set(
      propsRows.map((p) => p.id_entidad_relacionada_dueno).filter((v): v is number => !!v),
    ),
  );
  const { data: entRows } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona")
        .in("id", entIds)) as any)
    : { data: [] };
  const entPersonaMap = new Map<number, number | null>(
    ((entRows || []) as Array<any>).map((e) => [e.id as number, (e.id_persona ?? null) as number | null]),
  );
  const personaIds = Array.from(
    new Set(
      ((entRows || []) as Array<any>).map((e) => e.id_persona).filter((v): v is number => !!v),
    ),
  );
  const { data: persRows } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, nombre_comercial")
        .in("id", personaIds)) as any)
    : { data: [] };
  const personaNombreMap = new Map<number, string>(
    ((persRows || []) as Array<any>).map((p) => [
      p.id as number,
      (p.nombre_comercial || p.nombre_legal || "Sin nombre") as string,
    ]),
  );

  // 6) Compose rows.
  const now = Date.now();
  const rows: CobranzaRow[] = cuentas.map((c) => {
    const idProp = c.id_propiedad ?? (c.id_oferta ? ofPropMap.get(c.id_oferta) : null) ?? null;
    const prop = idProp ? propMap.get(idProp) : null;
    const idEnt = prop?.id_entidad_relacionada_dueno ?? null;
    const idPersona = idEnt ? entPersonaMap.get(idEnt) ?? null : null;
    const nombreDesarrollador = idPersona ? personaNombreMap.get(idPersona) ?? "Sin desarrollador" : "Sin desarrollador";
    const idEm = prop?.id_edificio_modelo ?? null;
    const idEd = idEm ? emEdMap.get(idEm) ?? null : null;
    const idProy = idEd ? edProyMap.get(idEd) ?? null : null;

    const idProducto = c.id_oferta ? ofProductoMap.get(c.id_oferta) ?? null : null;
    let tipo: TipoCobranza = "Propiedad";
    if (idProducto) {
      tipo = productoTipoMap.get(idProducto) ?? "Producto";
    }

    const precio = Number(c.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision_venta ?? 0);
    const subtotal = (precio * pct) / 100;
    const monto = c.iva_incluido ? subtotal * 1.16 : subtotal;

    let diasDesdeEmision: number | null = null;
    if (c.fecha_compra) {
      const dt = new Date(c.fecha_compra).getTime();
      diasDesdeEmision = Math.max(0, Math.floor((now - dt) / 86_400_000));
    }

    return {
      id_cuenta: c.id as number,
      tipo,
      monto_comision: +monto.toFixed(2),
      fecha_compra: (c.fecha_compra as string | null) ?? null,
      fecha_pago_comision: (c.fecha_pago_comision as string | null) ?? null,
      es_pagada: !!c.es_pagada_comision_venta,
      id_proyecto: idProy,
      id_persona_desarrollador: idPersona,
      desarrollador_nombre: nombreDesarrollador,
      dias_desde_emision: diasDesdeEmision,
    };
  });

  return { rows, proyectosMap };
}

/* ───────────── Utilidades de filtros ───────────── */

export type PeriodoCobranza =
  | "este_mes"
  | "ultimos_3_meses"
  | "ultimos_12_meses"
  | "todo";

export function startDateForPeriodo(periodo: PeriodoCobranza): Date {
  const now = new Date();
  if (periodo === "este_mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (periodo === "ultimos_3_meses") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  if (periodo === "ultimos_12_meses") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    return d;
  }
  return new Date(0); // todo
}

export interface CobranzaFiltros {
  idProyecto: number | null;
  tipo: TipoCobranza | "todos";
  /** id_persona del desarrollador. */
  idDesarrollador: number | null;
  /** Rango personalizado para filtrar por fecha_compra. */
  fechaInicio: string | null;
  fechaFin: string | null;
}

export const EMPTY_FILTROS: CobranzaFiltros = {
  idProyecto: null,
  tipo: "todos",
  idDesarrollador: null,
  fechaInicio: null,
  fechaFin: null,
};

export function filtrarRows(
  rows: CobranzaRow[],
  filtros: CobranzaFiltros,
): CobranzaRow[] {
  const { idProyecto, tipo, idDesarrollador, fechaInicio, fechaFin } = filtros;
  const rangoActivo = !!(fechaInicio && fechaFin && fechaInicio <= fechaFin);
  return rows.filter((r) => {
    if (idProyecto !== null && r.id_proyecto !== idProyecto) return false;
    if (tipo !== "todos" && r.tipo !== tipo) return false;
    if (idDesarrollador !== null && r.id_persona_desarrollador !== idDesarrollador) return false;
    if (rangoActivo) {
      if (!r.fecha_compra) return false;
      const f = r.fecha_compra.slice(0, 10);
      if (f < fechaInicio! || f > fechaFin!) return false;
    }
    return true;
  });
}

/** Lista de desarrolladores observados en el dataset, para el `<Select>`. */
export function listarDesarrolladores(
  rows: CobranzaRow[],
): Array<{ id: number; nombre: string }> {
  const map = new Map<number, string>();
  for (const r of rows) {
    if (r.id_persona_desarrollador && !map.has(r.id_persona_desarrollador)) {
      map.set(r.id_persona_desarrollador, r.desarrollador_nombre);
    }
  }
  return Array.from(map.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
