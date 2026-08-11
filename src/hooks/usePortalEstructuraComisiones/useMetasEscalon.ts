import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Incentivos por **metas de cierre mensual**.
 *
 * 1. Cada canal define su escalera: 3 ventas, 5 ventas, 7 ventas…
 * 2. Cada meta incrementa un **porcentaje sobre la comisión base** del
 *    comisionista (+20% de su base, no 20 puntos porcentuales).
 * 3. El contador es del **canal completo**: las metas se miden con las ventas
 *    del canal en el mes, no con las de cada persona.
 * 4. El cálculo es **MARGINAL POR TRAMOS**: cada venta se paga con el
 *    porcentaje del tramo en el que cae y las ventas anteriores **conservan**
 *    el suyo. Con escalones 3/5/7, las ventas 1–2 van a la base, 3–4 al escalón
 *    de 3, 5–6 al de 5 y 7 en adelante al de 7.
 * 5. La escalera puede tener **override por comisionista** (`id_personal`),
 *    que sobrescribe el tramo del canal para esa persona.
 *
 * Validado contra el Excel con el que la operación calcula esto hoy: los diez
 * acumulados coinciden exactamente con el cálculo marginal.
 *
 * Ver `Ejecuciones_manuales/20260811_incentivos_escalon_por_comisionista.md`.
 */

const METAS_KEY = "comisiones-metas-escalon";

/** PostgREST devuelve este código cuando la tabla aún no existe (DDL pendiente). */
const TABLE_MISSING_CODE = "PGRST205";
/** La columna existe en el código pero no en la BD: falta ejecutar el DDL. */
const COLUMN_MISSING_CODES = ["42703", "PGRST204"];
const DUPLICATE_KEY_CODE = "23505";

export interface MetaEscalon {
  id: number;
  idProyecto: number;
  idCanal: string;
  /** `null` = escalón del canal (aplica a todos). Con valor = propio de esa persona. */
  idPersonal: string | null;
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
    idPersonal: row.id_personal != null ? String(row.id_personal) : null,
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
      const completo = await (supabase as any)
        .from("comisiones_metas_escalon")
        .select("id, id_proyecto, id_canal, id_personal, ventas_meta, incremento_pct, activo")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true)
        .order("ventas_meta");

      if (!completo.error) return (completo.data ?? []).map(metaFromRow);
      if (completo.error.code === TABLE_MISSING_CODE) return null;

      // Sin `id_personal` (DDL del override pendiente) se relee sin ella: todos
      // los escalones son del canal, como antes de que existiera el override.
      if (!COLUMN_MISSING_CODES.includes(completo.error.code)) return [];
      const parcial = await (supabase as any)
        .from("comisiones_metas_escalon")
        .select("id, id_proyecto, id_canal, ventas_meta, incremento_pct, activo")
        .eq("id_proyecto", idProyecto)
        .eq("activo", true)
        .order("ventas_meta");
      if (parcial.error) return [];
      return (parcial.data ?? []).map((r: Record<string, unknown>) =>
        metaFromRow({ ...r, id_personal: null }),
      );
    },
  });
}

function traducirError(error: { code?: string; message?: string }): Error {
  if (error.code === TABLE_MISSING_CODE) {
    return new Error(
      'La base de datos aún no tiene la tabla de metas. Ejecuta ' +
      'Ejecuciones_manuales/20260811_incentivos_metas_cierre.md.',
    );
  }
  if (error.code && COLUMN_MISSING_CODES.includes(error.code)) {
    return new Error(
      'La base de datos aún no permite escalones por comisionista. Ejecuta ' +
      'Ejecuciones_manuales/20260811_incentivos_escalon_por_comisionista.md.',
    );
  }
  if (error.code === DUPLICATE_KEY_CODE) {
    return new Error("Ya existe un escalón para esa cantidad de ventas en este nivel.");
  }
  if (error.code === "23514") {
    return new Error("La meta debe ser mayor a cero y el incremento no puede ser negativo.");
  }
  return new Error(error.message ?? "No se pudo guardar el escalón.");
}

export interface NuevoEscalonInput {
  idCanal: string;
  /** `null` = escalón del canal; con valor = propio de esa persona. */
  idPersonal: string | null;
  ventasMeta: number;
  incrementoPct: number;
}

/**
 * Alta. Se usa `insert`, no `upsert`: la unicidad son índices **parciales**
 * (separan nivel canal de nivel persona) y PostgREST no puede inferirlos para
 * `on_conflict`.
 */
export function useCrearEscalon(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoEscalonInput) => {
      if (idProyecto == null) throw new Error("Selecciona un proyecto primero.");
      const { error } = await (supabase as any).from("comisiones_metas_escalon").insert({
        id_proyecto: idProyecto,
        id_canal: Number(input.idCanal),
        id_personal: input.idPersonal != null ? Number(input.idPersonal) : null,
        ventas_meta: input.ventasMeta,
        incremento_pct: input.incrementoPct,
        activo: true,
      });
      if (error) throw traducirError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [METAS_KEY, idProyecto] }),
  });
}

/** Modificación en su lugar: la meta y el incremento de un escalón existente. */
export function useActualizarEscalon(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campos }: { id: number; ventasMeta?: number; incrementoPct?: number }) => {
      const fila: Record<string, unknown> = { fecha_actualizacion: new Date().toISOString() };
      if (campos.ventasMeta !== undefined) fila.ventas_meta = campos.ventasMeta;
      if (campos.incrementoPct !== undefined) fila.incremento_pct = campos.incrementoPct;

      const { error } = await (supabase as any)
        .from("comisiones_metas_escalon")
        .update(fila)
        .eq("id", id);
      if (error) throw traducirError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [METAS_KEY, idProyecto] }),
  });
}

/** Baja lógica: conserva el histórico de la política con la que se liquidó. */
export function useEliminarEscalon(idProyecto: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from("comisiones_metas_escalon")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw traducirError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [METAS_KEY, idProyecto] }),
  });
}

/* ------------------------------------------------------------------ */
/* Resolución de la escalera y cálculo marginal                        */
/* ------------------------------------------------------------------ */

/** Un tramo de la escalera ya resuelto para un comisionista. */
export interface TramoEfectivo {
  ventasMeta: number;
  incrementoPct: number;
  /** true si viene del override de la persona y no del canal. */
  esOverride: boolean;
  /** Id del escalón que manda, para poder editarlo. */
  idEscalon: number;
}

/**
 * Escalera efectiva de un comisionista: **merge por umbral**, no reemplazo.
 *
 * Si el canal define 3/5/7 y la persona solo define su propio 5, hereda el 3 y
 * el 7 del canal. Reemplazar la escalera completa obligaría a recapturar todo
 * para cambiar un tramo.
 */
export function escaleraEfectiva(
  escalonesDelCanal: MetaEscalon[],
  escalonesDeLaPersona: MetaEscalon[],
): TramoEfectivo[] {
  const porMeta = new Map<number, TramoEfectivo>();
  for (const e of escalonesDelCanal) {
    porMeta.set(e.ventasMeta, {
      ventasMeta: e.ventasMeta,
      incrementoPct: e.incrementoPct,
      esOverride: false,
      idEscalon: e.id,
    });
  }
  for (const e of escalonesDeLaPersona) {
    porMeta.set(e.ventasMeta, {
      ventasMeta: e.ventasMeta,
      incrementoPct: e.incrementoPct,
      esOverride: true,
      idEscalon: e.id,
    });
  }
  return Array.from(porMeta.values()).sort((a, b) => a.ventasMeta - b.ventasMeta);
}

export interface VentaDesglosada {
  /** Número de venta del mes: 1, 2, 3… */
  ordinal: number;
  /** % que paga ESTA venta. */
  pct: number;
  /** Tramo que aplicó, o `null` si va a la comisión base. */
  tramo: TramoEfectivo | null;
  /** Importe de esta venta. */
  importe: number;
}

/**
 * Desglose marginal: qué porcentaje e importe paga **cada** venta del mes.
 *
 * Cada venta cae en el tramo cuyo umbral ya alcanzó, y las anteriores conservan
 * el suyo. Es lo que hace el Excel de operación y lo que sustituye al cálculo
 * retroactivo anterior, que liquidaba todas las ventas al porcentaje más alto.
 */
export function desglosePorVenta(
  pctBase: number,
  escalera: TramoEfectivo[],
  ventasDelMes: number,
  precioUnidad: number,
): VentaDesglosada[] {
  const ordenada = [...escalera].sort((a, b) => a.ventasMeta - b.ventasMeta);
  const desglose: VentaDesglosada[] = [];

  for (let ordinal = 1; ordinal <= ventasDelMes; ordinal++) {
    // El tramo de esta venta es el de mayor umbral que ya alcanzó.
    let tramo: TramoEfectivo | null = null;
    for (const t of ordenada) {
      if (t.ventasMeta <= ordinal) tramo = t;
      else break;
    }
    const pct = pctBase * (1 + (tramo?.incrementoPct ?? 0) / 100);
    desglose.push({ ordinal, pct, tramo, importe: precioUnidad * pct / 100 });
  }
  return desglose;
}

/** Totales del mes a partir del desglose marginal. */
export function totalesDelMes(desglose: VentaDesglosada[]) {
  const importe = desglose.reduce((s, v) => s + v.importe, 0);
  const pctAcumulado = desglose.reduce((s, v) => s + v.pct, 0);
  return {
    importe,
    /** Suma de los % de cada venta: el % total sobre un precio unitario. */
    pctAcumulado,
    /** % promedio por venta, útil para comparar contra la base. */
    pctPromedio: desglose.length ? pctAcumulado / desglose.length : 0,
  };
}

/** Tramo que aplica a la SIGUIENTE venta, para mostrar en qué nivel va el canal. */
export function tramoVigente(escalera: TramoEfectivo[], ventasDelMes: number): TramoEfectivo | null {
  return escalera
    .filter(t => t.ventasMeta <= ventasDelMes)
    .reduce<TramoEfectivo | null>(
      (mejor, t) => (mejor === null || t.ventasMeta > mejor.ventasMeta ? t : mejor),
      null,
    );
}

/** Siguiente meta por alcanzar, para mostrar cuánto falta. */
export function siguienteTramo(escalera: TramoEfectivo[], ventasDelMes: number): TramoEfectivo | null {
  return escalera
    .filter(t => t.ventasMeta > ventasDelMes)
    .reduce<TramoEfectivo | null>(
      (menor, t) => (menor === null || t.ventasMeta < menor.ventasMeta ? t : menor),
      null,
    );
}
