import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  Eye,
  Receipt,
  AlertTriangle,
  Banknote,
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
import { FacturaPorCobrarContent } from "@/components/admin/portal-alta-direccion/drawers/content/FacturaPorCobrarContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";

/* ──────────────────────────────────────────────────────────
   Tipo
   ────────────────────────────────────────────────────────── */

type EstadoCobro =
  | "timbrada_pendiente"
  | "cobro_parcial"
  | "cobrada"
  | "vencida"
  | "cancelada";

type FacturaPorCobrar = {
  id_factura: number;
  folio_cfdi: string;
  uuid_sat: string;
  desarrollador_nombre: string;
  desarrollador_rfc: string;
  venta_referencia: string;
  id_cuenta_cobranza: number;
  concepto: string;
  monto_subtotal: number;
  iva: number;
  monto_total: number;
  fecha_emision: string;
  fecha_pago_esperada: string;
  fecha_pago_real?: string;
  monto_cobrado: number;
  estado: EstadoCobro;
  dias_desde_emision: number;
  dias_para_vencer: number;
};

/* ──────────────────────────────────────────────────────────
   Mock data — referencia hoy = 2026-05-14
   IVA 16%: subtotal = total / 1.16  (redondeo a 2 decimales)
   ────────────────────────────────────────────────────────── */

const FACTURAS: FacturaPorCobrar[] = [
  {
    id_factura: 7041,
    folio_cfdi: "F-S2026-0041",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000041",
    desarrollador_nombre: "Grupo Daiku Desarrollos SA de CV",
    desarrollador_rfc: "GDD250318AB7",
    venta_referencia: "COB-1041 · Daiku A-201",
    id_cuenta_cobranza: 1041,
    concepto: "Comisión por intermediación 5% — Venta Daiku A-201",
    monto_subtotal: 81465.52,
    iva: 13034.48,
    monto_total: 94500.0,
    fecha_emision: "2026-05-06",
    fecha_pago_esperada: "2026-06-05",
    monto_cobrado: 0,
    estado: "timbrada_pendiente",
    dias_desde_emision: 8,
    dias_para_vencer: 22,
  },
  {
    id_factura: 7042,
    folio_cfdi: "F-S2026-0042",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000042",
    desarrollador_nombre: "Grupo Bottura SA de CV",
    desarrollador_rfc: "GBO230112XK4",
    venta_referencia: "COB-1042 · Bottura PH-3",
    id_cuenta_cobranza: 1042,
    concepto: "Comisión por intermediación 5% — Venta Bottura PH-3",
    monto_subtotal: 103448.28,
    iva: 16551.72,
    monto_total: 120000.0,
    fecha_emision: "2026-05-10",
    fecha_pago_esperada: "2026-06-09",
    monto_cobrado: 0,
    estado: "timbrada_pendiente",
    dias_desde_emision: 4,
    dias_para_vencer: 26,
  },
  {
    id_factura: 7038,
    folio_cfdi: "F-S2026-0038",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000038",
    desarrollador_nombre: "Grupo Daiku Desarrollos SA de CV",
    desarrollador_rfc: "GDD250318AB7",
    venta_referencia: "COB-1038 · Daiku C-302",
    id_cuenta_cobranza: 1038,
    concepto: "Comisión por intermediación 5% — Venta Daiku C-302",
    monto_subtotal: 65948.28,
    iva: 10551.72,
    monto_total: 76500.0,
    fecha_emision: "2026-04-30",
    fecha_pago_esperada: "2026-05-30",
    fecha_pago_real: "2026-05-08",
    monto_cobrado: 76500.0,
    estado: "cobrada",
    dias_desde_emision: 14,
    dias_para_vencer: 16,
  },
  {
    id_factura: 7033,
    folio_cfdi: "F-S2026-0033",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000033",
    desarrollador_nombre: "Constructora Monócolo SA de CV",
    desarrollador_rfc: "CMO240805RW8",
    venta_referencia: "COB-1033 · Monócolo A-7",
    id_cuenta_cobranza: 1033,
    concepto: "Comisión por intermediación 5% — Venta Monócolo A-7",
    monto_subtotal: 50000.0,
    iva: 8000.0,
    monto_total: 58000.0,
    fecha_emision: "2026-03-28",
    fecha_pago_esperada: "2026-04-27",
    monto_cobrado: 0,
    estado: "vencida",
    dias_desde_emision: 47,
    dias_para_vencer: -17,
  },
  {
    id_factura: 7040,
    folio_cfdi: "F-S2026-0040",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000040",
    desarrollador_nombre: "Grupo Bottura SA de CV",
    desarrollador_rfc: "GBO230112XK4",
    venta_referencia: "COB-1037 · Bottura PH-1",
    id_cuenta_cobranza: 1037,
    concepto: "Comisión por intermediación 5% — Venta Bottura PH-1",
    monto_subtotal: 116379.31,
    iva: 18620.69,
    monto_total: 135000.0,
    fecha_emision: "2026-04-26",
    fecha_pago_esperada: "2026-05-26",
    monto_cobrado: 80000.0,
    estado: "cobro_parcial",
    dias_desde_emision: 18,
    dias_para_vencer: 12,
  },
  {
    id_factura: 7039,
    folio_cfdi: "F-S2026-0039",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000039",
    desarrollador_nombre: "Constructora Monócolo SA de CV",
    desarrollador_rfc: "CMO240805RW8",
    venta_referencia: "COB-1029 · Monócolo C-12",
    id_cuenta_cobranza: 1029,
    concepto: "Comisión por intermediación 5% — Venta Monócolo C-12",
    monto_subtotal: 36206.9,
    iva: 5793.1,
    monto_total: 42000.0,
    fecha_emision: "2026-04-20",
    fecha_pago_esperada: "2026-05-20",
    fecha_pago_real: "2026-05-02",
    monto_cobrado: 42000.0,
    estado: "cobrada",
    dias_desde_emision: 24,
    dias_para_vencer: 6,
  },
  {
    id_factura: 7044,
    folio_cfdi: "F-S2026-0044",
    uuid_sat: "A1B2C3D4-E5F6-7890-ABCD-000000000044",
    desarrollador_nombre: "Grupo Daiku Desarrollos SA de CV",
    desarrollador_rfc: "GDD250318AB7",
    venta_referencia: "COB-1026 · Daiku A-104",
    id_cuenta_cobranza: 1026,
    concepto: "Comisión por intermediación 5% — Venta Daiku A-104",
    monto_subtotal: 75862.07,
    iva: 12137.93,
    monto_total: 88000.0,
    fecha_emision: "2026-04-08",
    fecha_pago_esperada: "2026-05-08",
    monto_cobrado: 0,
    estado: "vencida",
    dias_desde_emision: 36,
    dias_para_vencer: -6,
  },
];

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const ESTADO_LABEL: Record<EstadoCobro, string> = {
  timbrada_pendiente: "Timbrada pendiente",
  cobro_parcial: "Cobro parcial",
  cobrada: "Cobrada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const ESTADO_TONE: Record<EstadoCobro, string> = {
  timbrada_pendiente: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cobro_parcial: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cobrada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  vencida: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

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
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [desarrolladorFilter, setDesarrolladorFilter] = useState<string>("all");
  const [selected, setSelected] = useState<FacturaPorCobrar | null>(null);

  const desarrolladoresOptions = useMemo(
    () =>
      Array.from(new Set(FACTURAS.map((f) => f.desarrollador_nombre))).sort((a, b) =>
        a.localeCompare(b)
      ),
    []
  );

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return FACTURAS.filter((f) => {
      if (estadoFilter !== "all" && f.estado !== estadoFilter) return false;
      if (desarrolladorFilter !== "all" && f.desarrollador_nombre !== desarrolladorFilter)
        return false;
      if (q) {
        const hay = [f.folio_cfdi, f.desarrollador_nombre, f.venta_referencia].map(norm).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, estadoFilter, desarrolladorFilter]);

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

  const hayFiltros = !!search || estadoFilter !== "all" || desarrolladorFilter !== "all";
  const totalDesc = hayFiltros
    ? `${filtered.length} de ${FACTURAS.length} facturas`
    : `${FACTURAS.length} facturas en el período`;

  const limpiar = () => {
    setSearch("");
    setEstadoFilter("all");
    setDesarrolladorFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Facturas por Cobrar"
        description="CFDIs emitidos por SOZU a desarrolladores por servicios de intermediación"
        action={<DemoBadge />}
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
            placeholder="Buscar por folio CFDI o desarrollador…"
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
              <SelectItem value="timbrada_pendiente">Timbrada pendiente</SelectItem>
              <SelectItem value="cobro_parcial">Cobro parcial</SelectItem>
              <SelectItem value="cobrada">Cobrada</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={desarrolladorFilter} onValueChange={setDesarrolladorFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[280px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los desarrolladores</SelectItem>
              {desarrolladoresOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
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
                <TableHead className="text-xs">Folio CFDI</TableHead>
                <TableHead className="text-xs">Desarrollador</TableHead>
                <TableHead className="text-xs">Venta ref</TableHead>
                <TableHead className="text-xs text-right">Monto total</TableHead>
                <TableHead className="text-xs">Emisión</TableHead>
                <TableHead className="text-xs">Antigüedad</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
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
                    <TableCell className="font-medium text-sm font-mono">{f.folio_cfdi}</TableCell>
                    <TableCell className="text-sm">{f.desarrollador_nombre}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.venta_referencia}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      <div>{fmtMxn(f.monto_total)}</div>
                      {f.estado === "cobro_parcial" && (
                        <div className="text-[10px] font-normal text-amber-700 dark:text-amber-300">
                          Cobrado: {fmtMxn(f.monto_cobrado)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {f.fecha_emision}
                    </TableCell>
                    <TableCell>
                      <Antiguedad dias={f.dias_desde_emision} isVencida={vencida} />
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] font-medium", ESTADO_TONE[f.estado])} variant="outline">
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
          entityType="factura_por_cobrar"
          entityId={selected.folio_cfdi}
          ventaContext={getVentaContext(resolveCobFolio(selected.venta_referencia))}
        >
          <FacturaPorCobrarContent
            entity={{
              folio_cfdi: selected.folio_cfdi,
              uuid_sat: selected.uuid_sat,
              desarrollador_nombre: selected.desarrollador_nombre,
              desarrollador_rfc: selected.desarrollador_rfc,
              concepto: selected.concepto,
              monto_subtotal: selected.monto_subtotal,
              iva: selected.iva,
              monto_total: selected.monto_total,
              monto_cobrado: selected.monto_cobrado,
              fecha_emision: selected.fecha_emision,
              fecha_pago_esperada: selected.fecha_pago_esperada,
              fecha_pago_real: selected.fecha_pago_real,
              dias_desde_emision: selected.dias_desde_emision,
              dias_para_vencer: selected.dias_para_vencer,
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
