import { useQuery } from "@tanstack/react-query";
import {
  fetchCobranzaBase,
  filtrarRows,
  startDateForPeriodo,
  type CobranzaFiltros,
  type CobranzaRow,
  type PeriodoCobranza,
} from "./_cobranzaBase";

export interface CobranzaPorDesarrolladorRow {
  id_persona: number;
  razon_social: string;
  facturas_count: number;
  monto_emitido: number;
  monto_cobrado: number;
  monto_por_cobrar: number;
  monto_vencido_30d: number;
  antiguedad_promedio_dias: number;
}

export interface CobranzaPorDesarrolladorResult {
  data: CobranzaPorDesarrolladorRow[];
  isLoading: boolean;
  error: Error | null;
  rpcMissing: boolean;
}

export function useCobranzaPorDesarrollador(
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): CobranzaPorDesarrolladorResult {
  const query = useQuery({
    queryKey: ["cobranza-base", filtros.idProyecto ?? null],
    queryFn: () => fetchCobranzaBase({ idProyecto: filtros.idProyecto }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  const data = query.data
    ? computeDesarrolladores(filtrarRows(query.data.rows, filtros), periodo, filtros)
    : [];

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

function computeDesarrolladores(
  rows: CobranzaRow[],
  periodo: PeriodoCobranza,
  filtros: CobranzaFiltros,
): CobranzaPorDesarrolladorRow[] {
  // Si hay rango personalizado, `filtrarRows` ya restringió por fecha_compra.
  // El preset `periodo` se ignora en ese caso.
  const rangoActivo = !!(filtros.fechaInicio && filtros.fechaFin);
  const desde = rangoActivo ? new Date(filtros.fechaInicio! + "T00:00:00") : startDateForPeriodo(periodo);

  type Agg = {
    id_persona: number;
    razon_social: string;
    facturas_count: number;
    monto_emitido: number;
    monto_cobrado: number;
    monto_por_cobrar: number;
    monto_vencido_30d: number;
    suma_dias: number;
    cuentas_por_cobrar: number;
  };

  const map = new Map<number, Agg>();

  for (const r of rows) {
    if (!r.id_persona_desarrollador) continue;
    if (!r.fecha_compra) continue;
    if (new Date(r.fecha_compra) < desde) continue;

    const key = r.id_persona_desarrollador;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        id_persona: key,
        razon_social: r.desarrollador_nombre,
        facturas_count: 0,
        monto_emitido: 0,
        monto_cobrado: 0,
        monto_por_cobrar: 0,
        monto_vencido_30d: 0,
        suma_dias: 0,
        cuentas_por_cobrar: 0,
      };
      map.set(key, agg);
    }

    agg.facturas_count += 1;
    agg.monto_emitido += r.monto_comision;
    if (r.es_pagada) {
      agg.monto_cobrado += r.monto_comision;
    } else {
      agg.monto_por_cobrar += r.monto_comision;
      if ((r.dias_desde_emision ?? 0) > 30) {
        agg.monto_vencido_30d += r.monto_comision;
      }
      if (r.dias_desde_emision != null) {
        agg.suma_dias += r.dias_desde_emision;
        agg.cuentas_por_cobrar += 1;
      }
    }
  }

  const rowsOut = Array.from(map.values()).map((a) => ({
    id_persona: a.id_persona,
    razon_social: a.razon_social,
    facturas_count: a.facturas_count,
    monto_emitido: +a.monto_emitido.toFixed(2),
    monto_cobrado: +a.monto_cobrado.toFixed(2),
    monto_por_cobrar: +a.monto_por_cobrar.toFixed(2),
    monto_vencido_30d: +a.monto_vencido_30d.toFixed(2),
    antiguedad_promedio_dias:
      a.cuentas_por_cobrar > 0 ? +(a.suma_dias / a.cuentas_por_cobrar).toFixed(1) : 0,
  }));

  rowsOut.sort((a, b) => b.monto_por_cobrar - a.monto_por_cobrar);
  return rowsOut;
}
