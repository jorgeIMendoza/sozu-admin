import { useQuery } from "@tanstack/react-query";
import {
  fetchCobranzaBase,
  filtrarRows,
  type CobranzaFiltros,
  type CobranzaRow,
} from "./_cobranzaBase";

export interface EvolucionEmisionCobranzaRow {
  mes: string;
  monto_emitido: number;
  monto_cobrado: number;
}

export interface EvolucionEmisionCobranzaResult {
  data: EvolucionEmisionCobranzaRow[];
  isLoading: boolean;
  error: Error | null;
  rpcMissing: boolean;
}

export function useEvolucionEmisionCobranza(
  mesesAtras: number,
  filtros: CobranzaFiltros,
): EvolucionEmisionCobranzaResult {
  const query = useQuery({
    queryKey: ["cobranza-base", filtros.idProyecto ?? null],
    queryFn: () => fetchCobranzaBase({ idProyecto: filtros.idProyecto }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  const data = query.data ? computeEvolucion(filtrarRows(query.data.rows, filtros), mesesAtras, filtros) : [];

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

function computeEvolucion(
  rows: CobranzaRow[],
  mesesAtras: number,
  filtros: CobranzaFiltros,
): EvolucionEmisionCobranzaRow[] {
  // Si hay rango personalizado, los meses se construyen desde fechaInicio
  // hasta fechaFin. Si no, se usan los últimos `mesesAtras` meses.
  const meses = filtros.fechaInicio && filtros.fechaFin
    ? buildMonthsRangeAsc(filtros.fechaInicio, filtros.fechaFin)
    : buildLastMonthsAsc(mesesAtras);
  const byMes = new Map<string, EvolucionEmisionCobranzaRow>();
  meses.forEach((m) => byMes.set(m, { mes: m, monto_emitido: 0, monto_cobrado: 0 }));

  const minMes = meses[0];
  const maxMes = meses[meses.length - 1];

  for (const r of rows) {
    if (r.fecha_compra) {
      const mes = truncMonth(r.fecha_compra);
      if (mes >= minMes && mes <= maxMes) {
        const b = byMes.get(mes);
        if (b) b.monto_emitido += r.monto_comision;
      }
    }
    if (r.es_pagada) {
      const cobroDate = r.fecha_pago_comision ?? r.fecha_compra;
      if (cobroDate) {
        const mes = truncMonth(cobroDate);
        if (mes >= minMes && mes <= maxMes) {
          const b = byMes.get(mes);
          if (b) b.monto_cobrado += r.monto_comision;
        }
      }
    }
  }

  return Array.from(byMes.values()).map((r) => ({
    mes: r.mes,
    monto_emitido: +r.monto_emitido.toFixed(2),
    monto_cobrado: +r.monto_cobrado.toFixed(2),
  }));
}

function truncMonth(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

function buildLastMonthsAsc(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

function buildMonthsRangeAsc(fechaInicio: string, fechaFin: string): string[] {
  const start = new Date(fechaInicio + "T00:00:00");
  const end = new Date(fechaFin + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const max = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= max) {
    const yy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    out.push(`${yy}-${mm}-01`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
