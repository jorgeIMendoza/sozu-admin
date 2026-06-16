import { useMemo } from "react";
import { useMovimientosIngresosEgresos } from "./useMovimientosIngresosEgresos";

/**
 * Resumen de Ingresos y Egresos del Dashboard General (Portal Alta Dirección).
 *
 * Reutiliza el ledger real `useMovimientosIngresosEgresos` (base CAJA = flujo
 * de caja, mes en curso, todos los proyectos) y agrega client-side:
 *  - Ingresos: Comisión SOZU cobrada en el mes, por proyecto.
 *  - Egresos Externos: comisiones pagadas a inmobiliarias/agentes externos.
 *  - Egresos Internos: comisiones pagadas al equipo SOZU.
 *
 * Se usa `subtotal` (SIN IVA) para que coincida con el KPI "Ingresos
 * (Comisión SOZU)" de la pantalla Ingresos y Egresos, que reporta sin IVA.
 */

export interface MetricaFinanzas {
  total: number;
  porProyecto: Array<{ proyecto: string; valor: number }>;
}

export interface ResumenFinanzas {
  ingresos: MetricaFinanzas;
  egresosExternos: MetricaFinanzas;
  egresosInternos: MetricaFinanzas;
}

function agrupar(
  movs: Array<{ proyecto: string; total: number }>,
): MetricaFinanzas {
  const map = new Map<string, number>();
  let total = 0;
  for (const m of movs) {
    const proy = m.proyecto || "Sin proyecto";
    map.set(proy, (map.get(proy) ?? 0) + m.total);
    total += m.total;
  }
  return {
    total: +total.toFixed(2),
    porProyecto: Array.from(map.entries())
      .map(([proyecto, valor]) => ({ proyecto, valor: +valor.toFixed(2) }))
      .sort((a, b) => b.valor - a.valor),
  };
}

export function useResumenFinanzas() {
  const query = useMovimientosIngresosEgresos({
    proyecto: "todos",
    base: "caja",
    periodoMeses: "este_mes",
    fechaInicio: null,
    fechaFin: null,
    tipoIngreso: "todos",
  });

  const data = useMemo<ResumenFinanzas>(() => {
    const movs = query.data ?? [];
    const ingresos = movs
      .filter((m) => m.tipo_movimiento === "ingreso")
      .map((m) => ({ proyecto: m.proyecto, total: m.subtotal }));
    const externos = movs
      .filter((m) => m.tipo_movimiento === "egreso" && m.origen_egreso === "externo")
      .map((m) => ({ proyecto: m.proyecto, total: m.subtotal }));
    const internos = movs
      .filter((m) => m.tipo_movimiento === "egreso" && m.origen_egreso === "interno")
      .map((m) => ({ proyecto: m.proyecto, total: m.subtotal }));
    return {
      ingresos: agrupar(ingresos),
      egresosExternos: agrupar(externos),
      egresosInternos: agrupar(internos),
    };
  }, [query.data]);

  return { data, isLoading: query.isLoading, error: query.error as Error | null };
}
