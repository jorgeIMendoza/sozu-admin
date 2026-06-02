import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico Comercial — agregación client-side desde `cuentas_cobranza`.
 *
 * Por qué no usar una RPC: las cuentas_cobranza activas (~1.4k filas)
 * caben fácil en una página, y agregarlas en JS evita la dependencia de
 * funciones que aún no se han ejecutado en BD. Si más adelante el volumen
 * crece, se puede migrar a `get_historico_comercial` (definida en
 * `Ejecuciones_manuales/2026-06-01-rpcs-analisis-portal-direccion.md`).
 *
 * Reglas (alineadas con los hooks existentes que ya determinan estado
 * comercial — useCicloVentaCasos, useCobrosPorGestionar):
 *  - "Venta" = cuenta con `fecha_compra IS NOT NULL` Y la propiedad
 *    vinculada tiene `id_estatus_disponibilidad = 5` (Vendido), o el
 *    tipo es Producto/Servicio (no requiere propiedad). Mes agrupado por
 *    `fecha_compra`.
 *  - "Apartado" = cuenta con propiedad en `id_estatus_disponibilidad = 4`
 *    (sólo aplica a tipo Propiedad). Mes agrupado por `fecha_creacion`
 *    de la cuenta.
 *  - Tipo = "Propiedad" si la oferta no tiene `id_producto`; "Servicio"
 *    si el producto pertenece a categoría "Servicios"; "Producto" en
 *    cualquier otro caso.
 */

export type TipoCuenta = "Propiedad" | "Producto" | "Servicio" | "todos";
export type PeriodoHistorico = 6 | 12 | 24 | 0; // 0 = todo

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const PAGE_SIZE = 1000;

export interface HistoricoComercialRow {
  mes: string;
  ventas_count: number;
  ventas_monto: number;
  apartados_count: number;
  apartados_monto: number;
}

export interface HistoricoComercialParams {
  mesesAtras: PeriodoHistorico;
  idProyecto: number | null;
  canal: string | null;
  tipo: TipoCuenta;
  /** Rango personalizado (formato 'YYYY-MM-DD'). Cuando ambos están
   *  presentes anula `mesesAtras`. */
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface HistoricoComercialResult {
  data: HistoricoComercialRow[];
  isLoading: boolean;
  error: Error | null;
  /** Conservado por compatibilidad con la UI previa; siempre `false`. */
  rpcMissing: boolean;
}

export function useHistoricoComercial(
  params: HistoricoComercialParams,
): HistoricoComercialResult {
  const { mesesAtras, idProyecto, canal, tipo, fechaInicio, fechaFin } = params;
  const query = useQuery({
    queryKey: [
      "historico-comercial",
      mesesAtras,
      idProyecto,
      canal,
      tipo,
      fechaInicio ?? null,
      fechaFin ?? null,
    ],
    staleTime: 60_000,
    queryFn: () =>
      fetchHistorico({ mesesAtras, idProyecto, canal, tipo, fechaInicio, fechaFin }),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

async function fetchHistorico(
  params: HistoricoComercialParams,
): Promise<HistoricoComercialRow[]> {
  const { mesesAtras, idProyecto, canal, tipo, fechaInicio, fechaFin } = params;
  const customRange =
    fechaInicio && fechaFin && fechaInicio <= fechaFin ? { fechaInicio, fechaFin } : null;
  // 1) Paginar cuentas activas sin padre.
  const cuentas: Array<any> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("cuentas_cobranza")
      .select("id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion")
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
  if (cuentas.length === 0) return [];

  // 2) Ofertas (para id_propiedad fallback + id_producto).
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
  const ofMap = new Map<number, any>(ofertas.map((o) => [o.id, o]));

  // 3) Propiedades (estatus + edificio_modelo para resolver proyecto).
  const propIds = Array.from(
    new Set(
      cuentas
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  const propsRows: Array<any> = [];
  for (let i = 0; i < propIds.length; i += PAGE_SIZE) {
    const slice = propIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("propiedades")
      .select("id, id_estatus_disponibilidad, id_edificio_modelo")
      .in("id", slice);
    if (error) throw error;
    propsRows.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(propsRows.map((p) => [p.id, p]));

  // 4) edificios_modelos → edificio → proyecto.
  const emIds = Array.from(
    new Set(
      propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v),
    ),
  );
  const { data: emRows } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_edificio")
        .in("id", emIds)) as any)
    : { data: [] };
  const emMap = new Map<number, any>(((emRows || []) as Array<any>).map((e) => [e.id, e]));
  const edIds = Array.from(
    new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
  );
  const { data: edRows } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const edMap = new Map<number, any>(((edRows || []) as Array<any>).map((e) => [e.id, e]));

  // 5) Productos → tipo (Producto vs Servicio vía categoría).
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

  // 6) Clasificar cada cuenta.
  type ClasificadaRow = {
    monto: number;
    tipo: TipoCuenta;
    estadoPropiedad: number | null;
    idProyecto: number | null;
    mesVenta: string | null;     // YYYY-MM-01
    mesApartado: string | null;  // YYYY-MM-01
  };

  const clasificadas: ClasificadaRow[] = cuentas.map((c) => {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null =
      c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const estadoPropiedad: number | null = prop?.id_estatus_disponibilidad ?? null;
    const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
    const ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const idProy: number | null = ed?.id_proyecto ?? null;

    let tipoCuenta: TipoCuenta = "Propiedad";
    if (oferta?.id_producto) {
      tipoCuenta = productoTipoMap.get(oferta.id_producto) ?? "Producto";
    }

    const mesVenta = c.fecha_compra ? truncMonth(c.fecha_compra) : null;
    const mesApartado =
      estadoPropiedad === ESTATUS_APARTADO && c.fecha_creacion
        ? truncMonth(c.fecha_creacion)
        : null;

    return {
      monto: Number(c.precio_final ?? 0),
      tipo: tipoCuenta,
      estadoPropiedad,
      idProyecto: idProy,
      mesVenta,
      mesApartado,
    };
  });

  // 7) Filtros aplicados.
  const filtradas = clasificadas.filter((r) => {
    if (tipo !== "todos" && r.tipo !== tipo) return false;
    if (idProyecto !== null && r.idProyecto !== idProyecto) return false;
    // `canal` reservado para cuando exista el campo en BD (ver el .md).
    if (canal && canal !== "todos" && canal !== "") {
      // Placeholder: sin canal por cuenta hoy. No filtra.
    }
    return true;
  });

  // 8) Construir esqueleto de meses. Si hay rango personalizado, los
  //    meses se construyen desde fechaInicio hasta fechaFin; si no, se
  //    usan los últimos `mesesAtras` meses (default).
  const meses = customRange
    ? buildMonthsRange(customRange.fechaInicio, customRange.fechaFin)
    : buildMonthsSkeleton(mesesAtras);
  const byMes = new Map<string, HistoricoComercialRow>();
  meses.forEach((m) =>
    byMes.set(m, {
      mes: m,
      ventas_count: 0,
      ventas_monto: 0,
      apartados_count: 0,
      apartados_monto: 0,
    }),
  );

  // En el esqueleto los meses vienen orden desc; calcular cota inferior y
  // superior con tolerancia al rango personalizado.
  const minMes = meses.length ? meses[meses.length - 1] : null;
  const maxMes = meses.length ? meses[0] : null;
  const minDateIso = customRange?.fechaInicio ?? null;
  const maxDateIso = customRange?.fechaFin ?? null;

  // 9) Acumular ventas y apartados por mes.
  for (const r of filtradas) {
    // Una cuenta es "venta" si:
    //   - Es Producto / Servicio (no requiere propiedad vendida), o
    //   - Es Propiedad con estatus Vendido (5).
    // En ambos casos tiene fecha_compra.
    const esVenta =
      r.mesVenta != null &&
      (r.tipo !== "Propiedad" || r.estadoPropiedad === ESTATUS_VENDIDO);
    const esApartado =
      r.tipo === "Propiedad" &&
      r.estadoPropiedad === ESTATUS_APARTADO &&
      r.mesApartado != null;

    if (esVenta && r.mesVenta && inRange(r.mesVenta, minMes, maxMes)) {
      const bucket = byMes.get(r.mesVenta);
      if (bucket) {
        bucket.ventas_count += 1;
        bucket.ventas_monto += r.monto;
      }
    }
    if (esApartado && r.mesApartado && inRange(r.mesApartado, minMes, maxMes)) {
      const bucket = byMes.get(r.mesApartado);
      if (bucket) {
        bucket.apartados_count += 1;
        bucket.apartados_monto += r.monto;
      }
    }
  }

  // Orden descendente (mes más reciente primero).
  return Array.from(byMes.values()).sort((a, b) => (a.mes > b.mes ? -1 : 1));
}

function inRange(mes: string, min: string | null, max: string | null): boolean {
  if (min && mes < min) return false;
  if (max && mes > max) return false;
  return true;
}

function buildMonthsRange(fechaInicio: string, fechaFin: string): string[] {
  // Devuelve los meses (YYYY-MM-01) entre las dos fechas, en orden
  // descendente (más reciente primero). Trunca al primer día del mes.
  const start = new Date(fechaInicio + "T00:00:00");
  const end = new Date(fechaFin + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }
  const out: string[] = [];
  const cursor = new Date(end.getFullYear(), end.getMonth(), 1);
  const min = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor >= min) {
    const yy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    out.push(`${yy}-${mm}-01`);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return out;
}

function truncMonth(iso: string): string {
  // iso = "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS..."
  return iso.slice(0, 7) + "-01";
}

function buildMonthsSkeleton(mesesAtras: PeriodoHistorico): string[] {
  const out: string[] = [];
  const now = new Date();
  const total = mesesAtras === 0 ? 240 : mesesAtras; // "todo" = 20 años
  for (let i = 0; i < total; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${yy}-${mm}-01`);
  }
  // out está orden desc; lo dejamos así (más reciente primero).
  return out;
}
