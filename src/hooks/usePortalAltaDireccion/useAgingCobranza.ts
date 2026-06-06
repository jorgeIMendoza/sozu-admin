import { useQuery } from "@tanstack/react-query";
import {
  fetchCobranzaBase,
  filtrarRows,
  startDateForPeriodo,
  type CobranzaFiltros,
  type CobranzaRow,
  type PeriodoCobranza,
} from "./_cobranzaBase";

export type AgingBucket = "0-30" | "31-60" | "61-90" | "+90";

export interface AgingRow {
  bucket: AgingBucket;
  cuenta: number;
  monto: number;
}

export interface AgingCobranzaResult {
  data: AgingRow[];
  isLoading: boolean;
  error: Error | null;
  rpcMissing: boolean;
}

const BUCKETS: AgingBucket[] = ["0-30", "31-60", "61-90", "+90"];

export function useAgingCobranza(
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): AgingCobranzaResult {
  const query = useQuery({
    queryKey: ["cobranza-base", filtros.idProyecto ?? null],
    queryFn: () => fetchCobranzaBase({ idProyecto: filtros.idProyecto }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  const data = query.data
    ? computeAging(filtrarRows(query.data.rows, filtros), periodo, filtros)
    : [];

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

function computeAging(
  rows: CobranzaRow[],
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): AgingRow[] {
  // Coherente con `useAnalisisCobranzaKpis`: el aging sólo cuenta cuentas
  // emitidas dentro del período seleccionado (o el rango personalizado).
  const rangoActivo = !!(filtros.fechaInicio && filtros.fechaFin);
  const desde = rangoActivo
    ? new Date(filtros.fechaInicio! + "T00:00:00")
    : startDateForPeriodo(periodo);

  const init: Record<AgingBucket, { cuenta: number; monto: number }> = {
    "0-30": { cuenta: 0, monto: 0 },
    "31-60": { cuenta: 0, monto: 0 },
    "61-90": { cuenta: 0, monto: 0 },
    "+90":  { cuenta: 0, monto: 0 },
  };

  for (const r of rows) {
    if (r.es_pagada) continue;
    if (r.dias_desde_emision == null) continue;
    if (!r.fecha_compra) continue;
    if (new Date(r.fecha_compra) < desde) continue;
    const d = r.dias_desde_emision;
    let bucket: AgingBucket;
    if (d <= 30) bucket = "0-30";
    else if (d <= 60) bucket = "31-60";
    else if (d <= 90) bucket = "61-90";
    else bucket = "+90";
    init[bucket].cuenta += 1;
    init[bucket].monto += r.monto_comision;
  }

  return BUCKETS.map((b) => ({
    bucket: b,
    cuenta: init[b].cuenta,
    monto: +init[b].monto.toFixed(2),
  }));
}
