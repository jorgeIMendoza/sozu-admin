import { useMemo, useState } from "react";
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  Layers3,
  Wallet,
  TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PageHeader, Kpi, Panel } from "@/components/admin/portal-socio-bancario/ui";
import { DesarrolloNoAsignado } from "@/components/admin/portal-socio-bancario/EmptyStates";
import { useSocioProyecto } from "@/hooks/usePortalSocioBancario/useSocioProyecto";
import { usePropiedadesEstatusKpis } from "@/hooks/usePortalSocioBancario/usePropiedadesEstatusKpis";
import { useHistoricoComercial } from "@/hooks/usePortalSocioBancario/useHistoricoComercial";
import { useForecastIngresos } from "@/hooks/usePortalSocioBancario/useForecastIngresos";

function fmtMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
function fmtMxnCompact(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
function fmtPct(n: number, dec = 0): string {
  return `${n.toFixed(dec)}%`;
}
function labelMes(iso: string): string {
  // iso = YYYY-MM-01
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

type Modo = "unidades" | "monto";

export default function SocioBancarioVentasInventarioPage() {
  const { idProyecto, nombre, noAsignado, isLoading: loadingProyecto } = useSocioProyecto();
  const [modo, setModo] = useState<Modo>("unidades");

  const kpis = usePropiedadesEstatusKpis(idProyecto);
  const historico = useHistoricoComercial({
    mesesAtras: 0,
    idProyecto,
    canal: null,
    tipo: "todos",
  });
  const forecast = useForecastIngresos();

  // Inventario disponible a precio de lista (Σ precio_lista de Disponibles del
  // desarrollo). Reusa la rama fuente:"inventario" del forecast, SIN comisión.
  const inventarioPrecioLista = useMemo(() => {
    const rows = forecast.data ?? [];
    return rows
      .filter((r) => r.fuente === "inventario" && r.proyecto_id === idProyecto)
      .reduce((s, r) => s + r.monto, 0);
  }, [forecast.data, idProyecto]);

  const valorComercializado = useMemo(
    () => (historico.data ?? []).reduce((s, r) => s + r.ventas_monto, 0),
    [historico.data],
  );

  // Serie para la gráfica: últimos 12 meses con actividad (orden ascendente).
  const serie = useMemo(() => {
    const rows = (historico.data ?? []).slice(0, 12).slice().reverse();
    return rows.map((r) => ({
      mes: labelMes(r.mes),
      Ventas: modo === "unidades" ? r.ventas_count : r.ventas_monto,
      Apartados: modo === "unidades" ? r.apartados_count : r.apartados_monto,
    }));
  }, [historico.data, modo]);

  if (noAsignado) {
    return (
      <>
        <PageHeader title="Ventas e Inventario" description="Portal Socio Bancario" />
        <DesarrolloNoAsignado />
      </>
    );
  }

  const cargando = loadingProyecto || kpis.isLoading || historico.isLoading;

  const k = kpis.data;
  const vendidas = k?.ventas_totales ?? 0;
  const apartadas = k?.apartados ?? 0;
  const disponibles = k?.disponibles ?? 0;
  const total = vendidas + apartadas + disponibles;
  const pctColocado = total > 0 ? (vendidas / total) * 100 : 0;

  const detalle = (historico.data ?? []).filter(
    (r) => r.ventas_count > 0 || r.apartados_count > 0,
  );

  return (
    <>
      <PageHeader
        title="Ventas e Inventario"
        description={nombre ? `Comercialización · ${nombre}` : "Comercialización del desarrollo"}
      />

      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Kpi icon={PackageCheck} tone="success" label="Vendidas" value={vendidas} hint={`${fmtPct(pctColocado)} colocado`} />
            <Kpi icon={Clock} tone="warning" label="Apartadas" value={apartadas} hint="Estatus Apartada" />
            <Kpi icon={ShoppingBag} tone="info" label="Disponibles" value={disponibles} hint="Inventario en venta" />
            <Kpi icon={TrendingUp} tone="primary" label="% colocado" value={fmtPct(pctColocado)} hint={`${vendidas} de ${total} unidades`} />
            <Kpi icon={Wallet} tone="default" label="Valor comercializado" value={fmtMxn(valorComercializado)} hint="Ventas reconocidas (sin comisión)" />
            <Kpi icon={Layers3} tone="warning" label="Inventario disponible" value={fmtMxn(inventarioPrecioLista)} hint={`${disponibles} unidades · precio de lista`} />
          </div>

          {/* Meta de colocación: oculta — no existe meta en la base. No se inventa.
              // SWAP POINT: meta de colocación → mostrar real vs meta con semáforo. */}

          <div className="mt-4">
            <Panel
              title="Evolución mensual"
              description="Ventas vs. apartados del desarrollo"
              action={
                <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                  {(["unidades", "monto"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setModo(m)}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-medium transition-colors capitalize",
                        modo === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Por {m}
                    </button>
                  ))}
                </div>
              }
            >
              {serie.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Sin ventas ni apartados registrados en el periodo.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={modo === "monto" ? 64 : 32}
                        tickFormatter={(v) => (modo === "monto" ? fmtMxnCompact(Number(v)) : String(v))}
                      />
                      <Tooltip
                        formatter={(v: number) => (modo === "monto" ? fmtMxn(v) : v)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Ventas" fill="#57ae75" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Apartados" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title="Detalle por mes" description="Ventas y apartados reconocidos">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left">Mes</th>
                      <th className="px-3 py-2 text-right">Ventas</th>
                      <th className="px-3 py-2 text-right">Ventas $</th>
                      <th className="px-3 py-2 text-right">Apartados</th>
                      <th className="px-3 py-2 text-right">Apartados $</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detalle.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Sin actividad comercial registrada.</td></tr>
                    ) : (
                      detalle.map((r) => (
                        <tr key={r.mes} className="hover:bg-muted/30">
                          <td className="px-3 py-2 capitalize">{labelMes(r.mes)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.ventas_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMxn(r.ventas_monto)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.apartados_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMxn(r.apartados_monto)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
