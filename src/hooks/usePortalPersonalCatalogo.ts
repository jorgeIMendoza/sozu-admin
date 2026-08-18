import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchExtrasPorPropiedad, precioTotalUnidad } from "@/lib/inventario/precio-unidad";
import { mapEstatusCatalog, progressFromEstatus } from "@/utils/avanceObra";
import {
  useProyectosSozuReales,
  normalizeProjectName,
} from "@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales";

/**
 * Catálogo REAL para el Portal del Personal: proyectos comercializados por SOZU
 * y sus departamentos disponibles a la venta.
 *
 * Definiciones (las mismas que Alta Dirección → Estructura de Comisiones, para
 * que los dos portales nunca digan números distintos):
 *
 *   - Proyecto comercializado por SOZU → existe una `entidades_relacionadas` de
 *     tipo 5 (SOZU) apuntando al proyecto y el proyecto está activo; se excluyen
 *     los catálogos internos (`id_tipo_uso` 9 y 10: Productos y Servicios).
 *     NO se filtra por `publicar`: eso es el interruptor del catálogo público,
 *     y un desarrollo puede tener estructura de comisión antes de publicarse.
 *   - Departamento disponible a la venta → `propiedades` activas, aprobadas y
 *     con `id_estatus_disponibilidad = 2`. Bodegas y estacionamientos NO son
 *     departamentos: viven en sus propias tablas y sólo suman al precio.
 *   - Precio del departamento → precio de lista + bodegas + estacionamientos,
 *     con la fórmula única de `lib/inventario/precio-unidad`.
 *   - Precio promedio ponderado del proyecto → viene tal cual de
 *     `useProyectosSozuReales` (`precioPromedioUnidad` = monto disponible /
 *     unidades disponibles), que es el mismo hook que alimenta el precio de
 *     referencia del Motor de Comisiones en Alta Dirección.
 *
 * Waterfall explícito proyecto → edificios → edificios_modelos → propiedades
 * (patrón #1 de CLAUDE.md): el triple join de PostgREST falla en silencio.
 */

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;
/** Productos y Servicios: catálogos internos, no desarrollos. */
const TIPOS_USO_EXCLUIDOS = [9, 10];
/** Estatus "Disponible" en `estatus_disponibilidad`. */
const ESTATUS_DISPONIBLE = 2;

export interface ProyectoComercializado {
  /** `proyectos.id` como texto: los <Select> trabajan con strings. */
  id: string;
  idNumerico: number;
  nombre: string;
  direccion: string;
  avanceObra: number;
  /** Trimestre de entrega, formato "Q3 2029" (o "Por definir" si no hay fecha). */
  entregaEstimada: string;
  /** Promedio ponderado del inventario disponible: monto / unidades. */
  precioPromedioPonderado: number;
  unidadesDisponibles: number;
}

export interface DepartamentoDisponible {
  /** `propiedades.id` como texto. */
  id: string;
  idNumerico: number;
  numero: string;
  modelo: string;
  nivel: string | null;
  precioLista: number;
  /** Lista + bodegas + estacionamientos: lo que el cliente termina pagando. */
  precioTotal: number;
  recamaras: number;
  banos: number;
  m2: number;
  imagen: string | null;
}

/** "2029-07-01" → "Q3 2029". Sin fecha no se inventa un trimestre. */
function trimestreDe(fecha: string | null | undefined): string {
  if (!fecha) return "Por definir";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "Por definir";
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

/** Ordena "PH-2" y "1002" como los lee una persona, no como texto plano. */
const porNumero = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

export function useProyectosComercializados() {
  // Mismos números que Alta Dirección: precio promedio ponderado y unidades
  // disponibles salen de aquí, no de un cálculo paralelo.
  const { proyectos: realesSozu, isLoading: cargandoReales } = useProyectosSozuReales();

  const { data: estatusData } = useQuery({
    queryKey: ["estatus-proyecto-all"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("estatus_proyecto")
        .select("*")
        .eq("activo", true)
        .order("id");
      return data || [];
    },
  });

  const { data: crudos = [], isLoading: cargandoProyectos } = useQuery({
    queryKey: ["portal-personal-proyectos-comercializados"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rels } = await (supabase as any)
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
        .eq("activo", true)
        .not("id_proyecto", "is", null);

      const ids = Array.from(new Set(((rels as any[]) ?? []).map((r) => r.id_proyecto as number)));
      if (!ids.length) return [];

      const { data, error } = await (supabase as any)
        .from("proyectos")
        .select(
          "id, nombre, direccion, fecha_entrega, fecha_entrega_proyecto, id_estatus_proyecto, id_tipo_uso",
        )
        .in("id", ids)
        .eq("activo", true)
        .order("nombre", { ascending: true });
      if (error || !data) return [];

      return (data as any[]).filter((p) => !TIPOS_USO_EXCLUIDOS.includes(p.id_tipo_uso as number));
    },
  });

  const proyectos: ProyectoComercializado[] = useMemo(() => {
    const etapas = mapEstatusCatalog(estatusData ?? []);
    const realPorNombre = new Map(
      realesSozu.map((p) => [normalizeProjectName(p.nombre), p]),
    );
    return crudos.map((p: any) => {
      const real = realPorNombre.get(normalizeProjectName(p.nombre));
      return {
        id: String(p.id),
        idNumerico: p.id as number,
        nombre: p.nombre as string,
        direccion: (p.direccion as string) ?? "",
        avanceObra: progressFromEstatus(etapas, p.id_estatus_proyecto),
        entregaEstimada: trimestreDe(p.fecha_entrega_proyecto ?? p.fecha_entrega),
        precioPromedioPonderado: Math.round(real?.precioPromedioUnidad ?? 0),
        unidadesDisponibles: real?.unidadesDisponibles ?? 0,
      };
    });
  }, [crudos, estatusData, realesSozu]);

  return { proyectos, isLoading: cargandoProyectos || cargandoReales };
}

/** Departamentos disponibles a la venta del proyecto indicado. */
export function useDepartamentosDisponibles(idProyecto: number | null | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-personal-departamentos", idProyecto],
    enabled: idProyecto != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: edificios } = await (supabase as any)
        .from("edificios")
        .select("id")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true);
      const edificioIds = ((edificios as any[]) ?? []).map((e) => e.id as number);
      if (!edificioIds.length) return [];

      const { data: edModelos } = await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_modelo")
        .in("id_edificio", edificioIds);
      const emRows = ((edModelos as any[]) ?? []);
      if (!emRows.length) return [];
      const emAModelo = new Map(emRows.map((em) => [em.id as number, em.id_modelo as number]));

      const { data: propiedades } = await (supabase as any)
        .from("propiedades")
        .select(
          "id, numero_propiedad, numero_piso, precio_lista, m2_interiores, m2_exteriores, id_edificio_modelo",
        )
        .in("id_edificio_modelo", Array.from(emAModelo.keys()))
        .eq("activo", true)
        .eq("es_aprobado", true)
        .eq("id_estatus_disponibilidad", ESTATUS_DISPONIBLE);
      const props = ((propiedades as any[]) ?? []);
      if (!props.length) return [];

      const modeloIds = Array.from(
        new Set(props.map((p) => emAModelo.get(p.id_edificio_modelo)).filter(Boolean) as number[]),
      );
      const propIds = props.map((p) => p.id as number);

      const [modelosRes, imgPropRes, imgModeloRes, extras] = await Promise.all([
        (supabase as any)
          .from("modelos")
          .select("id, nombre, numero_recamaras, numero_completo_banos")
          .in("id", modeloIds),
        (supabase as any)
          .from("multimedias_propiedad")
          .select("id_propiedad, url")
          .in("id_propiedad", propIds)
          .eq("activo", true)
          .eq("es_imagen", true),
        (supabase as any)
          .from("multimedias_modelo")
          .select("id_modelo, url")
          .in("id_modelo", modeloIds)
          .eq("activo", true)
          .eq("es_imagen", true)
          .eq("ver_como_imagen_de_propiedad", true),
        // El precio que se cotiza incluye bodegas y estacionamientos, igual que
        // la tarjeta del Inventario.
        fetchExtrasPorPropiedad(propIds),
      ]);

      const modelo = new Map(((modelosRes?.data as any[]) ?? []).map((m) => [m.id as number, m]));
      const imgPorPropiedad = new Map<number, string>();
      for (const i of ((imgPropRes?.data as any[]) ?? [])) {
        if (!imgPorPropiedad.has(i.id_propiedad)) imgPorPropiedad.set(i.id_propiedad, i.url);
      }
      const imgPorModelo = new Map<number, string>();
      for (const i of ((imgModeloRes?.data as any[]) ?? [])) {
        if (!imgPorModelo.has(i.id_modelo)) imgPorModelo.set(i.id_modelo, i.url);
      }

      const lista: DepartamentoDisponible[] = props.map((p) => {
        const idModelo = emAModelo.get(p.id_edificio_modelo) ?? null;
        const m = idModelo != null ? modelo.get(idModelo) : null;
        return {
          id: String(p.id),
          idNumerico: p.id as number,
          numero: (p.numero_propiedad as string) ?? String(p.id),
          modelo: (m?.nombre as string) ?? "",
          nivel: (p.numero_piso as string) ?? null,
          precioLista: Number(p.precio_lista ?? 0),
          precioTotal: precioTotalUnidad(p.precio_lista, extras.get(p.id as number)),
          recamaras: (m?.numero_recamaras as number) ?? 0,
          banos: (m?.numero_completo_banos as number) ?? 0,
          m2: Number(p.m2_interiores ?? 0) + Number(p.m2_exteriores ?? 0),
          imagen:
            imgPorPropiedad.get(p.id as number) ??
            (idModelo != null ? imgPorModelo.get(idModelo) ?? null : null),
        };
      });

      return lista.sort((a, b) => porNumero(a.numero, b.numero));
    },
  });

  const departamentos = useMemo(() => data ?? [], [data]);

  return {
    departamentos,
    isLoading: idProyecto != null && isLoading,
  };
}
