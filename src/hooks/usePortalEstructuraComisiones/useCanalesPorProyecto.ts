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
 * Ver `Ejecuciones_manuales/20260809_directorio_personal_rrhh.md`, Anexo 7.
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
    };
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
          'Ejecuta el DDL "Canales de Venta por proyecto" en Ejecuciones_manuales.',
        );
      }
      if (res.tableMissing) {
        throw new Error(
          'La base de datos aún no tiene la tabla comisiones_canal_config. ' +
          'Ejecuta el DDL "Comisión total independiente por canal" en Ejecuciones_manuales.',
        );
      }
      if (!res.ok) throw new Error("No se pudo guardar la configuración del canal.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONFIG_KEY, idProyecto] });
    },
  });
}

export interface ProyectoSozu {
  id: number;
  nombre: string;
}

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;

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
        .select("id, nombre")
        .in("id", ids)
        .eq("activo", true)
        .order("nombre");
      if (error || !data) return [];
      return data as ProyectoSozu[];
    },
  });
}
