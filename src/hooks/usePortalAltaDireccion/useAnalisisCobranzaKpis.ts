import { useQuery } from "@tanstack/react-query";
import {
  fetchCobranzaBase,
  filtrarRows,
  startDateForPeriodo,
  type CobranzaFiltros,
  type CobranzaRow,
  type PeriodoCobranza,
} from "./_cobranzaBase";

export type { PeriodoCobranza };

export interface AnalisisCobranzaKpis {
  cobrado_periodo: number;
  por_cobrar_total: number;
  vencido_30d: number;
  dso_dias: number;
}

export interface AnalisisCobranzaKpisResult {
  data: AnalisisCobranzaKpis | null;
  isLoading: boolean;
  error: Error | null;
  rpcMissing: boolean;
}

export function useAnalisisCobranzaKpis(
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): AnalisisCobranzaKpisResult {
  const query = useQuery({
    queryKey: ["cobranza-base"],
    queryFn: fetchCobranzaBase,
    staleTime: 60_000,
  });

  const data = query.data ? computeKpis(filtrarRows(query.data.rows, filtros), periodo, filtros) : null;

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

function computeKpis(rows: CobranzaRow[], periodo: PeriodoCobranza, filtros: CobranzaFiltros): AnalisisCobranzaKpis {
  // Si hay rango personalizado, el filtro ya restringió por fecha_compra al
  // rango y `periodo` queda informativo. Si no, usamos `desde` del preset.
  const rangoActivo = !!(filtros.fechaInicio && filtros.fechaFin);
  const desde = rangoActivo ? new Date(filtros.fechaInicio! + "T00:00:00") : startDateForPeriodo(periodo);

  let cobradoPeriodo = 0;
  let porCobrar = 0;
  let vencido30d = 0;
  let numDso = 0;
  let denDso = 0;

  for (const r of rows) {
    const esEmitido = r.fecha_compra != null;
    if (!esEmitido) continue;

    if (r.es_pagada) {
      const ref = r.fecha_pago_comision ?? r.fecha_compra!;
      if (new Date(ref) >= desde) cobradoPeriodo += r.monto_comision;
    } else {
      porCobrar += r.monto_comision;
      if ((r.dias_desde_emision ?? 0) > 30) vencido30d += r.monto_comision;
      if (r.dias_desde_emision != null) {
        numDso += r.dias_desde_emision * r.monto_comision;
        denDso += r.monto_comision;
      }
    }
  }

  return {
    cobrado_periodo: +cobradoPeriodo.toFixed(2),
    por_cobrar_total: +porCobrar.toFixed(2),
    vencido_30d: +vencido30d.toFixed(2),
    dso_dias: denDso > 0 ? +(numDso / denDso).toFixed(1) : 0,
  };
}
