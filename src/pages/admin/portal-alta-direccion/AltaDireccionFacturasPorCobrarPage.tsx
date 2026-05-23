import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  Eye,
  Receipt,
  AlertTriangle,
  Banknote,
  Loader2,
  FileText,
  ExternalLink,
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
import { Kpi, PageHeader, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { VentaParaFacturarContent } from "@/components/admin/portal-alta-direccion/drawers/content/VentaParaFacturarContent";
import { getVentaContext } from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";
import {
  useFacturasPorCobrar,
  type FacturaPorCobrar,
  type EstadoFacturaSozu,
  type EstatusPagoFactura,
} from "@/hooks/useFacturasPorCobrar";

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const FACTURA_SOZU_LABEL: Record<EstadoFacturaSozu, string> = {
  sin_generar: "Sin generar",
  draft: "Draft",
  timbrada: "Timbrada",
};

const FACTURA_SOZU_TONE: Record<EstadoFacturaSozu, string> = {
  sin_generar: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  timbrada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const ESTATUS_PAGO_LABEL: Record<EstatusPagoFactura, string> = {
  espera_autorizacion: "Espera Autorización",
  autorizada: "Autorizada",
  pagada: "Pagada",
  rechazada: "Rechazada",
};

const ESTATUS_PAGO_TONE: Record<EstatusPagoFactura, string> = {
  espera_autorizacion: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  autorizada: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rechazada: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Antiguedad({ dias, isVencida }: { dias: number; isVencida: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        isVencida ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={isVencida ? "Factura vencida (>30 días sin cobrar)" : undefined}
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionFacturasPorCobrarPage() {
  const [search, setSearch] = useState("");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [entidadDuenaFilter, setEntidadDuenaFilter] = useState<string>("all");
  const [facturaSozuFilter, setFacturaSozuFilter] = useState<string>("all");
  const [estatusPagoFilter, setEstatusPagoFilter] = useState<string>("all");
  const [selected, setSelected] = useState<FacturaPorCobrar | null>(null);

  const { data: facturas = [], isLoading, error } = useFacturasPorCobrar();

  const proyectoOptions = useMemo(
    () =>
      Array.from(
        new Set(facturas.map((f) => f.proyecto_nombre).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [facturas],
  );
  const entidadDuenaOptions = useMemo(
    () =>
      Array.from(
        new Set(facturas.map((f) => f.entidad_duena).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [facturas],
  );

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return facturas.filter((f) => {
      if (proyectoFilter !== "all" && f.proyecto_nombre !== proyectoFilter) return false;
      if (entidadDuenaFilter !== "all" && f.entidad_duena !== entidadDuenaFilter) return false;
      if (facturaSozuFilter !== "all" && f.estado_factura_sozu !== facturaSozuFilter) return false;
      if (estatusPagoFilter !== "all" && f.estatus_pago !== estatusPagoFilter) return false;
      if (q) {
        const hay = [f.folio_cfdi, f.numero_departamento].map(norm).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, proyectoFilter, entidadDuenaFilter, facturaSozuFilter, estatusPagoFilter, facturas]);

  const kpis = useMemo(() => {
    let emitidoTotal = 0,
      emitidoCount = 0,
      pendienteTotal = 0,
      pendienteCount = 0,
      vencidoTotal = 0,
      vencidoCount = 0,
      cobradoTotal = 0,
      cobradoCount = 0;
    for (const f of filtered) {
      emitidoTotal += f.monto_total;
      emitidoCount++;
      if (f.estado !== "cobrada" && f.estado !== "cancelada") {
        pendienteTotal += f.monto_total - f.monto_cobrado;
        pendienteCount++;
      }
      if (f.estado === "vencida") {
        vencidoTotal += f.monto_total - f.monto_cobrado;
        vencidoCount++;
      }
      if (f.monto_cobrado > 0) {
        cobradoTotal += f.monto_cobrado;
        cobradoCount++;
      }
    }
    return {
      emitido: { total: emitidoTotal, count: emitidoCount },
      pendiente: { total: pendienteTotal, count: pendienteCount },
      vencido: { total: vencidoTotal, count: vencidoCount },
      cobrado: { total: cobradoTotal, count: cobradoCount },
    };
  }, [filtered]);

  const hayFiltros =
    !!search ||
    proyectoFilter !== "all" ||
    entidadDuenaFilter !== "all" ||
    facturaSozuFilter !== "all" ||
    estatusPagoFilter !== "all";
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${facturas.length} facturas`
    : `${facturas.length} facturas pendientes de cobro`;

  const limpiar = () => {
    setSearch("");
    setProyectoFilter("all");
    setEntidadDuenaFilter("all");
    setFacturaSozuFilter("all");
    setEstatusPagoFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Facturas por Cobrar"
        description="Comisiones que SOZU (Real Estate Ventures) tiene por cobrar a desarrolladores"
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total emitido en período"
          value={fmtMxn(kpis.emitido.total)}
          hint={`${kpis.emitido.count} ${kpis.emitido.count === 1 ? "factura" : "facturas"}`}
          icon={Receipt}
          tone="info"
        />
        <Kpi
          label="Pendiente de cobro"
          value={fmtMxn(kpis.pendiente.total)}
          hint={`${kpis.pendiente.count} ${kpis.pendiente.count === 1 ? "factura" : "facturas"}`}
          icon={Clock}
          tone="warning"
        />
        <Kpi
          label="Vencido (>30 días)"
          value={fmtMxn(kpis.vencido.total)}
          hint={`${kpis.vencido.count} ${kpis.vencido.count === 1 ? "factura" : "facturas"}`}
          icon={AlertTriangle}
          tone="destructive"
        />
        <Kpi
          label="Cobrado en período"
          value={fmtMxn(kpis.cobrado.total)}
          hint={`${kpis.cobrado.count} ${kpis.cobrado.count === 1 ? "factura" : "facturas"} con cobro`}
          icon={Banknote}
          tone="success"
        />
      </div>

      {/* ─── Filtros ─── */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID Cuenta o No. Depto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {proyectoOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={entidadDuenaFilter} onValueChange={setEntidadDuenaFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[240px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades dueñas</SelectItem>
              {entidadDuenaOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={facturaSozuFilter} onValueChange={setFacturaSozuFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda Fact. Comisión Sozu</SelectItem>
              <SelectItem value="timbrada">Timbrada</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sin_generar">Sin generar</SelectItem>
            </SelectContent>
          </Select>

          <Select value={estatusPagoFilter} onValueChange={setEstatusPagoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estatus de pago</SelectItem>
              <SelectItem value="espera_autorizacion">Espera Autorización</SelectItem>
              <SelectItem value="autorizada">Autorizada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Error al cargar facturas: {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {facturas.length === 0
                ? "No hay facturas pendientes de cobro."
                : "No se encontraron facturas con esos criterios."}
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
                  <TableHead className="text-xs">ID Cuenta</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Proyecto</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-xs">No. Depto</TableHead>
                  <TableHead className="text-xs">Entidad Dueña</TableHead>
                  <TableHead className="text-xs text-right">Precio final</TableHead>
                  <TableHead className="text-xs text-right">Comisión</TableHead>
                  <TableHead className="text-xs text-right">IVA</TableHead>
                  <TableHead className="text-xs">Fact. Comisión Sozu</TableHead>
                  <TableHead className="text-xs">Emisión</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs">Estatus Pago</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const vencida = f.estado === "vencida";
                  return (
                    <TableRow
                      key={f.id_factura}
                      className={cn(vencida && "bg-red-50/50 dark:bg-red-950/20")}
                    >
                      <TableCell className="font-medium text-sm font-mono whitespace-nowrap">
                        {f.folio_cfdi}
                      </TableCell>
                      <TableCell className="text-xs">{f.tipo}</TableCell>
                      <TableCell className="text-sm">{f.proyecto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.modelo_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.producto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.numero_departamento || "-"}</TableCell>
                      <TableCell className="text-sm">{f.entidad_duena || "-"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {fmtMxn(f.precio_final)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        <div className="font-semibold">{fmtMxn(f.monto_comision)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          ({f.porcentaje_comision}%)
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        <div>{fmtMxn(f.iva)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {f.iva_incluido ? "Incluido" : "Sin IVA"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              FACTURA_SOZU_TONE[f.estado_factura_sozu],
                            )}
                          >
                            {FACTURA_SOZU_LABEL[f.estado_factura_sozu]}
                          </Badge>
                          {f.url_factura_comision && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Ver factura"
                              onClick={() => window.open(f.url_factura_comision!, "_blank")}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                          {f.url_factura_xml_comision && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Descargar XML"
                              onClick={() => window.open(f.url_factura_xml_comision!, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {f.fecha_emision}
                      </TableCell>
                      <TableCell>
                        <Antiguedad dias={f.dias_desde_emision} isVencida={vencida} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium whitespace-nowrap",
                            ESTATUS_PAGO_TONE[f.estatus_pago],
                          )}
                          title={
                            f.estatus_pago === "pagada" && f.fecha_pago_comision
                              ? `Pago recibido el ${f.fecha_pago_comision}`
                              : undefined
                          }
                        >
                          {ESTATUS_PAGO_LABEL[f.estatus_pago]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setSelected(f)}
                          aria-label={`Ver detalle de ${f.folio_cfdi}`}
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
          entityType="venta_para_facturar"
          entityId={selected.folio_cfdi}
          ventaContext={getVentaContext(selected.folio_cfdi)}
          hideVentaContext
        >
          <VentaParaFacturarContent
            entity={{
              folio_cuenta: selected.folio_cfdi,
              fecha_venta: selected.fecha_emision,
              dias_esperando: selected.dias_desde_emision,
              monto_factura_desarrollador: selected.monto_total,
              comprador_principal: "",
              rfc_comprador: "",
              desarrollador_nombre: selected.desarrollador_nombre,
            }}
            ventaContext={getVentaContext(selected.folio_cfdi)}
            onClose={() => setSelected(null)}
          />
        </ExpedienteDrawer>
      )}
    </>
  );
}
