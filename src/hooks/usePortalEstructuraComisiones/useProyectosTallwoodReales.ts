import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Datos REALES (Supabase) para las tarjetas de "Proyectos" del Portal
 * Estructura de Comisiones — reemplaza los campos mock de `seed-data.ts`
 * (Unidades, Precio Prom., Absorción/mes, Comisión Total, Inicio de Venta,
 * Entrega) para los 4 desarrollos activos de Tallwood.
 *
 * Ids hardcodeados a propósito (confirmado con el usuario): no se generaliza
 * a "todos los proyectos SOZU" por ahora.
 */

const PROYECTOS_TALLWOOD: Record<string, number> = {
  margot: 1743,
  bottura: 2,
  daiku: 1453,
  monocolo: 1902,
};

export type ProjectStage = "Por lanzar" | "En venta" | "Entregado";

export interface RealProjectData {
  id: number;
  totalUnits: number;
  averagePrice: number;
  salesStartDate: string | null;
  deliveryDate: string | null;
  monthlyAbsorption: number | null;
  totalCommissionPct: number | null;
  stage: ProjectStage | null;
}

/** Quita acentos y normaliza mayúsculas para matchear "Monócolo" ~ "MONOCOLO". */
export function normalizeProjectName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function toDateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function computeStage(salesStartDate: string | null, deliveryDate: string | null): ProjectStage | null {
  if (!salesStartDate) return null;
  const today = toDateOnly(new Date().toISOString())!;
  if (today < salesStartDate) return "Por lanzar";
  if (deliveryDate && today >= deliveryDate) return "Entregado";
  return "En venta";
}

async function fetchProyectosTallwoodReales(): Promise<Record<string, RealProjectData>> {
  const ids = Object.values(PROYECTOS_TALLWOOD);

  const { data: proyectos } = await supabase
    .from("proyectos")
    .select("id, nombre, fecha_lanzamiento, fecha_entrega")
    .in("id", ids);

  const { data: edificios } = await supabase
    .from("edificios")
    .select("id, id_proyecto")
    .in("id_proyecto", ids)
    .eq("activo", true);
  const edificioToProyecto = new Map((edificios ?? []).map((e) => [e.id, e.id_proyecto]));
  const edificioIds = (edificios ?? []).map((e) => e.id);

  const { data: modelos } = edificioIds.length
    ? await supabase.from("edificios_modelos").select("id, id_edificio").in("id_edificio", edificioIds)
    : { data: [] as { id: number; id_edificio: number }[] };
  const modeloToProyecto = new Map(
    (modelos ?? []).map((m) => [m.id, edificioToProyecto.get(m.id_edificio) ?? null])
  );
  const modeloIds = (modelos ?? []).map((m) => m.id);

  const { data: propiedades } = modeloIds.length
    ? await supabase
        .from("propiedades")
        .select("id, precio_lista, id_edificio_modelo")
        .in("id_edificio_modelo", modeloIds)
        .eq("activo", true)
    : { data: [] as { id: number; precio_lista: number | null; id_edificio_modelo: number }[] };
  const propiedadToProyecto = new Map(
    (propiedades ?? []).map((p) => [p.id, modeloToProyecto.get(p.id_edificio_modelo) ?? null])
  );
  const propiedadIds = (propiedades ?? []).map((p) => p.id);

  const { data: cuentas } = propiedadIds.length
    ? await supabase
        .from("cuentas_cobranza")
        .select("id_propiedad, fecha_compra, porcentaje_comision_venta")
        .in("id_propiedad", propiedadIds)
        .eq("activo", true)
    : { data: [] as { id_propiedad: number | null; fecha_compra: string | null; porcentaje_comision_venta: number | null }[] };

  const result: Record<string, RealProjectData> = {};

  for (const [key, proyectoId] of Object.entries(PROYECTOS_TALLWOOD)) {
    const proyecto = (proyectos ?? []).find((p) => p.id === proyectoId);
    const salesStartDate = toDateOnly(proyecto?.fecha_lanzamiento ?? null);
    const deliveryDate = toDateOnly(proyecto?.fecha_entrega ?? null);

    const propsDelProyecto = (propiedades ?? []).filter(
      (p) => propiedadToProyecto.get(p.id) === proyectoId
    );
    const totalUnits = propsDelProyecto.length;
    const precios = propsDelProyecto.map((p) => Number(p.precio_lista ?? 0)).filter((n) => n > 0);
    const averagePrice = precios.length ? precios.reduce((s, n) => s + n, 0) / precios.length : 0;

    const propIdsDelProyecto = new Set(propsDelProyecto.map((p) => p.id));
    const cuentasDelProyecto = (cuentas ?? []).filter(
      (c) => c.id_propiedad != null && propIdsDelProyecto.has(c.id_propiedad)
    );

    const unidadesVendidas = new Set(cuentasDelProyecto.map((c) => c.id_propiedad)).size;
    let monthlyAbsorption: number | null = null;
    if (unidadesVendidas > 0 && salesStartDate) {
      const start = new Date(salesStartDate);
      const now = new Date();
      const monthsElapsed = Math.max(
        1,
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      );
      monthlyAbsorption = unidadesVendidas / monthsElapsed;
    }

    const comisiones = cuentasDelProyecto
      .map((c) => Number(c.porcentaje_comision_venta ?? NaN))
      .filter((n) => !Number.isNaN(n));
    const totalCommissionPct = comisiones.length
      ? comisiones.reduce((s, n) => s + n, 0) / comisiones.length
      : null;

    result[key] = {
      id: proyectoId,
      totalUnits,
      averagePrice,
      salesStartDate,
      deliveryDate,
      monthlyAbsorption,
      totalCommissionPct,
      stage: computeStage(salesStartDate, deliveryDate),
    };
  }

  return result;
}

/** Busca el override real para un proyecto del simulador por nombre (Margot, Bottura, Daiku, Monócolo). */
export function useProyectosTallwoodReales() {
  const query = useQuery({
    queryKey: ["proyectos-tallwood-reales"],
    staleTime: 5 * 60_000,
    queryFn: fetchProyectosTallwoodReales,
  });

  const getRealData = (projectName: string): RealProjectData | undefined => {
    const key = normalizeProjectName(projectName);
    return query.data?.[key];
  };

  return { getRealData, isLoading: query.isLoading, error: query.error as Error | null };
}
