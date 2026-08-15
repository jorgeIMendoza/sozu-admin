import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { fetchAllRows, fetchInBatches } from "@/utils/supabasePagination";

/**
 * Forecast de Ingresos — fuente de verdad ÚNICA.
 *
 * Estimación = Σ precio_final de cuentas_cobranza cuya propiedad tenga
 * estatus_disponibilidad ∈ {Inventario(1), Apartada(4), Vendido(5),
 * Escrituración(7), Entregada(8), Pagada(9), En demanda(11)}
 * + Σ precio_lista de propiedades con estatus Disponible(2).
 * Limitado a proyectos comercializados por SOZU (entidad relacionada tipo 5).
 *
 * El total global (sin filtros) es el que muestra el KPI "Forecast total" de
 * la pantalla Forecast de Ingresos del Portal Alta Dirección. Se comparte vía
 * react-query (misma queryKey) para que cualquier consumidor obtenga el mismo
 * número.
 */

export type Tipo = "Propiedad" | "Producto" | "Servicio";
export type FuenteForecast = "cuenta" | "inventario";

export interface ForecastRow {
  fuente: FuenteForecast;
  id: number;
  folio: string;
  tipo: Tipo;
  proyecto_id: number | null;
  proyecto_nombre: string;
  desarrollador_id: number | null;
  desarrollador_nombre: string;
  estatus_id: number | null;
  estatus_nombre: string;
  monto: number;
  numero_propiedad: string;
  edificio_nombre: string;
}

/** IDs de `estatus_disponibilidad` aceptados para el forecast (CLAUDE.md). */
export const ESTATUS_FORECAST_CUENTA = [1, 4, 5, 7, 8, 9, 11] as const;
export const ESTATUS_DISPONIBLE = 2 as const;

export const ESTATUS_LABEL: Record<number, string> = {
  1: "Inventario",
  2: "Disponible",
  4: "Apartada",
  5: "Vendido",
  7: "Escrituración",
  8: "Entregada",
  9: "Pagada completamente",
  11: "En demanda",
};

export async function fetchForecast(): Promise<ForecastRow[]> {
  // 0) En PARALELO: proyectos SOZU (entidad tipo 5) + cuentas de cobranza con flujo.
  const [relsSozu, cuentas] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      (supabase as any)
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", 5)
        .eq("activo", true)
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("cuentas_cobranza")
        .select("id, precio_final, id_propiedad, id_oferta")
        .eq("activo", true)
        .is("id_cuenta_cobranza_padre", null)
        .gt("precio_final", 0)
        .range(from, to),
    ),
  ]);

  const sozuProyectoIds = new Set<number>(
    relsSozu.map((r: any) => r.id_proyecto).filter((x: any): x is number => !!x),
  );
  const esProyectoSozu = (proyectoId: number | null) =>
    proyectoId != null && sozuProyectoIds.has(proyectoId);

  // 1) Edificios y modelos de los proyectos SOZU. Esto ACOTA el inventario a
  //    ~cientos de propiedades (SOZU) en vez de traer el catálogo completo
  //    (decenas de miles) para descartarlo en el cliente, y sirve para resolver
  //    las dimensiones (proyecto/edificio) sin fetches extra.
  const sozuProyIdList = Array.from(sozuProyectoIds);
  const eds = sozuProyIdList.length === 0
    ? []
    : await fetchInBatches<any>(sozuProyIdList, (batch) =>
        (supabase as any)
          .from("edificios")
          .select("id, nombre, id_proyecto")
          .in("id_proyecto", batch as number[]),
      );
  const edMap = new Map<number, any>(eds.map((e: any) => [e.id, e]));
  const sozuEdIds = eds.map((e: any) => e.id);
  const ems = sozuEdIds.length === 0
    ? []
    : await fetchInBatches<any>(sozuEdIds, (batch) =>
        (supabase as any)
          .from("edificios_modelos")
          .select("id, id_edificio")
          .in("id_edificio", batch as number[]),
      );
  const emMap = new Map<number, any>(ems.map((e: any) => [e.id, e]));
  const sozuEmIds = ems.map((e: any) => e.id);

  // 2) En PARALELO: inventario disponible SOLO de proyectos SOZU (acotado por
  //    modelo) + ofertas de las cuentas.
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((x): x is number => !!x)),
  );
  const [propiedadesDisponibles, ofertas] = await Promise.all([
    sozuEmIds.length === 0
      ? Promise.resolve([] as any[])
      : fetchInBatches<any>(sozuEmIds, (batch) =>
          (supabase as any)
            .from("propiedades")
            .select(
              "id, numero_propiedad, precio_lista, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
            )
            .in("id_edificio_modelo", batch as number[])
            .eq("activo", true)
            .eq("id_estatus_disponibilidad", ESTATUS_DISPONIBLE),
        ),
    fetchInBatches<any>(ofertaIds, (batch) =>
      supabase.from("ofertas").select("id, id_propiedad, id_producto").in("id", batch as number[]),
    ),
  ]);
  const ofMap = new Map<number, any>(ofertas.map((o) => [o.id, o]));

  // 3) En PARALELO: productos (tipo) + propiedades de las cuentas (por id).
  const productoIds = Array.from(
    new Set(ofertas.map((o) => o.id_producto).filter((x): x is number => !!x)),
  );
  const propIdsCuentas = Array.from(
    new Set([
      ...cuentas.map((c) => c.id_propiedad).filter((x): x is number => !!x),
      ...ofertas.map((o) => o.id_propiedad).filter((x): x is number => !!x),
    ]),
  );
  const [productos, propsCuentas] = await Promise.all([
    fetchInBatches<any>(productoIds, (batch) =>
      (supabase as any)
        .from("productos_servicios")
        .select("id, nombre, categorias_producto!productos_servicios_id_categoria_fkey(nombre)")
        .in("id", batch as number[]),
    ),
    fetchInBatches<any>(propIdsCuentas, (batch) =>
      (supabase as any)
        .from("propiedades")
        .select(
          "id, numero_propiedad, precio_lista, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
        )
        .in("id", batch as number[]),
    ),
  ]);
  const productoTipoById = new Map<number, Tipo>(
    productos.map((p: any) => [
      p.id,
      ((p.categorias_producto?.nombre || "").toLowerCase() === "servicios"
        ? "Servicio"
        : "Producto") as Tipo,
    ]),
  );

  // Propiedades involucradas: inventario disponible (SOZU) + las de las cuentas.
  const propMap = new Map<number, any>();
  [...propsCuentas, ...propiedadesDisponibles].forEach((p: any) => propMap.set(p.id, p));

  // 4) En PARALELO: nombres de proyecto + desarrolladores de las propiedades.
  const projIds = Array.from(
    new Set(eds.map((e: any) => e.id_proyecto).filter((x: any): x is number => !!x)),
  );
  const entIds = Array.from(
    new Set(
      [...propsCuentas, ...propiedadesDisponibles]
        .map((p: any) => p.id_entidad_relacionada_dueno)
        .filter((x: any): x is number => !!x),
    ),
  );
  const [projs, ents] = await Promise.all([
    fetchInBatches<any>(projIds, (batch) =>
      (supabase as any).from("proyectos").select("id, nombre").in("id", batch as number[]),
    ),
    fetchInBatches<any>(entIds, (batch) =>
      (supabase as any)
        .from("entidades_relacionadas")
        .select("id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
        .in("id", batch as number[]),
    ),
  ]);
  const projMap = new Map<number, any>(projs.map((p: any) => [p.id, p]));
  const entMap = new Map<number, { id: number; nombre: string }>(
    ents.map((e: any) => [
      e.id,
      {
        id: e.id,
        nombre: e.personas?.nombre_comercial || e.personas?.nombre_legal || "Sin desarrollador",
      },
    ]),
  );

  const resolverDimensiones = (prop: any) => {
    const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
    const ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoId = ed?.id_proyecto ?? null;
    const proyecto = proyectoId ? projMap.get(proyectoId) : null;
    const desarrolladorId = prop?.id_entidad_relacionada_dueno ?? null;
    const desarrollador = desarrolladorId ? entMap.get(desarrolladorId) : null;
    return {
      proyecto_id: proyectoId,
      proyecto_nombre: proyecto?.nombre ?? "Sin proyecto",
      edificio_nombre: ed?.nombre ?? "",
      desarrollador_id: desarrolladorId,
      desarrollador_nombre: desarrollador?.nombre ?? "Sin desarrollador",
    };
  };

  const rows: ForecastRow[] = [];
  const estatusElegibles = new Set<number>(ESTATUS_FORECAST_CUENTA);

  for (const c of cuentas) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const estatusId = prop?.id_estatus_disponibilidad ?? null;

    let tipo: Tipo = "Propiedad";
    if (oferta?.id_producto) {
      tipo = productoTipoById.get(oferta.id_producto) ?? "Producto";
    }

    const esProductoServicioPuro = idPropEfectivo == null;
    if (!esProductoServicioPuro && !estatusElegibles.has(estatusId ?? -1)) continue;

    const dims = resolverDimensiones(prop);
    if (!esProductoServicioPuro && !esProyectoSozu(dims.proyecto_id)) continue;
    rows.push({
      fuente: "cuenta",
      id: c.id,
      folio: formatCuentaCobranzaId(c.id, tipo),
      tipo,
      ...dims,
      estatus_id: estatusId,
      estatus_nombre: estatusId != null
        ? ESTATUS_LABEL[estatusId] ?? `Estatus ${estatusId}`
        : tipo === "Propiedad" ? "Sin estatus" : "Producto/Servicio",
      monto: Number(c.precio_final ?? 0),
      numero_propiedad: prop?.numero_propiedad ?? "",
    });
  }

  for (const p of propiedadesDisponibles) {
    const dims = resolverDimensiones(p);
    if (!esProyectoSozu(dims.proyecto_id)) continue;
    const precio = Number(p.precio_lista ?? 0);
    rows.push({
      fuente: "inventario",
      id: p.id,
      folio: `PROP-${String(p.id).padStart(6, "0")}`,
      tipo: "Propiedad",
      ...dims,
      estatus_id: ESTATUS_DISPONIBLE,
      estatus_nombre: ESTATUS_LABEL[ESTATUS_DISPONIBLE],
      monto: precio,
      numero_propiedad: p.numero_propiedad ?? "",
    });
  }

  return rows;
}

/** Hook que entrega las filas del forecast (compartido vía react-query). */
export function useForecastIngresos() {
  return useQuery<ForecastRow[]>({
    queryKey: ["forecast-ingresos"],
    staleTime: 5 * 60_000,
    queryFn: fetchForecast,
  });
}

/**
 * Total GLOBAL del forecast (todos los tipos, todos los proyectos SOZU) — el
 * mismo número del KPI "Forecast total". Pensado para consumidores que solo
 * necesitan el monto agregado (p.ej. Estructura de comisiones · Proyectos).
 */
export function useForecastTotalGlobal() {
  const query = useForecastIngresos();
  const data = useMemo(() => {
    const rows = query.data ?? [];
    return { total: rows.reduce((s, r) => s + r.monto, 0), registros: rows.length };
  }, [query.data]);
  return { ...data, isLoading: query.isLoading, error: query.error as Error | null };
}
