import { useMemo } from "react";
import {
  MOCK_MOVIMIENTOS,
  MOCK_EVOLUCION_DEVENGADO,
  MOCK_EVOLUCION_CAJA,
  MOCK_EXPOSICION,
  type BaseContable,
  type IngresoEgresoMovimiento,
  type ProyectoSozu,
  type TipoIngresoSozu,
  type ResumenFinanciero,
  type PuntoEvolucionMensual,
  type ExposicionCobroPrevio,
} from "@/data/socioBancario/ingresosEgresosMock";

/**
 * Hook puro que computa los KPIs, evolución, exposición y filtrado del
 * ledger para la sección "Ingresos y Egresos". Mañana, cuando llegue la
 * fuente real (RPC `get_resumen_ingresos_egresos` o agregaciones
 * client-side), se sustituye el origen del dataset sin cambiar la UI.
 */

export type PeriodoIngresosEgresos = "este_mes" | 3 | 6 | 12 | "rango";

export interface IngresosEgresosFiltros {
  base: BaseContable;
  periodoMeses: PeriodoIngresosEgresos;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  proyecto: ProyectoSozu | "todos";
  tipoIngreso: TipoIngresoSozu | "todos";
}

/**
 * Defaults pedidos por producto: mes en curso, proyecto Daiku, tipo
 * Propiedad. Base devengado por convención contable estándar.
 */
export const DEFAULT_FILTROS: IngresosEgresosFiltros = {
  base: "devengado",
  periodoMeses: "este_mes",
  fechaInicio: null,
  fechaFin: null,
  proyecto: "Daiku",
  tipoIngreso: "Propiedad",
};

export interface UseResumenResult {
  resumen: ResumenFinanciero;
  movimientos: IngresoEgresoMovimiento[];
  evolucion: PuntoEvolucionMensual[];
  exposicion: ExposicionCobroPrevio[];
  composicionIngresos: Array<{ key: string; label: string; monto: number; count: number; pct: number }>;
  composicionEgresos: {
    externos: { total: number; pct: number; top: Array<{ nombre: string; monto: number }> };
    internos: { total: number; pct: number; porRol: Array<{ rol: string; monto: number }> };
  };
}

const TODAY = new Date("2026-06-05T00:00:00");

function desdeSegunPeriodo(periodoMeses: IngresosEgresosFiltros["periodoMeses"]): Date {
  if (periodoMeses === "rango") return new Date(0);
  if (periodoMeses === "este_mes") {
    return new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  }
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - periodoMeses);
  return d;
}

function aplicaFechaSegunBase(
  m: IngresoEgresoMovimiento,
  base: BaseContable,
): string | null {
  if (base === "devengado") return m.fecha_causacion;
  return m.fecha_cobro_pago;
}

export function useResumenIngresosEgresos(
  filtros: IngresosEgresosFiltros,
): UseResumenResult {
  return useMemo(() => {
    const { base, periodoMeses, fechaInicio, fechaFin, proyecto, tipoIngreso } = filtros;
    const rangoActivo = periodoMeses === "rango" && fechaInicio && fechaFin;
    const desde = rangoActivo
      ? new Date(fechaInicio! + "T00:00:00")
      : desdeSegunPeriodo(periodoMeses);
    const hasta = rangoActivo ? new Date(fechaFin! + "T23:59:59") : TODAY;

    // Filtra base por filtros generales (proyecto, tipo); luego por
    // fecha según la base contable seleccionada.
    const filtradas = MOCK_MOVIMIENTOS.filter((m) => {
      if (proyecto !== "todos" && m.proyecto !== proyecto) return false;
      if (
        tipoIngreso !== "todos" &&
        m.tipo_movimiento === "ingreso" &&
        m.tipo_ingreso !== tipoIngreso
      ) {
        return false;
      }
      const fecha = aplicaFechaSegunBase(m, base);
      if (!fecha) return false;
      const d = new Date(fecha + "T00:00:00");
      return d >= desde && d <= hasta;
    });

    // KPIs.
    let ingresosSubtotal = 0;
    let ingresosIva = 0;
    let egresosExternosSubtotal = 0;
    let egresosInternosSubtotal = 0;
    let exposicionSubtotal = 0;
    let exposicionCount = 0;
    for (const m of filtradas) {
      if (m.tipo_movimiento === "ingreso") {
        ingresosSubtotal += m.subtotal;
        ingresosIva += m.iva;
      } else {
        if (m.origen_egreso === "externo") egresosExternosSubtotal += m.subtotal;
        else egresosInternosSubtotal += m.subtotal;
        if (m.cobro_previo === false) {
          exposicionSubtotal += m.subtotal;
          exposicionCount += 1;
        }
      }
    }
    const egresosTotalSubtotal = egresosExternosSubtotal + egresosInternosSubtotal;
    const resultadoNeto = ingresosSubtotal - egresosTotalSubtotal;
    const margenPct = ingresosSubtotal > 0 ? (resultadoNeto / ingresosSubtotal) * 100 : 0;

    const resumen: ResumenFinanciero = {
      base,
      ingresos_subtotal: +ingresosSubtotal.toFixed(2),
      ingresos_iva: +ingresosIva.toFixed(2),
      ingresos_total_con_iva: +(ingresosSubtotal + ingresosIva).toFixed(2),
      egresos_externos_subtotal: +egresosExternosSubtotal.toFixed(2),
      egresos_internos_subtotal: +egresosInternosSubtotal.toFixed(2),
      egresos_total_subtotal: +egresosTotalSubtotal.toFixed(2),
      resultado_neto: +resultadoNeto.toFixed(2),
      margen_pct: +margenPct.toFixed(2),
      exposicion_subtotal: +exposicionSubtotal.toFixed(2),
      exposicion_count: exposicionCount,
    };

    // Composición de ingresos por tipo.
    const tiposMap = new Map<TipoIngresoSozu, { monto: number; count: number }>();
    for (const m of filtradas) {
      if (m.tipo_movimiento !== "ingreso") continue;
      const key = (m.tipo_ingreso ?? "Propiedad") as TipoIngresoSozu;
      const prev = tiposMap.get(key) ?? { monto: 0, count: 0 };
      tiposMap.set(key, { monto: prev.monto + m.subtotal, count: prev.count + 1 });
    }
    const composicionIngresos = Array.from(tiposMap.entries()).map(([key, v]) => ({
      key,
      label: key,
      monto: +v.monto.toFixed(2),
      count: v.count,
      pct: ingresosSubtotal > 0 ? +((v.monto / ingresosSubtotal) * 100).toFixed(1) : 0,
    }));

    // Composición de egresos.
    const topExternos = new Map<string, number>();
    const porRolInterno = new Map<string, number>();
    for (const m of filtradas) {
      if (m.tipo_movimiento !== "egreso") continue;
      if (m.origen_egreso === "externo") {
        const prev = topExternos.get(m.contraparte) ?? 0;
        topExternos.set(m.contraparte, prev + m.subtotal);
      } else {
        const rol = m.rol ?? "Otro";
        const prev = porRolInterno.get(rol) ?? 0;
        porRolInterno.set(rol, prev + m.subtotal);
      }
    }
    const composicionEgresos = {
      externos: {
        total: +egresosExternosSubtotal.toFixed(2),
        pct: egresosTotalSubtotal > 0
          ? +((egresosExternosSubtotal / egresosTotalSubtotal) * 100).toFixed(1)
          : 0,
        top: Array.from(topExternos.entries())
          .map(([nombre, monto]) => ({ nombre, monto: +monto.toFixed(2) }))
          .sort((a, b) => b.monto - a.monto)
          .slice(0, 5),
      },
      internos: {
        total: +egresosInternosSubtotal.toFixed(2),
        pct: egresosTotalSubtotal > 0
          ? +((egresosInternosSubtotal / egresosTotalSubtotal) * 100).toFixed(1)
          : 0,
        porRol: Array.from(porRolInterno.entries())
          .map(([rol, monto]) => ({ rol, monto: +monto.toFixed(2) }))
          .sort((a, b) => b.monto - a.monto),
      },
    };

    // Evolución mensual filtrada al período.
    const evolucionFull = base === "devengado" ? MOCK_EVOLUCION_DEVENGADO : MOCK_EVOLUCION_CAJA;
    const evolucion = evolucionFull.filter((p) => {
      const d = new Date(p.mes + "T00:00:00");
      return d >= desde && d <= hasta;
    });

    // Exposición.
    const exposicion = MOCK_EXPOSICION.filter((e) => {
      if (proyecto !== "todos" && e.proyecto !== proyecto) return false;
      return true;
    });

    return {
      resumen,
      movimientos: filtradas,
      evolucion,
      exposicion,
      composicionIngresos,
      composicionEgresos,
    };
  }, [filtros]);
}
