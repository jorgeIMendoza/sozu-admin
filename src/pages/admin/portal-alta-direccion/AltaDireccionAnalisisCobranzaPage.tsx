import { useMemo, useState } from "react";
import {
  Wallet,
  Hourglass,
  AlertTriangle,
  Activity,
  X,
  RefreshCw,
  Inbox,
  CalendarIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Line,
  Cell,
} from "recharts";
import { PageHeader, Kpi, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { Badge } from "@/components/ui/badge";
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
  useAnalisisCobranzaKpis,
  type PeriodoCobranza,
} from "@/hooks/usePortalAltaDireccion/useAnalisisCobranzaKpis";
import { useAgingCobranza, type AgingRow } from "@/hooks/usePortalAltaDireccion/useAgingCobranza";
import { useEvolucionEmisionCobranza } from "@/hooks/usePortalAltaDireccion/useEvolucionEmisionCobranza";
import {
  useCobranzaPorDesarrollador,
  type CobranzaPorDesarrolladorRow,
} from "@/hooks/usePortalAltaDireccion/useCobranzaPorDesarrollador";
import { useProyectosFiltro } from "@/hooks/usePortalAltaDireccion/useProyectosFiltro";
import { useDesarrolladoresFiltro } from "@/hooks/usePortalAltaDireccion/useDesarrolladoresFiltro";
import type { CobranzaFiltros, TipoCobranza } from "@/hooks/usePortalAltaDireccion/_cobranzaBase";
import { cn } from "@/lib/utils";

type SortKey =
  | "razon_social"
  | "facturas_count"
  | "monto_emitido"
  | "monto_cobrado"
  | "monto_por_cobrar"
  | "monto_vencido_30d"
  | "antiguedad_promedio_dias";

const fmtMes = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" }).replace(".", "");
};

const BUCKET_COLORS: Record<string, string> = {
  "0-30": "hsl(142, 71%, 45%)", // verde
  "31-60": "hsl(48, 96%, 53%)", // amarillo
  "61-90": "hsl(25, 95%, 53%)", // naranja
  "+90": "hsl(0, 84%, 60%)",     // rojo
};

export default function AltaDireccionAnalisisCobranzaPage() {
  const [periodo, setPeriodo] = useState<PeriodoCobranza>("ultimos_3_meses");
  const [idProyecto, setIdProyecto] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoCobranza | "todos">("todos");
  const [idDesarrollador, setIdDesarrollador] = useState<number | null>(null);
  const [rango, setRango] = useState<DateRange | undefined>(undefined);
  const [rangoOpen, setRangoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("monto_por_cobrar");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fechaInicio = rango?.from ? toIsoDate(rango.from) : null;
  const fechaFin = rango?.to ? toIsoDate(rango.to) : null;
  const hayRango = !!(fechaInicio && fechaFin);

  const filtros: CobranzaFiltros = {
    idProyecto,
    tipo,
    idDesarrollador,
    fechaInicio,
    fechaFin,
  };

  const proyectos = useProyectosFiltro();
  const desarrolladoresLista = useDesarrolladoresFiltro();
  const kpis = useAnalisisCobranzaKpis(periodo, filtros);
  const aging = useAgingCobranza(filtros);
  const mesesEvolucion = 12;
  const evolucion = useEvolucionEmisionCobranza(mesesEvolucion, filtros);
  const desarrolladores = useCobranzaPorDesarrollador(periodo, filtros);

  const hasFilters =
    idProyecto !== null ||
    periodo !== "ultimos_3_meses" ||
    tipo !== "todos" ||
    idDesarrollador !== null ||
    hayRango;
  const clearFilters = () => {
    setIdProyecto(null);
    setPeriodo("ultimos_3_meses");
    setTipo("todos");
    setIdDesarrollador(null);
    setRango(undefined);
  };

  const agingTotales = useMemo(() => {
    const total = aging.data.reduce((s, b) => s + Number(b.monto), 0);
    const vencido = aging.data
      .filter((b) => b.bucket !== "0-30")
      .reduce((s, b) => s + Number(b.monto), 0);
    return {
      total,
      vencido,
      pctVencido: total > 0 ? (vencido / total) * 100 : 0,
    };
  }, [aging.data]);

  const evolucionChartData = useMemo(() => {
    return evolucion.data.map((r) => ({ ...r, mesLabel: fmtMes(r.mes) }));
  }, [evolucion.data]);

  const tablaOrdenada = useMemo(() => {
    const rows = [...desarrolladores.data];
    rows.sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "razon_social":
          return a.razon_social.localeCompare(b.razon_social) * factor;
        case "facturas_count":
          return (a.facturas_count - b.facturas_count) * factor;
        case "monto_emitido":
          return (a.monto_emitido - b.monto_emitido) * factor;
        case "monto_cobrado":
          return (a.monto_cobrado - b.monto_cobrado) * factor;
        case "monto_por_cobrar":
          return (a.monto_por_cobrar - b.monto_por_cobrar) * factor;
        case "monto_vencido_30d":
          return (a.monto_vencido_30d - b.monto_vencido_30d) * factor;
        case "antiguedad_promedio_dias":
          return (a.antiguedad_promedio_dias - b.antiguedad_promedio_dias) * factor;
        default:
          return 0;
      }
    });
    return rows;
  }, [desarrolladores.data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div>
      <PageHeader
        title="Análisis de Cobranza"
        description="Salud financiera del flujo entrante"
        action={
          <Badge
            variant="outline"
            className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
          >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Datos en vivo
          </Badge>
        }
      />

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3 justify-end">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoCobranza)}>
          <SelectTrigger className="w-[200px] h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="este_mes">Este mes</SelectItem>
            <SelectItem value="ultimos_3_meses">Últimos 3 meses</SelectItem>
            <SelectItem value="ultimos_12_meses">Últimos 12 meses</SelectItem>
            <SelectItem value="todo">Todo el histórico</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={idProyecto === null ? "todos" : String(idProyecto)}
          onValueChange={(v) => setIdProyecto(v === "todos" ? null : Number(v))}
        >
          <SelectTrigger className="w-[220px] h-9 text-[13px]">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {(proyectos.data ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCobranza | "todos")}>
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

        <Select
          value={idDesarrollador === null ? "todos" : String(idDesarrollador)}
          onValueChange={(v) => setIdDesarrollador(v === "todos" ? null : Number(v))}
        >
          <SelectTrigger className="w-[220px] h-9 text-[13px]">
            <SelectValue placeholder="Todos los desarrolladores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los desarrolladores</SelectItem>
            {(desarrolladoresLista.data ?? []).map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.nombre}
              </SelectItem>
            ))}
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
        {kpis.isLoading ? (
          <>
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
            <Skeleton className="h-[112px] rounded-xl" />
          </>
        ) : (
          <>
            <Kpi
              label="Cobrado en período"
              value={fmtMxn(kpis.data?.cobrado_periodo ?? 0)}
              hint={periodoLabel(periodo)}
              icon={Wallet}
              tone="success"
            />
            <Kpi
              label="Por cobrar"
              value={fmtMxn(kpis.data?.por_cobrar_total ?? 0)}
              hint="Facturas emitidas no cobradas"
              icon={Hourglass}
              tone="warning"
            />
            <Kpi
              label="Vencido > 30 días"
              value={fmtMxn(kpis.data?.vencido_30d ?? 0)}
              hint={
                kpis.data && kpis.data.vencido_30d > 0
                  ? "Requiere atención"
                  : "Sin vencimientos"
              }
              icon={AlertTriangle}
              tone={kpis.data && kpis.data.vencido_30d > 0 ? "destructive" : "default"}
            />
            <Kpi
              label="DSO (días)"
              value={(kpis.data?.dso_dias ?? 0).toFixed(1)}
              hint="Days Sales Outstanding"
              icon={Activity}
              tone="primary"
            />
          </>
        )}
      </div>

      {/* Aging buckets */}
      <Panel
        title="Antigüedad de cartera"
        description={
          aging.data.length > 0
            ? `Total por cobrar: ${fmtMxn(agingTotales.total)} · ${agingTotales.pctVencido.toFixed(1)}% vencido`
            : undefined
        }
      >
        {aging.isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : aging.data.length === 0 || aging.data.every((b) => b.cuenta === 0) ? (
          <EmptyState
            icon={Inbox}
            title="Sin cartera pendiente"
            description="No hay facturas emitidas sin cobrar para los filtros seleccionados."
            onClear={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging.data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="bucket"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => abbrevMxn(Number(v))}
                />
                <Tooltip
                  formatter={(value: number, name: string, props: { payload?: AgingRow }) => {
                    if (name === "monto") {
                      const c = props.payload?.cuenta ?? 0;
                      return [
                        `${fmtMxn(Number(value))} (${c} ${c === 1 ? "factura" : "facturas"})`,
                        "Monto",
                      ];
                    }
                    return [String(value), name];
                  }}
                  labelFormatter={(label) => `Bucket: ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="monto" name="monto" radius={[4, 4, 0, 0]}>
                  {aging.data.map((entry) => (
                    <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? "hsl(220, 9%, 60%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Evolución mensual */}
      <Panel
        title="Evolución mensual de emisión vs cobranza"
        description="Últimos 12 meses · gap visual = rezago entre emisión y cobro"
        className="mt-6"
      >
        {evolucion.isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : evolucionChartData.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sin movimientos"
            description="No hay emisión ni cobranza registrada en el período."
            onClear={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={evolucionChartData}
                margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="mesLabel"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => abbrevMxn(Number(v))}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmtMxn(Number(value)), name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="monto_emitido"
                  name="Emitido"
                  fill="hsl(217, 91%, 60%)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="monto_cobrado"
                  name="Cobrado"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Tabla por desarrollador */}
      <Panel title="Cobranza por desarrollador" className="mt-6">
        {desarrolladores.isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : tablaOrdenada.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sin desarrolladores con cartera"
            description="No hay facturación por desarrollador para los filtros seleccionados."
            onClear={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTh label="Desarrollador"        active={sortKey === "razon_social"}             dir={sortDir} onClick={() => toggleSort("razon_social")} />
                  <SortableTh label="Facturas"             active={sortKey === "facturas_count"}           dir={sortDir} onClick={() => toggleSort("facturas_count")} align="right" />
                  <SortableTh label="Emitido"              active={sortKey === "monto_emitido"}            dir={sortDir} onClick={() => toggleSort("monto_emitido")} align="right" />
                  <SortableTh label="Cobrado"              active={sortKey === "monto_cobrado"}            dir={sortDir} onClick={() => toggleSort("monto_cobrado")} align="right" />
                  <SortableTh label="Por cobrar"           active={sortKey === "monto_por_cobrar"}         dir={sortDir} onClick={() => toggleSort("monto_por_cobrar")} align="right" />
                  <SortableTh label="Vencido >30d"         active={sortKey === "monto_vencido_30d"}        dir={sortDir} onClick={() => toggleSort("monto_vencido_30d")} align="right" />
                  <SortableTh label="Antig. (días)"        active={sortKey === "antiguedad_promedio_dias"} dir={sortDir} onClick={() => toggleSort("antiguedad_promedio_dias")} align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tablaOrdenada.map((row) => (
                  <DesarrolladorRow key={row.id_persona} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ───────────── Helpers internos ───────────── */

function DesarrolladorRow({ row }: { row: CobranzaPorDesarrolladorRow }) {
  const pct = row.monto_emitido > 0 ? (row.monto_cobrado / row.monto_emitido) * 100 : 0;
  return (
    <TableRow>
      <TableCell className="font-medium">{row.razon_social}</TableCell>
      <TableCell className="text-right tabular-nums">{row.facturas_count}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtMxn(row.monto_emitido)}</TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="flex flex-col items-end">
          <span>{fmtMxn(row.monto_cobrado)}</span>
          <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{fmtMxn(row.monto_por_cobrar)}</TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          row.monto_vencido_30d > 0 && "text-destructive font-medium",
        )}
      >
        {fmtMxn(row.monto_vencido_30d)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {(row.antiguedad_promedio_dias ?? 0).toFixed(0)}
      </TableCell>
    </TableRow>
  );
}

function toIsoDate(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" });
}

function periodoLabel(p: PeriodoCobranza): string {
  switch (p) {
    case "este_mes":
      return "Este mes";
    case "ultimos_3_meses":
      return "Últimos 3 meses";
    case "ultimos_12_meses":
      return "Últimos 12 meses";
    default:
      return "Todo el histórico";
  }
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
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  onClear,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-[12px] text-muted-foreground mt-1 max-w-xs">{description}</p>
      {onClear && (
        <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onClear}>
          <RefreshCw className="h-3.5 w-3.5" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
