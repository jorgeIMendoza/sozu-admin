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
import { Kpi, PageHeader, Panel, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { ComisionExternaContent } from "@/components/admin/portal-alta-direccion/drawers/content/ComisionExternaContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";

/* ──────────────────────────────────────────────────────────
   Tipo
   ────────────────────────────────────────────────────────── */

type EstadoComisionExt =
  | "devengada"
  | "aprobada"
  | "facturada"
  | "pagada"
  | "cancelada";

type TipoBeneficiario =
  | "inmobiliaria"
  | "broker"
  | "aliado_comercial"
  | "agente_externo";

type ComisionExterna = {
  id_comisionista: number;
  folio_comision: string;
  beneficiario_nombre: string;
  beneficiario_rfc: string;
  beneficiario_tipo: TipoBeneficiario;
  id_cuenta_cobranza: number;
  venta_referencia: string;
  porcentaje_comision: number;
  monto_comision: number;
  estado: EstadoComisionExt;
  fecha_devengo: string;
  fecha_aprobacion?: string;
  factura_referencia?: string;
  fecha_pago?: string;
  dias_desde_devengo: number;
  ya_se_cobro_al_desarrollador: boolean;
};

/* ──────────────────────────────────────────────────────────
   Mock data — armonizado con Facturas Por Pagar
   Referencia: hoy = 2026-05-14
   ────────────────────────────────────────────────────────── */

const COMISIONES: ComisionExterna[] = [
  // COB-1041 VENTA reconocida 2026-05-06 (hace 8 días).
  {
    id_comisionista: 9041,
    folio_comision: "COM-EXT-1041",
    beneficiario_nombre: "Inmobiliaria Vértice SA de CV",
    beneficiario_rfc: "IVE220915MNL",
    beneficiario_tipo: "inmobiliaria",
    id_cuenta_cobranza: 1041,
    venta_referencia: "COB-1041 · Daiku A-201",
    porcentaje_comision: 2.0,
    monto_comision: 37800.0,
    estado: "devengada",
    fecha_devengo: "2026-05-06",
    factura_referencia: "F-V-1184",
    dias_desde_devengo: 8,
    ya_se_cobro_al_desarrollador: false,
  },
  // COB-1042 VENTA reconocida 2026-05-08 (hace 6 días).
  {
    id_comisionista: 9042,
    folio_comision: "COM-EXT-1042",
    beneficiario_nombre: "Broker Capital MX SA de CV",
    beneficiario_rfc: "BCM231120QR2",
    beneficiario_tipo: "broker",
    id_cuenta_cobranza: 1042,
    venta_referencia: "COB-1042 · Bottura PH-3",
    porcentaje_comision: 2.25,
    monto_comision: 54000.0,
    estado: "devengada",
    fecha_devengo: "2026-05-08",
    factura_referencia: "F-MX-3382",
    dias_desde_devengo: 6,
    ya_se_cobro_al_desarrollador: false,
  },
  // Reemplazo de COM-EXT-1043 (la venta COB-1043 no es Vendida aún).
  // Venta previa Daiku B-308 (COB-1036), precio $2,100,000.
  {
    id_comisionista: 9036,
    folio_comision: "COM-EXT-1036",
    beneficiario_nombre: "Premier Brokers MX",
    beneficiario_rfc: "PBM230807UK1",
    beneficiario_tipo: "broker",
    id_cuenta_cobranza: 1036,
    venta_referencia: "COB-1036 · Daiku B-308 (venta previa)",
    porcentaje_comision: 1.78,
    monto_comision: 37380.0, // 1.78% × 2,100,000
    estado: "pagada",
    fecha_devengo: "2026-04-16",
    fecha_aprobacion: "2026-04-19",
    factura_referencia: "F-PM-2218",
    fecha_pago: "2026-05-02",
    dias_desde_devengo: 28,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_comisionista: 9038,
    folio_comision: "COM-EXT-1038",
    beneficiario_nombre: "Carlos Mendoza Ávalos",
    beneficiario_rfc: "MEAC820315LZ4",
    beneficiario_tipo: "agente_externo",
    id_cuenta_cobranza: 1038,
    venta_referencia: "COB-1038 · Daiku C-302",
    porcentaje_comision: 2.0,
    monto_comision: 30600.0,
    estado: "facturada",
    fecha_devengo: "2026-04-26",
    fecha_aprobacion: "2026-04-28",
    factura_referencia: "F-CM-7711",
    dias_desde_devengo: 18,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_comisionista: 9037,
    folio_comision: "COM-EXT-1037",
    beneficiario_nombre: "Premier Brokers MX",
    beneficiario_rfc: "PBM230807UK1",
    beneficiario_tipo: "broker",
    id_cuenta_cobranza: 1037,
    venta_referencia: "COB-1037 · Bottura PH-1",
    porcentaje_comision: 1.78,
    monto_comision: 48000.0,
    estado: "pagada",
    fecha_devengo: "2026-04-14",
    fecha_aprobacion: "2026-04-17",
    factura_referencia: "F-PR-2204",
    fecha_pago: "2026-05-05",
    dias_desde_devengo: 30,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_comisionista: 9034,
    folio_comision: "COM-EXT-1034",
    beneficiario_nombre: "Inmobiliaria Vértice SA de CV",
    beneficiario_rfc: "IVE220915MNL",
    beneficiario_tipo: "inmobiliaria",
    id_cuenta_cobranza: 1024,
    venta_referencia: "COB-1024 · Daiku B-308 (venta previa)",
    porcentaje_comision: 2.0,
    monto_comision: 42000.0,
    estado: "pagada",
    fecha_devengo: "2026-03-30",
    fecha_aprobacion: "2026-04-02",
    factura_referencia: "F-VX-4421",
    fecha_pago: "2026-05-10",
    dias_desde_devengo: 45,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_comisionista: 9029,
    folio_comision: "COM-EXT-1029",
    beneficiario_nombre: "Red Tropical Bienes Raíces",
    beneficiario_rfc: "RTB210605VW8",
    beneficiario_tipo: "aliado_comercial",
    id_cuenta_cobranza: 1022,
    venta_referencia: "COB-1022 · Monócolo D-3 (venta previa)",
    porcentaje_comision: 2.25,
    monto_comision: 19000.0,
    estado: "aprobada",
    fecha_devengo: "2026-04-22",
    fecha_aprobacion: "2026-04-25",
    factura_referencia: "F-RT-8810",
    dias_desde_devengo: 22,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_comisionista: 9023,
    folio_comision: "COM-EXT-1023",
    beneficiario_nombre: "Oficina Macro Inmobiliaria SA",
    beneficiario_rfc: "OMI220411FH3",
    beneficiario_tipo: "inmobiliaria",
    id_cuenta_cobranza: 1019,
    venta_referencia: "COB-1019 · Bottura PH-5 (venta previa)",
    porcentaje_comision: 2.0,
    monto_comision: 33000.0,
    estado: "cancelada",
    fecha_devengo: "2026-03-30",
    fecha_aprobacion: "2026-04-03",
    factura_referencia: "F-OM-1130",
    dias_desde_devengo: 45,
    ya_se_cobro_al_desarrollador: true,
  },
];

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

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

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

export default function AltaDireccionComisionesExternasPage() {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ComisionExterna | null>(null);

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return COMISIONES.filter((c) => {
      if (estadoFilter !== "all" && c.estado !== estadoFilter) return false;
      if (tipoFilter !== "all" && c.beneficiario_tipo !== tipoFilter) return false;
      if (q) {
        const hay = [c.folio_comision, c.beneficiario_nombre, c.venta_referencia]
          .map(norm)
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, estadoFilter, tipoFilter]);

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

  // KPI de RIESGO — siempre global, no se ve afectado por filtros casuales
  const bloqueadoGlobal = useMemo(() => {
    let total = 0,
      count = 0;
    for (const c of COMISIONES) {
      if (!c.ya_se_cobro_al_desarrollador) {
        total += c.monto_comision;
        count++;
      }
    }
    return { total, count };
  }, []);

  const bloqueadoEnFiltro = useMemo(
    () => filtered.filter((c) => !c.ya_se_cobro_al_desarrollador).length,
    [filtered]
  );

  const hayFiltros = !!search || estadoFilter !== "all" || tipoFilter !== "all";
  const showGlobalHint = hayFiltros && bloqueadoEnFiltro !== bloqueadoGlobal.count;
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${COMISIONES.length} comisiones`
    : `${COMISIONES.length} comisiones en el período`;

  const limpiar = () => {
    setSearch("");
    setEstadoFilter("all");
    setTipoFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Comisiones Externas"
        description="Obligaciones con agentes externos, inmobiliarias, brokers y aliados comerciales"
        action={<DemoBadge />}
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
            placeholder="Buscar por folio o beneficiario…"
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
              <SelectItem value="facturada">Facturada</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
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

          {hayFiltros && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* ─── Tabla ─── */}
      <Panel title="Listado" description={totalDesc}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No se encontraron comisiones con esos criterios.
            </p>
            <Button variant="outline" size="sm" onClick={limpiar}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Folio</TableHead>
                <TableHead className="text-xs">Beneficiario</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Venta ref</TableHead>
                <TableHead className="text-xs text-right">%</TableHead>
                <TableHead className="text-xs text-right">Monto</TableHead>
                <TableHead className="text-xs">Devengada</TableHead>
                <TableHead className="text-xs">Antigüedad</TableHead>
                <TableHead className="text-xs">Flag cobro</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
                <TableHead className="text-xs text-right">Acción</TableHead>
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
                    <TableCell className="font-medium text-sm font-mono">
                      {c.folio_comision}
                    </TableCell>
                    <TableCell className="text-sm">{c.beneficiario_nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {TIPO_LABEL[c.beneficiario_tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.venta_referencia}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {c.porcentaje_comision.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      {fmtMxn(c.monto_comision)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {c.fecha_devengo}
                    </TableCell>
                    <TableCell>
                      <Antiguedad dias={c.dias_desde_devengo} isAlerta={alerta} />
                    </TableCell>
                    <TableCell>
                      {sinCobro ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                          title="No pagar antes de cobrar al desarrollador"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Sin cobro
                        </Badge>
                      ) : (
                        <div>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Cobrado
                          </Badge>
                          {c.factura_referencia && (
                            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                              {c.factura_referencia}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium", ESTADO_TONE[c.estado])}
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
        )}
      </Panel>

      {/* ─── Drawer unificado del Portal Alta Dirección ─── */}
      {selected && (
        <ExpedienteDrawer
          open={!!selected}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          entityType="comision_externa"
          entityId={selected.folio_comision}
          ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
        >
          <ComisionExternaContent
            entity={{
              folio: selected.folio_comision,
              beneficiario_nombre: selected.beneficiario_nombre,
              beneficiario_rfc: selected.beneficiario_rfc,
              beneficiario_tipo: selected.beneficiario_tipo,
              porcentaje_comision: selected.porcentaje_comision,
              monto: selected.monto_comision,
              fecha_devengo: selected.fecha_devengo,
              fecha_aprobacion: selected.fecha_aprobacion,
              fecha_pago: selected.fecha_pago,
              dias_desde_devengo: selected.dias_desde_devengo,
              factura_referencia: selected.factura_referencia,
              ya_se_cobro_al_desarrollador: selected.ya_se_cobro_al_desarrollador,
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
