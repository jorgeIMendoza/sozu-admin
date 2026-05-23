import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  Eye,
  Receipt,
  AlertTriangle,
  Banknote,
  Check,
  ShieldAlert,
  Loader2,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { PagoExternoContent } from "@/components/admin/portal-alta-direccion/drawers/content/PagoExternoContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";
import {
  useFacturasPorPagar,
  type FacturaPorPagar,
  type TipoBeneficiario,
  type EstatusComision,
} from "@/hooks/useFacturasPorPagar";

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const TIPO_LABEL: Record<TipoBeneficiario, string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

const ESTATUS_COMISION_LABEL: Record<EstatusComision, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  pagada: "Pagada",
};

const ESTATUS_COMISION_TONE: Record<EstatusComision, string> = {
  pendiente: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  aprobada: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Antiguedad({
  dias,
  isAlertaBloqueo,
}: {
  dias: number;
  isAlertaBloqueo: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        isAlertaBloqueo ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={
        isAlertaBloqueo
          ? "Bloqueada con más de 15 días — riesgo de financiamiento involuntario"
          : undefined
      }
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionFacturasPorPagarPage() {
  const [search, setSearch] = useState("");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [estatusComisionFilter, setEstatusComisionFilter] = useState<string>("all");
  const [flagCobroFilter, setFlagCobroFilter] = useState<string>("all");
  const [selected, setSelected] = useState<FacturaPorPagar | null>(null);

  const { data: facturas = [], isLoading, error } = useFacturasPorPagar();

  const proyectoOptions = useMemo(
    () =>
      Array.from(
        new Set(facturas.map((f) => f.proyecto_nombre).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [facturas],
  );

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return facturas.filter((f) => {
      if (proyectoFilter !== "all" && f.proyecto_nombre !== proyectoFilter) return false;
      if (estatusComisionFilter !== "all" && f.estatus_comision !== estatusComisionFilter) return false;
      if (flagCobroFilter !== "all") {
        const wantCobrado = flagCobroFilter === "cobrado";
        if (!!f.ya_se_cobro_al_desarrollador !== wantCobrado) return false;
      }
      if (q) {
        const hay = [
          f.folio_cfdi,
          f.beneficiario_nombre,
          f.numero_departamento,
        ]
          .map(norm)
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, proyectoFilter, estatusComisionFilter, flagCobroFilter, facturas]);

  const kpis = useMemo(() => {
    let recibidoTotal = 0,
      recibidoCount = 0,
      pendienteTotal = 0,
      pendienteCount = 0,
      pagadoTotal = 0,
      pagadoCount = 0;
    for (const f of filtered) {
      recibidoTotal += f.monto_total;
      recibidoCount++;
      if (
        f.estado === "en_revision" ||
        f.estado === "aprobada_para_pago" ||
        f.estado === "bloqueada"
      ) {
        pendienteTotal += f.monto_total;
        pendienteCount++;
      }
      if (f.estado === "pagada") {
        pagadoTotal += f.monto_total;
        pagadoCount++;
      }
    }
    return {
      recibido: { total: recibidoTotal, count: recibidoCount },
      pendiente: { total: pendienteTotal, count: pendienteCount },
      pagado: { total: pagadoTotal, count: pagadoCount },
    };
  }, [filtered]);

  // KPI de RIESGO — siempre se computa sobre el dataset completo,
  // no se ve afectado por filtros casuales. Es un indicador no-oculto-por-error.
  const bloqueadoGlobal = useMemo(() => {
    let total = 0,
      count = 0;
    for (const f of facturas) {
      if (!f.ya_se_cobro_al_desarrollador && f.estado !== "pagada") {
        total += f.monto_total;
        count++;
      }
    }
    return { total, count };
  }, [facturas]);

  const bloqueadoEnFiltro = useMemo(
    () => filtered.filter((f) => !f.ya_se_cobro_al_desarrollador).length,
    [filtered]
  );

  const hayFiltros =
    !!search ||
    proyectoFilter !== "all" ||
    estatusComisionFilter !== "all" ||
    flagCobroFilter !== "all";
  const showGlobalHint = hayFiltros && bloqueadoEnFiltro !== bloqueadoGlobal.count;
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${facturas.length} facturas`
    : `${facturas.length} facturas de comisionistas externos`;

  const limpiar = () => {
    setSearch("");
    setProyectoFilter("all");
    setEstatusComisionFilter("all");
    setFlagCobroFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Facturas por Pagar"
        description="CFDIs recibidos por SOZU (Real Estate Ventures) de inmobiliarias y agentes externos"
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total recibido en período"
          value={fmtMxn(kpis.recibido.total)}
          hint={`${kpis.recibido.count} ${kpis.recibido.count === 1 ? "factura" : "facturas"}`}
          icon={Receipt}
          tone="info"
        />
        <Kpi
          label="Pendiente de pago"
          value={fmtMxn(kpis.pendiente.total)}
          hint={`${kpis.pendiente.count} ${kpis.pendiente.count === 1 ? "factura" : "facturas"}`}
          icon={Clock}
          tone="warning"
        />
        {/* KPI clave — bloqueado sin cobro. Card custom (no Kpi shared) porque
            necesitamos: (a) ring rojo de destaque, (b) un segundo hint cuando los
            filtros activos divergen de la métrica global. */}
        <Card
          className={cn(
            bloqueadoGlobal.count > 0 && "ring-2 ring-red-300 dark:ring-red-900/60"
          )}
        >
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Bloqueado — sin cobro a desarrollador
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground truncate">
                {fmtMxn(bloqueadoGlobal.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bloqueadoGlobal.count}{" "}
                {bloqueadoGlobal.count === 1 ? "factura" : "facturas"} en riesgo
              </p>
              {showGlobalHint && (
                <p className="mt-1 text-[10px] text-muted-foreground italic">
                  Total global · no afectado por filtros
                </p>
              )}
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-lg shrink-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </CardContent>
        </Card>
        <Kpi
          label="Pagado en período"
          value={fmtMxn(kpis.pagado.total)}
          hint={`${kpis.pagado.count} ${kpis.pagado.count === 1 ? "factura" : "facturas"}`}
          icon={Banknote}
          tone="success"
        />
      </div>

      {/* ─── Banner regla de negocio — siempre global, igual que el KPI ─── */}
      {bloqueadoGlobal.count > 0 && (
        <Card className="mb-4 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900/40">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Regla operativa:</span> SOZU no paga
              a un externo hasta haber cobrado del desarrollador correspondiente.
              {" "}
              {bloqueadoGlobal.count} {bloqueadoGlobal.count === 1 ? "factura" : "facturas"} ({fmtMxn(bloqueadoGlobal.total)})
              están sin cobro previo — pagarlas ahora sería financiamiento involuntario.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Filtros ─── */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID Cuenta, Beneficiario o No. Depto…"
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

          <Select value={estatusComisionFilter} onValueChange={setEstatusComisionFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estatus comisión</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={flagCobroFilter} onValueChange={setFlagCobroFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo flag cobro</SelectItem>
              <SelectItem value="cobrado">Cobrado</SelectItem>
              <SelectItem value="sin_cobro">Sin cobro</SelectItem>
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
                ? "No hay facturas por pagar a comisionistas externos."
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
                  <TableHead className="text-xs">Beneficiario</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Proyecto</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-xs">No. Depto</TableHead>
                  <TableHead className="text-xs">Estatus comisión</TableHead>
                  <TableHead className="text-xs">Visualizar Factura</TableHead>
                  <TableHead className="text-xs text-right">Monto total</TableHead>
                  <TableHead className="text-xs">Emisión</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs">Flag cobro</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const sinCobro = !f.ya_se_cobro_al_desarrollador;
                  const alertaBloqueo = f.estado === "bloqueada" && f.dias_desde_emision > 15;
                  return (
                    <TableRow
                      key={f.id_factura}
                      className={cn(sinCobro && "bg-amber-50/50 dark:bg-amber-950/20")}
                    >
                      <TableCell className="font-medium text-sm font-mono whitespace-nowrap">
                        {formatCuentaCobranzaId(f.id_cuenta_cobranza, f.tipo)}
                      </TableCell>
                      <TableCell className="text-sm">{f.beneficiario_nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">
                          {TIPO_LABEL[f.beneficiario_tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{f.proyecto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.modelo_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.producto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{f.numero_departamento || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              ESTATUS_COMISION_TONE[f.estatus_comision],
                            )}
                          >
                            {ESTATUS_COMISION_LABEL[f.estatus_comision]}
                          </Badge>
                          {f.estatus_comision === "pagada" && f.url_evidencia_pago && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Ver comprobante de pago"
                              onClick={() => window.open(f.url_evidencia_pago!, "_blank")}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {f.url_factura ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => window.open(f.url_factura!, "_blank")}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Ver factura
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">
                        {fmtMxn(f.monto_total)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {f.fecha_emision}
                      </TableCell>
                      <TableCell>
                        <Antiguedad dias={f.dias_desde_emision} isAlertaBloqueo={alertaBloqueo} />
                      </TableCell>
                      <TableCell>
                        {sinCobro ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 whitespace-nowrap"
                            title="No pagar antes de cobrar al desarrollador"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sin cobro
                          </Badge>
                        ) : (
                          <div>
                            <Badge
                              variant="outline"
                              className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 whitespace-nowrap"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Cobrado
                            </Badge>
                            {f.factura_cobrar_referencia && (
                              <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                                {f.factura_cobrar_referencia}
                              </p>
                            )}
                          </div>
                        )}
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
          entityType="pago_externo"
          entityId={formatCuentaCobranzaId(selected.id_cuenta_cobranza, selected.tipo)}
          ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
          hideVentaContext
        >
          <PagoExternoContent
            entity={{
              folio_cfdi: selected.folio_cfdi,
              uuid_sat: selected.uuid_sat,
              beneficiario_nombre: selected.beneficiario_nombre,
              beneficiario_rfc: selected.beneficiario_rfc,
              beneficiario_tipo: selected.beneficiario_tipo,
              monto: selected.monto_total,
              fecha_emision: selected.fecha_emision,
              dias_desde_emision: selected.dias_desde_emision,
              ya_se_cobro_al_desarrollador: selected.ya_se_cobro_al_desarrollador,
              factura_cobrar_referencia: selected.factura_cobrar_referencia,
              folio_cuenta: resolveCobFolio(selected.venta_referencia),
              url_factura_externa: selected.url_factura,
              estatus_pago: selected.estatus_pago,
              fecha_pago: selected.fecha_pago_real ?? null,
            }}
            ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
            onClose={() => setSelected(null)}
          />
        </ExpedienteDrawer>
      )}
    </>
  );
}
