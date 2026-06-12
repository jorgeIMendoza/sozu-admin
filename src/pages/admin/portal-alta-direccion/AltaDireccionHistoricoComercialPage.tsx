import { useMemo, useState } from "react";
import {
  TrendingDown,
  Home,
  Building2,
  CheckCircle2,
  Package,
  RefreshCw,
  X,
  CalendarIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader, Kpi, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { Badge } from "@/components/ui/badge";
import { RefreshButton } from "@/components/admin/portal-alta-direccion/RefreshButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import {
  useHistoricoComercial,
  type PeriodoHistorico,
  type TipoCuenta,
} from "@/hooks/usePortalAltaDireccion/useHistoricoComercial";
import {
  useHistoricoComercialDetalle,
  type CategoriaHistorico,
  type HistoricoComercialDetalleRow,
} from "@/hooks/usePortalAltaDireccion/useHistoricoComercialDetalle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Eye, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMetricasConversionComercial } from "@/hooks/usePortalAltaDireccion/useMetricasConversionComercial";
import { usePropiedadesEstatusKpis } from "@/hooks/usePortalAltaDireccion/usePropiedadesEstatusKpis";
import { useProyectosFiltro } from "@/hooks/usePortalAltaDireccion/useProyectosFiltro";
import { cn } from "@/lib/utils";

type ChartMode = "unidades" | "monto";
type SortKey =
  | "mes"
  | "ventas_count"
  | "ventas_monto"
  | "apartados_count"
  | "apartados_monto"
  | "conversion";

const CANALES = [
  { value: "todos", label: "Todos los canales" },
  { value: "Inmobiliaria", label: "Inmobiliaria" },
  { value: "Broker", label: "Broker" },
  { value: "Aliado", label: "Aliado" },
  { value: "Agente Externo", label: "Agente Externo" },
  { value: "Canal Interno", label: "Canal Interno" },
];

const fmtMes = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" }).replace(".", "");
};

export default function AltaDireccionHistoricoComercialPage() {
  const [periodo, setPeriodo] = useState<PeriodoHistorico>(12);
  const [idProyecto, setIdProyecto] = useState<number | null>(null);
  const [canal, setCanal] = useState<string>("todos");
  const [tipo, setTipo] = useState<TipoCuenta>("todos");
  const [chartMode, setChartMode] = useState<ChartMode>("unidades");
  const [sortKey, setSortKey] = useState<SortKey>("mes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Rango personalizado: cuando ambas fechas están set, anula `periodo`.
  const [rango, setRango] = useState<DateRange | undefined>(undefined);
  const [rangoOpen, setRangoOpen] = useState(false);

  const fechaInicio = rango?.from ? toIsoDate(rango.from) : null;
  const fechaFin = rango?.to ? toIsoDate(rango.to) : null;
  const hayRango = !!(fechaInicio && fechaFin);

  const proyectosQuery = useProyectosFiltro();

  const historicoParams = {
    mesesAtras: periodo,
    idProyecto,
    canal: canal === "todos" ? null : canal,
    tipo,
    fechaInicio,
    fechaFin,
  };
  const historico = useHistoricoComercial(historicoParams);
  const historicoDetalle = useHistoricoComercialDetalle(historicoParams);

  const conversion = useMetricasConversionComercial(idProyecto, tipo);
  const estatusKpis = usePropiedadesEstatusKpis(idProyecto);

  // Drill-down: cuando el usuario hace click en una barra de la
  // gráfica "Evolución mensual", abrimos un drawer con las cuentas que
  // forman ese indicador (mes + categoría).
  const navigate = useNavigate();
  const [drillDown, setDrillDown] = useState<{
    mes: string;
    categoria: CategoriaHistorico;
  } | null>(null);

  const drillDownRows = useMemo<HistoricoComercialDetalleRow[]>(() => {
    if (!drillDown) return [];
    return historicoDetalle.data.filter((r) => {
      if (r.categoria !== drillDown.categoria) return false;
      const mes = r.categoria === "ventas" ? r.mes_venta : r.mes_apartado;
      return mes === drillDown.mes;
    });
  }, [historicoDetalle.data, drillDown]);

  // Series para chart (siempre cronológico ascendente).
  const seriesChart = useMemo(() => {
    return [...historico.data]
      .sort((a, b) => (a.mes > b.mes ? 1 : -1))
      .map((row) => ({
        ...row,
        mesLabel: fmtMes(row.mes),
      }));
  }, [historico.data]);

  // Conversión apartado→venta por mes (count vendidas / count apartados).
  const tableRows = useMemo(() => {
    const rows = historico.data.map((r) => ({
      ...r,
      conversion:
        r.apartados_count > 0
          ? Math.min(100, (r.ventas_count / r.apartados_count) * 100)
          : 0,
    }));
    return rows.sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "mes":
          return a.mes > b.mes ? factor : -factor;
        case "ventas_count":
          return (a.ventas_count - b.ventas_count) * factor;
        case "ventas_monto":
          return (a.ventas_monto - b.ventas_monto) * factor;
        case "apartados_count":
          return (a.apartados_count - b.apartados_count) * factor;
        case "apartados_monto":
          return (a.apartados_monto - b.apartados_monto) * factor;
        case "conversion":
          return (a.conversion - b.conversion) * factor;
        default:
          return 0;
      }
    });
  }, [historico.data, sortKey, sortDir]);

  // KPIs derivados.
  const kpis = useMemo(() => {
    const sortedDesc = [...historico.data].sort((a, b) => (a.mes > b.mes ? -1 : 1));
    const cur = sortedDesc[0];
    const prev = sortedDesc[1];
    return {
      ventas: cur ?? null,
      prevVentas: prev ?? null,
      apartados: cur ?? null,
      prevApartados: prev ?? null,
    };
  }, [historico.data]);

  const totales = useMemo(() => {
    return historico.data.reduce(
      (acc, r) => ({
        ventas_count: acc.ventas_count + r.ventas_count,
        ventas_monto: acc.ventas_monto + Number(r.ventas_monto),
        apartados_count: acc.apartados_count + r.apartados_count,
        apartados_monto: acc.apartados_monto + Number(r.apartados_monto),
      }),
      { ventas_count: 0, ventas_monto: 0, apartados_count: 0, apartados_monto: 0 },
    );
  }, [historico.data]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const hasFilters =
    idProyecto !== null ||
    canal !== "todos" ||
    tipo !== "todos" ||
    periodo !== 12 ||
    hayRango;
  const clearFilters = () => {
    setIdProyecto(null);
    setCanal("todos");
    setTipo("todos");
    setPeriodo(12);
    setRango(undefined);
  };

  return (
    <div>
      <PageHeader
        title="Histórico Comercial"
        description="Evolución de ventas y apartados por mes"
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
            >
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Datos en vivo
            </Badge>
            <RefreshButton keyPrefixes={["historico-comercial", "historico-comercial-detalle", "metricas-conversion-comercial", "propiedades-estatus-kpis"]} />
          </div>
        }
      />

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3 justify-end">
        <Select
          value={String(periodo)}
          onValueChange={(v) => {
            setPeriodo(Number(v) as PeriodoHistorico);
            // Si el usuario elige un preset, el rango personalizado se descarta.
            if (hayRango) setRango(undefined);
          }}
          disabled={hayRango}
        >
          <SelectTrigger className="w-[200px] h-9 text-[13px]">
            <SelectValue placeholder={hayRango ? "Rango personalizado" : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
            <SelectItem value="24">Últimos 24 meses</SelectItem>
            <SelectItem value="0">Todo el histórico</SelectItem>
          </SelectContent>
        </Select>

        <Popover open={rangoOpen} onOpenChange={setRangoOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hayRango ? "default" : "outline"}
              size="sm"
              className="h-9 gap-2 text-[13px] font-normal"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {hayRango
                ? `${fmtFecha(rango!.from!)} – ${fmtFecha(rango!.to!)}`
                : "Rango personalizado"}
              {hayRango && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Limpiar rango"
                  className="ml-1 -mr-1 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary-foreground/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRango(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setRango(undefined);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={rango?.from ?? new Date()}
              selected={rango}
              onSelect={(r) => {
                setRango(r);
                if (r?.from && r?.to) setRangoOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        <Select
          value={idProyecto === null ? "todos" : String(idProyecto)}
          onValueChange={(v) => setIdProyecto(v === "todos" ? null : Number(v))}
        >
          <SelectTrigger className="w-[220px] h-9 text-[13px]">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {(proyectosQuery.data ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="w-[200px] h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANALES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCuenta)}>
          <SelectTrigger className="w-[170px] h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="Propiedad">Propiedad</SelectItem>
            <SelectItem value="Producto">Producto</SelectItem>
            <SelectItem value="Servicio">Servicio</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1 text-[12px]"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {historico.isLoading ? (
          <>
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
          </>
        ) : (
          <>
            <Kpi
              label="Ventas este mes"
              value={kpis.ventas?.ventas_count ?? 0}
              hint={fmtMxn(kpis.ventas?.ventas_monto ?? 0)}
              icon={Home}
              tone="success"
              trend={
                kpis.prevVentas
                  ? deltaTrend(
                      kpis.ventas?.ventas_count ?? 0,
                      kpis.prevVentas.ventas_count,
                    )
                  : undefined
              }
            />
            <Kpi
              label="Apartados al momento"
              value={estatusKpis.data?.apartados ?? 0}
              hint="Estatus Apartado"
              icon={Building2}
              tone="info"
            />
            <Kpi
              label="Ventas totales"
              value={estatusKpis.data?.ventas_totales ?? 0}
              hint="Vendido + Pagada completamente"
              icon={CheckCircle2}
              tone="primary"
            />
            <Kpi
              label="Disponibles"
              value={estatusKpis.data?.disponibles ?? 0}
              hint="Estatus Disponible"
              icon={Package}
              tone="default"
            />
          </>
        )}
      </div>

      {/* Chart */}
      <Panel
        title="Evolución mensual"
        description="Comparativo de ventas vs apartados a lo largo del tiempo"
        action={
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {(["unidades", "monto"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cn(
                  "px-3 py-1 text-[12px] font-medium rounded-md transition-all",
                  chartMode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "unidades" ? "Por unidades" : "Por monto"}
              </button>
            ))}
          </div>
        }
      >
        {historico.isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : historico.data.length === 0 ? (
          <EmptyChartState onClear={hasFilters ? clearFilters : undefined} />
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seriesChart} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="mesLabel"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    chartMode === "monto" ? abbrevMxn(Number(v)) : String(v)
                  }
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => {
                    const isMonto =
                      name === "Ventas (monto)" || name === "Apartados (monto)";
                    return [isMonto ? fmtMxn(Number(value)) : String(value), name];
                  }}
                  labelClassName="text-foreground"
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey={chartMode === "monto" ? "ventas_monto" : "ventas_count"}
                  name={chartMode === "monto" ? "Ventas (monto)" : "Ventas (unidades)"}
                  fill="hsl(142, 71%, 45%)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(p: any) => {
                    if (p?.payload?.mes) {
                      setDrillDown({ mes: p.payload.mes, categoria: "ventas" });
                    }
                  }}
                />
                <Bar
                  dataKey={chartMode === "monto" ? "apartados_monto" : "apartados_count"}
                  name={chartMode === "monto" ? "Apartados (monto)" : "Apartados (unidades)"}
                  fill="hsl(217, 91%, 60%)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(p: any) => {
                    if (p?.payload?.mes) {
                      setDrillDown({ mes: p.payload.mes, categoria: "apartados" });
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Tabla detalle */}
      <Panel title="Detalle por mes" className="mt-6">
        {historico.isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : historico.data.length === 0 ? (
          <EmptyChartState onClear={hasFilters ? clearFilters : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTh label="Mes"        active={sortKey === "mes"}             dir={sortDir} onClick={() => toggleSort("mes")} />
                  <SortableTh label="Ventas"     active={sortKey === "ventas_count"}    dir={sortDir} onClick={() => toggleSort("ventas_count")}    align="right" />
                  <SortableTh label="Ventas $"   active={sortKey === "ventas_monto"}    dir={sortDir} onClick={() => toggleSort("ventas_monto")}    align="right" />
                  <SortableTh label="Apartados"  active={sortKey === "apartados_count"} dir={sortDir} onClick={() => toggleSort("apartados_count")} align="right" />
                  <SortableTh label="Apartados $" active={sortKey === "apartados_monto"} dir={sortDir} onClick={() => toggleSort("apartados_monto")} align="right" />
                  <SortableTh label="Conv. (%)" active={sortKey === "conversion"}      dir={sortDir} onClick={() => toggleSort("conversion")}      align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.mes}>
                    <TableCell className="font-medium">{fmtMes(row.mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.ventas_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMxn(row.ventas_monto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.apartados_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMxn(row.apartados_monto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conversion.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {/* Totales */}
                <TableRow className="bg-muted/40 font-semibold border-t-2">
                  <TableCell>Totales</TableCell>
                  <TableCell className="text-right tabular-nums">{totales.ventas_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMxn(totales.ventas_monto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{totales.apartados_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMxn(totales.apartados_monto)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Drill-down drawer: cuentas que forman un mes/categoría */}
      <Sheet
        open={!!drillDown}
        onOpenChange={(open) => {
          if (!open) setDrillDown(null);
        }}
      >
        <SheetContent className="sm:max-w-[1100px] p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-[16px]">
              {drillDown
                ? `${drillDown.categoria === "ventas" ? "Ventas" : "Apartados"} · ${fmtMesLargo(drillDown.mes)}`
                : ""}
            </SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              {drillDownRows.length === 0
                ? "Sin cuentas en este período."
                : `${drillDownRows.length} ${drillDownRows.length === 1 ? "cuenta" : "cuentas"} · ${fmtMxn(drillDownRows.reduce((s, r) => s + r.precio_final, 0))} total`}
            </p>
          </SheetHeader>
          <div className="px-6 py-5">
            {historicoDetalle.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas…
              </div>
            ) : drillDownRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-12">
                No hay cuentas que coincidan con los filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Compradores</TableHead>
                      <TableHead className="text-xs">Propietario</TableHead>
                      <TableHead className="text-xs">Proyecto</TableHead>
                      <TableHead className="text-xs">No. Prop.</TableHead>
                      <TableHead className="text-xs">Modelo</TableHead>
                      <TableHead className="text-xs text-right">Metraje</TableHead>
                      <TableHead className="text-xs text-right">Precio/m²</TableHead>
                      <TableHead className="text-xs text-right">Precio Final</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownRows.map((r) => (
                      <TableRow key={r.id_cuenta_cobranza}>
                        <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                          {r.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {r.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.compradores.length === 0
                            ? "—"
                            : r.compradores.length === 1
                              ? r.compradores[0]
                              : (
                                <>
                                  <p className="truncate max-w-[180px]">{r.compradores[0]}</p>
                                  <p className="text-[11px] text-muted-foreground/70">+{r.compradores.length - 1} más</p>
                                </>
                              )}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[180px]">{r.propietario}</TableCell>
                        <TableCell className="text-sm">{r.proyecto_nombre}</TableCell>
                        <TableCell className="text-sm">{r.numero_propiedad}</TableCell>
                        <TableCell className="text-sm">{r.modelo_nombre}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {r.metraje > 0 ? `${r.metraje.toFixed(2)} m²` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {r.precio_m2 > 0 ? fmtMxn(r.precio_m2) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold tabular-nums">
                          {fmtMxn(r.precio_final)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-[11px]"
                            onClick={() => {
                              setDrillDown(null);
                              navigate(
                                `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(r.folio_cuenta)}`,
                              );
                            }}
                            aria-label={`Ver Ciclo de Venta de ${r.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───────────── Helpers internos ───────────── */

function fmtMesLargo(mesIso: string): string {
  // mesIso es 'YYYY-MM-01'.
  const d = new Date(mesIso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD en zona local — evitamos toISOString() porque convierte a UTC.
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" });
}

function deltaTrend(curr: number, prev: number): { value: string; direction: "up" | "down" } {
  if (prev === 0 && curr === 0) return { value: "0%", direction: "up" };
  if (prev === 0) return { value: "+100%", direction: "up" };
  const pct = ((curr - prev) / prev) * 100;
  return {
    value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    direction: pct >= 0 ? "up" : "down",
  };
}

function abbrevMxn(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "right";
}) {
  return (
    <TableHead className={cn(align === "right" && "text-right")}>
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground font-semibold",
        )}
      >
        {label}
        {active && (
          <span className="text-[10px]">
            {dir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </TableHead>
  );
}

function EmptyChartState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <TrendingDown className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-foreground">Sin datos para mostrar</p>
      <p className="text-[12px] text-muted-foreground mt-1 max-w-xs">
        No se encontraron ventas ni apartados para los filtros seleccionados.
      </p>
      {onClear && (
        <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onClear}>
          <RefreshCw className="h-3.5 w-3.5" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
