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
import { PagoExternoContent } from "@/components/admin/portal-alta-direccion/drawers/content/PagoExternoContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";

/* ──────────────────────────────────────────────────────────
   Tipo
   ────────────────────────────────────────────────────────── */

type EstadoPago =
  | "en_revision"
  | "aprobada_para_pago"
  | "pagada"
  | "bloqueada"
  | "rechazada";

type TipoBeneficiario =
  | "inmobiliaria"
  | "broker"
  | "aliado_comercial"
  | "agente_externo";

type FacturaPorPagar = {
  id_factura: number;
  folio_cfdi: string;
  uuid_sat: string;
  beneficiario_nombre: string;
  beneficiario_rfc: string;
  beneficiario_tipo: TipoBeneficiario;
  venta_referencia: string;
  id_cuenta_cobranza: number;
  concepto: string;
  monto_subtotal: number;
  iva: number;
  monto_total: number;
  fecha_emision: string;
  fecha_pago_real?: string;
  estado: EstadoPago;
  dias_desde_emision: number;
  ya_se_cobro_al_desarrollador: boolean;
  factura_cobrar_referencia?: string;
};

/* ──────────────────────────────────────────────────────────
   Mock data — referencia hoy = 2026-05-14
   IVA 16%: subtotal = total / 1.16
   ────────────────────────────────────────────────────────── */

const FACTURAS: FacturaPorPagar[] = [
  {
    id_factura: 8101,
    folio_cfdi: "F-V-1184",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000001184",
    beneficiario_nombre: "Inmobiliaria Vértice SA de CV",
    beneficiario_rfc: "IVE220915MNL",
    beneficiario_tipo: "inmobiliaria",
    venta_referencia: "COB-1041 · Daiku A-201",
    id_cuenta_cobranza: 1041,
    concepto: "Comisión venta inmobiliaria — Daiku A-201 (3% sobre venta)",
    monto_subtotal: 32586.21,
    iva: 5213.79,
    monto_total: 37800.0,
    fecha_emision: "2026-05-08",
    estado: "bloqueada",
    dias_desde_emision: 6,
    ya_se_cobro_al_desarrollador: false,
  },
  {
    id_factura: 8102,
    folio_cfdi: "F-MX-3382",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000003382",
    beneficiario_nombre: "Broker Capital MX SA de CV",
    beneficiario_rfc: "BCM231120QR2",
    beneficiario_tipo: "broker",
    venta_referencia: "COB-1042 · Bottura PH-3",
    id_cuenta_cobranza: 1042,
    concepto: "Comisión venta broker — Bottura PH-3",
    monto_subtotal: 46551.72,
    iva: 7448.28,
    monto_total: 54000.0,
    fecha_emision: "2026-05-09",
    estado: "bloqueada",
    dias_desde_emision: 5,
    ya_se_cobro_al_desarrollador: false,
  },
  // Reemplazo de F-AL-0991 (COB-1043 aún no es Vendida → no debe haber
  // factura de externo). Venta previa Daiku B-308 (COB-1036) por Premier
  // Brokers MX, $37,380. Pareada con COM-EXT-1036.
  {
    id_factura: 8103,
    folio_cfdi: "F-PM-2218",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000002218",
    beneficiario_nombre: "Premier Brokers MX",
    beneficiario_rfc: "PBM230807UK1",
    beneficiario_tipo: "broker",
    venta_referencia: "COB-1036 · Daiku B-308 (venta previa)",
    id_cuenta_cobranza: 1036,
    concepto: "Comisión broker — Daiku B-308",
    monto_subtotal: 32224.14,
    iva: 5155.86,
    monto_total: 37380.0,
    fecha_emision: "2026-05-02",
    fecha_pago_real: "2026-05-02",
    estado: "pagada",
    dias_desde_emision: 12,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_factura: 8104,
    folio_cfdi: "F-CM-7711",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000007711",
    beneficiario_nombre: "Carlos Mendoza Ávalos",
    beneficiario_rfc: "MEAC820315LZ4",
    beneficiario_tipo: "agente_externo",
    venta_referencia: "COB-1038 · Daiku C-302",
    id_cuenta_cobranza: 1038,
    concepto: "Comisión agente externo — Daiku C-302",
    monto_subtotal: 26379.31,
    iva: 4220.69,
    monto_total: 30600.0,
    fecha_emision: "2026-04-26",
    estado: "aprobada_para_pago",
    dias_desde_emision: 18,
    ya_se_cobro_al_desarrollador: true,
    factura_cobrar_referencia: "F-S2026-0038",
  },
  {
    id_factura: 8105,
    folio_cfdi: "F-PR-2204",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000002204",
    beneficiario_nombre: "Premier Brokers MX",
    beneficiario_rfc: "PBM230807UK1",
    beneficiario_tipo: "broker",
    venta_referencia: "COB-1037 · Bottura PH-1",
    id_cuenta_cobranza: 1037,
    concepto: "Comisión broker — Bottura PH-1",
    monto_subtotal: 41379.31,
    iva: 6620.69,
    monto_total: 48000.0,
    fecha_emision: "2026-04-12",
    fecha_pago_real: "2026-05-05",
    estado: "pagada",
    dias_desde_emision: 32,
    ya_se_cobro_al_desarrollador: true,
    factura_cobrar_referencia: "F-S2026-0040 (parcial)",
  },
  {
    id_factura: 8106,
    folio_cfdi: "F-VX-4421",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000004421",
    beneficiario_nombre: "Inmobiliaria Vértice SA de CV",
    beneficiario_rfc: "IVE220915MNL",
    beneficiario_tipo: "inmobiliaria",
    venta_referencia: "COB-1024 · Daiku B-308 (venta previa)",
    id_cuenta_cobranza: 1024,
    concepto: "Comisión inmobiliaria — Daiku B-308",
    monto_subtotal: 36206.9,
    iva: 5793.1,
    monto_total: 42000.0,
    fecha_emision: "2026-04-19",
    fecha_pago_real: "2026-05-10",
    estado: "pagada",
    dias_desde_emision: 25,
    ya_se_cobro_al_desarrollador: true,
    factura_cobrar_referencia: "F-S2026-0029",
  },
  {
    id_factura: 8107,
    folio_cfdi: "F-RT-8810",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000008810",
    beneficiario_nombre: "Red Tropical Bienes Raíces",
    beneficiario_rfc: "RTB210605VW8",
    beneficiario_tipo: "aliado_comercial",
    venta_referencia: "COB-1022 · Monócolo D-3 (venta previa)",
    id_cuenta_cobranza: 1022,
    concepto: "Comisión aliado comercial — Monócolo D-3 (monto inconsistente)",
    monto_subtotal: 16379.31,
    iva: 2620.69,
    monto_total: 19000.0,
    fecha_emision: "2026-04-22",
    estado: "en_revision",
    dias_desde_emision: 22,
    ya_se_cobro_al_desarrollador: true,
    factura_cobrar_referencia: "F-S2026-0027",
  },
  {
    id_factura: 8108,
    folio_cfdi: "F-OM-1130",
    uuid_sat: "B2C3D4E5-F6A7-8901-BCDE-000000001130",
    beneficiario_nombre: "Oficina Macro Inmobiliaria SA",
    beneficiario_rfc: "OMI220411FH3",
    beneficiario_tipo: "inmobiliaria",
    venta_referencia: "COB-1019 · Bottura PH-5 (venta previa)",
    id_cuenta_cobranza: 1019,
    concepto: "Comisión inmobiliaria — Bottura PH-5 (datos fiscales incorrectos)",
    monto_subtotal: 28448.28,
    iva: 4551.72,
    monto_total: 33000.0,
    fecha_emision: "2026-03-30",
    estado: "rechazada",
    dias_desde_emision: 45,
    ya_se_cobro_al_desarrollador: true,
    factura_cobrar_referencia: "F-S2026-0023",
  },
];

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const ESTADO_LABEL: Record<EstadoPago, string> = {
  en_revision: "En revisión",
  aprobada_para_pago: "Aprobada para pago",
  pagada: "Pagada",
  bloqueada: "Bloqueada",
  rechazada: "Rechazada",
};

const ESTADO_TONE: Record<EstadoPago, string> = {
  en_revision: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  aprobada_para_pago: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  bloqueada: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  rechazada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [selected, setSelected] = useState<FacturaPorPagar | null>(null);

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return FACTURAS.filter((f) => {
      if (estadoFilter !== "all" && f.estado !== estadoFilter) return false;
      if (tipoFilter !== "all" && f.beneficiario_tipo !== tipoFilter) return false;
      if (q) {
        const hay = [f.folio_cfdi, f.beneficiario_nombre, f.venta_referencia].map(norm).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, estadoFilter, tipoFilter]);

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
    for (const f of FACTURAS) {
      if (!f.ya_se_cobro_al_desarrollador) {
        total += f.monto_total;
        count++;
      }
    }
    return { total, count };
  }, []);

  const bloqueadoEnFiltro = useMemo(
    () => filtered.filter((f) => !f.ya_se_cobro_al_desarrollador).length,
    [filtered]
  );

  const hayFiltros = !!search || estadoFilter !== "all" || tipoFilter !== "all";
  const showGlobalHint = hayFiltros && bloqueadoEnFiltro !== bloqueadoGlobal.count;
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${FACTURAS.length} facturas`
    : `${FACTURAS.length} facturas en el período`;

  const limpiar = () => {
    setSearch("");
    setEstadoFilter("all");
    setTipoFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Facturas por Pagar"
        description="CFDIs recibidos de agentes, inmobiliarias, brokers y aliados comerciales"
        action={<DemoBadge />}
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
            placeholder="Buscar por folio CFDI o beneficiario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="en_revision">En revisión</SelectItem>
              <SelectItem value="aprobada_para_pago">Aprobada para pago</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="bloqueada">Bloqueada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
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
              No se encontraron facturas con esos criterios.
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
                <TableHead className="text-xs text-right">Monto total</TableHead>
                <TableHead className="text-xs">Emisión</TableHead>
                <TableHead className="text-xs">Antigüedad</TableHead>
                <TableHead className="text-xs">Flag cobro</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
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
                    <TableCell className="font-medium text-sm font-mono">{f.folio_cfdi}</TableCell>
                    <TableCell className="text-sm">{f.beneficiario_nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {TIPO_LABEL[f.beneficiario_tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.venta_referencia}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      {fmtMxn(f.monto_total)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {f.fecha_emision}
                    </TableCell>
                    <TableCell>
                      <Antiguedad dias={f.dias_desde_emision} isAlertaBloqueo={alertaBloqueo} />
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
                            Desarrollador pagó
                          </Badge>
                          {f.factura_cobrar_referencia && (
                            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                              {f.factura_cobrar_referencia}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium", ESTADO_TONE[f.estado])}
                      >
                        {ESTADO_LABEL[f.estado]}
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
        )}
      </Panel>

      {/* ─── Drawer unificado del Portal Alta Dirección ─── */}
      {selected && (
        <ExpedienteDrawer
          open={!!selected}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          entityType="pago_externo"
          entityId={selected.folio_cfdi}
          ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
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
            }}
            ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
            onClose={() => setSelected(null)}
          />
        </ExpedienteDrawer>
      )}
    </>
  );
}
