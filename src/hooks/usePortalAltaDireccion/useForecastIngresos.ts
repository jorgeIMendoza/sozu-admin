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

export type Tipo =
  | "Propiedad"
  | "Producto"
  | "Servicio"
  | "Locales comerciales"
  | "Oficinas"
  | "Bodegas comerciales"
  | "Terrenos"
  | "Activo Comercial"
  | "Propiedades Asignadas";
export type FuenteForecast = "cuenta" | "inventario" | "activo_comercial" | "asignada";

/**
 * Activos Comerciales = `propiedades` con `id_tipo_propiedad > 10`, desglosados
 * por subtipo (mismos nombres que el catálogo `tipos_propiedad`):
 *   11 Locales comerciales · 12 Oficinas · 13 Bodegas comerciales · 14 Terrenos.
 * Solo cuentan al forecast los que están `activo` Y `es_aprobado`.
 */
const TIPO_ACTIVO_COMERCIAL_LABEL: Record<number, Tipo> = {
  11: "Locales comerciales",
  12: "Oficinas",
  13: "Bodegas comerciales",
  14: "Terrenos",
};
const esActivoComercial = (idTipoPropiedad: number | null | undefined) =>
  idTipoPropiedad != null && idTipoPropiedad > 10;

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
/** Asignada: propiedad entregada en aportación (socios/aliados/colaboradores). */
export const ESTATUS_ASIGNADA = 10 as const;

export const ESTATUS_LABEL: Record<number, string> = {
  1: "Inventario",
  2: "Disponible",
  4: "Apartada",
  5: "Vendido",
  7: "Escrituración",
  8: "Entregada",
  9: "Pagada completamente",
  10: "Asignada",
  11: "En demanda",
};

export async function fetchForecast(): Promise<ForecastRow[]> {
  // Probe: ¿la base soporta el vínculo DIRECTO `propiedades.id_edificio` (DDL
  //   20260818)? Los activos comerciales nuevos cuelgan del proyecto por esa
  //   columna, no por `id_edificio_modelo`. Si no existe, se lee solo el modelo.
  const probeEdificio = await (supabase as any).from("propiedades").select("id_edificio").limit(0);
  const soportaEdificioDirecto = !probeEdificio.error;
  const AC_COLS =
    "id, numero_propiedad, precio_lista, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad, id_tipo_propiedad" +
    (soportaEdificioDirecto ? ", id_edificio" : "");

  // 0) En PARALELO: proyectos SOZU (entidad tipo 5) + cuentas de cobranza con
  //    flujo + Activos Comerciales activos y aprobados (Locales/Oficinas/
  //    Bodegas/Terrenos). Estos últimos NO se filtran por proyecto SOZU: se
  //    incluyen todos y, si están vinculados a un proyecto, suman a su total.
  const [relsSozu, cuentas, activosComerciales] = await Promise.all([
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
    fetchAllRows<any>((from, to) =>
      (supabase as any)
        .from("propiedades")
        .select(AC_COLS)
        .gt("id_tipo_propiedad", 10)
        .eq("activo", true)
        .eq("es_aprobado", true)
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
  const PROP_INV_COLS =
    "id, numero_propiedad, precio_lista, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad, id_tipo_propiedad";
  const [propiedadesDisponibles, propiedadesAsignadas, ofertas] = await Promise.all([
    sozuEmIds.length === 0
      ? Promise.resolve([] as any[])
      : fetchInBatches<any>(sozuEmIds, (batch) =>
          (supabase as any)
            .from("propiedades")
            .select(PROP_INV_COLS)
            .in("id_edificio_modelo", batch as number[])
            .eq("activo", true)
            .eq("id_estatus_disponibilidad", ESTATUS_DISPONIBLE),
        ),
    // Propiedades en estatus Asignada(10): departamentos entregados en aportación
    // (socios/aliados/colaboradores). No son ingreso de venta pero cuantifican el
    // valor del proyecto — se suman a su total por su valor de mercado (precio_lista).
    sozuEmIds.length === 0
      ? Promise.resolve([] as any[])
      : fetchInBatches<any>(sozuEmIds, (batch) =>
          (supabase as any)
            .from("propiedades")
            .select(PROP_INV_COLS)
            .in("id_edificio_modelo", batch as number[])
            .eq("activo", true)
            .eq("id_estatus_disponibilidad", ESTATUS_ASIGNADA),
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
          "id, numero_propiedad, precio_lista, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad, id_tipo_propiedad",
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
  [...propsCuentas, ...propiedadesDisponibles, ...propiedadesAsignadas].forEach((p: any) => propMap.set(p.id, p));

  // 4) En PARALELO: nombres de proyecto + desarrolladores de las propiedades.
  const projIds = Array.from(
    new Set(eds.map((e: any) => e.id_proyecto).filter((x: any): x is number => !!x)),
  );
  const entIds = Array.from(
    new Set(
      [...propsCuentas, ...propiedadesDisponibles, ...propiedadesAsignadas]
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

  // 4.b) Enriquecer los mapas con la cadena edificio_modelo→edificio→proyecto y
  //      los desarrolladores de los Activos Comerciales que NO cuelgan de un
  //      proyecto SOZU (los SOZU ya están en los mapas). Así `resolverDimensiones`
  //      puede ubicar su proyecto y sumar el valor al total correspondiente.
  const uniqNums = (xs: any[]) =>
    Array.from(new Set(xs.filter((x): x is number => x != null)));
  const acEmFaltantes = uniqNums(activosComerciales.map((a: any) => a.id_edificio_modelo)).filter((id) => !emMap.has(id));
  if (acEmFaltantes.length) {
    const acEms = await fetchInBatches<any>(acEmFaltantes, (batch) =>
      (supabase as any).from("edificios_modelos").select("id, id_edificio").in("id", batch as number[]),
    );
    acEms.forEach((e: any) => emMap.set(e.id, e));
    const acEdFaltantes = uniqNums(acEms.map((e: any) => e.id_edificio)).filter((id) => !edMap.has(id));
    if (acEdFaltantes.length) {
      const acEds = await fetchInBatches<any>(acEdFaltantes, (batch) =>
        (supabase as any).from("edificios").select("id, nombre, id_proyecto").in("id", batch as number[]),
      );
      acEds.forEach((e: any) => edMap.set(e.id, e));
      const acProjFaltantes = uniqNums(acEds.map((e: any) => e.id_proyecto)).filter((id) => !projMap.has(id));
      if (acProjFaltantes.length) {
        const acProjs = await fetchInBatches<any>(acProjFaltantes, (batch) =>
          (supabase as any).from("proyectos").select("id, nombre").in("id", batch as number[]),
        );
        acProjs.forEach((p: any) => projMap.set(p.id, p));
      }
    }
  }
  // Edificios vinculados DIRECTAMENTE (activos comerciales con `id_edificio`) y
  // sus proyectos — para resolver su proyecto por esa vía.
  const acEdDirectFaltantes = uniqNums(activosComerciales.map((a: any) => a.id_edificio)).filter((id) => !edMap.has(id));
  if (acEdDirectFaltantes.length) {
    const acEdsDirect = await fetchInBatches<any>(acEdDirectFaltantes, (batch) =>
      (supabase as any).from("edificios").select("id, nombre, id_proyecto").in("id", batch as number[]),
    );
    acEdsDirect.forEach((e: any) => edMap.set(e.id, e));
    const acProjDirectFaltantes = uniqNums(acEdsDirect.map((e: any) => e.id_proyecto)).filter((id) => !projMap.has(id));
    if (acProjDirectFaltantes.length) {
      const acProjsDirect = await fetchInBatches<any>(acProjDirectFaltantes, (batch) =>
        (supabase as any).from("proyectos").select("id, nombre").in("id", batch as number[]),
      );
      acProjsDirect.forEach((p: any) => projMap.set(p.id, p));
    }
  }

  const acEntFaltantes = uniqNums(activosComerciales.map((a: any) => a.id_entidad_relacionada_dueno)).filter((id) => !entMap.has(id));
  if (acEntFaltantes.length) {
    const acEnts = await fetchInBatches<any>(acEntFaltantes, (batch) =>
      (supabase as any)
        .from("entidades_relacionadas")
        .select("id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
        .in("id", batch as number[]),
    );
    acEnts.forEach((e: any) =>
      entMap.set(e.id, {
        id: e.id,
        nombre: e.personas?.nombre_comercial || e.personas?.nombre_legal || "Sin desarrollador",
      }),
    );
  }

  const resolverDimensiones = (prop: any) => {
    // Vínculo DIRECTO con edificio (activos comerciales, DDL `id_edificio`) tiene
    // prioridad; si no, la vía estándar `edificio_modelo → edificio`.
    let ed = prop?.id_edificio ? edMap.get(prop.id_edificio) : null;
    if (!ed) {
      const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
      ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    }
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
    // Los Activos Comerciales se contabilizan aparte (por su valor registrado),
    // no por la cuenta: se omiten aquí para no duplicar.
    if (prop && esActivoComercial(prop.id_tipo_propiedad)) continue;
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
      folio: formatCuentaCobranzaId(c.id, tipo === "Propiedad" ? "Propiedad" : "Producto"),
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
    // Los Activos Comerciales se contabilizan en su propia rama.
    if (esActivoComercial(p.id_tipo_propiedad)) continue;
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

  // Propiedades en estatus Asignada(10): departamentos entregados en aportación.
  // Se cuantifican por su valor de mercado (precio_lista) y suman al total del
  // proyecto. Se excluyen las que sean activos comerciales (ya contadas aparte).
  for (const p of propiedadesAsignadas) {
    if (esActivoComercial(p.id_tipo_propiedad)) continue;
    const dims = resolverDimensiones(p);
    if (!esProyectoSozu(dims.proyecto_id)) continue;
    rows.push({
      fuente: "asignada",
      id: p.id,
      folio: `PROP-${String(p.id).padStart(6, "0")}`,
      tipo: "Propiedades Asignadas",
      ...dims,
      estatus_id: ESTATUS_ASIGNADA,
      estatus_nombre: ESTATUS_LABEL[ESTATUS_ASIGNADA],
      monto: Number(p.precio_lista ?? 0),
      numero_propiedad: p.numero_propiedad ?? "",
    });
  }

  // Activos Comerciales (Locales/Oficinas/Bodegas/Terrenos) activos y aprobados.
  // Suman su valor registrado (precio_lista) como un Tipo de Ingreso propio; si
  // están vinculados a un proyecto, ese valor cae en el total del proyecto (vía
  // `resolverDimensiones`). Los terrenos/independientes quedan "Sin proyecto".
  for (const a of activosComerciales as any[]) {
    const dims = resolverDimensiones(a);
    const estatusId = a.id_estatus_disponibilidad ?? null;
    rows.push({
      fuente: "activo_comercial",
      id: a.id,
      folio: `AC-${String(a.id).padStart(6, "0")}`,
      tipo: TIPO_ACTIVO_COMERCIAL_LABEL[a.id_tipo_propiedad] ?? "Activo Comercial",
      ...dims,
      estatus_id: estatusId,
      estatus_nombre: estatusId != null ? (ESTATUS_LABEL[estatusId] ?? `Estatus ${estatusId}`) : "—",
      monto: Number(a.precio_lista ?? 0),
      numero_propiedad: a.numero_propiedad ?? "",
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
