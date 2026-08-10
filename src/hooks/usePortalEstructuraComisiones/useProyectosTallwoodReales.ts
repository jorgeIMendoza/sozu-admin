import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Datos REALES (Supabase) de los proyectos **comercializados por SOZU**, para el
 * menú "Proyectos" del Portal Estructura de Comisiones.
 *
 * Antes los ids de los 4 desarrollos de Tallwood estaban hardcodeados. Ahora el
 * universo se resuelve como en el resto del portal: existe una
 * `entidades_relacionadas` de tipo 5 (SOZU) apuntando al proyecto y el proyecto
 * está activo. Cualquier desarrollo que se dé de alta con esa relación aparece
 * automáticamente, sin tocar código.
 *
 * Métricas de inventario disponible (`id_estatus_disponibilidad = 2`):
 * unidades, monto a colocar, precio promedio ponderado por unidad y por m².
 * Ambos promedios son ponderados por construcción —monto total entre unidades y
 * entre m² totales—, no el promedio de los promedios de cada unidad.
 *
 * Waterfall explícito proyecto → edificios → edificios_modelos → propiedades
 * (patrón #1 de CLAUDE.md): el triple join de PostgREST falla en silencio.
 */

/** Estatus "Disponible" en `estatus_disponibilidad` (ver CLAUDE.md). */
const ESTATUS_DISPONIBLE = 2;

/**
 * Estatus que implican que la unidad **ya se vendió**: 5 Vendido, 7 Escrituración,
 * 8 Entregada, 9 Pagada completamente. Es el criterio documentado en CLAUDE.md
 * para los dashboards de entregas/postventa.
 *
 * No se cuenta por `cuentas_cobranza` porque una unidad vendida hace años y ya
 * entregada puede no tener cuenta activa: en Bottura el estatus da 469 unidades
 * vendidas y las cuentas activas solo 199. El estatus es el estado real de la
 * propiedad; la cuenta es el vehículo de cobranza y puede haberse cerrado.
 *
 * Apartada (4) queda fuera a propósito: reservada no es vendida.
 */
const ESTATUS_VENDIDAS = [5, 7, 8, 9];

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;

/**
 * "Proyectos" que en realidad son catálogos internos (Productos, Servicios) y no
 * desarrollos: comparten la relación con SOZU pero no se comercializan como
 * inventario. Mismo criterio que `useProyectosMotorComisiones.ts`.
 */
const TIPOS_USO_EXCLUIDOS = [9, 10];

export type ProjectStage = "Por lanzar" | "En venta" | "Entregado";

export interface RealProjectData {
  id: number;
  nombre: string;
  totalUnits: number;
  averagePrice: number;
  salesStartDate: string | null;
  deliveryDate: string | null;
  monthlyAbsorption: number | null;
  totalCommissionPct: number | null;
  stage: ProjectStage | null;

  /** Unidades ya vendidas (estatus 5, 7, 8 o 9). */
  unidadesVendidas: number;

  /* --- Inventario con estatus Disponible --- */
  /** Unidades con estatus Disponible. */
  unidadesDisponibles: number;
  /** Monto total a colocar: suma del precio de lista de lo disponible. */
  montoDisponible: number;
  /** m² totales de lo disponible (interiores + exteriores). */
  m2Disponibles: number;
  /** Precio promedio ponderado por unidad: monto / unidades. */
  precioPromedioUnidad: number;
  /** Precio promedio ponderado por m²: monto / m² totales. */
  precioPromedioM2: number;
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
  // Universo: proyectos comercializados por SOZU (relación tipo 5) y activos.
  const { data: rels } = await supabase
    .from("entidades_relacionadas")
    .select("id_proyecto")
    .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
    .eq("activo", true)
    .not("id_proyecto", "is", null);

  const idsSozu = Array.from(new Set((rels ?? []).map((r) => r.id_proyecto as number)));
  if (!idsSozu.length) return {};

  const { data: proyectosRaw } = await supabase
    .from("proyectos")
    .select("id, nombre, fecha_lanzamiento, fecha_entrega, id_tipo_uso")
    .in("id", idsSozu)
    .eq("activo", true)
    .order("nombre");

  // Fuera los catálogos internos (Productos/Servicios): no son desarrollos.
  const proyectos = (proyectosRaw ?? []).filter(
    (p) => !TIPOS_USO_EXCLUIDOS.includes(p.id_tipo_uso as number),
  );

  const ids = proyectos.map((p) => p.id);
  if (!ids.length) return {};

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

  type PropiedadRow = {
    id: number;
    precio_lista: number | null;
    id_edificio_modelo: number;
    id_estatus_disponibilidad: number | null;
    m2_interiores: number | null;
    m2_exteriores: number | null;
  };
  const { data: propiedades } = modeloIds.length
    ? await supabase
        .from("propiedades")
        .select("id, precio_lista, id_edificio_modelo, id_estatus_disponibilidad, m2_interiores, m2_exteriores")
        .in("id_edificio_modelo", modeloIds)
        .eq("activo", true)
    : { data: [] as PropiedadRow[] };
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

  for (const proyecto of proyectos ?? []) {
    const proyectoId = proyecto.id;
    const key = normalizeProjectName(proyecto.nombre);
    const salesStartDate = toDateOnly(proyecto.fecha_lanzamiento ?? null);
    const deliveryDate = toDateOnly(proyecto.fecha_entrega ?? null);

    const propsDelProyecto = (propiedades ?? []).filter(
      (p) => propiedadToProyecto.get(p.id) === proyectoId
    );

    const unidadesVendidasPorEstatus = propsDelProyecto.filter(
      (p) => p.id_estatus_disponibilidad != null
        && ESTATUS_VENDIDAS.includes(p.id_estatus_disponibilidad)
    ).length;

    // Inventario con estatus Disponible: es el que se puede colocar.
    const disponibles = propsDelProyecto.filter(
      (p) => p.id_estatus_disponibilidad === ESTATUS_DISPONIBLE
    );
    const montoDisponible = disponibles.reduce((s, p) => s + Number(p.precio_lista ?? 0), 0);
    const m2Disponibles = disponibles.reduce(
      (s, p) => s + Number(p.m2_interiores ?? 0) + Number(p.m2_exteriores ?? 0),
      0,
    );
    // Ponderados: monto entre unidades y monto entre m² totales. No es el
    // promedio de los precios/m² de cada unidad — eso daría otro número.
    const precioPromedioUnidad = disponibles.length ? montoDisponible / disponibles.length : 0;
    const precioPromedioM2 = m2Disponibles > 0 ? montoDisponible / m2Disponibles : 0;
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
      nombre: proyecto.nombre,
      totalUnits,
      averagePrice,
      salesStartDate,
      deliveryDate,
      monthlyAbsorption,
      totalCommissionPct,
      stage: computeStage(salesStartDate, deliveryDate),
      unidadesVendidas: unidadesVendidasPorEstatus,
      unidadesDisponibles: disponibles.length,
      montoDisponible,
      m2Disponibles,
      precioPromedioUnidad,
      precioPromedioM2,
    };
  }

  return result;
}

/**
 * Datos reales de los proyectos comercializados por SOZU.
 *
 * `proyectos` es la lista completa —el universo que debe mostrar la pantalla—.
 * `getRealData(nombre)` sigue existiendo para cruzar por nombre con el catálogo
 * del simulador, que conserva sus propios campos de simulación.
 */
export function useProyectosSozuReales() {
  const query = useQuery({
    queryKey: ["proyectos-sozu-reales"],
    staleTime: 5 * 60_000,
    queryFn: fetchProyectosTallwoodReales,
  });

  const getRealData = (projectName: string): RealProjectData | undefined => {
    const key = normalizeProjectName(projectName);
    return query.data?.[key];
  };

  /** Ordenados por nombre, como los devuelve la consulta. */
  const proyectos: RealProjectData[] = Object.values(query.data ?? {});

  return { proyectos, getRealData, isLoading: query.isLoading, error: query.error as Error | null };
}

/** @deprecated Nombre heredado de cuando el universo eran los 4 de Tallwood. Usa `useProyectosSozuReales`. */
export const useProyectosTallwoodReales = useProyectosSozuReales;
