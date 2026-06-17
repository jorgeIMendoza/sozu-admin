import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  X,
  Eye,
  Loader2,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader, Kpi, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { RefreshButton } from "@/components/admin/portal-alta-direccion/RefreshButton";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import {
  DEFAULT_FILTROS,
  type IngresosEgresosFiltros,
} from "@/hooks/usePortalAltaDireccion/useResumenIngresosEgresos";
import { useMovimientosIngresosEgresos } from "@/hooks/usePortalAltaDireccion/useMovimientosIngresosEgresos";
import type {
  BaseContable,
  IngresoEgresoMovimiento,
  ProyectoSozu,
  TipoIngresoSozu,
} from "@/data/altaDireccion/ingresosEgresosMock";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const PROYECTOS: Array<ProyectoSozu> = ["Daiku", "Margot", "Monócolo", "Bottura"];
const TIPOS: Array<TipoIngresoSozu> = ["Propiedad", "Producto", "Servicio"];

type FiltroMov = "todos" | "ingresos" | "egresos";
type SortDir = "desc" | "asc";

/** Construye los filtros iniciales desde la URL (CTA del Dashboard General:
 *  ?base=caja&periodo=este_mes&proyecto=todos&tipo=todos). Sin params usa los
 *  defaults del módulo. */
function buildInitialFiltros(sp: URLSearchParams): IngresosEgresosFiltros {
  const base = sp.get("base");
  const proyecto = sp.get("proyecto");
  const tipo = sp.get("tipo");
  const periodo = sp.get("periodo");
  if (!base && !proyecto && !tipo && !periodo) return DEFAULT_FILTROS;
  return {
    ...DEFAULT_FILTROS,
    base: base === "caja" ? "caja" : base === "devengado" ? "devengado" : DEFAULT_FILTROS.base,
    proyecto: (proyecto ?? DEFAULT_FILTROS.proyecto) as IngresosEgresosFiltros["proyecto"],
    tipoIngreso: (tipo ?? DEFAULT_FILTROS.tipoIngreso) as IngresosEgresosFiltros["tipoIngreso"],
    periodoMeses: periodo === "este_mes" ? "este_mes" : DEFAULT_FILTROS.periodoMeses,
    fechaInicio: null,
    fechaFin: null,
  };
}

export default function AltaDireccionIngresosEgresosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filtros, setFiltros] = useState<IngresosEgresosFiltros>(() =>
    buildInitialFiltros(searchParams),
  );
  // Ledger real desde BD. KPIs, waterfall y composiciones se derivan de este
  // mismo ledger (ver resumenReal/composicion*Real) para que coincidan con el
  // Dashboard General.
  const movimientosRealQuery = useMovimientosIngresosEgresos(filtros);

  // Enfoque desde el CTA "Egresos" del Dashboard General: al cargar, hacer
  // scroll a la sección "Composición de egresos".
  useEffect(() => {
    if (searchParams.get("focus") === "egresos" && !movimientosRealQuery.isLoading) {
      document
        .getElementById("composicion-egresos")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientosRealQuery.isLoading]);

  // Rango personalizado (popover con calendar). Sincroniza con `filtros`
  // vía useEffect — al elegir un rango se cambia periodoMeses a "rango"
  // y al limpiarlo se regresa a "este_mes".
  const [rango, setRango] = useState<DateRange | undefined>(undefined);
  const [rangoOpen, setRangoOpen] = useState(false);
  const hayRango = !!(rango?.from && rango?.to);
  const fechaInicioStr = rango?.from ? toIsoDate(rango.from) : null;
  const fechaFinStr = rango?.to ? toIsoDate(rango.to) : null;
  useEffect(() => {
    if (hayRango) {
      setFiltros((prev) =>
        prev.periodoMeses === "rango" &&
        prev.fechaInicio === fechaInicioStr &&
        prev.fechaFin === fechaFinStr
          ? prev
          : { ...prev, periodoMeses: "rango", fechaInicio: fechaInicioStr, fechaFin: fechaFinStr },
      );
    } else if (filtros.periodoMeses === "rango") {
      setFiltros((prev) => ({ ...prev, periodoMeses: "este_mes", fechaInicio: null, fechaFin: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayRango, fechaInicioStr, fechaFinStr]);

  // Ledger local UI state.
  const [search, setSearch] = useState("");
  const [filtroMov, setFiltroMov] = useState<FiltroMov>(() => {
    const mov = searchParams.get("mov");
    return mov === "ingresos" || mov === "egresos" ? mov : "todos";
  });
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  // Drill-down del Waterfall: cada barra abre un drawer con el detalle
  // de las cuentas que la conforman.
  type WaterfallBucket = "ingresos" | "externos" | "internos" | "resultado";
  const [waterfallDrill, setWaterfallDrill] = useState<WaterfallBucket | null>(null);

  // Drill-down de la Evolución mensual: click en barra "Ingresos" o
  // "Egresos" de un mes específico abre drawer con las cuentas que
  // conforman ese monto.
  const [evolucionDrill, setEvolucionDrill] = useState<{ mes: string; kind: "ingreso" | "egreso" } | null>(null);

  // Drill-down de Composición de egresos: click en un beneficiario
  // externo o en un rol interno abre drawer con las cuentas de ese
  // beneficiario / rol.
  const [composicionDrill, setComposicionDrill] = useState<
    { kind: "externo"; nombre: string } | { kind: "interno"; rol: string } | null
  >(null);

  const hasFilters =
    filtros.base !== DEFAULT_FILTROS.base ||
    filtros.periodoMeses !== DEFAULT_FILTROS.periodoMeses ||
    filtros.proyecto !== DEFAULT_FILTROS.proyecto ||
    filtros.tipoIngreso !== DEFAULT_FILTROS.tipoIngreso ||
    hayRango;

  const clearFilters = () => {
    setFiltros(DEFAULT_FILTROS);
    setRango(undefined);
  };

  const update = <K extends keyof IngresosEgresosFiltros>(
    key: K,
    value: IngresosEgresosFiltros[K],
  ) => setFiltros((prev) => ({ ...prev, [key]: value }));

  /* Ledger filtrado + ordenado + paginado (data real) */
  const movimientosReales = movimientosRealQuery.data ?? [];
  const ledgerFiltrado = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = movimientosReales.filter((m) => {
      if (filtroMov === "ingresos" && m.tipo_movimiento !== "ingreso") return false;
      if (filtroMov === "egresos" && m.tipo_movimiento !== "egreso") return false;
      if (filtroEstado !== "todos" && m.estado !== filtroEstado) return false;
      if (q) {
        const hay = [m.folio, m.folio_cuenta, m.contraparte, m.proyecto, m.concepto]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const cmp = new Date(a.fecha_causacion).getTime() - new Date(b.fecha_causacion).getTime();
      return sortDir === "desc" ? -cmp : cmp;
    });
    return rows;
  }, [movimientosReales, search, filtroMov, filtroEstado, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ledgerFiltrado.length / PAGE_SIZE));
  const ledgerPage = ledgerFiltrado.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ──────────────────────────────────────────────────────────
     Derivaciones reales desde `movimientosReales` para los paneles
     "Composición de egresos", "Exposición sin cobro previo" y
     "Evolución mensual · ingresos vs egresos".
     ────────────────────────────────────────────────────────── */
  const composicionEgresosReal = useMemo(() => {
    const egresos = movimientosReales.filter((m) => m.tipo_movimiento === "egreso");
    let externosTotal = 0;
    let internosTotal = 0;
    const topExternos = new Map<string, number>();
    const porRolInterno = new Map<string, number>();
    for (const m of egresos) {
      if (m.origen_egreso === "externo") {
        externosTotal += m.subtotal;
        topExternos.set(m.contraparte, (topExternos.get(m.contraparte) ?? 0) + m.subtotal);
      } else {
        internosTotal += m.subtotal;
        const rol = m.rol ?? "Otro";
        porRolInterno.set(rol, (porRolInterno.get(rol) ?? 0) + m.subtotal);
      }
    }
    const total = externosTotal + internosTotal;
    return {
      externos: {
        total: +externosTotal.toFixed(2),
        pct: total > 0 ? +((externosTotal / total) * 100).toFixed(1) : 0,
        top: Array.from(topExternos.entries())
          .map(([nombre, monto]) => ({ nombre, monto: +monto.toFixed(2) }))
          .sort((a, b) => b.monto - a.monto)
          .slice(0, 5),
      },
      internos: {
        total: +internosTotal.toFixed(2),
        pct: total > 0 ? +((internosTotal / total) * 100).toFixed(1) : 0,
        porRol: Array.from(porRolInterno.entries())
          .map(([rol, monto]) => ({ rol, monto: +monto.toFixed(2) }))
          .sort((a, b) => b.monto - a.monto),
      },
    };
  }, [movimientosReales]);

  const exposicionReal = useMemo(() => {
    return movimientosReales
      .filter((m) => m.tipo_movimiento === "egreso" && m.cobro_previo === false)
      .map((m) => ({
        id: m.id,
        folio_cuenta: m.folio_cuenta,
        beneficiario: m.contraparte,
        tipo: (m.origen_egreso as "externo" | "interno") ?? "externo",
        proyecto: m.proyecto,
        monto_comprometido: m.subtotal,
        dias_antiguedad: m.dias_antiguedad,
        estado: m.estado,
        flag_cobro: false,
      }));
  }, [movimientosReales]);

  const exposicionTotalReal = useMemo(
    () => exposicionReal.reduce((s, r) => s + r.monto_comprometido, 0),
    [exposicionReal],
  );

  const evolucionReal = useMemo(() => {
    type Bucket = { ingresos: number; egresos: number; opIng: number; opEg: number };
    const byMes = new Map<string, Bucket>();
    for (const m of movimientosReales) {
      const fecha = filtros.base === "devengado" ? m.fecha_causacion : m.fecha_cobro_pago;
      if (!fecha) continue;
      const mes = fecha.slice(0, 7) + "-01";
      let b = byMes.get(mes);
      if (!b) {
        b = { ingresos: 0, egresos: 0, opIng: 0, opEg: 0 };
        byMes.set(mes, b);
      }
      if (m.tipo_movimiento === "ingreso") {
        b.ingresos += m.subtotal;
        b.opIng += 1;
      } else {
        b.egresos += m.subtotal;
        b.opEg += 1;
      }
    }
    return Array.from(byMes.entries())
      .map(([mes, b]) => ({
        mes,
        ingresos: +b.ingresos.toFixed(2),
        egresos: +b.egresos.toFixed(2),
        resultado: +(b.ingresos - b.egresos).toFixed(2),
        operaciones_ingreso: b.opIng,
        operaciones_egreso: b.opEg,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [movimientosReales, filtros.base]);

  // Resumen REAL (KPIs + waterfall) desde el ledger real, sin IVA — sustituye
  // al resumen mock para que coincida con el Dashboard General.
  const resumenReal = useMemo(() => {
    let ingSub = 0, ingIva = 0, extSub = 0, intSub = 0;
    for (const m of movimientosReales) {
      if (m.tipo_movimiento === "ingreso") {
        ingSub += m.subtotal;
        ingIva += m.iva;
      } else if (m.origen_egreso === "externo") {
        extSub += m.subtotal;
      } else {
        intSub += m.subtotal;
      }
    }
    const egrTotal = extSub + intSub;
    const neto = ingSub - egrTotal;
    return {
      base: filtros.base,
      ingresos_subtotal: +ingSub.toFixed(2),
      ingresos_iva: +ingIva.toFixed(2),
      ingresos_total_con_iva: +(ingSub + ingIva).toFixed(2),
      egresos_externos_subtotal: +extSub.toFixed(2),
      egresos_internos_subtotal: +intSub.toFixed(2),
      egresos_total_subtotal: +egrTotal.toFixed(2),
      resultado_neto: +neto.toFixed(2),
      margen_pct: ingSub > 0 ? +((neto / ingSub) * 100).toFixed(2) : 0,
      exposicion_subtotal: +exposicionTotalReal.toFixed(2),
      exposicion_count: exposicionReal.length,
    };
  }, [movimientosReales, filtros.base, exposicionTotalReal, exposicionReal.length]);

  const composicionIngresosReal = useMemo(() => {
    const map = new Map<string, { monto: number; count: number }>();
    let total = 0;
    for (const m of movimientosReales) {
      if (m.tipo_movimiento !== "ingreso") continue;
      const key = (m.tipo_ingreso ?? "Propiedad") as string;
      const prev = map.get(key) ?? { monto: 0, count: 0 };
      map.set(key, { monto: prev.monto + m.subtotal, count: prev.count + 1 });
      total += m.subtotal;
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      label: key,
      monto: +v.monto.toFixed(2),
      count: v.count,
      pct: total > 0 ? +((v.monto / total) * 100).toFixed(1) : 0,
    }));
  }, [movimientosReales]);

  /* Filas para el drawer del Waterfall según bucket activo. */
  const waterfallDrillRows = useMemo(() => {
    if (!waterfallDrill) return [];
    return movimientosReales.filter((m) => {
      if (waterfallDrill === "resultado") return true;
      if (waterfallDrill === "ingresos") return m.tipo_movimiento === "ingreso";
      if (waterfallDrill === "externos") {
        return m.tipo_movimiento === "egreso" && m.origen_egreso === "externo";
      }
      // internos
      return m.tipo_movimiento === "egreso" && m.origen_egreso === "interno";
    });
  }, [waterfallDrill, movimientosReales]);
  const waterfallDrillTitles: Record<WaterfallBucket, string> = {
    ingresos: "Ingresos · comisión SOZU",
    externos: "Egresos externos · comisiones a aliados",
    internos: "Egresos internos · dispersión al equipo SOZU",
    resultado: "Resultado neto · ingresos − egresos",
  };
  const waterfallDrillTotal = useMemo(() => {
    return waterfallDrillRows.reduce((s, r) => s + r.subtotal, 0);
  }, [waterfallDrillRows]);

  /* Filas para el drawer del drill-down de Evolución mensual. */
  const evolucionDrillRows = useMemo(() => {
    if (!evolucionDrill) return [];
    return movimientosReales.filter((m) => {
      const fecha = filtros.base === "devengado" ? m.fecha_causacion : m.fecha_cobro_pago;
      if (!fecha) return false;
      const mes = fecha.slice(0, 7) + "-01";
      if (mes !== evolucionDrill.mes) return false;
      return evolucionDrill.kind === "ingreso"
        ? m.tipo_movimiento === "ingreso"
        : m.tipo_movimiento === "egreso";
    });
  }, [evolucionDrill, movimientosReales, filtros.base]);
  const evolucionDrillTotal = useMemo(
    () => evolucionDrillRows.reduce((s, r) => s + r.subtotal, 0),
    [evolucionDrillRows],
  );

  /* Filas para el drawer del drill-down de Composición de egresos. */
  const composicionDrillRows = useMemo(() => {
    if (!composicionDrill) return [];
    return movimientosReales.filter((m) => {
      if (m.tipo_movimiento !== "egreso") return false;
      if (composicionDrill.kind === "externo") {
        return m.origen_egreso === "externo" && m.contraparte === composicionDrill.nombre;
      }
      // interno
      return m.origen_egreso === "interno" && (m.rol ?? "Otro") === composicionDrill.rol;
    });
  }, [composicionDrill, movimientosReales]);
  const composicionDrillTotal = useMemo(
    () => composicionDrillRows.reduce((s, r) => s + r.subtotal, 0),
    [composicionDrillRows],
  );

  // Scroll a exposición al click en KPI.
  const scrollExposicion = () => {
    document.getElementById("exposicion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <PageHeader
        title="Ingresos y Egresos"
        description="Resultado y flujo de Real Estate Ventures, S.A. de C.V."
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
            >
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Datos en vivo
            </Badge>
            <RefreshButton keyPrefixes={["movimientos-ingresos-egresos"]} />
          </div>
        }
      />

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3 justify-end">
        {/* Período */}
        <Select
          value={String(filtros.periodoMeses)}
          onValueChange={(v) => {
            // Cambio de preset → descarta cualquier rango personalizado.
            if (v === "este_mes") update("periodoMeses", "este_mes");
            else update("periodoMeses", Number(v) as 3 | 6 | 12);
            if (hayRango) setRango(undefined);
          }}
          disabled={hayRango}
        >
          <SelectTrigger className="w-[200px] h-9 text-[13px]">
            <SelectValue placeholder={hayRango ? "Rango personalizado" : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="este_mes">Este mes</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>

        {/* Rango personalizado */}
        <Popover open={rangoOpen} onOpenChange={setRangoOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hayRango ? "default" : "outline"}
              size="sm"
              className="h-9 gap-2 text-[13px] font-normal"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {hayRango
                ? `${fmtFechaCorta(rango!.from!)} – ${fmtFechaCorta(rango!.to!)}`
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

        {/* Base contable */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {(["devengado", "caja"] as BaseContable[]).map((b) => (
            <button
              key={b}
              onClick={() => update("base", b)}
              className={cn(
                "px-3 py-[6px] text-[12px] font-medium rounded-md transition-all",
                filtros.base === b
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {b === "devengado" ? "Devengado" : "Flujo de caja"}
            </button>
          ))}
        </div>

        {/* Proyecto */}
        <Select
          value={filtros.proyecto}
          onValueChange={(v) => update("proyecto", v as ProyectoSozu | "todos")}
        >
          <SelectTrigger className="w-[180px] h-9 text-[13px]">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {PROYECTOS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tipo de ingreso */}
        <Select
          value={filtros.tipoIngreso}
          onValueChange={(v) => update("tipoIngreso", v as TipoIngresoSozu | "todos")}
        >
          <SelectTrigger className="w-[160px] h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button size="sm" variant="ghost" className="h-9 gap-1 text-[12px]" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* KPIs hero — 5 cards en desktop, 2 en tablet, 1 mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Kpi
          label="Ingresos (Comisión SOZU)"
          value={fmtMxn(resumenReal.ingresos_subtotal)}
          hint={filtros.base === "devengado" ? "Comisiones facturadas" : "Comisiones cobradas"}
          icon={ArrowDownRight}
          tone="success"
        />
        <Kpi
          label="Egresos totales"
          value={fmtMxn(resumenReal.egresos_total_subtotal)}
          hint={`Externos ${fmtMxn(resumenReal.egresos_externos_subtotal)} · Internos ${fmtMxn(resumenReal.egresos_internos_subtotal)}`}
          icon={ArrowUpRight}
          tone="destructive"
        />
        <Kpi
          label="Resultado neto"
          value={fmtMxn(resumenReal.resultado_neto)}
          hint={`Sin IVA · base: ${filtros.base === "devengado" ? "Devengado" : "Flujo de caja"}`}
          icon={resumenReal.resultado_neto >= 0 ? TrendingUp : TrendingDown}
          tone="primary"
        />
        <Kpi
          label="Margen"
          value={`${resumenReal.margen_pct.toFixed(1)}%`}
          hint="Resultado / Ingresos · sin IVA"
          icon={Scale}
          tone="info"
        />
        <Kpi
          label="Exposición (sin cobro previo)"
          value={fmtMxn(exposicionTotalReal)}
          hint={`${exposicionReal.length} ${exposicionReal.length === 1 ? "caso" : "casos"} en riesgo`}
          icon={AlertTriangle}
          tone={exposicionTotalReal > 0 ? "destructive" : "default"}
          onClick={scrollExposicion}
          active={exposicionTotalReal > 0}
        />
      </div>

      {/* Waterfall */}
      <Panel
        title="Resumen del resultado"
        description="Cascada de ingresos a resultado neto (sin IVA)"
        className="mb-6"
      >
        <WaterfallChart
          resumen={resumenReal}
          onBarClick={(bucket) => setWaterfallDrill(bucket)}
        />
      </Panel>

      {/* Evolución mensual — data real desde movimientos */}
      <Panel
        title="Evolución mensual · ingresos vs egresos"
        description={`Base: ${filtros.base === "devengado" ? "Devengado" : "Flujo de caja"} · ${evolucionReal.length} ${evolucionReal.length === 1 ? "mes" : "meses"} con movimiento`}
        className="mb-6"
      >
        {movimientosRealQuery.isLoading ? (
          <div className="h-[320px] w-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : evolucionReal.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-12">
            Sin movimientos en el período.
          </p>
        ) : (
          <EvolucionChart
            puntos={evolucionReal}
            onBarClick={(mes, kind) => setEvolucionDrill({ mes, kind })}
          />
        )}
      </Panel>

      {/* Composición ingresos / egresos */}
      <div id="composicion-egresos" className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Panel title="Composición de ingresos" description="Distribución por tipo de comisión SOZU">
          <ComposicionIngresos rows={composicionIngresosReal} total={resumenReal.ingresos_subtotal} />
        </Panel>
        <Panel title="Composición de egresos" description="Externos (a aliados) vs Internos (equipo SOZU)">
          {movimientosRealQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <ComposicionEgresos
              data={composicionEgresosReal}
              onExternoClick={(nombre) => setComposicionDrill({ kind: "externo", nombre })}
              onInternoClick={(rol) => setComposicionDrill({ kind: "interno", rol })}
            />
          )}
        </Panel>
      </div>

      {/* Exposición sin cobro previo */}
      <div id="exposicion" className="mb-6">
        <Panel
          title="Egresos comprometidos sin cobro previo"
          description="Riesgo de financiamiento involuntario"
          className="border-red-200/60 dark:border-red-900/40"
          action={
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total exposición</p>
              <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {fmtMxn(exposicionTotalReal)}
              </p>
            </div>
          }
        >
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-[12px] text-amber-900 dark:text-amber-200 mb-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
            <p>
              SOZU no paga una comisión hasta haber cobrado del desarrollador correspondiente. Estos
              egresos están comprometidos sin ingreso cobrado y representan riesgo de financiamiento
              involuntario.
            </p>
          </div>
          {movimientosRealQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : exposicionReal.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">
              No hay exposición sin cobro previo para los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                    <TableHead className="text-xs">Beneficiario</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Proyecto</TableHead>
                    <TableHead className="text-xs text-right">Monto comprometido</TableHead>
                    <TableHead className="text-xs">Antigüedad</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Flag cobro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exposicionReal.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap font-medium">{r.folio_cuenta}</TableCell>
                      <TableCell className="text-sm">{r.beneficiario}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          r.tipo === "externo"
                            ? "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40"
                            : "border-violet-400 text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40",
                        )}>
                          {r.tipo === "externo" ? "Externo" : "Interno"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.proyecto}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">
                        {fmtMxn(r.monto_comprometido)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-sm tabular-nums",
                        r.dias_antiguedad > 7 && "text-red-600 dark:text-red-400 font-semibold",
                      )}>
                        {r.dias_antiguedad} días
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap capitalize">
                          {r.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40">
                          Sin cobro
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      {/* Ledger */}
      <Panel
        title="Movimientos"
        description={`${ledgerFiltrado.length} movimientos · base ${filtros.base === "devengado" ? "Devengado" : "Flujo de caja"}`}
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="Buscar por folio, contraparte o proyecto…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-9 text-[13px] max-w-sm"
          />
          <Select value={filtroMov} onValueChange={(v) => { setFiltroMov(v as FiltroMov); setPage(0); }}>
            <SelectTrigger className="w-[150px] h-9 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ingresos">Solo ingresos</SelectItem>
              <SelectItem value="egresos">Solo egresos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-9 text-[13px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="cobrada">Cobrada</SelectItem>
              <SelectItem value="facturada">Facturada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="comprometida">Comprometida</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
            <SelectTrigger className="w-[170px] h-9 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Más recientes primero</SelectItem>
              <SelectItem value="asc">Más antiguos primero</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {movimientosRealQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando movimientos…
          </div>
        ) : movimientosRealQuery.error ? (
          <div className="text-center py-10 text-sm text-destructive">
            Error al cargar movimientos: {(movimientosRealQuery.error as Error).message}
          </div>
        ) : ledgerPage.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-10">
            Sin movimientos que coincidan con los filtros.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Fecha de ejecución</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Concepto</TableHead>
                    <TableHead className="text-xs">Contraparte</TableHead>
                    <TableHead className="text-xs text-right">Subtotal</TableHead>
                    <TableHead className="text-xs text-right">IVA</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs">Estado del Pago</TableHead>
                    <TableHead className="text-xs">Flag cobro previo</TableHead>
                    <TableHead className="text-xs text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerPage.map((m) => (
                    <LedgerRow
                      key={m.id}
                      m={m}
                      base={filtros.base}
                      onVer={() =>
                        navigate(
                          `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(m.folio_cuenta)}`,
                        )
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-xs">
              <span className="tabular-nums text-muted-foreground mr-2">
                {page * PAGE_SIZE + 1}–{Math.min(ledgerFiltrado.length, (page + 1) * PAGE_SIZE)} de {ledgerFiltrado.length}
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
              </Button>
              <span className="tabular-nums text-muted-foreground">
                Página <span className="font-semibold text-foreground">{page + 1}</span> de {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages - 1} onClick={() => setPage(Math.min(totalPages - 1, page + 1))}>
                Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </>
        )}
      </Panel>

      {/* Drill-down del Waterfall (Resumen del resultado) */}
      <Sheet
        open={!!waterfallDrill}
        onOpenChange={(open) => { if (!open) setWaterfallDrill(null); }}
      >
        <SheetContent className="sm:max-w-[1100px] p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-[16px]">
              {waterfallDrill ? waterfallDrillTitles[waterfallDrill] : ""}
            </SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              {waterfallDrillRows.length === 0
                ? "Sin cuentas en este indicador."
                : `${waterfallDrillRows.length} ${waterfallDrillRows.length === 1 ? "cuenta" : "cuentas"} · subtotal ${fmtMxn(waterfallDrillTotal)}`}
            </p>
          </SheetHeader>
          <div className="px-6 py-5">
            {movimientosRealQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : waterfallDrillRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-12">
                No hay cuentas que conformen este indicador para los filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Concepto</TableHead>
                      <TableHead className="text-xs">Contraparte</TableHead>
                      <TableHead className="text-xs text-right">Subtotal</TableHead>
                      <TableHead className="text-xs text-right">IVA</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waterfallDrillRows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                          {m.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] whitespace-nowrap",
                            m.tipo_movimiento === "ingreso"
                              ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                              : "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40",
                          )}>
                            {m.tipo_movimiento === "ingreso"
                              ? "Ingreso"
                              : m.origen_egreso === "externo"
                                ? "Egreso · Externo"
                                : "Egreso · Interno"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[280px]">{m.concepto}</TableCell>
                        <TableCell className="text-sm">
                          <p className="truncate max-w-[200px]">{m.contraparte}</p>
                          {m.tipo_movimiento === "egreso" && m.rol && (
                            <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{m.rol}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmtMxn(m.subtotal)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{fmtMxn(m.iva)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-semibold">{fmtMxn(m.total)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-[11px]"
                            onClick={() => {
                              setWaterfallDrill(null);
                              navigate(
                                `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(m.folio_cuenta)}`,
                              );
                            }}
                            aria-label={`Ver Ciclo de Venta ${m.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver detalle
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

      {/* Drill-down de Evolución mensual */}
      <Sheet
        open={!!evolucionDrill}
        onOpenChange={(open) => { if (!open) setEvolucionDrill(null); }}
      >
        <SheetContent className="sm:max-w-[1100px] p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-[16px]">
              {evolucionDrill
                ? `${evolucionDrill.kind === "ingreso" ? "Ingresos" : "Egresos"} · ${fmtMesLargo(evolucionDrill.mes)}`
                : ""}
            </SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              {evolucionDrillRows.length === 0
                ? "Sin cuentas en este mes."
                : `${evolucionDrillRows.length} ${evolucionDrillRows.length === 1 ? "cuenta" : "cuentas"} · subtotal ${fmtMxn(evolucionDrillTotal)}`}
            </p>
          </SheetHeader>
          <div className="px-6 py-5">
            {evolucionDrillRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-12">
                No hay cuentas que conformen este monto para los filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Concepto</TableHead>
                      <TableHead className="text-xs">Contraparte</TableHead>
                      <TableHead className="text-xs text-right">Subtotal</TableHead>
                      <TableHead className="text-xs text-right">IVA</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evolucionDrillRows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                          {m.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] whitespace-nowrap",
                            m.tipo_movimiento === "ingreso"
                              ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                              : "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40",
                          )}>
                            {m.tipo_movimiento === "ingreso"
                              ? "Ingreso"
                              : m.origen_egreso === "externo"
                                ? "Egreso · Externo"
                                : "Egreso · Interno"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[280px]">{m.concepto}</TableCell>
                        <TableCell className="text-sm">
                          <p className="truncate max-w-[200px]">{m.contraparte}</p>
                          {m.tipo_movimiento === "egreso" && m.rol && (
                            <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{m.rol}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmtMxn(m.subtotal)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{fmtMxn(m.iva)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-semibold">{fmtMxn(m.total)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-[11px]"
                            onClick={() => {
                              setEvolucionDrill(null);
                              navigate(
                                `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(m.folio_cuenta)}`,
                              );
                            }}
                            aria-label={`Ver Ciclo de Venta ${m.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver detalle
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

      {/* Drill-down de Composición de egresos (top externos / por rol) */}
      <Sheet
        open={!!composicionDrill}
        onOpenChange={(open) => { if (!open) setComposicionDrill(null); }}
      >
        <SheetContent className="sm:max-w-[1100px] p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-[16px]">
              {composicionDrill
                ? composicionDrill.kind === "externo"
                  ? `Egresos externos · ${composicionDrill.nombre}`
                  : `Egresos internos · ${composicionDrill.rol}`
                : ""}
            </SheetTitle>
            <p className="text-[12px] text-muted-foreground">
              {composicionDrillRows.length === 0
                ? "Sin cuentas para los filtros aplicados."
                : `${composicionDrillRows.length} ${composicionDrillRows.length === 1 ? "cuenta" : "cuentas"} · subtotal ${fmtMxn(composicionDrillTotal)}`}
            </p>
          </SheetHeader>
          <div className="px-6 py-5">
            {composicionDrillRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-12">
                No hay cuentas con egresos en este beneficiario/rol para los filtros aplicados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Concepto</TableHead>
                      <TableHead className="text-xs">Contraparte</TableHead>
                      <TableHead className="text-xs text-right">Subtotal</TableHead>
                      <TableHead className="text-xs text-right">IVA</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {composicionDrillRows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                          {m.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] whitespace-nowrap",
                            m.origen_egreso === "externo"
                              ? "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40"
                              : "border-violet-400 text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40",
                          )}>
                            {m.origen_egreso === "externo" ? "Egreso · Externo" : "Egreso · Interno"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[280px]">{m.concepto}</TableCell>
                        <TableCell className="text-sm">
                          <p className="truncate max-w-[200px]">{m.contraparte}</p>
                          {m.rol && (
                            <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{m.rol}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmtMxn(m.subtotal)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{fmtMxn(m.iva)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-semibold">{fmtMxn(m.total)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-[11px]"
                            onClick={() => {
                              setComposicionDrill(null);
                              navigate(
                                `/admin/portal-alta-direccion/ciclo-venta?caso=${encodeURIComponent(m.folio_cuenta)}`,
                              );
                            }}
                            aria-label={`Ver Ciclo de Venta ${m.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver detalle
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

/* ─────────────────────────── Sub-componentes ─────────────────────────── */

function LedgerRow({
  m,
  base,
  onVer,
}: {
  m: IngresoEgresoMovimiento;
  base: BaseContable;
  onVer: () => void;
}) {
  const fecha = base === "devengado" ? m.fecha_causacion : m.fecha_cobro_pago;
  const fechaEjecucion = m.fecha_cobro_pago;
  return (
    <TableRow>
      <TableCell className="text-xs font-mono whitespace-nowrap font-medium">{m.folio_cuenta}</TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {fecha ?? "—"}
      </TableCell>
      <TableCell className="text-xs tabular-nums whitespace-nowrap">
        {fechaEjecucion ? (
          <span className="text-foreground">{fechaEjecucion}</span>
        ) : (
          <span className="text-muted-foreground/60">Pendiente</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn(
          "text-[10px] whitespace-nowrap",
          m.tipo_movimiento === "ingreso"
            ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
            : "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40",
        )}>
          {m.tipo_movimiento === "ingreso"
            ? "Ingreso"
            : m.origen_egreso === "externo"
              ? "Egreso · Externo"
              : "Egreso · Interno"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm truncate max-w-[280px]">{m.concepto}</TableCell>
      <TableCell className="text-sm">
        <p className="truncate max-w-[200px]">{m.contraparte}</p>
        {m.tipo_movimiento === "egreso" && m.rol && (
          <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{m.rol}</p>
        )}
      </TableCell>
      <TableCell className="text-sm text-right tabular-nums">{fmtMxn(m.subtotal)}</TableCell>
      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{fmtMxn(m.iva)}</TableCell>
      <TableCell className="text-sm text-right tabular-nums font-semibold">{fmtMxn(m.total)}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] whitespace-nowrap capitalize">{m.estado}</Badge>
      </TableCell>
      <TableCell>
        {m.tipo_movimiento === "egreso" ? (
          m.cobro_previo ? (
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40">
              Cobrado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40">
              Sin cobro
            </Badge>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[11px]"
          onClick={onVer}
          aria-label={`Ver Ciclo de Venta ${m.folio_cuenta}`}
        >
          <Eye className="h-3.5 w-3.5" /> Ver
        </Button>
      </TableCell>
    </TableRow>
  );
}

function WaterfallChart({
  resumen,
  onBarClick,
}: {
  resumen: { ingresos_subtotal: number; egresos_externos_subtotal: number; egresos_internos_subtotal: number; resultado_neto: number };
  onBarClick?: (bucket: "ingresos" | "externos" | "internos" | "resultado") => void;
}) {
  // Recharts no tiene waterfall nativo; lo construimos con barras
  // apiladas (base invisible + valor). Cada barra se sostiene desde
  // donde queda el saldo anterior.
  const ingresos = resumen.ingresos_subtotal;
  const externos = resumen.egresos_externos_subtotal;
  const internos = resumen.egresos_internos_subtotal;
  const tras1 = ingresos - externos;
  const tras2 = tras1 - internos;
  const resultado = resumen.resultado_neto;

  const data = [
    { name: "Ingresos",      bucket: "ingresos",  base: 0,     valor: ingresos,  color: "hsl(142, 71%, 45%)" },
    { name: "(−) Externos",  bucket: "externos",  base: tras1, valor: externos,  color: "hsl(0, 84%, 60%)" },
    { name: "(−) Internos",  bucket: "internos",  base: tras2, valor: internos,  color: "hsl(0, 84%, 60%)" },
    { name: "Resultado neto", bucket: "resultado", base: 0,     valor: resultado, color: "hsl(265, 80%, 55%)" },
  ] as const;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as any} margin={{ top: 24, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => abbr(v)} />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => {
              const isCorte = props.payload?.name === "Ingresos" || props.payload?.name === "Resultado neto";
              const pct = isCorte && resumen.ingresos_subtotal > 0
                ? ` · ${((value / resumen.ingresos_subtotal) * 100).toFixed(1)}%`
                : "";
              return [`${fmtMxn(value)}${pct}`, "Monto"];
            }}
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar
            dataKey="valor"
            stackId="w"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(p: any) => {
              const bucket = p?.payload?.bucket as "ingresos" | "externos" | "internos" | "resultado" | undefined;
              if (bucket && onBarClick) onBarClick(bucket);
            }}
          >
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvolucionChart({
  puntos,
  onBarClick,
}: {
  puntos: Array<{ mes: string; ingresos: number; egresos: number; resultado: number }>;
  onBarClick?: (mes: string, kind: "ingreso" | "egreso") => void;
}) {
  const data = puntos.map((p) => ({ ...p, mesLabel: fmtMes(p.mes) }));
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => abbr(Number(v))} />
          <Tooltip
            formatter={(value: number, name: string) => [fmtMxn(Number(value)), name]}
            labelClassName="text-foreground"
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="ingresos"
            name="Ingresos"
            fill="hsl(142, 71%, 45%)"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(p: any) => {
              const mes = p?.payload?.mes as string | undefined;
              if (mes && onBarClick) onBarClick(mes, "ingreso");
            }}
          />
          <Bar
            dataKey="egresos"
            name="Egresos"
            fill="hsl(0, 84%, 60%)"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(p: any) => {
              const mes = p?.payload?.mes as string | undefined;
              if (mes && onBarClick) onBarClick(mes, "egreso");
            }}
          />
          <Line dataKey="resultado" name="Resultado" stroke="hsl(265, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComposicionIngresos({
  rows,
  total,
}: {
  rows: Array<{ key: string; label: string; monto: number; count: number; pct: number }>;
  total: number;
}) {
  if (rows.length === 0 || total === 0) {
    return <p className="text-[13px] text-muted-foreground text-center py-6">Sin ingresos para los filtros aplicados.</p>;
  }
  const COLORS: Record<string, string> = {
    Propiedad: "hsl(142, 71%, 45%)",
    Producto: "hsl(217, 91%, 60%)",
    Servicio: "hsl(265, 80%, 55%)",
  };
  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full rounded-md overflow-hidden border border-border">
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ width: `${r.pct}%`, backgroundColor: COLORS[r.key] ?? "hsl(220, 9%, 60%)" }}
            title={`${r.label} · ${fmtMxn(r.monto)} · ${r.pct}%`}
          />
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Tipo</TableHead>
            <TableHead className="text-xs text-right">Monto</TableHead>
            <TableHead className="text-xs text-right">%</TableHead>
            <TableHead className="text-xs text-right">Operaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[r.key] ?? "hsl(220, 9%, 60%)" }} />
                  {r.label}
                </span>
              </TableCell>
              <TableCell className="text-sm text-right tabular-nums">{fmtMxn(r.monto)}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{r.pct.toFixed(1)}%</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComposicionEgresos({
  data,
  onExternoClick,
  onInternoClick,
}: {
  data: {
    externos: { total: number; pct: number; top: Array<{ nombre: string; monto: number }> };
    internos: { total: number; pct: number; porRol: Array<{ rol: string; monto: number }> };
  };
  onExternoClick?: (nombre: string) => void;
  onInternoClick?: (rol: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Externos */}
      <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80 font-semibold">
            Externos
          </p>
          <Badge variant="outline" className="text-[10px] border-amber-400">{data.externos.pct.toFixed(1)}%</Badge>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground mb-3">{fmtMxn(data.externos.total)}</p>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Top beneficiarios</p>
        {data.externos.top.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="space-y-1">
            {data.externos.top.map((t) => (
              <li key={t.nombre}>
                <button
                  type="button"
                  onClick={() => onExternoClick?.(t.nombre)}
                  className="w-full flex items-center justify-between text-[12px] rounded-md px-1.5 py-1 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors cursor-pointer text-left"
                  aria-label={`Ver detalle de ${t.nombre}`}
                >
                  <span className="truncate max-w-[180px] group-hover:text-amber-800">{t.nombre}</span>
                  <span className="tabular-nums font-medium">{fmtMxn(t.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Internos */}
      <div className="rounded-lg border border-violet-200/60 bg-violet-50/40 dark:bg-violet-950/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-violet-700/80 dark:text-violet-300/80 font-semibold">
            Internos
          </p>
          <Badge variant="outline" className="text-[10px] border-violet-400">{data.internos.pct.toFixed(1)}%</Badge>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground mb-3">{fmtMxn(data.internos.total)}</p>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Por rol</p>
        {data.internos.porRol.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="space-y-1">
            {data.internos.porRol.map((t) => (
              <li key={t.rol}>
                <button
                  type="button"
                  onClick={() => onInternoClick?.(t.rol)}
                  className="w-full flex items-center justify-between text-[12px] rounded-md px-1.5 py-1 hover:bg-violet-100/60 dark:hover:bg-violet-900/30 transition-colors cursor-pointer text-left"
                  aria-label={`Ver detalle del rol ${t.rol}`}
                >
                  <span className="truncate max-w-[180px]">{t.rol}</span>
                  <span className="tabular-nums font-medium">{fmtMxn(t.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function abbr(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function fmtMes(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" }).replace(".", "");
}

function fmtMesLargo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function toIsoDate(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtFechaCorta(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" });
}
