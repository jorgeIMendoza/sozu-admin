import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import {
  fetchCobranzaBase,
  filtrarRows,
  startDateForPeriodo,
  type CobranzaFiltros,
  type CobranzaRow,
  type PeriodoCobranza,
  type TipoCobranza,
} from "./_cobranzaBase";
import type { AgingBucket } from "./useAgingCobranza";

/**
 * Detalle por cuenta para la gráfica "Antigüedad de cartera" del menú
 * Análisis de Cobranza. Devuelve una fila por cuenta no pagada (con la
 * misma definición de bucket que `useAgingCobranza`) y trae los datos que
 * necesita el drawer al hacer click en cada barra:
 *
 *   ID Cuenta · Tipo · Compradores · Propietario · Precio Final ·
 *   Total Pagado · Monto del adeudo retrasado a pago · Acción.
 */

export interface AgingCobranzaDetalleRow {
  id_cuenta: number;
  folio_cuenta: string;
  tipo: TipoCobranza;
  compradores: string[];
  propietario: string;
  precio_final: number;
  total_pagado: number;
  /** Monto retrasado = comisión SOZU pendiente de cobro (no pagada). */
  monto_adeudo: number;
  dias_desde_emision: number;
  bucket: AgingBucket;
}

export interface AgingCobranzaDetalleResult {
  data: AgingCobranzaDetalleRow[];
  isLoading: boolean;
  error: Error | null;
}

export function useAgingCobranzaDetalle(
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): AgingCobranzaDetalleResult {
  const query = useQuery<AgingCobranzaDetalleRow[]>({
    queryKey: [
      "cobranza-aging-detalle",
      periodo,
      filtros.idProyecto,
      filtros.tipo,
      filtros.idDesarrollador,
      filtros.fechaInicio,
      filtros.fechaFin,
    ],
    staleTime: 60_000,
    queryFn: async () => {
      const base = await fetchCobranzaBase();
      const filtradas = filtrarRows(base.rows, filtros);
      const candidatas = pickAgingCandidates(filtradas, periodo, filtros);
      if (candidatas.length === 0) return [];
      const compradoresMap = await fetchCompradores(candidatas.map((c) => c.id_cuenta));
      return candidatas.map((r) => ({
        id_cuenta: r.id_cuenta,
        folio_cuenta: formatCuentaCobranzaId(r.id_cuenta, r.tipo),
        tipo: r.tipo,
        compradores: compradoresMap.get(r.id_cuenta) ?? [],
        propietario: r.desarrollador_nombre,
        precio_final: r.precio_final,
        total_pagado: r.total_pagado,
        monto_adeudo: r.monto_comision,
        dias_desde_emision: r.dias_desde_emision ?? 0,
        bucket: bucketize(r.dias_desde_emision ?? 0),
      }));
    },
  });
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

function pickAgingCandidates(
  rows: CobranzaRow[],
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): CobranzaRow[] {
  const rangoActivo = !!(filtros.fechaInicio && filtros.fechaFin);
  const desde = rangoActivo
    ? new Date(filtros.fechaInicio! + "T00:00:00")
    : startDateForPeriodo(periodo);
  return rows.filter((r) => {
    if (r.es_pagada) return false;
    if (r.dias_desde_emision == null) return false;
    if (!r.fecha_compra) return false;
    if (new Date(r.fecha_compra) < desde) return false;
    return true;
  });
}

function bucketize(d: number): AgingBucket {
  if (d <= 30) return "0-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "+90";
}

async function fetchCompradores(
  cuentaIds: number[],
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (cuentaIds.length === 0) return out;

  // compradores → personas. Batched para evitar URLs largas.
  const BATCH = 500;
  type CompradorRow = { id_cuenta_cobranza: number; id_persona: number };
  const compradoresRows: CompradorRow[] = [];
  for (let i = 0; i < cuentaIds.length; i += BATCH) {
    const slice = cuentaIds.slice(i, i + BATCH);
    try {
      const batch = await fetchAllRows<CompradorRow>((from, to) =>
        (supabase as any)
          .from("compradores")
          .select("id_cuenta_cobranza, id_persona")
          .in("id_cuenta_cobranza", slice)
          .eq("activo", true)
          .range(from, to),
      );
      compradoresRows.push(...batch);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[aging-detalle] compradores fetch falló:", err);
    }
  }

  const personaIds = Array.from(
    new Set(compradoresRows.map((c) => c.id_persona).filter((v): v is number => !!v)),
  );
  const personaNombre = new Map<number, string>();
  for (let i = 0; i < personaIds.length; i += BATCH) {
    const slice = personaIds.slice(i, i + BATCH);
    try {
      const batch = await fetchAllRows<{ id: number; nombre_legal: string | null; nombre_comercial: string | null }>(
        (from, to) =>
          (supabase as any)
            .from("personas")
            .select("id, nombre_legal, nombre_comercial")
            .in("id", slice)
            .range(from, to),
      );
      for (const p of batch) {
        personaNombre.set(
          p.id,
          (p.nombre_comercial || p.nombre_legal || "Sin nombre") as string,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[aging-detalle] personas fetch falló:", err);
    }
  }

  for (const c of compradoresRows) {
    const nombre = personaNombre.get(c.id_persona);
    if (!nombre) continue;
    const arr = out.get(c.id_cuenta_cobranza) ?? [];
    arr.push(nombre);
    out.set(c.id_cuenta_cobranza, arr);
  }
  return out;
}
