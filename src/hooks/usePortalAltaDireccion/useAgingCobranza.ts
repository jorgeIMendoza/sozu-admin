import { useQuery } from "@tanstack/react-query";
import {
  fetchCobranzaBase,
  filtrarRows,
  type CobranzaFiltros,
  type CobranzaRow,
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

export function useAgingCobranza(filtros: CobranzaFiltros): AgingCobranzaResult {
  const query = useQuery({
    queryKey: ["cobranza-base"],
    queryFn: fetchCobranzaBase,
    staleTime: 60_000,
  });

  const data = query.data ? computeAging(filtrarRows(query.data.rows, filtros)) : [];

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

function computeAging(rows: CobranzaRow[]): AgingRow[] {
  const init: Record<AgingBucket, { cuenta: number; monto: number }> = {
    "0-30": { cuenta: 0, monto: 0 },
    "31-60": { cuenta: 0, monto: 0 },
    "61-90": { cuenta: 0, monto: 0 },
    "+90":  { cuenta: 0, monto: 0 },
  };

  for (const r of rows) {
    if (r.es_pagada) continue;
    if (r.dias_desde_emision == null) continue;
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
