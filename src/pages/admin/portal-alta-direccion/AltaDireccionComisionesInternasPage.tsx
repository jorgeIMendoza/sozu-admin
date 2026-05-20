import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  Eye,
  Percent,
  Banknote,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { ComisionInternaContent } from "@/components/admin/portal-alta-direccion/drawers/content/ComisionInternaContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";
import {
  useComisionesInternas,
  type ComisionInterna,
  type EstadoComisionInterna as EstadoComisionInt,
} from "@/hooks/useComisionesInternas";

/* ──────────────────────────────────────────────────────────
   Helpers (mock data removido; ahora se consume vía hook)
   ────────────────────────────────────────────────────────── */


const ESTADO_LABEL: Record<EstadoComisionInt, string> = {
  devengada: "Devengada",
  aprobada: "Aprobada",
  autorizada: "Autorizada",
  dispersada: "Dispersada",
  cancelada: "Cancelada",
};

const ESTADO_TONE: Record<EstadoComisionInt, string> = {
  devengada: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  aprobada: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  autorizada: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  dispersada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Antiguedad({
  dias,
  isAlerta,
  tooltip,
}: {
  dias: number;
  isAlerta: boolean;
  tooltip?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        isAlerta ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={tooltip}
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

/** Celda de Antigüedad que adapta el campo y el umbral según el estado. */
function AntiguedadCell({ c }: { c: ComisionInterna }) {
  if (c.estado === "aprobada" && c.dias_esperando_director != null) {
    const danger = c.dias_esperando_director > 5;
    return (
      <Antiguedad
        dias={c.dias_esperando_director}
        isAlerta={danger}
        tooltip={
          danger
            ? "Aprobada con más de 5 días — el Director es el cuello de botella"
            : "Días esperando autorización del Director"
        }
      />
    );
  }
  if (c.estado === "autorizada" && c.dias_esperando_dispersion != null) {
    return (
      <Antiguedad
        dias={c.dias_esperando_dispersion}
        isAlerta={false}
        tooltip="Días esperando dispersión vía nómina"
      />
    );
  }
  if (c.estado === "dispersada") {
    return (
      <span className="text-xs text-muted-foreground tabular-nums" title="Fecha de dispersión">
        {c.fecha_dispersion || "—"}
      </span>
    );
  }
  // devengada, cancelada — fallback al campo neutro
  return (
    <Antiguedad
      dias={c.dias_desde_devengo}
      isAlerta={false}
      tooltip="Días desde devengo"
    />
  );
}

type KpiTone = "info" | "warning" | "primary" | "success";
const KPI_TONE_CLASS: Record<KpiTone, string> = {
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

/** KPI clicable. Espejo visual del <Kpi /> compartido + estado activo. */
function ClickableKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Clock;
  tone: KpiTone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filtrar por ${label}`}
      className={cn(
        "text-left w-full rounded-lg border bg-card transition-all",
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        active
          ? "ring-2 ring-primary border-primary shadow-md"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground truncate">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg shrink-0",
            KPI_TONE_CLASS[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionComisionesInternasPage() {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [rolFilter, setRolFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ComisionInterna | null>(null);

  const { data: comisiones = [], isLoading, error } = useComisionesInternas();

  const rolOptions = useMemo(
    () =>
      Array.from(new Set(comisiones.map((c) => c.comisionista_rol).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [comisiones],
  );

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return comisiones.filter((c) => {
      if (estadoFilter !== "all" && c.estado !== estadoFilter) return false;
      if (rolFilter !== "all" && c.comisionista_rol !== rolFilter) return false;
      if (q) {
        const hay = [
          c.folio_comision,
          c.comisionista_nombre,
          c.comisionista_rol,
          c.venta_referencia,
          c.proyecto_nombre,
          c.modelo_nombre,
          c.numero_departamento,
        ]
          .map(norm)
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, estadoFilter, rolFilter, comisiones]);

  const kpis = useMemo(() => {
    let devengadaTotal = 0,
      devengadaCount = 0,
      aprobadaTotal = 0,
      aprobadaCount = 0,
      autorizadaTotal = 0,
      autorizadaCount = 0,
      dispersadaTotal = 0,
      dispersadaCount = 0;
    for (const c of filtered) {
      devengadaTotal += c.monto_comision;
      devengadaCount++;
      if (c.estado === "aprobada") {
        aprobadaTotal += c.monto_comision;
        aprobadaCount++;
      }
      if (c.estado === "autorizada") {
        autorizadaTotal += c.monto_comision;
        autorizadaCount++;
      }
      if (c.estado === "dispersada") {
        dispersadaTotal += c.monto_comision;
        dispersadaCount++;
      }
    }
    return {
      devengada: { total: devengadaTotal, count: devengadaCount },
      aprobada: { total: aprobadaTotal, count: aprobadaCount },
      autorizada: { total: autorizadaTotal, count: autorizadaCount },
      dispersada: { total: dispersadaTotal, count: dispersadaCount },
    };
  }, [filtered]);

  const hayFiltros = !!search || estadoFilter !== "all" || rolFilter !== "all";
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${comisiones.length} comisiones`
    : `${comisiones.length} comisiones internas`;

  // KPI activo según el filtro de estado actual.
  // "Total devengadas" corresponde a estadoFilter==='all'.
  // Cualquier otro filtro deja sin KPI activo.
  const activeKpi: "total" | "aprobada" | "autorizada" | "dispersada" | null =
    estadoFilter === "all" && !search && rolFilter === "all"
      ? "total"
      : estadoFilter === "aprobada"
        ? "aprobada"
        : estadoFilter === "autorizada"
          ? "autorizada"
          : estadoFilter === "dispersada"
            ? "dispersada"
            : null;

  const limpiar = () => {
    setSearch("");
    setEstadoFilter("all");
    setRolFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Comisiones Internas"
        description="Parte variable del ingreso del equipo comercial y operativo SOZU"
      />

      {/* ─── KPIs clicables (filtran la tabla) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <ClickableKpi
          label="Total devengadas en período"
          value={fmtMxn(kpis.devengada.total)}
          hint={`${kpis.devengada.count} ${kpis.devengada.count === 1 ? "comisión" : "comisiones"}`}
          icon={Percent}
          tone="info"
          active={activeKpi === "total"}
          onClick={() => {
            setSearch("");
            setRolFilter("all");
            setEstadoFilter("all");
          }}
        />
        <ClickableKpi
          label="Pendiente autorización del Director"
          value={fmtMxn(kpis.aprobada.total)}
          hint={`${kpis.aprobada.count} ${kpis.aprobada.count === 1 ? "comisión" : "comisiones"} · cuello de botella`}
          icon={Clock}
          tone="warning"
          active={activeKpi === "aprobada"}
          onClick={() => setEstadoFilter("aprobada")}
        />
        <ClickableKpi
          label="Por dispersar (autorizadas)"
          value={fmtMxn(kpis.autorizada.total)}
          hint={`${kpis.autorizada.count} ${kpis.autorizada.count === 1 ? "comisión" : "comisiones"}`}
          icon={ShieldCheck}
          tone="primary"
          active={activeKpi === "autorizada"}
          onClick={() => setEstadoFilter("autorizada")}
        />
        <ClickableKpi
          label="Dispersadas en período"
          value={fmtMxn(kpis.dispersada.total)}
          hint={`${kpis.dispersada.count} ${kpis.dispersada.count === 1 ? "comisión" : "comisiones"}`}
          icon={Banknote}
          tone="success"
          active={activeKpi === "dispersada"}
          onClick={() => setEstadoFilter("dispersada")}
        />
      </div>

      {/* ─── Filtros ─── */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, nombre o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="devengada">Devengada</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="autorizada">Autorizada</SelectItem>
              <SelectItem value="dispersada">Dispersada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={rolFilter} onValueChange={setRolFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {rolOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hayFiltros && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* ─── Tabla ─── */}
      <Panel title="Listado" description={totalDesc}>
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando comisiones…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Error al cargar comisiones: {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {comisiones.length === 0
                ? "No hay comisiones internas activas."
                : "No se encontraron comisiones con esos criterios."}
            </p>
            {hayFiltros && (
              <Button variant="outline" size="sm" onClick={limpiar}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">No. Cuenta</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Proyecto</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs">No. Departamento</TableHead>
                  <TableHead className="text-xs text-right">Precio final</TableHead>
                  <TableHead className="text-xs text-right">Comisión Total</TableHead>
                  <TableHead className="text-xs text-right">% de comisión</TableHead>
                  <TableHead className="text-xs text-right">Comisión a dispersar</TableHead>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs text-right">Comisión</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const aprobada = c.estado === "aprobada";
                  return (
                    <TableRow
                      key={c.id_comision_interna}
                      className={cn(aprobada && "bg-amber-50/50 dark:bg-amber-950/20")}
                    >
                      <TableCell className="font-medium text-sm font-mono whitespace-nowrap">
                        COB-{c.id_cuenta_cobranza}
                      </TableCell>
                      <TableCell className="text-xs">{c.tipo}</TableCell>
                      <TableCell className="text-sm">{c.proyecto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{c.modelo_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{c.numero_departamento || "-"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {fmtMxn(c.precio_final)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {fmtMxn(c.comision_total_cuenta)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {c.porcentaje_comision.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                        {fmtMxn(c.comision_a_dispersar)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{c.comisionista_nombre}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.comisionista_rol}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">
                        {fmtMxn(c.monto_comision)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium whitespace-nowrap",
                            ESTADO_TONE[c.estado],
                          )}
                        >
                          {ESTADO_LABEL[c.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setSelected(c)}
                          aria-label={`Ver detalle de ${c.folio_comision}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* ─── Drawer unificado del Portal Alta Dirección ─── */}
      {selected && (
        <ExpedienteDrawer
          open={!!selected}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          entityType="comision_interna"
          entityId={selected.folio_comision}
          ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
        >
          <ComisionInternaContent
            entity={{
              folio: selected.folio_comision,
              comisionista_nombre: selected.comisionista_nombre,
              comisionista_rol: selected.comisionista_rol,
              comisionista_email: selected.comisionista_email,
              porcentaje_comision: selected.porcentaje_comision,
              monto: selected.monto_comision,
              fecha_devengo: selected.fecha_devengo,
              fecha_aprobacion: selected.fecha_aprobacion,
              dias_esperando_director: selected.dias_esperando_director ?? selected.dias_desde_devengo,
              estado: selected.estado,
            }}
            ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
            onClose={() => setSelected(null)}
          />
        </ExpedienteDrawer>
      )}
    </>
  );
}
