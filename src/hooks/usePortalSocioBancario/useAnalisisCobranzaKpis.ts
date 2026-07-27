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
    queryKey: ["cobranza-base", filtros.idProyecto ?? null],
    queryFn: () => fetchCobranzaBase({ idProyecto: filtros.idProyecto }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  const data = query.data ? computeKpis(filtrarRows(query.data.rows, filtros), periodo, filtros) : null;

  return {
    data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    rpcMissing: false,
  };
}

/**
 * Estatus de propiedad que cuentan como "inventario con derecho de cobro
 * pendiente" para la fórmula especial de "Por cobrar · Todo el histórico":
 *   2 Disponible · 4 Apartada · 5 Vendido · 7 Escrituración ·
 *   8 Entregada · 9 Pagada completamente · 11 En demanda.
 * Excluye 1 Inventario (alta inicial sin compromiso comercial).
 */
const ESTATUS_INVENTARIO_ACTIVO = new Set([2, 4, 5, 7, 8, 9, 11]);

/**
 * Estatus de propiedad que cuentan para la fórmula especial de
 * "Cobrado · Todo el histórico": muestra la suma del Total Pagado real
 * (vía aplicaciones_pago) de cuentas con propiedad en estos estatus.
 *   1 Inventario · 4 Apartada · 5 Vendido · 7 Escrituración ·
 *   8 Entregada · 9 Pagada completamente · 11 En demanda.
 * Excluye 2 Disponible (no aplica cobro real todavía).
 */
const ESTATUS_COBRABLE_REAL = new Set([1, 4, 5, 7, 8, 9, 11]);

function computeKpis(rows: CobranzaRow[], periodo: PeriodoCobranza, filtros: CobranzaFiltros): AnalisisCobranzaKpis {
  // Si hay rango personalizado, el filtro ya restringió por fecha_compra al
  // rango y `periodo` queda informativo. Si no, usamos `desde` del preset.
  // Todas las métricas se filtran por el mismo `desde` para que los 4 KPIs
  // sean coherentes entre sí.
  const rangoActivo = !!(filtros.fechaInicio && filtros.fechaFin);
  const desde = rangoActivo ? new Date(filtros.fechaInicio! + "T00:00:00") : startDateForPeriodo(periodo);

  let cobradoComisionPeriodo = 0; // "Cobrado por periodo (presets clásicos)" — Σ comisiones cobradas
  let porCobrarEmitido = 0; // suma "Por cobrar = comisión sin cobrar de emitidas"
  let vencido30d = 0;
  let numDso = 0;
  let denDso = 0;
  // Acumuladores para las fórmulas especiales de "Todo el histórico":
  let sumaPrecioInventarioActivo = 0;
  let totalPagadoCobrable = 0;

  for (const r of rows) {
    if (r.estado_propiedad != null) {
      // Σ precio_final de inventario activo — fórmula "Por cobrar · Todo".
      if (ESTATUS_INVENTARIO_ACTIVO.has(r.estado_propiedad)) {
        sumaPrecioInventarioActivo += r.precio_final;
      }
      // Σ total_pagado de cuentas cuya propiedad está en el conjunto
      // cobrable — fórmula "Cobrado · Todo el histórico".
      if (ESTATUS_COBRABLE_REAL.has(r.estado_propiedad)) {
        totalPagadoCobrable += r.total_pagado;
      }
    }

    const esEmitido = r.fecha_compra != null;
    if (!esEmitido) continue;

    const dEmision = new Date(r.fecha_compra!);
    const emitidaEnPeriodo = dEmision >= desde;

    if (r.es_pagada) {
      const ref = r.fecha_pago_comision ?? r.fecha_compra!;
      if (new Date(ref) >= desde) cobradoComisionPeriodo += r.monto_comision;
    } else {
      // Sólo cuenta como "Por cobrar/Vencido/DSO" si la emisión cae dentro
      // del período seleccionado. Coherente con "Cobrado en período".
      if (!emitidaEnPeriodo) continue;
      porCobrarEmitido += r.monto_comision;
      if ((r.dias_desde_emision ?? 0) > 30) vencido30d += r.monto_comision;
      if (r.dias_desde_emision != null) {
        numDso += r.dias_desde_emision * r.monto_comision;
        denDso += r.monto_comision;
      }
    }
  }

  // Fórmulas especiales para "Todo el histórico" (sin rango personalizado):
  // - Cobrado: Σ Total Pagado real (aplicaciones_pago) de cuentas cobrable.
  // - Por cobrar: Σ precio_final inventario activo − Cobrado.
  // Para los demás presets / rango personalizado se conserva la métrica
  // clásica de comisiones.
  const usarFormulaEspecial = periodo === "todo" && !rangoActivo;
  const cobradoFinal = usarFormulaEspecial ? totalPagadoCobrable : cobradoComisionPeriodo;
  const porCobrarFinal = usarFormulaEspecial
    ? Math.max(0, sumaPrecioInventarioActivo - cobradoFinal)
    : porCobrarEmitido;

  return {
    cobrado_periodo: +cobradoFinal.toFixed(2),
    por_cobrar_total: +porCobrarFinal.toFixed(2),
    vencido_30d: +vencido30d.toFixed(2),
    dso_dias: denDso > 0 ? +(numDso / denDso).toFixed(1) : 0,
  };
}
