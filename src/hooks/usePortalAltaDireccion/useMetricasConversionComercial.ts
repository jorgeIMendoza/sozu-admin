import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TipoCuenta } from "./useHistoricoComercial";

/**
 * Velocidad de conversión y ciclo promedio de venta — agregación
 * client-side. Reglas:
 *  - Universo = cuentas con propiedad existente (sólo aplica a tipo
 *    Propiedad). Productos/Servicios no tienen "apartado".
 *  - Apartados últimos 90 días = cuentas cuya `fecha_creacion` cae en
 *    los últimos 90 días Y cuya propiedad tiene `id_estatus = 4`
 *    (apartadas hoy) o pasó a 5 (vendido) — i.e. todos los apartados
 *    iniciados en esa ventana.
 *  - Convertidos = del set anterior, los que ya tienen `fecha_compra
 *    NOT NULL` Y propiedad en `id_estatus = 5`.
 *  - Velocidad = convertidos / total * 100.
 *  - Ciclo promedio = AVG(fecha_compra - fecha_creacion) en días sobre
 *    los convertidos.
 *
 * Filtros opcionales: idProyecto, tipo (no aplica a Producto/Servicio).
 */

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const ESTATUS_EN_CICLO = [ESTATUS_APARTADO, ESTATUS_VENDIDO];
const PAGE_SIZE = 1000;

export interface MetricasConversionComercial {
  velocidad_conversion_pct: number;
  ciclo_promedio_dias: number;
  apartados_ultimos_90d_count: number;
  apartados_convertidos_count: number;
}

export interface MetricasConversionResult {
  data: MetricasConversionComercial | null;
  isLoading: boolean;
  error: Error | null;
  rpcMissing: boolean;
}

export function useMetricasConversionComercial(
  idProyecto: number | null,
  tipo: TipoCuenta = "todos",
): MetricasConversionResult {
  const query = useQuery({
    queryKey: ["metricas-conversion-comercial", idProyecto, tipo],
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: () => fetchMetricas(idProyecto, tipo),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

async function fetchMetricas(
  idProyecto: number | null,
  tipo: TipoCuenta,
): Promise<MetricasConversionComercial> {
  // Si el filtro es Producto o Servicio, no hay noción de "apartado":
  // devolvemos 0s sin pegarle a BD.
  if (tipo === "Producto" || tipo === "Servicio") {
    return {
      velocidad_conversion_pct: 0,
      ciclo_promedio_dias: 0,
      apartados_ultimos_90d_count: 0,
      apartados_convertidos_count: 0,
    };
  }

  const hace90 = new Date();
  hace90.setDate(hace90.getDate() - 90);
  const hace90Iso = hace90.toISOString();

  // 1) Cuentas creadas en los últimos 90 días.
  const cuentas: Array<any> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("cuentas_cobranza")
      .select("id, id_oferta, id_propiedad, fecha_compra, fecha_creacion")
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .gte("fecha_creacion", hace90Iso)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    cuentas.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (offset > 100_000) break;
  }
  if (cuentas.length === 0) {
    return {
      velocidad_conversion_pct: 0,
      ciclo_promedio_dias: 0,
      apartados_ultimos_90d_count: 0,
      apartados_convertidos_count: 0,
    };
  }

  // 2) Ofertas → fallback id_propiedad. (Sin id_producto: la métrica
  //    excluye productos/servicios — sólo Propiedad.)
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofMap = new Map<number, any>(((ofs || []) as Array<any>).map((o) => [o.id, o]));

  // 3) Propiedades en ciclo (Apartado o Vendido), con filtro proyecto.
  const propIds = Array.from(
    new Set(
      cuentas
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  if (propIds.length === 0) {
    return {
      velocidad_conversion_pct: 0,
      ciclo_promedio_dias: 0,
      apartados_ultimos_90d_count: 0,
      apartados_convertidos_count: 0,
    };
  }
  const propsRows: Array<any> = [];
  for (let i = 0; i < propIds.length; i += PAGE_SIZE) {
    const slice = propIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("propiedades")
      .select("id, id_estatus_disponibilidad, id_edificio_modelo")
      .in("id", slice)
      .in("id_estatus_disponibilidad", ESTATUS_EN_CICLO);
    if (error) throw error;
    propsRows.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(propsRows.map((p) => [p.id, p]));

  let idProyectoFilter: Map<number, number | null> | null = null;
  if (idProyecto !== null) {
    const emIds = Array.from(
      new Set(propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
    );
    const { data: emRows } = emIds.length
      ? ((await (supabase as any)
          .from("edificios_modelos")
          .select("id, id_edificio")
          .in("id", emIds)) as any)
      : { data: [] };
    const edIds = Array.from(
      new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
    );
    const { data: edRows } = edIds.length
      ? ((await (supabase as any)
          .from("edificios")
          .select("id, id_proyecto")
          .in("id", edIds)) as any)
      : { data: [] };
    const edMap = new Map<number, number | null>(
      ((edRows || []) as Array<any>).map((e) => [e.id as number, (e.id_proyecto ?? null) as number | null]),
    );
    const emProyectoMap = new Map<number, number | null>(
      ((emRows || []) as Array<any>).map((e) => [
        e.id as number,
        e.id_edificio ? edMap.get(e.id_edificio) ?? null : null,
      ]),
    );
    idProyectoFilter = new Map<number, number | null>(
      propsRows.map((p) => [
        p.id as number,
        p.id_edificio_modelo ? emProyectoMap.get(p.id_edificio_modelo) ?? null : null,
      ]),
    );
  }

  // 4) Filtrar cuentas: sólo Propiedad (id_propiedad efectiva en propMap),
  //    en proyecto si aplica, y no Producto.
  const apartados = cuentas.filter((c) => {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    if (oferta?.id_producto) return false; // Producto/Servicio: no aplica.
    const idProp = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (!idProp) return false;
    if (!propMap.has(idProp)) return false; // Estatus distinto a Apartado/Vendido.
    if (idProyectoFilter) {
      const idProy = idProyectoFilter.get(idProp);
      if (idProy !== idProyecto) return false;
    }
    return true;
  });

  const total = apartados.length;
  let convertidos = 0;
  let sumDias = 0;
  for (const c of apartados) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idProp = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = idProp ? propMap.get(idProp) : null;
    const yaVendido =
      prop?.id_estatus_disponibilidad === ESTATUS_VENDIDO && !!c.fecha_compra;
    if (yaVendido) {
      convertidos += 1;
      const dias =
        (new Date(c.fecha_compra).getTime() - new Date(c.fecha_creacion).getTime()) /
        86_400_000;
      if (dias >= 0) sumDias += dias;
    }
  }

  return {
    velocidad_conversion_pct: total > 0 ? +((convertidos * 100) / total).toFixed(2) : 0,
    ciclo_promedio_dias: convertidos > 0 ? Math.round(sumDias / convertidos) : 0,
    apartados_ultimos_90d_count: total,
    apartados_convertidos_count: convertidos,
  };
}
