import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  Eye,
  Percent,
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
import { Kpi, PageHeader, Panel } from "@/components/admin/portal-administracion/ui";
import { fmtMxn } from "@/data/administracion/mockData";
import { cn } from "@/lib/utils";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { ExpedienteDrawer } from "@/components/admin/portal-administracion/drawers/ExpedienteDrawer";
import { PagoExternoContent } from "@/components/admin/portal-administracion/drawers/content/PagoExternoContent";
import { useNavigate } from "react-router-dom";
import { getVentaContext } from "@/components/admin/portal-administracion/drawers/ventaContexts";
import {
  useComisionesExternas,
  type ComisionExterna,
  type EstadoComisionExterna as EstadoComisionExt,
  type TipoBeneficiarioComExt as TipoBeneficiario,
} from "@/hooks/useComisionesExternas";

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const ESTADO_LABEL: Record<EstadoComisionExt, string> = {
  devengada: "Devengada",
  aprobada: "Aprobada",
  facturada: "Facturada",
  pagada: "Pagada",
  cancelada: "Cancelada",
};

const ESTADO_TONE: Record<EstadoComisionExt, string> = {
  devengada: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  aprobada: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  facturada: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const TIPO_LABEL: Record<TipoBeneficiario, string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Antiguedad({
  dias,
  isAlerta,
}: {
  dias: number;
  isAlerta: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        isAlerta ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={
        isAlerta
          ? "Comisión devengada/aprobada con más de 15 días — atención"
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

export default function AdministracionComisionesExternasPage() {
  const [search, setSearch] = useState("");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [estadoPagoFilter, setEstadoPagoFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ComisionExterna | null>(null);
  const navigate = useNavigate();

  const { data: comisiones = [], isLoading, error } = useComisionesExternas();

  const proyectoOptions = useMemo(
    () =>
      Array.from(
        new Set(comisiones.map((c) => c.proyecto_nombre).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [comisiones],
  );

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return comisiones.filter((c) => {
      if (proyectoFilter !== "all" && c.proyecto_nombre !== proyectoFilter) return false;
      if (tipoFilter !== "all" && c.beneficiario_tipo !== tipoFilter) return false;
      if (estadoPagoFilter !== "all" && c.estado !== estadoPagoFilter) return false;
      if (q) {
        const idCuenta = formatCuentaCobranzaId(c.id_cuenta_cobranza, c.tipo);
        const hay = [idCuenta, c.beneficiario_nombre, c.numero_departamento]
          .map(norm)
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, proyectoFilter, tipoFilter, estadoPagoFilter, comisiones]);

  const kpis = useMemo(() => {
    let devengadaTotal = 0,
      devengadaCount = 0,
      pendienteApTotal = 0,
      pendienteApCount = 0,
      pagadaTotal = 0,
      pagadaCount = 0;
    for (const c of filtered) {
      devengadaTotal += c.monto_comision;
      devengadaCount++;
      if (c.estado === "devengada") {
        pendienteApTotal += c.monto_comision;
        pendienteApCount++;
      }
      if (c.estado === "pagada") {
        pagadaTotal += c.monto_comision;
        pagadaCount++;
      }
    }
    return {
      devengada: { total: devengadaTotal, count: devengadaCount },
      pendienteAp: { total: pendienteApTotal, count: pendienteApCount },
      pagada: { total: pagadaTotal, count: pagadaCount },
    };
  }, [filtered]);

  // KPI de RIESGO — global sobre el dataset cargado (no afectado por filtros)
  const bloqueadoGlobal = useMemo(() => {
    let total = 0,
      count = 0;
    for (const c of comisiones) {
      if (!c.ya_se_cobro_al_desarrollador && c.estado !== "pagada") {
        total += c.monto_comision;
        count++;
      }
    }
    return { total, count };
  }, [comisiones]);

  const bloqueadoEnFiltro = useMemo(
    () => filtered.filter((c) => !c.ya_se_cobro_al_desarrollador).length,
    [filtered]
  );

  const hayFiltros =
    !!search ||
    proyectoFilter !== "all" ||
    tipoFilter !== "all" ||
    estadoPagoFilter !== "all";
  const showGlobalHint = hayFiltros && bloqueadoEnFiltro !== bloqueadoGlobal.count;
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${comisiones.length} comisiones`
    : `${comisiones.length} comisiones externas`;

  const limpiar = () => {
    setSearch("");
    setProyectoFilter("all");
    setTipoFilter("all");
    setEstadoPagoFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Comisiones Externas"
        description="Obligaciones con inmobiliarias y agentes externos que SOZU debe pagar"
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total devengadas en período"
          value={fmtMxn(kpis.devengada.total)}
          hint={`${kpis.devengada.count} ${kpis.devengada.count === 1 ? "comisión" : "comisiones"}`}
          icon={Percent}
          tone="info"
        />
        <Kpi
          label="Pendientes de aprobación"
          value={fmtMxn(kpis.pendienteAp.total)}
          hint={`${kpis.pendienteAp.count} ${kpis.pendienteAp.count === 1 ? "comisión" : "comisiones"}`}
          icon={Clock}
          tone="warning"
        />
        {/* KPI clave — bloqueadas sin cobro a desarrollador. Card custom para
            permitir hint extra cuando filtros activos divergen del global. */}
        <Card
          className={cn(
            bloqueadoGlobal.count > 0 && "ring-2 ring-red-300 dark:ring-red-900/60"
          )}
        >
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Bloqueadas — sin cobro a desarrollador
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground truncate">
                {fmtMxn(bloqueadoGlobal.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bloqueadoGlobal.count}{" "}
                {bloqueadoGlobal.count === 1 ? "comisión" : "comisiones"} en riesgo
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
          label="Pagadas en período"
          value={fmtMxn(kpis.pagada.total)}
          hint={`${kpis.pagada.count} ${kpis.pagada.count === 1 ? "comisión" : "comisiones"}`}
          icon={Banknote}
          tone="success"
        />
      </div>

      {/* ─── Banner regla de negocio ─── */}
      {bloqueadoGlobal.count > 0 && (
        <Card className="mb-4 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900/40">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Regla operativa:</span> SOZU no paga
              una comisión externa hasta haber cobrado del desarrollador
              correspondiente.{" "}
              {bloqueadoGlobal.count}{" "}
              {bloqueadoGlobal.count === 1 ? "comisión" : "comisiones"} ({fmtMxn(bloqueadoGlobal.total)})
              están sin cobro previo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Filtros ─── */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID Cuenta, Beneficiario o Depto…"
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

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
              <SelectItem value="broker">Broker</SelectItem>
              <SelectItem value="aliado_comercial">Aliado comercial</SelectItem>
              <SelectItem value="agente_externo">Agente externo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={estadoPagoFilter} onValueChange={setEstadoPagoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados de pago</SelectItem>
              <SelectItem value="devengada">Devengada</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="facturada">Facturada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
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
                ? "No hay comisiones externas activas."
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
                  <TableHead className="text-xs">ID Cuenta</TableHead>
                  <TableHead className="text-xs">Beneficiario</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Proyecto</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs">Depto</TableHead>
                  <TableHead className="text-xs text-right">Precio Final</TableHead>
                  <TableHead className="text-xs text-right">Comisión</TableHead>
                  <TableHead className="text-xs text-right">% Comisión</TableHead>
                  <TableHead className="text-xs">Devengada</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs">Flag cobro</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Factura</TableHead>
                  <TableHead className="text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const sinCobro = !c.ya_se_cobro_al_desarrollador;
                  const alerta =
                    c.dias_desde_devengo > 15 &&
                    (c.estado === "devengada" || c.estado === "aprobada");
                  return (
                    <TableRow
                      key={c.id_comisionista}
                      className={cn(sinCobro && "bg-amber-50/50 dark:bg-amber-950/20")}
                    >
                      <TableCell className="font-medium text-sm font-mono whitespace-nowrap">
                        {formatCuentaCobranzaId(c.id_cuenta_cobranza, c.tipo)}
                      </TableCell>
                      <TableCell className="text-sm">{c.beneficiario_nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">
                          {TIPO_LABEL[c.beneficiario_tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{c.proyecto_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{c.modelo_nombre || "-"}</TableCell>
                      <TableCell className="text-sm">{c.numero_departamento || "-"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        {fmtMxn(c.precio_final)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">
                        {fmtMxn(c.monto_comision)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {c.porcentaje_comision.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {c.fecha_devengo}
                      </TableCell>
                      <TableCell>
                        <Antiguedad dias={c.dias_desde_devengo} isAlerta={alerta} />
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
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 whitespace-nowrap"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Cobrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium whitespace-nowrap", ESTADO_TONE[c.estado])}
                          >
                            {ESTADO_LABEL[c.estado]}
                          </Badge>
                          {c.estado === "pagada" && c.url_evidencia_pago && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Ver comprobante de pago"
                              onClick={() => window.open(c.url_evidencia_pago!, "_blank")}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.url_factura ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] px-2"
                            title="Ver factura del comisionista"
                            onClick={() => window.open(c.url_factura!, "_blank")}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Ver PDF
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Sin factura</span>
                        )}
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

      {/* ─── Drawer Pago externo (reusado para consulta de comisión) ─── */}
      {selected && (() => {
        const folioCuenta = formatCuentaCobranzaId(
          selected.id_cuenta_cobranza,
          selected.tipo,
        );
        // Mapear el estado de comisión externa → estatus de pago homologado
        let estatusPago:
          | "espera_autorizacion"
          | "autorizada"
          | "pagada"
          | "rechazada";
        if (selected.estado === "pagada") estatusPago = "pagada";
        else if (selected.estado === "cancelada") estatusPago = "rechazada";
        else if (selected.estado === "facturada" || selected.estado === "aprobada")
          estatusPago = "autorizada";
        else estatusPago = "espera_autorizacion";

        const requiereValidacion =
          estatusPago === "espera_autorizacion" || estatusPago === "autorizada";

        return (
          <ExpedienteDrawer
            open={!!selected}
            onOpenChange={(open) => { if (!open) setSelected(null); }}
            entityType="pago_externo"
            entityId={folioCuenta}
            ventaContext={getVentaContext(folioCuenta)}
            hideVentaContext
          >
            <PagoExternoContent
              entity={{
                folio_cfdi: folioCuenta,
                beneficiario_nombre: selected.beneficiario_nombre,
                beneficiario_rfc: selected.beneficiario_rfc,
                beneficiario_tipo: selected.beneficiario_tipo,
                monto: selected.monto_comision,
                fecha_emision: selected.fecha_devengo,
                dias_desde_emision: selected.dias_desde_devengo,
                ya_se_cobro_al_desarrollador: selected.ya_se_cobro_al_desarrollador,
                factura_cobrar_referencia: selected.factura_referencia,
                folio_cuenta: folioCuenta,
                url_factura_externa: selected.url_factura ?? null,
                estatus_pago: estatusPago,
                fecha_pago: selected.fecha_pago ?? null,
              }}
              ventaContext={getVentaContext(folioCuenta)}
              onClose={() => setSelected(null)}
              readOnly
              ctaButton={
                requiereValidacion
                  ? {
                      label: "Ir a Bandeja de Validaciones",
                      onClick: () => {
                        setSelected(null);
                        navigate(
                          `/admin/portal-administracion/bandeja#${encodeURIComponent(
                            folioCuenta,
                          )}`,
                        );
                      },
                    }
                  : undefined
              }
            />
          </ExpedienteDrawer>
        );
      })()}
    </>
  );
}
