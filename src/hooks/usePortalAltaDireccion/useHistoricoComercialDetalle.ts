import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type {
  HistoricoComercialParams,
  TipoCuenta,
} from "./useHistoricoComercial";

/**
 * Drill-down de Histórico Comercial: una fila por cuenta de cobranza con
 * todos los datos que el drawer necesita (proyecto, modelo, metraje,
 * compradores, propietario, etc.) y la clasificación por mes (`ventas`
 * vs `apartados`) que alimenta la gráfica `Evolución mensual`.
 *
 * Los filtros (idProyecto, canal, tipo, rango personalizado) son los
 * mismos que `useHistoricoComercial`; el componente debe pasar el mismo
 * shape para que el conteo cuadre con las barras.
 */

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const PAGE_SIZE = 1000;

export type CategoriaHistorico = "ventas" | "apartados";

export interface HistoricoComercialDetalleRow {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo: Exclude<TipoCuenta, "todos">;
  mes_venta: string | null; // YYYY-MM-01
  mes_apartado: string | null; // YYYY-MM-01
  categoria: CategoriaHistorico; // venta o apartado (la cuenta cuenta para una sola)
  proyecto_nombre: string;
  edificio_nombre: string;
  modelo_nombre: string;
  numero_propiedad: string;
  compradores: string[];
  propietario: string;
  metraje: number;
  precio_m2: number;
  precio_final: number;
  fecha_evento: string; // fecha_compra para ventas, fecha_creacion para apartados
}

export interface HistoricoComercialDetalleResult {
  data: HistoricoComercialDetalleRow[];
  isLoading: boolean;
  error: Error | null;
}

export function useHistoricoComercialDetalle(
  params: HistoricoComercialParams,
): HistoricoComercialDetalleResult {
  const { mesesAtras, idProyecto, canal, tipo, fechaInicio, fechaFin } = params;
  const query = useQuery({
    queryKey: [
      "historico-comercial-detalle",
      mesesAtras,
      idProyecto,
      canal,
      tipo,
      fechaInicio ?? null,
      fechaFin ?? null,
    ],
    staleTime: 60_000,
    queryFn: () => fetchDetalle({ mesesAtras, idProyecto, canal, tipo, fechaInicio, fechaFin }),
  });
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

async function fetchDetalle(
  params: HistoricoComercialParams,
): Promise<HistoricoComercialDetalleRow[]> {
  const { mesesAtras, idProyecto, tipo, fechaInicio, fechaFin } = params;
  const customRange =
    fechaInicio && fechaFin && fechaInicio <= fechaFin ? { fechaInicio, fechaFin } : null;

  // 1) Cuentas activas (paginadas).
  const cuentas: Array<any> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion",
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
  if (cuentas.length === 0) return [];

  // 2) Ofertas.
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const ofertas: Array<any> = [];
  for (let i = 0; i < ofertaIds.length; i += PAGE_SIZE) {
    const slice = ofertaIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto, id_persona_lead")
      .in("id", slice);
    if (error) throw error;
    ofertas.push(...((data || []) as Array<any>));
  }
  const ofMap = new Map<number, any>(ofertas.map((o) => [o.id, o]));

  // 3) Propiedades.
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
      .select(
        "id, numero_propiedad, id_estatus_disponibilidad, id_edificio_modelo, id_entidad_relacionada_dueno, m2_interiores, m2_exteriores",
      )
      .in("id", slice);
    if (error) throw error;
    propsRows.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(propsRows.map((p) => [p.id, p]));

  // 4) edificios_modelos → modelo nombre + id_edificio.
  const emIds = Array.from(
    new Set(propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
  );
  const { data: emRows } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select(
          "id, id_edificio, modelos!edificios_modelos_id_modelo_fkey(nombre)",
        )
        .in("id", emIds)) as any)
    : { data: [] };
  const emMap = new Map<number, any>(((emRows || []) as Array<any>).map((e) => [e.id, e]));

  // 5) edificios → proyecto.
  const edIds = Array.from(
    new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
  );
  const { data: edRows } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, nombre, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const edMap = new Map<number, any>(((edRows || []) as Array<any>).map((e) => [e.id, e]));

  const projIds = Array.from(
    new Set(((edRows || []) as Array<any>).map((e) => e.id_proyecto).filter((v): v is number => !!v)),
  );
  const { data: projRows } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const projMap = new Map<number, string>(
    ((projRows || []) as Array<any>).map((p) => [p.id, p.nombre as string]),
  );

  // 6) Productos → tipo.
  const productoIds = Array.from(
    new Set(ofertas.map((o) => o.id_producto).filter((v): v is number => !!v)),
  );
  const { data: prodRows } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const productoTipoMap = new Map<number, "Producto" | "Servicio">(
    ((prodRows || []) as Array<any>).map((p) => {
      const cat = (p.categorias_producto?.nombre ?? "").toLowerCase();
      return [p.id as number, cat === "servicios" ? "Servicio" : "Producto"];
    }),
  );

  // 7) Compradores por cuenta.
  const cuentaIds = cuentas.map((c) => c.id as number);
  const compradoresByCuenta = new Map<number, number[]>();
  for (let i = 0; i < cuentaIds.length; i += PAGE_SIZE) {
    const slice = cuentaIds.slice(i, i + PAGE_SIZE);
    const { data } = ((await (supabase as any)
      .from("compradores")
      .select("id_cuenta_cobranza, id_persona")
      .in("id_cuenta_cobranza", slice)
      .eq("activo", true)) as any);
    for (const r of ((data || []) as Array<any>)) {
      const arr = compradoresByCuenta.get(r.id_cuenta_cobranza) ?? [];
      arr.push(r.id_persona as number);
      compradoresByCuenta.set(r.id_cuenta_cobranza, arr);
    }
  }

  // 8) Personas (compradores + lead oferta + propietario via entidad).
  const personaIdsCompradores = Array.from(compradoresByCuenta.values()).flat();
  const personaIdsLead = ofertas
    .map((o) => o.id_persona_lead)
    .filter((v): v is number => !!v);

  // Entidad dueña → id_persona (propietario).
  const entIds = Array.from(
    new Set(
      propsRows
        .map((p) => p.id_entidad_relacionada_dueno)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: entRows } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona")
        .in("id", entIds)) as any)
    : { data: [] };
  const entPersonaMap = new Map<number, number>(
    ((entRows || []) as Array<any>).map((e) => [e.id, e.id_persona]),
  );

  const personaIdsAll = Array.from(
    new Set([
      ...personaIdsCompradores,
      ...personaIdsLead,
      ...Array.from(entPersonaMap.values()).filter((v): v is number => !!v),
    ]),
  );
  const personaMap = new Map<number, string>();
  for (let i = 0; i < personaIdsAll.length; i += PAGE_SIZE) {
    const slice = personaIdsAll.slice(i, i + PAGE_SIZE);
    const { data } = ((await (supabase as any)
      .from("personas")
      .select("id, nombre_legal, nombre_comercial")
      .in("id", slice)) as any);
    for (const p of ((data || []) as Array<any>)) {
      const nombre = (p.nombre_comercial || p.nombre_legal || "—") as string;
      personaMap.set(p.id as number, nombre);
    }
  }

  // 9) Construir filas.
  const out: HistoricoComercialDetalleRow[] = [];
  for (const c of cuentas) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const estadoPropiedad: number | null = prop?.id_estatus_disponibilidad ?? null;

    // Clasificación tipo.
    let tipoCuenta: Exclude<TipoCuenta, "todos"> = "Propiedad";
    if (oferta?.id_producto) {
      tipoCuenta = productoTipoMap.get(oferta.id_producto) ?? "Producto";
    }

    // Mes (YYYY-MM-01).
    const mesVenta = c.fecha_compra ? truncMonth(c.fecha_compra) : null;
    const mesApartado =
      estadoPropiedad === ESTATUS_APARTADO && c.fecha_creacion
        ? truncMonth(c.fecha_creacion)
        : null;

    // Categoría: venta o apartado.
    const esVenta =
      mesVenta != null &&
      (tipoCuenta !== "Propiedad" || estadoPropiedad === ESTATUS_VENDIDO);
    const esApartado =
      tipoCuenta === "Propiedad" &&
      estadoPropiedad === ESTATUS_APARTADO &&
      mesApartado != null;

    if (!esVenta && !esApartado) continue;
    const categoria: CategoriaHistorico = esVenta ? "ventas" : "apartados";

    // Filtros.
    if (tipo !== "todos" && tipoCuenta !== tipo) continue;
    const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
    const ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const idProy: number | null = ed?.id_proyecto ?? null;
    if (idProyecto !== null && idProy !== idProyecto) continue;

    // Rango de meses.
    const mesActivo = categoria === "ventas" ? mesVenta : mesApartado;
    if (mesActivo && customRange) {
      const minMes = truncMonth(customRange.fechaInicio);
      const maxMes = truncMonth(customRange.fechaFin);
      if (mesActivo < minMes || mesActivo > maxMes) continue;
    } else if (mesActivo && mesesAtras && mesesAtras > 0) {
      const cutoff = monthsAgoIso(mesesAtras);
      if (mesActivo < cutoff) continue;
    }

    // Enrich textual.
    const proyecto_nombre = idProy ? projMap.get(idProy) ?? "—" : "—";
    const edificio_nombre = (ed?.nombre as string | null) ?? "—";
    const modelo_nombre = (em?.modelos?.nombre as string | null) ?? "—";
    const numero_propiedad = (prop?.numero_propiedad as string | null) ?? "—";
    const m2_int = Number(prop?.m2_interiores ?? 0);
    const m2_ext = Number(prop?.m2_exteriores ?? 0);
    const metraje = m2_int + m2_ext;
    const precio = Number(c.precio_final ?? 0);
    const precio_m2 = m2_int > 0 ? precio / m2_int : 0;

    // Compradores: lista desde tabla compradores; fallback a id_persona_lead.
    let compradorIds = compradoresByCuenta.get(c.id) ?? [];
    if (compradorIds.length === 0 && oferta?.id_persona_lead) {
      compradorIds = [oferta.id_persona_lead];
    }
    const compradores = compradorIds
      .map((id) => personaMap.get(id))
      .filter((v): v is string => !!v);

    // Propietario.
    const entId = prop?.id_entidad_relacionada_dueno as number | null;
    const propIdPersona = entId ? entPersonaMap.get(entId) ?? null : null;
    const propietario = propIdPersona ? personaMap.get(propIdPersona) ?? "—" : "—";

    out.push({
      id_cuenta_cobranza: c.id as number,
      folio_cuenta: formatCuentaCobranzaId(c.id as number, tipoCuenta),
      tipo: tipoCuenta,
      mes_venta: mesVenta,
      mes_apartado: mesApartado,
      categoria,
      proyecto_nombre,
      edificio_nombre,
      modelo_nombre,
      numero_propiedad,
      compradores,
      propietario,
      metraje,
      precio_m2,
      precio_final: precio,
      fecha_evento:
        categoria === "ventas"
          ? (c.fecha_compra as string)
          : (c.fecha_creacion as string),
    });
  }
  return out;
}

function truncMonth(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

function monthsAgoIso(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (n - 1));
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
