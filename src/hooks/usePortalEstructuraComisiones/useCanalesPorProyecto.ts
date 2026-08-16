import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Channel } from "@/lib/portal-estructura-comisiones/types/simulator";
import {
  fetchCanalesConfigProyecto, guardarCanalConfigProyecto, type CanalConfigProyecto,
} from "./useMotorComisionesSync";

/**
 * Canales de Venta **de un proyecto**.
 *
 * `comisiones_canales` es el catálogo maestro global (nombre, código, categoría,
 * banderas) y `comisiones_canal_config` guarda, por proyecto, si el canal aplica
 * y sus porcentajes propios. Un porcentaje `null` hereda del catálogo, así que
 * cambiar el maestro sigue propagándose a quien no tenga override.
 *
 * Ver `Ejecuciones_manuales/20260811_canales_por_proyecto.md`.
 */

const CONFIG_KEY = "canales-config-proyecto";

/** Canal ya resuelto para un proyecto: catálogo + override, con el rastro de cuál manda. */
export interface CanalDeProyecto {
  canal: Channel;
  /** El canal aplica a este proyecto. */
  aplica: boolean;
  /** Nunca se ha configurado para este proyecto (no hay fila). */
  sinConfigurar: boolean;
  comisionTotalPct: number;
  /** Valor vigente: el del proyecto si lo hay, si no el del catálogo. */
  comisionExternaPct: number;
  comisionMinPct: number;
  comisionMaxPct: number;
  /** Qué porcentajes vienen del proyecto y no heredados del catálogo. */
  overrides: { externa: boolean; min: boolean; max: boolean };
  /** Último guardado de esta configuración: cuándo y por quién. */
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}

export function useCanalesConfigProyecto(idProyecto: number | null) {
  return useQuery<CanalConfigProyecto[] | null>({
    queryKey: [CONFIG_KEY, idProyecto],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: () => fetchCanalesConfigProyecto(idProyecto as number),
  });
}

/**
 * Cruza el catálogo maestro con la configuración del proyecto.
 *
 * Sin configuración (DDL pendiente o proyecto nuevo) todos los canales activos
 * del catálogo se consideran aplicables y heredados: es el comportamiento previo
 * a que los canales fueran por proyecto, así que nada se rompe.
 */
export function resolverCanalesDeProyecto(
  catalogo: Channel[],
  config: CanalConfigProyecto[] | null | undefined,
): CanalDeProyecto[] {
  const porCanal = new Map((config ?? []).map(c => [c.idCanal, c]));

  return catalogo.map(canal => {
    const cfg = porCanal.get(canal.id);
    const sinConfigurar = cfg === undefined;
    return {
      canal,
      // Sin fila se asume que aplica: así un canal nuevo del catálogo no
      // desaparece de los proyectos por el simple hecho de no estar capturado.
      aplica: cfg?.aplica ?? true,
      sinConfigurar,
      comisionTotalPct: cfg?.comisionTotalPct ?? 0,
      comisionExternaPct: cfg?.comisionExternaPct ?? canal.externalCommissionPct,
      comisionMinPct: cfg?.comisionMinPct ?? canal.minCommissionPct,
      comisionMaxPct: cfg?.comisionMaxPct ?? canal.maxCommissionPct,
      overrides: {
        externa: cfg?.comisionExternaPct != null,
        min: cfg?.comisionMinPct != null,
        max: cfg?.comisionMaxPct != null,
      },
      fechaActualizacion: cfg?.fechaActualizacion ?? null,
      actualizadoPor: cfg?.actualizadoPor ?? null,
    };
  });
}

/**
 * Guardado en lote de los canales de un proyecto.
 *
 * Se escribe canal por canal —el upsert es por `(id_proyecto, id_canal)`— pero
 * el resultado se reporta junto: al usuario le importa si su tanda de cambios
 * quedó guardada, no cuál de los seis upserts falló. Si alguno falla se dice
 * cuáles, en lugar de dar por bueno el guardado completo.
 */
export function useGuardarCanalesDeProyecto(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      { cambios, actualizadoPor }: {
        cambios: Array<{ nombre: string; config: CanalConfigProyecto }>;
        actualizadoPor: string | null;
      },
    ) => {
      if (idProyecto == null) throw new Error("Selecciona un proyecto primero.");

      const fallidos: string[] = [];
      for (const { nombre, config } of cambios) {
        const res = await guardarCanalConfigProyecto(idProyecto, config, actualizadoPor);
        if (!res.tableMissing && !res.ok) fallidos.push(nombre);
        if (res.tableMissing) {
          throw new Error(
            'La base de datos aún no tiene la tabla comisiones_canal_config. ' +
            'Ejecuta el Anexo 5 de Ejecuciones_manuales/20260809_directorio_personal_rrhh.md.',
          );
        }
      }

      if (fallidos.length > 0) {
        throw new Error(`No se pudieron guardar: ${fallidos.join(', ')}.`);
      }
      return cambios.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONFIG_KEY, idProyecto] });
    },
  });
}

/** Canales que efectivamente aplican al proyecto, con sus porcentajes vigentes. */
export function canalesAplicables(resueltos: CanalDeProyecto[]): Channel[] {
  return resueltos
    .filter(c => c.aplica && c.canal.active)
    .map(c => ({
      ...c.canal,
      externalCommissionPct: c.comisionExternaPct,
      minCommissionPct: c.comisionMinPct,
      maxCommissionPct: c.comisionMaxPct,
    }));
}

export function useGuardarCanalDeProyecto(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: CanalConfigProyecto) => {
      if (idProyecto == null) throw new Error("Selecciona un proyecto primero.");
      const res = await guardarCanalConfigProyecto(idProyecto, config);
      if (res.columnMissing) {
        throw new Error(
          'La base de datos aún no tiene las columnas de canales por proyecto. ' +
          'Ejecuta Ejecuciones_manuales/20260811_canales_por_proyecto.md.',
        );
      }
      if (res.tableMissing) {
        throw new Error(
          'La base de datos aún no tiene la tabla comisiones_canal_config. ' +
          'Ejecuta el Anexo 5 de Ejecuciones_manuales/20260809_directorio_personal_rrhh.md.',
        );
      }
      if (!res.ok) throw new Error("No se pudo guardar la configuración del canal.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONFIG_KEY, idProyecto] });
    },
  });
}

/** Un canal de un proyecto, ya resuelto, para comparar entre desarrollos. */
export interface CanalComparado {
  idProyecto: number;
  proyecto: string;
  idCanal: string;
  canal: string;
  comisionTotalPct: number;
  comisionExternaPct: number;
  /** Lo que queda para repartir entre el equipo interno. */
  comisionInternaPct: number;
  /** El % externo es propio del proyecto, no heredado del catálogo. */
  externaEsPropia: boolean;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}

/**
 * Configuración guardada de canales de **todos** los proyectos.
 *
 * Solo trae lo que está persistido: un proyecto que nunca guardó cambios no
 * aparece. Es deliberado — la comparación es entre propuestas reales, y mostrar
 * a los demás con los valores del catálogo insinuaría una decisión que nadie
 * tomó.
 *
 * Waterfall explícito (patrón #1 de CLAUDE.md): config → proyectos, por
 * separado. El embed de PostgREST sobre `proyectos` devuelve `null` sin error y
 * dejaría filas sin nombre de proyecto.
 */
export function useCanalesDeTodosLosProyectos() {
  return useQuery<Array<CanalConfigProyecto & { idProyecto: number; proyecto: string }> | null>({
    queryKey: ["canales-config-todos"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comisiones_canal_config")
        .select(
          "id_proyecto, id_canal, activo, comision_total_pct, comision_externa_pct, " +
          "comision_min_pct, comision_max_pct, fecha_actualizacion, actualizado_por",
        );
      if (error) {
        // Sin la columna de autoría se relee sin ella; sin la tabla no hay nada.
        const reintento = await (supabase as any)
          .from("comisiones_canal_config")
          .select("id_proyecto, id_canal, activo, comision_total_pct, comision_externa_pct, comision_min_pct, comision_max_pct, fecha_actualizacion");
        if (reintento.error || !reintento.data) return null;
        return conNombreDeProyecto(reintento.data as any[]);
      }
      return conNombreDeProyecto((data ?? []) as any[]);
    },
  });
}

async function conNombreDeProyecto(filas: any[]) {
  if (!filas.length) return [];
  const ids = Array.from(new Set(filas.map(f => f.id_proyecto as number)));
  const { data: proyectos } = await supabase
    .from("proyectos")
    .select("id, nombre")
    .in("id", ids);
  const nombre = new Map((proyectos ?? []).map(p => [p.id as number, p.nombre as string]));

  const num = (v: unknown) => (v == null ? null : Number(v));
  return filas.map(f => ({
    idProyecto: f.id_proyecto as number,
    proyecto: nombre.get(f.id_proyecto as number) ?? `Proyecto ${f.id_proyecto}`,
    idCanal: String(f.id_canal),
    aplica: f.activo ?? true,
    comisionTotalPct: Number(f.comision_total_pct ?? 0),
    comisionExternaPct: num(f.comision_externa_pct),
    comisionMinPct: num(f.comision_min_pct),
    comisionMaxPct: num(f.comision_max_pct),
    fechaActualizacion: f.fecha_actualizacion ?? null,
    actualizadoPor: f.actualizado_por ?? null,
  }));
}

/**
 * Cruza esa configuración con el catálogo maestro para dejar cada canal listo
 * para comparar: el % externo vacío hereda del catálogo, igual que en la
 * pantalla del proyecto.
 */
export function compararCanalesEntreProyectos(
  catalogo: Channel[],
  config: Array<CanalConfigProyecto & { idProyecto: number; proyecto: string }> | null | undefined,
): CanalComparado[] {
  if (!config?.length) return [];
  const porId = new Map(catalogo.map(c => [c.id, c]));

  return config
    .filter(c => c.aplica)
    .map(c => {
      const canal = porId.get(c.idCanal);
      const externa = c.comisionExternaPct ?? canal?.externalCommissionPct ?? 0;
      return {
        idProyecto: c.idProyecto,
        proyecto: c.proyecto,
        idCanal: c.idCanal,
        canal: canal?.name ?? `Canal ${c.idCanal}`,
        comisionTotalPct: c.comisionTotalPct,
        comisionExternaPct: externa,
        comisionInternaPct: c.comisionTotalPct - externa,
        externaEsPropia: c.comisionExternaPct != null,
        fechaActualizacion: c.fechaActualizacion ?? null,
        actualizadoPor: c.actualizadoPor ?? null,
      };
    })
    // Canal y luego proyecto: se compara el mismo canal entre desarrollos.
    .sort((a, b) => a.canal.localeCompare(b.canal) || a.proyecto.localeCompare(b.proyecto));
}

export interface ProyectoSozu {
  id: number;
  nombre: string;
}

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;

/**
 * "Proyectos" que son catálogos internos (Productos, Servicios) y no desarrollos:
 * comparten la relación con SOZU pero no se comercializan como inventario, así que
 * no tienen canales de venta que configurar. Mismo criterio que
 * `useProyectosMotorComisiones` y `useProyectosSozuReales`.
 */
const TIPOS_USO_EXCLUIDOS = [9, 10];

/**
 * Proyectos **comercializados por SOZU** y activos — el universo válido para
 * configurar canales. Misma definición que el Directorio de Personal y
 * `usePortalAltaDireccion/proyectosSozu.ts`.
 *
 * Waterfall explícito en dos pasos (patrón #1 de CLAUDE.md): el triple join de
 * PostgREST falla en silencio.
 */
export function useProyectosSozuCanales() {
  return useQuery<ProyectoSozu[]>({
    queryKey: ["proyectos-sozu-canales"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rels, error: relError } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
        .eq("activo", true)
        .not("id_proyecto", "is", null);
      if (relError || !rels?.length) return [];

      const ids = Array.from(new Set(rels.map(r => r.id_proyecto as number)));

      const { data, error } = await supabase
        .from("proyectos")
        .select("id, nombre, id_tipo_uso")
        .in("id", ids)
        .eq("activo", true)
        .order("nombre");
      if (error || !data) return [];
      return data
        .filter(p => !TIPOS_USO_EXCLUIDOS.includes(p.id_tipo_uso as number))
        .map(p => ({ id: p.id, nombre: p.nombre }));
    },
  });
}
