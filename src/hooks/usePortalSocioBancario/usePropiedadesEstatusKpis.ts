import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ESTATUS_DISPONIBLE = 2;
const ESTATUS_APARTADA = 4;
const ESTATUS_VENDIDO = 5;
const ESTATUS_PAGADA = 9;

export interface PropiedadesEstatusKpis {
  ventas_totales: number;
  disponibles: number;
  apartados: number;
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
    if (edIds.length === 0) {
      return { ventas_totales: 0, disponibles: 0, apartados: 0 };
    }
    const { data: emRows, error: emErr } = await (supabase as any)
      .from("edificios_modelos")
      .select("id")
      .in("id_edificio", edIds);
    if (emErr) throw emErr;
    edificioModeloIds = ((emRows || []) as Array<{ id: number }>).map((e) => e.id);
    if (edificioModeloIds.length === 0) {
      return { ventas_totales: 0, disponibles: 0, apartados: 0 };
    }
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

  const [ventasRes, dispRes, apartRes] = await Promise.all([
    buildQuery([ESTATUS_VENDIDO, ESTATUS_PAGADA]),
    buildQuery(ESTATUS_DISPONIBLE),
    buildQuery(ESTATUS_APARTADA),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  if (dispRes.error) throw dispRes.error;
  if (apartRes.error) throw apartRes.error;

  return {
    ventas_totales: ventasRes.count ?? 0,
    disponibles: dispRes.count ?? 0,
    apartados: apartRes.count ?? 0,
  };
}
