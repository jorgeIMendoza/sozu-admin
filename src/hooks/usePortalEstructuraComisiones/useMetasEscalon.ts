import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Incentivos por **metas de cierre mensual**.
 *
 * La comisión sube cuando el canal alcanza metas de ventas en el mes:
 *
 * 1. Cada canal define su escalera: 3 ventas, 5 ventas, 7 ventas…
 * 2. Cada meta incrementa un **porcentaje sobre la comisión base** del
 *    comisionista (+20% de su base, no 20 puntos porcentuales).
 * 3. El contador es del **canal completo**: al alcanzar la meta sube el
 *    porcentaje de todos sus comisionistas, hayan vendido mucho o poco.
 * 4. El efecto es **retroactivo al mes**: alcanzada la meta, todas las ventas
 *    del mes se liquidan al porcentaje nuevo.
 *
 * Ver `Ejecuciones_manuales/20260811_incentivos_metas_cierre.md`.
 */

const METAS_KEY = "comisiones-metas-escalon";

/** PostgREST devuelve este código cuando la tabla aún no existe (DDL pendiente). */
const TABLE_MISSING_CODE = "PGRST205";

export interface MetaEscalon {
  id: number;
  idProyecto: number;
  idCanal: string;
  /** Ventas del canal en el mes que disparan este escalón. */
  ventasMeta: number;
  /** Incremento como % de la comisión base (20 = +20% de la base). */
  incrementoPct: number;
  activo: boolean;
}

function metaFromRow(row: Record<string, unknown>): MetaEscalon {
  return {
    id: Number(row.id),
    idProyecto: Number(row.id_proyecto),
    idCanal: String(row.id_canal),
    ventasMeta: Number(row.ventas_meta ?? 0),
    incrementoPct: Number(row.incremento_pct ?? 0),
    activo: (row.activo as boolean) ?? true,
  };
}

/** `null` = la tabla no existe todavía (DDL pendiente), distinto de "sin escalones". */
export function useMetasEscalon(idProyecto: number | null) {
  return useQuery<MetaEscalon[] | null>({
    queryKey: [METAS_KEY, idProyecto],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comisiones_metas_escalon")
        .select("id, id_proyecto, id_canal, ventas_meta, incremento_pct, activo")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true)
        .order("ventas_meta");
      if (error) return error.code === TABLE_MISSING_CODE ? null : [];
      return (data ?? []).map(metaFromRow);
    },
  });
}

export interface GuardarMetaInput {
  id?: number;
  idCanal: string;
  ventasMeta: number;
  incrementoPct: number;
}

export function useGuardarMeta(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarMetaInput) => {
      if (idProyecto == null) throw new Error("Selecciona un proyecto primero.");
      const fila = {
        id_proyecto: idProyecto,
        id_canal: Number(input.idCanal),
        ventas_meta: input.ventasMeta,
        incremento_pct: input.incrementoPct,
        activo: true,
        fecha_actualizacion: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("comisiones_metas_escalon")
        .upsert(fila, { onConflict: "id_proyecto,id_canal,ventas_meta" });

      if (error) {
        if (error.code === TABLE_MISSING_CODE) {
          throw new Error(
            'La base de datos aún no tiene la tabla de metas. Ejecuta ' +
            'Ejecuciones_manuales/20260811_incentivos_metas_cierre.md.',
          );
        }
        if (error.code === "23514") {
          throw new Error("La meta debe ser mayor a cero y el incremento no puede ser negativo.");
        }
        throw new Error(error.message ?? "No se pudo guardar la meta.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [METAS_KEY, idProyecto] }),
  });
}

/** Baja lógica: conserva el histórico de la política con la que se liquidó. */
export function useEliminarMeta(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("comisiones_metas_escalon")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw new Error(error.message ?? "No se pudo eliminar la meta.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [METAS_KEY, idProyecto] }),
  });
}

/**
 * Escalón aplicable para un número de ventas: el **mayor alcanzado**, no la suma.
 *
 * Con metas 3/5/7 (+20/+40/+60) y 6 ventas aplica el de 5 → +40%. Sumarlos haría
 * que la escalera creciera más rápido de lo pactado.
 */
export function escalonAlcanzado(metas: MetaEscalon[], ventasDelMes: number): MetaEscalon | null {
  return metas
    .filter(m => m.activo && m.ventasMeta <= ventasDelMes)
    .reduce<MetaEscalon | null>(
      (mejor, m) => (mejor === null || m.ventasMeta > mejor.ventasMeta ? m : mejor),
      null,
    );
}

/** Comisión efectiva = base × (1 + incremento/100). Sin escalón, es la base. */
export function pctEfectivo(pctBase: number, escalon: MetaEscalon | null): number {
  return pctBase * (1 + (escalon?.incrementoPct ?? 0) / 100);
}

/** Siguiente meta por alcanzar, para mostrar cuánto falta. */
export function siguienteMeta(metas: MetaEscalon[], ventasDelMes: number): MetaEscalon | null {
  return metas
    .filter(m => m.activo && m.ventasMeta > ventasDelMes)
    .reduce<MetaEscalon | null>(
      (menor, m) => (menor === null || m.ventasMeta < menor.ventasMeta ? m : menor),
      null,
    );
}
