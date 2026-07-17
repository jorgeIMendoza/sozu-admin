/**
 * Forecast de Ingresos — Portal Alta Dirección.
 *
 * Estimación = Σ precio_final de cuentas_cobranza cuya propiedad tenga
 * estatus_disponibilidad ∈ {Apartado(4), En demanda(11), Entregado(8),
 * Escriturado(7), Inventario(1), Pagada completamente(9), Vendido(5)}
 * + Σ precio_lista de propiedades con estatus_disponibilidad = Disponible(2)
 * (estas últimas todavía no tienen cuenta de cobranza).
 *
 * Permite filtrar y desglosar por:
 *   - Proyecto
 *   - Tipo (Propiedad, Producto, Servicio)
 *   - Desarrollador Dueño
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Building2,
  Layers3,
  Briefcase,
  RefreshCw,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/portal-socio-bancario/ui";
import { fmtMxn } from "@/data/socioBancario/mockData";
import { cn } from "@/lib/utils";
import { fetchForecast, type ForecastRow } from "@/hooks/usePortalSocioBancario/useForecastIngresos";

const ALL = "__all__";

export default function SocioBancarioForecastIngresosPage() {
  const [proyectoFilter, setProyectoFilter] = useState<string>(ALL);
  const [tipoFilter, setTipoFilter] = useState<string>(ALL);
  const [desarrolladorFilter, setDesarrolladorFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const q = useQuery<ForecastRow[]>({
    queryKey: ["forecast-ingresos"],
    staleTime: 5 * 60_000,
    queryFn: fetchForecast,
  });

  const rows = q.data ?? [];

  // Opciones para los Selects, derivadas del dataset cargado.
  const proyectoOptions = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => {
      if (r.proyecto_id != null) m.set(r.proyecto_id, r.proyecto_nombre);
    });
    return Array.from(m.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [rows]);

  const desarrolladorOptions = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => {
      if (r.desarrollador_id != null) m.set(r.desarrollador_id, r.desarrollador_nombre);
    });
    return Array.from(m.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [rows]);

  // Filtrado en cliente — el dataset cabe en memoria fácilmente.
  const filtered = useMemo(() => {
    const qq = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (proyectoFilter !== ALL && String(r.proyecto_id ?? "") !== proyectoFilter) return false;
      if (tipoFilter !== ALL && r.tipo !== tipoFilter) return false;
      if (desarrolladorFilter !== ALL && String(r.desarrollador_id ?? "") !== desarrolladorFilter) return false;
      if (!qq) return true;
      return (
        r.folio.toLowerCase().includes(qq) ||
        r.proyecto_nombre.toLowerCase().includes(qq) ||
        r.desarrollador_nombre.toLowerCase().includes(qq) ||
        r.numero_propiedad.toLowerCase().includes(qq) ||
        r.edificio_nombre.toLowerCase().includes(qq)
      );
    });
  }, [rows, proyectoFilter, tipoFilter, desarrolladorFilter, search]);

  const totalForecast = filtered.reduce((s, r) => s + r.monto, 0);
  const filasCuentas = filtered.filter((r) => r.fuente === "cuenta");
  const filasInventario = filtered.filter((r) => r.fuente === "inventario");
  const totalCuentas = filasCuentas.reduce((s, r) => s + r.monto, 0);
  const totalInventario = filasInventario.reduce((s, r) => s + r.monto, 0);

  // Breakdowns
  const porProyecto = useMemo(() => agruparMonto(filtered, (r) => r.proyecto_nombre || "Sin proyecto"), [filtered]);
  const porTipo = useMemo(() => agruparMonto(filtered, (r) => r.tipo), [filtered]);
  const porDesarrollador = useMemo(() => agruparMonto(filtered, (r) => r.desarrollador_nombre || "Sin desarrollador"), [filtered]);

  const hayFiltros = proyectoFilter !== ALL || tipoFilter !== ALL || desarrolladorFilter !== ALL || !!search;
  const limpiarFiltros = () => {
    setProyectoFilter(ALL);
    setTipoFilter(ALL);
    setDesarrolladorFilter(ALL);
    setSearch("");
  };

  return (
    <>
      <PageHeader
        title="Forecast de Ingresos"
        description="Estimación de ingresos = cuentas de cobranza con estatus de flujo + inventario disponible."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="h-9"
            data-cta="alta-direccion.forecast.actualizar"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", q.isFetching && "animate-spin")} />
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiTile
          icon={TrendingUp}
          tone="emerald"
          label="Forecast total"
          value={fmtMxn(totalForecast)}
          sub={`${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`}
        />
        <KpiTile
          icon={Briefcase}
          tone="blue"
          label="Cuentas con flujo"
          value={fmtMxn(totalCuentas)}
          sub={`${filasCuentas.length} cuentas · Apartadas, Vendidas, Pagadas, Entregadas, En demanda, Inventario, Escrituración`}
        />
        <KpiTile
          icon={Layers3}
          tone="amber"
          label="Inventario disponible"
          value={fmtMxn(totalInventario)}
          sub={`${filasInventario.length} ${filasInventario.length === 1 ? "propiedad" : "propiedades"} en venta · precio de lista`}
        />
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SearchableSelect
          value={proyectoFilter}
          onValueChange={setProyectoFilter}
          options={proyectoOptions.map((p) => ({ value: String(p.id), label: p.nombre }))}
          allLabel="Todos los proyectos"
          searchPlaceholder="Buscar proyecto…"
          emptyText="No se encontró el proyecto."
          triggerClassName="w-[220px]"
        />

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            <SelectItem value="Propiedad">Propiedad</SelectItem>
            <SelectItem value="Producto">Producto</SelectItem>
            <SelectItem value="Servicio">Servicio</SelectItem>
          </SelectContent>
        </Select>

        <SearchableSelect
          value={desarrolladorFilter}
          onValueChange={setDesarrolladorFilter}
          options={desarrolladorOptions.map((d) => ({ value: String(d.id), label: d.nombre }))}
          allLabel="Todos los desarrolladores"
          searchPlaceholder="Buscar desarrollador…"
          emptyText="No se encontró el desarrollador."
          triggerClassName="w-[260px]"
        />

        <div className="relative w-full sm:w-[260px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar folio, edificio, depto…"
            className="h-9 text-xs pr-7"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground"
            onClick={limpiarFiltros}
            data-cta="alta-direccion.forecast.limpiar-filtros"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Breakdowns en 3 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <BreakdownCard
          title="Por Proyecto"
          icon={Building2}
          data={porProyecto}
          loading={q.isLoading}
        />
        <BreakdownCard
          title="Por Tipo"
          icon={Layers3}
          data={porTipo}
          loading={q.isLoading}
        />
        <BreakdownCard
          title="Por Desarrollador"
          icon={Briefcase}
          data={porDesarrollador}
          loading={q.isLoading}
        />
      </div>

      {/* Tabla detalle */}
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando forecast…</div>
          ) : q.error ? (
            <div className="py-12 text-center text-sm text-red-600">
              Error: {(q.error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {hayFiltros ? "Sin resultados con esos filtros." : "Sin datos de forecast."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Folio</TableHead>
                    <TableHead className="text-xs">Fuente</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Proyecto</TableHead>
                    <TableHead className="text-xs">Edificio · Depto</TableHead>
                    <TableHead className="text-xs">Desarrollador</TableHead>
                    <TableHead className="text-xs">Estatus</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={`${r.fuente}-${r.id}`}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{r.folio}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            r.fuente === "cuenta"
                              ? "border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300"
                              : "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
                          )}
                        >
                          {r.fuente === "cuenta" ? "Cuenta" : "Inventario"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.tipo}</TableCell>
                      <TableCell className="text-sm">{r.proyecto_nombre || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[r.edificio_nombre, r.numero_propiedad].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.desarrollador_nombre || "—"}</TableCell>
                      <TableCell className="text-xs">{r.estatus_nombre}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">
                        {fmtMxn(r.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                  Mostrando 500 primeros de {filtered.length}. Aplica filtros para acotar.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Helpers visuales
   ────────────────────────────────────────────────────────── */

/**
 * Filtro tipo combobox con búsqueda. Muestra todas las opciones al abrir y
 * permite escribir para acotar la lista (cmdk filtra por el texto visible).
 * El valor sentinela `ALL` representa "Todos…".
 */
function SearchableSelect({
  value,
  onValueChange,
  options,
  allLabel,
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados.",
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = value === ALL ? allLabel : selected?.label ?? allLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 justify-between text-xs font-normal", triggerClassName)}
        >
          <span className="truncate text-left">{display}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="text-xs" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange(ALL);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5", value === ALL ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{allLabel}</span>
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function KpiTile({
  icon: Icon, tone, label, value, sub,
}: {
  icon: typeof TrendingUp;
  tone: "emerald" | "blue" | "amber";
  label: string;
  value: string;
  sub: string;
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 ring-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-900/40 dark:text-emerald-300"
      : tone === "blue"
        ? "bg-blue-50 ring-blue-200 text-blue-700 dark:bg-blue-950/30 dark:ring-blue-900/40 dark:text-blue-300"
        : "bg-amber-50 ring-amber-200 text-amber-700 dark:bg-amber-950/30 dark:ring-amber-900/40 dark:text-amber-300";
  return (
    <div className={cn("rounded-xl ring-1 p-4", cls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/60 dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function BreakdownCard({
  title, icon: Icon, data, loading,
}: {
  title: string;
  icon: typeof Building2;
  data: Array<{ key: string; monto: number; count: number }>;
  loading: boolean;
}) {
  const top = data.slice(0, 10);
  const chartData = top.map((d) => ({ name: d.key, monto: Math.round(d.monto) }));
  const total = data.reduce((s, d) => s + d.monto, 0);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-muted">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
            {fmtMxn(total)}
          </Badge>
        </div>
        {loading ? (
          <div className="h-40 text-center text-xs text-muted-foreground py-12">Cargando…</div>
        ) : data.length === 0 ? (
          <div className="h-40 text-center text-xs text-muted-foreground py-12">Sin datos.</div>
        ) : (
          <>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(v: any) => fmtMxn(Number(v))}
                    contentStyle={{ fontSize: 11, padding: 6 }}
                  />
                  <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {data.slice(0, 5).map((d, i) => (
                <li key={d.key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{d.key}</span>
                  </div>
                  <span className="tabular-nums font-medium text-foreground shrink-0">
                    {fmtMxn(d.monto)}
                  </span>
                </li>
              ))}
              {data.length > 5 && (
                <li className="text-muted-foreground text-[10px]">
                  + {data.length - 5} más
                </li>
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "hsl(160 60% 45%)", "hsl(220 70% 55%)", "hsl(35 85% 55%)", "hsl(280 60% 60%)",
  "hsl(10 75% 55%)", "hsl(200 70% 50%)", "hsl(140 55% 45%)", "hsl(310 60% 55%)",
  "hsl(50 80% 55%)", "hsl(180 60% 50%)",
];

function agruparMonto(
  rows: ForecastRow[],
  key: (r: ForecastRow) => string,
): Array<{ key: string; monto: number; count: number }> {
  const m = new Map<string, { monto: number; count: number }>();
  rows.forEach((r) => {
    const k = key(r) || "—";
    const prev = m.get(k) ?? { monto: 0, count: 0 };
    prev.monto += r.monto;
    prev.count += 1;
    m.set(k, prev);
  });
  return Array.from(m.entries())
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.monto - a.monto);
}

// `fetchForecast` y los tipos/constantes del forecast viven ahora en el hook
// compartido `useForecastIngresos` (única fuente de verdad, también consumido
// por Estructura de comisiones · Proyectos).
