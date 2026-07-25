import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

const ESTATUS_INVENTARIO = 1;
const ESTATUS_DISPONIBLE = 2;
const ESTATUS_APARTADA = 4;
const ESTATUS_VENDIDO = 5;
const ESTATUS_PAGADA = 9;
const ESTATUS_ASIGNADO = 10;

/** Estatus con valor de lista relevante para las tarjetas de inventario. */
const ESTATUS_CON_VALOR = [ESTATUS_INVENTARIO, ESTATUS_DISPONIBLE, ESTATUS_ASIGNADO] as const;

/** Conteo y Σ precio_lista de un estatus (o grupo de estatus). */
export interface EstatusBucket {
  count: number;
  valor_lista: number;
}

export interface PropiedadesEstatusKpis {
  ventas_totales: number;
  /** Unidades en estatus Disponible(2). Base del cálculo de "% colocado". */
  disponibles: number;
  /** Σ precio_lista de las unidades Disponible(2) — tarjeta "Inventario disponible". */
  disponibles_valor_lista: number;
  apartados: number;
  /** Desglose de la tarjeta: propiedades en estatus Inventario(1). */
  inventario: EstatusBucket;
  /** Desglose de la tarjeta: propiedades en estatus Asignado(10). */
  asignado: EstatusBucket;
}

export interface PropiedadesEstatusKpisResult {
  data: PropiedadesEstatusKpis | null;
  isLoading: boolean;
  error: Error | null;
}

export function usePropiedadesEstatusKpis(
  idProyecto: number | null,
): PropiedadesEstatusKpisResult {
  const query = useQuery({
    queryKey: ["propiedades-estatus-kpis", idProyecto],
    queryFn: () => fetchKpis(idProyecto),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

const EMPTY: PropiedadesEstatusKpis = {
  ventas_totales: 0,
  disponibles: 0,
  disponibles_valor_lista: 0,
  apartados: 0,
  inventario: { count: 0, valor_lista: 0 },
  asignado: { count: 0, valor_lista: 0 },
};

async function fetchKpis(idProyecto: number | null): Promise<PropiedadesEstatusKpis> {
  // TODO RLS: la frontera real (un socio bancario solo lee su(s) desarrollo(s)
  // asignado(s)) la debe hacer cumplir el RLS de Jorge por id_proyecto activo.
  // Hoy el scope vive en la app (idProyecto viene de useSocioProyecto).
  let edificioModeloIds: number[] | null = null;

  if (idProyecto !== null) {
    const { data: edRows, error: edErr } = await (supabase as any)
      .from("edificios")
      .select("id")
      .eq("id_proyecto", idProyecto)
      .eq("activo", true);
    if (edErr) throw edErr;
    const edIds = ((edRows || []) as Array<{ id: number }>).map((e) => e.id);
    if (edIds.length === 0) return { ...EMPTY };
    const { data: emRows, error: emErr } = await (supabase as any)
      .from("edificios_modelos")
      .select("id")
      .in("id_edificio", edIds);
    if (emErr) throw emErr;
    edificioModeloIds = ((emRows || []) as Array<{ id: number }>).map((e) => e.id);
    if (edificioModeloIds.length === 0) return { ...EMPTY };
  }

  const buildQuery = (estatus: number | number[]) => {
    let q = (supabase as any)
      .from("propiedades")
      .select("*", { count: "exact", head: true })
      .eq("activo", true);
    q = Array.isArray(estatus)
      ? q.in("id_estatus_disponibilidad", estatus)
      : q.eq("id_estatus_disponibilidad", estatus);
    if (edificioModeloIds) {
      q = q.in("id_edificio_modelo", edificioModeloIds);
    }
    return q;
  };

  // Inventario / Disponible / Asignado: se traen las filas (estatus + precio_lista)
  // para desglosar conteo y Σ valor de lista por estatus, de una sola fuente scoped
  // al desarrollo (sin depender del forecast global). Paginado para no toparse con
  // el límite de 1000 filas.
  const emIds = edificioModeloIds;
  const [ventasRes, apartRes, valorRows] = await Promise.all([
    buildQuery([ESTATUS_VENDIDO, ESTATUS_PAGADA]),
    buildQuery(ESTATUS_APARTADA),
    fetchAllRows<{ id_estatus_disponibilidad: number; precio_lista: number | string | null }>(
      (from, to) => {
        let q = (supabase as any)
          .from("propiedades")
          .select("id_estatus_disponibilidad, precio_lista")
          .eq("activo", true)
          .in("id_estatus_disponibilidad", ESTATUS_CON_VALOR as unknown as number[]);
        if (emIds) q = q.in("id_edificio_modelo", emIds);
        return q.range(from, to);
      },
    ),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (apartRes.error) throw apartRes.error;

  const inventario: EstatusBucket = { count: 0, valor_lista: 0 };
  const disponible: EstatusBucket = { count: 0, valor_lista: 0 };
  const asignado: EstatusBucket = { count: 0, valor_lista: 0 };
  for (const r of valorRows) {
    const bucket =
      r.id_estatus_disponibilidad === ESTATUS_ASIGNADO
        ? asignado
        : r.id_estatus_disponibilidad === ESTATUS_DISPONIBLE
          ? disponible
          : inventario;
    bucket.count += 1;
    bucket.valor_lista += Number(r.precio_lista ?? 0);
  }

  return {
    ventas_totales: ventasRes.count ?? 0,
    disponibles: disponible.count,
    disponibles_valor_lista: disponible.valor_lista,
    apartados: apartRes.count ?? 0,
    inventario,
    asignado,
  };
}
