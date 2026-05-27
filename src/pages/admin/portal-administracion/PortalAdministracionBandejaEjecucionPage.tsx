import { useMemo, useRef, useState } from "react";
import {
  Receipt,
  FileOutput,
  HandCoins,
  Users,
  Clock,
  Eye,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/portal-administracion/ui";
import { fmtMxn } from "@/data/administracion/mockData";
import { cn } from "@/lib/utils";
import { EjecucionDrawer } from "@/components/admin/portal-administracion/drawers/EjecucionDrawer";
import { EjecucionCobroExpedienteContent } from "@/components/admin/portal-administracion/drawers/content/EjecucionCobroExpedienteContent";
import {
  EjecucionPagoExternoContent,
  type EjecucionPagoExternoEntity,
} from "@/components/admin/portal-administracion/drawers/content/EjecucionPagoExternoContent";
import { EjecucionDispersionExpedienteContent } from "@/components/admin/portal-administracion/drawers/content/EjecucionDispersionExpedienteContent";
import { EjecucionFacturaSozuContent } from "@/components/admin/portal-administracion/drawers/content/EjecucionFacturaSozuContent";
import {
  useFacturasComisionSozuPorGenerar,
  type FacturaComisionSozuPorGenerar,
} from "@/hooks/useFacturasComisionSozuPorGenerar";
import {
  useDispersionesInternasPendientes,
  type DispersionInternaPendiente,
} from "@/hooks/useDispersionesInternasPendientes";
import {
  useCobrosPorGestionar,
  type CobroPorGestionar,
} from "@/hooks/useCobrosPorGestionar";
import {
  useComisionesExternas,
  type ComisionExterna,
  type TipoBeneficiarioComExt,
} from "@/hooks/useComisionesExternas";

/* ──────────────────────────────────────────────────────────
   Tipos extendidos para filas (entity + extras de tabla)
   ────────────────────────────────────────────────────────── */

type SelectedItem =
  | { tipo: "factura_sozu"; data: FacturaComisionSozuPorGenerar }
  | { tipo: "cobro"; data: CobroPorGestionar }
  | { tipo: "pago_externo"; data: ComisionExterna }
  | { tipo: "dispersion_interna"; data: DispersionInternaPendiente };

/* ──────────────────────────────────────────────────────────
   Helpers visuales (Antigüedad, Sort, Pagination)
   ────────────────────────────────────────────────────────── */

const PAGE_SIZE = 50;
type SortDir = "asc" | "desc";

function Antiguedad({ dias, umbral }: { dias: number; umbral: number }) {
  const danger = dias > umbral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        danger
          ? "text-red-600 font-semibold dark:text-red-400"
          : "text-muted-foreground",
      )}
      title={danger ? `Supera el umbral de ${umbral} días` : undefined}
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

const ESTATUS_COBRO_TONE: Record<CobroPorGestionar["estatus"], string> = {
  "Por Autorizar":
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  Autorizado:
    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  Declinado:
    "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
};

const BENEFICIARIO_TIPO_LABEL: Record<TipoBeneficiarioComExt, string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

const padCcId = (id: number) => String(id).padStart(6, "0");

const formatCuentaFolio = (c: ComisionExterna) =>
  c.tipo === "Producto" || c.tipo === "Servicio"
    ? `CCP-${padCcId(c.id_cuenta_cobranza)}`
    : `CC-${padCcId(c.id_cuenta_cobranza)}`;

function SortToggle({
  value,
  onChange,
}: {
  value: SortDir;
  onChange: (v: SortDir) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortDir)}>
      <SelectTrigger className="h-7 w-[200px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="asc">Más antiguas primero</SelectItem>
        <SelectItem value="desc">Más recientes primero</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalCount === 0) return null;
  const from = totalCount === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(totalCount, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-end gap-2 mt-3 text-xs">
      <span className="tabular-nums text-muted-foreground mr-2">
        {from}–{to} de {totalCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page === 0}
        onClick={() => onPageChange(Math.max(0, page - 1))}
      >
        <ChevronLeft className="h-3.5 w-3.5 mr-1" />
        Anterior
      </Button>
      <span className="tabular-nums text-muted-foreground">
        Página <span className="font-semibold text-foreground">{page + 1}</span> de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
      >
        Siguiente
        <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   KPI card (clickeable, scrollea a sección)
   ────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  count,
  amountLabel,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  count: number | string;
  amountLabel: string;
  icon: typeof FileOutput;
  tone: "teal" | "emerald" | "amber" | "blue" | "orange";
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, { bg: string; ring: string; iconBg: string; iconText: string }> = {
    teal: {
      bg: "bg-teal-50 dark:bg-teal-950/30",
      ring: "ring-teal-200 dark:ring-teal-900/40 hover:ring-teal-300",
      iconBg: "bg-teal-100 dark:bg-teal-900/50",
      iconText: "text-teal-700 dark:text-teal-300",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      ring: "ring-emerald-200 dark:ring-emerald-900/40 hover:ring-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconText: "text-emerald-700 dark:text-emerald-300",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      ring: "ring-amber-200 dark:ring-amber-900/40 hover:ring-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconText: "text-amber-700 dark:text-amber-300",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      ring: "ring-blue-200 dark:ring-blue-900/40 hover:ring-blue-300",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconText: "text-blue-700 dark:text-blue-300",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      ring: "ring-orange-200 dark:ring-orange-900/40 hover:ring-orange-300",
      iconBg: "bg-orange-100 dark:bg-orange-900/50",
      iconText: "text-orange-700 dark:text-orange-300",
    },
  };
  const c = toneClasses[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ir a sección ${label}`}
      className={cn(
        "group text-left rounded-xl p-4 ring-1 transition-all duration-150",
        c.bg,
        c.ring,
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{count}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{amountLabel}</p>
        </div>
        <span className={cn("grid h-10 w-10 place-items-center rounded-lg shrink-0", c.iconBg, c.iconText)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Ver detalle <ArrowDown className="h-3 w-3" />
      </p>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  description,
  count,
  right,
}: {
  icon: typeof FileOutput;
  iconColor: string;
  title: string;
  description: string;
  count: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", iconColor)}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="ml-1">
          {count}
        </Badge>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <p className="mt-1 ml-10 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function PortalAdministracionBandejaEjecucionPage() {
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const facturasSozuRef = useRef<HTMLDivElement>(null);
  const cobrosRef = useRef<HTMLDivElement>(null);
  const externosRef = useRef<HTMLDivElement>(null);
  const dispersionesRef = useRef<HTMLDivElement>(null);

  // BD real: facturas comisión SOZU por generar
  const {
    data: facturasSozu,
    isLoading: facturasSozuLoading,
    error: facturasSozuError,
  } = useFacturasComisionSozuPorGenerar();

  // BD real: dispersiones internas pendientes (comisionistas autorizados,
  // todavía no pagados, agrupados por cuenta_cobranza).
  const {
    data: dispersionesInternas,
    isLoading: dispersionesInternasLoading,
    error: dispersionesInternasError,
  } = useDispersionesInternasPendientes();

  // BD real: cobros por gestionar (cuentas con factura SOZU timbrada,
  // pendientes/autorizadas/declinadas para cobro al desarrollador).
  const {
    data: cobros,
    isLoading: cobrosLoading,
    error: cobrosError,
  } = useCobrosPorGestionar();

  // BD real: pagos a externos por ejecutar — comisionistas externos autorizados
  // (estado='aprobada' o 'facturada') y todavía no pagados.
  const {
    data: comisionesExternasAll,
    isLoading: externosLoading,
    error: externosError,
  } = useComisionesExternas();

  const [sortFacturasSozu, setSortFacturasSozu] = useState<SortDir>("desc"); // más recientes primero (default por spec)
  const [pageFacturasSozu, setPageFacturasSozu] = useState(0);
  const [sortCobros, setSortCobros] = useState<SortDir>("asc");
  const [pageCobros, setPageCobros] = useState(0);
  const [sortExternos, setSortExternos] = useState<SortDir>("asc");
  const [pageExternos, setPageExternos] = useState(0);
  const [sortDispersiones, setSortDispersiones] = useState<SortDir>("asc");
  const [pageDispersiones, setPageDispersiones] = useState(0);

  const sortBy = <T extends { dias_desde_autorizacion: number }>(rows: T[], dir: SortDir) => {
    const factor = dir === "asc" ? -1 : 1;
    return [...rows].sort(
      (a, b) => factor * (a.dias_desde_autorizacion - b.dias_desde_autorizacion),
    );
  };

  // Facturas SOZU: orden por fecha_compra (más recientes/antiguas).
  // Cuando fecha_compra es null (raro pero posible) queda al final en asc/desc.
  const facturasSozuSorted = useMemo(() => {
    const rows = facturasSozu ?? [];
    return [...rows].sort((a, b) => {
      const da = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
      const db = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
      return sortFacturasSozu === "asc" ? da - db : db - da;
    });
  }, [facturasSozu, sortFacturasSozu]);
  const facturasSozuTotal = facturasSozu?.length ?? 0;
  const facturasSozuTotalPages = Math.max(1, Math.ceil(facturasSozuTotal / PAGE_SIZE));
  const facturasSozuPage = useMemo(
    () => facturasSozuSorted.slice(pageFacturasSozu * PAGE_SIZE, (pageFacturasSozu + 1) * PAGE_SIZE),
    [facturasSozuSorted, pageFacturasSozu],
  );
  const facturasSozuMonto = useMemo(
    () => (facturasSozu ?? []).reduce((s, r) => s + r.monto_comision, 0),
    [facturasSozu],
  );

  // Cobros: orden por fecha_compra (igual que Facturas SOZU / Dispersiones).
  const cobrosSorted = useMemo(() => {
    const rows = cobros ?? [];
    return [...rows].sort((a, b) => {
      const da = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
      const db = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
      return sortCobros === "asc" ? da - db : db - da;
    });
  }, [cobros, sortCobros]);
  const cobrosTotal = cobros?.length ?? 0;
  const cobrosTotalPages = Math.max(1, Math.ceil(cobrosTotal / PAGE_SIZE));
  const cobrosMonto = useMemo(
    () => (cobros ?? []).reduce((s, r) => s + r.monto_factura, 0),
    [cobros],
  );

  // Pagos externos por ejecutar — filtrados a autorizados (aprobada/facturada),
  // no pagados, ordenados por antigüedad.
  const externosFiltrados = useMemo(
    () =>
      (comisionesExternasAll ?? []).filter(
        (c) => c.estado === "aprobada" || c.estado === "facturada",
      ),
    [comisionesExternasAll],
  );
  const externosSorted = useMemo(() => {
    const factor = sortExternos === "asc" ? -1 : 1;
    return [...externosFiltrados].sort(
      (a, b) => factor * (a.dias_desde_devengo - b.dias_desde_devengo),
    );
  }, [externosFiltrados, sortExternos]);
  const externosTotal = externosFiltrados.length;
  const externosTotalPages = Math.max(1, Math.ceil(externosTotal / PAGE_SIZE));
  const externosMonto = useMemo(
    () => externosFiltrados.reduce((s, r) => s + r.monto_comision, 0),
    [externosFiltrados],
  );

  // Dispersiones internas: orden por fecha_compra (igual que Facturas SOZU).
  const dispersionesInternasSorted = useMemo(() => {
    const rows = dispersionesInternas ?? [];
    return [...rows].sort((a, b) => {
      const da = a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0;
      const db = b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0;
      return sortDispersiones === "asc" ? da - db : db - da;
    });
  }, [dispersionesInternas, sortDispersiones]);
  const dispersionesInternasTotal = dispersionesInternas?.length ?? 0;
  const dispersionesInternasTotalPages = Math.max(
    1,
    Math.ceil(dispersionesInternasTotal / PAGE_SIZE),
  );
  const dispersionesInternasMonto = useMemo(
    () => (dispersionesInternas ?? []).reduce((s, r) => s + r.monto_a_dispersar, 0),
    [dispersionesInternas],
  );

  const paginate = <T,>(rows: T[], page: number) =>
    rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const cobrosPage = paginate(cobrosSorted, pageCobros);
  const externosPage = paginate(externosSorted, pageExternos);
  const dispersionesInternasPage = paginate(dispersionesInternasSorted, pageDispersiones);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        title="Bandeja de Ejecución"
        description="Operaciones autorizadas por Dirección · pendientes de ejecutar"
        action={<Badge variant="outline">Datos demo</Badge>}
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Facturas SOZU por generar"
          count={facturasSozuLoading ? "…" : facturasSozuTotal}
          amountLabel={
            facturasSozuLoading
              ? "Cargando…"
              : facturasSozuError
                ? "Error al cargar"
                : fmtMxn(facturasSozuMonto)
          }
          icon={Receipt}
          tone="teal"
          onClick={() => scrollTo(facturasSozuRef)}
        />
        <KpiCard
          label="Cobros por gestionar"
          count={cobrosLoading ? "…" : cobrosTotal}
          amountLabel={
            cobrosLoading
              ? "Cargando…"
              : cobrosError
                ? "Error al cargar"
                : fmtMxn(cobrosMonto)
          }
          icon={FileOutput}
          tone="emerald"
          onClick={() => scrollTo(cobrosRef)}
        />
        <KpiCard
          label="Pagos a externos por ejecutar"
          count={externosLoading ? "…" : externosTotal}
          amountLabel={
            externosLoading
              ? "Cargando…"
              : externosError
                ? "Error al cargar"
                : fmtMxn(externosMonto)
          }
          icon={HandCoins}
          tone="amber"
          onClick={() => scrollTo(externosRef)}
        />
        <KpiCard
          label="Dispersiones internas pendientes"
          count={dispersionesInternasLoading ? "…" : dispersionesInternasTotal}
          amountLabel={
            dispersionesInternasLoading
              ? "Cargando…"
              : dispersionesInternasError
                ? "Error al cargar"
                : fmtMxn(dispersionesInternasMonto)
          }
          icon={Users}
          tone="blue"
          onClick={() => scrollTo(dispersionesRef)}
        />
      </div>

      {/* ─── 0. Facturas Comisión SOZU por Generar (BD real) ─── */}
      <section ref={facturasSozuRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Receipt}
          iconColor="bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"
          title="Facturas Comisión SOZU por Generar"
          description="Cuentas de cobranza con estatus Vendida sin factura SOZU emitida. Requieren generación de CFDI para iniciar cobranza al desarrollador."
          count={facturasSozuTotal}
          right={
            <SortToggle
              value={sortFacturasSozu}
              onChange={(v) => {
                setSortFacturasSozu(v);
                setPageFacturasSozu(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {facturasSozuLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas comisión SOZU…
              </div>
            ) : facturasSozuError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(facturasSozuError as Error).message}
              </div>
            ) : facturasSozuPage.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay facturas SOZU pendientes de generar.
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
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs">No. Depa</TableHead>
                      <TableHead className="text-xs">Entidad Dueña</TableHead>
                      <TableHead className="text-xs">STP de Comisión</TableHead>
                      <TableHead className="text-xs text-right">Precio final</TableHead>
                      <TableHead className="text-xs text-right">% Comisión</TableHead>
                      <TableHead className="text-xs text-right">Comisión</TableHead>
                      <TableHead className="text-xs text-right">Fact. Comisión SOZU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturasSozuPage.map((f) => {
                      // STP completa — se usa como referencia en procesos posteriores
                      // (rastreo de SPEI, conciliación STP). No enmascarar.
                      const stpFull = f.cuenta_stp_comisiones ?? null;
                      return (
                        <TableRow key={f.id_cuenta_cobranza}>
                          <TableCell className="text-xs font-mono whitespace-nowrap font-medium">
                            {f.folio_cuenta}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                              {f.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{f.proyecto_nombre || "—"}</TableCell>
                          <TableCell className="text-sm">{f.modelo_nombre || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {f.producto_nombre || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{f.numero_departamento || "—"}</TableCell>
                          <TableCell className="text-xs">{f.entidad_duena || "—"}</TableCell>
                          <TableCell className="text-xs font-mono whitespace-nowrap">
                            {stpFull || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                            {fmtMxn(f.precio_final)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {f.porcentaje_comision_venta.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-sm text-right font-semibold tabular-nums">
                            {fmtMxn(f.monto_comision)}
                            {f.iva_incluido && (
                              <span className="block text-[9px] text-muted-foreground font-normal">
                                IVA incluido
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {f.estado_factura === "draft" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40 whitespace-nowrap"
                                >
                                  Draft
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setSelected({ tipo: "factura_sozu", data: f })}
                                aria-label={
                                  f.estado_factura === "draft"
                                    ? `Validar draft factura SOZU ${f.folio_cuenta}`
                                    : `Generar factura SOZU para ${f.folio_cuenta}`
                                }
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                {f.estado_factura === "draft" ? "Validar" : "Generar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageFacturasSozu}
          totalPages={facturasSozuTotalPages}
          totalCount={facturasSozuTotal}
          pageSize={PAGE_SIZE}
          onPageChange={setPageFacturasSozu}
        />
      </section>

      {/* ─── 1. Cobros por gestionar ─── */}
      <section ref={cobrosRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={FileOutput}
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          title="Cobros por gestionar"
          description="Cuentas con factura SOZU timbrada — esperando autorización del Director o ya autorizadas/declinadas"
          count={cobrosTotal}
          right={
            <SortToggle
              value={sortCobros}
              onChange={(v) => {
                setSortCobros(v);
                setPageCobros(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {cobrosLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando cobros…
              </div>
            ) : cobrosError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(cobrosError as Error).message}
              </div>
            ) : cobrosPage.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Sin cobros pendientes de gestión.
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
                      <TableHead className="text-xs">No. Depa</TableHead>
                      <TableHead className="text-xs">Entidad Dueña</TableHead>
                      <TableHead className="text-xs">Comprador</TableHead>
                      <TableHead className="text-xs text-right">Precio final</TableHead>
                      <TableHead className="text-xs text-right">Monto factura</TableHead>
                      <TableHead className="text-xs">Fecha Antigüedad</TableHead>
                      <TableHead className="text-xs">Estatus</TableHead>
                      <TableHead className="text-xs text-right">Factura</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobrosPage.map((c) => (
                      <TableRow key={c.id_cuenta_cobranza}>
                        <TableCell className="font-medium text-xs font-mono whitespace-nowrap">
                          {c.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {c.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.proyecto_nombre || "—"}</TableCell>
                        <TableCell className="text-sm">{c.modelo_nombre || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.producto_nombre || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{c.numero_departamento || "—"}</TableCell>
                        <TableCell className="text-xs">{c.entidad_duena || "—"}</TableCell>
                        <TableCell className="text-xs">{c.comprador_nombre || "—"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                          {fmtMxn(c.precio_final)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold tabular-nums">
                          {fmtMxn(c.monto_factura)}
                          {c.iva_incluido && (
                            <span className="block text-[9px] text-muted-foreground font-normal">
                              IVA incluido
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {c.fecha_compra || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ESTATUS_COBRO_TONE[c.estatus]}>
                            {c.estatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.url_factura_pdf ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => window.open(c.url_factura_pdf!, "_blank")}
                              aria-label={`Ver factura ${c.folio_cuenta}`}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" /> Ver PDF
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelected({ tipo: "cobro", data: c })}
                            aria-label={`Ejecutar cobro ${c.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Ejecutar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageCobros}
          totalPages={cobrosTotalPages}
          totalCount={cobrosTotal}
          pageSize={PAGE_SIZE}
          onPageChange={setPageCobros}
        />
      </section>

      {/* ─── 2. Pagos a externos por ejecutar ─── */}
      <section ref={externosRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={HandCoins}
          iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          title="Pagos a externos por ejecutar"
          description="Comisiones a inmobiliarias, brokers, aliados y agentes externos — autorizadas por Dirección y pendientes de pago"
          count={externosTotal}
          right={
            <SortToggle
              value={sortExternos}
              onChange={(v) => {
                setSortExternos(v);
                setPageExternos(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {externosLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando pagos a externos…
              </div>
            ) : externosError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(externosError as Error).message}
              </div>
            ) : externosPage.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay pagos a externos pendientes de ejecutar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Nombre comisionista</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">% Comisión</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                      <TableHead className="text-xs">Antigüedad</TableHead>
                      <TableHead className="text-xs">Flag cobro</TableHead>
                      <TableHead className="text-xs text-right">Factura</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {externosPage.map((p) => {
                      const puedePagar = p.ya_se_cobro_al_desarrollador;
                      return (
                        <TableRow key={p.id_comisionista}>
                          <TableCell className="font-medium text-xs font-mono whitespace-nowrap">
                            {formatCuentaFolio(p)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{p.beneficiario_nombre}</div>
                            {p.beneficiario_rfc && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {p.beneficiario_rfc}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                              {BENEFICIARIO_TIPO_LABEL[p.beneficiario_tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {p.porcentaje_comision.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-sm text-right font-semibold tabular-nums">
                            {fmtMxn(p.monto_comision)}
                          </TableCell>
                          <TableCell>
                            <Antiguedad dias={p.dias_desde_devengo} umbral={5} />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] whitespace-nowrap",
                                p.ya_se_cobro_al_desarrollador
                                  ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/40"
                                  : "border-red-400 text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950/40",
                              )}
                              title={
                                p.ya_se_cobro_al_desarrollador
                                  ? "Cobro al desarrollador confirmado — pago habilitado"
                                  : "Aún no se cobra al desarrollador — pago bloqueado"
                              }
                            >
                              {p.ya_se_cobro_al_desarrollador ? "Cobrado" : "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.url_factura ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => window.open(p.url_factura!, "_blank")}
                                aria-label={`Ver factura ${p.folio_comision}`}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" /> Ver PDF
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              disabled={!puedePagar}
                              onClick={() => setSelected({ tipo: "pago_externo", data: p })}
                              aria-label={`Ejecutar pago ${p.folio_comision}`}
                              title={
                                puedePagar
                                  ? "Ejecutar pago a externo"
                                  : "Bloqueado: aún no se cobra al desarrollador"
                              }
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Ejecutar pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageExternos}
          totalPages={externosTotalPages}
          totalCount={externosTotal}
          pageSize={PAGE_SIZE}
          onPageChange={setPageExternos}
        />
      </section>

      {/* ─── 3. Dispersiones internas pendientes ─── */}
      <section ref={dispersionesRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Users}
          iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          title="Dispersiones internas pendientes"
          description="Cuentas con comisiones internas autorizadas por Dirección — listas para dispersar al equipo SOZU"
          count={dispersionesInternasTotal}
          right={
            <SortToggle
              value={sortDispersiones}
              onChange={(v) => {
                setSortDispersiones(v);
                setPageDispersiones(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {dispersionesInternasLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando dispersiones internas…
              </div>
            ) : dispersionesInternasError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(dispersionesInternasError as Error).message}
              </div>
            ) : dispersionesInternasPage.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay dispersiones internas pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ID Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Proyecto</TableHead>
                      <TableHead className="text-xs">Edificio</TableHead>
                      <TableHead className="text-xs">Modelo</TableHead>
                      <TableHead className="text-xs">No. Departamento</TableHead>
                      <TableHead className="text-xs text-right">Precio final</TableHead>
                      <TableHead className="text-xs text-right">Comisión a dispersar</TableHead>
                      <TableHead className="text-xs">Fecha Antigüedad</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispersionesInternasPage.map((d) => (
                      <TableRow key={d.id_cuenta_cobranza}>
                        <TableCell className="font-medium text-xs font-mono whitespace-nowrap">
                          {d.folio_cuenta}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {d.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{d.proyecto_nombre || "—"}</TableCell>
                        <TableCell className="text-sm">{d.edificio_nombre || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {d.tipo === "Propiedad"
                            ? d.modelo_nombre || "—"
                            : d.producto_nombre || d.modelo_nombre || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{d.numero_departamento || "—"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                          {fmtMxn(d.precio_final)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold tabular-nums">
                          {fmtMxn(d.monto_a_dispersar)}
                          {d.iva_incluido && (
                            <span className="block text-[9px] text-muted-foreground font-normal">
                              IVA incluido
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {d.fecha_compra || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelected({ tipo: "dispersion_interna", data: d })}
                            aria-label={`Ejecutar dispersión ${d.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Ejecutar dispersión
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageDispersiones}
          totalPages={dispersionesInternasTotalPages}
          totalCount={dispersionesInternasTotal}
          pageSize={PAGE_SIZE}
          onPageChange={setPageDispersiones}
        />
      </section>

      {/* ─── Drawer ─── */}
      {selected && (() => {
        const close = () => setSelected(null);
        const open = !!selected;
        const onOpenChange = (o: boolean) => {
          if (!o) close();
        };

        if (selected.tipo === "factura_sozu") {
          const f = selected.data;
          // No usamos ventaContexts: la BD real ya provee proyecto/cliente/precio reales.
          const vctx = {
            folio: f.folio_cuenta,
            propiedad: [f.proyecto_nombre, f.modelo_nombre, f.numero_departamento ? `Depto ${f.numero_departamento}` : null]
              .filter(Boolean)
              .join(" · ") || "—",
            cliente: f.cliente_nombre || "—",
            cliente_rfc: f.cliente_rfc ?? undefined,
            precio_venta: f.precio_final,
            comision_total_sozu: f.monto_comision,
            porcentaje_comision: f.porcentaje_comision_venta,
            estado_venta: "Vendida" as const,
            dias_desde_apartado: 0,
          };
          return (
            <EjecucionDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="ejecucion_factura_sozu"
              entityId={f.folio_cuenta}
              ventaContext={vctx}
            >
              <EjecucionFacturaSozuContent entity={f} onClose={close} />
            </EjecucionDrawer>
          );
        }

        if (selected.tipo === "cobro") {
          const c = selected.data;
          const diasDesdeCompra = c.fecha_compra
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(c.fecha_compra).getTime()) / 86_400_000,
                ),
              )
            : 0;
          const propiedadLabel =
            [c.proyecto_nombre, c.modelo_nombre, c.numero_departamento ? `Depto ${c.numero_departamento}` : null]
              .filter(Boolean)
              .join(" · ") || "—";
          const vctx = {
            folio: c.folio_cuenta,
            propiedad: propiedadLabel,
            cliente: c.comprador_nombre || "—",
            cliente_rfc: c.cliente_rfc ?? undefined,
            precio_venta: c.precio_final,
            comision_total_sozu: c.monto_factura,
            porcentaje_comision: c.porcentaje_comision_venta,
            estado_venta: "Vendida" as const,
            dias_desde_apartado: diasDesdeCompra,
          };
          return (
            <EjecucionDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="ejecucion_cobro"
              entityId={c.folio_cuenta}
              ventaContext={vctx}
            >
              <EjecucionCobroExpedienteContent entity={c} onClose={close} />
            </EjecucionDrawer>
          );
        }

        if (selected.tipo === "pago_externo") {
          const p = selected.data;
          const pagoEntity: EjecucionPagoExternoEntity = {
            folio: p.folio_comision,
            beneficiario_nombre: p.beneficiario_nombre,
            beneficiario_tipo:
              p.beneficiario_tipo === "inmobiliaria"
                ? "Inmobiliaria"
                : p.beneficiario_tipo === "broker"
                  ? "Broker"
                  : p.beneficiario_tipo === "aliado_comercial"
                    ? "Aliado comercial"
                    : "Agente externo",
            venta_ref: formatCuentaFolio(p),
            monto: p.monto_comision,
            clabe_destino: "—",
            dias_desde_autorizacion: p.dias_desde_devengo,
          };
          const propiedadLabel =
            [p.proyecto_nombre, p.modelo_nombre, p.numero_departamento ? `Depto ${p.numero_departamento}` : null]
              .filter(Boolean)
              .join(" · ") || "—";
          const vctx = {
            folio: formatCuentaFolio(p),
            propiedad: propiedadLabel,
            cliente: p.beneficiario_nombre,
            precio_venta: p.precio_final,
            comision_total_sozu: p.monto_comision,
            porcentaje_comision: p.porcentaje_comision,
            estado_venta: "Vendida" as const,
            dias_desde_apartado: p.dias_desde_devengo,
          };
          return (
            <EjecucionDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="ejecucion_pago_externo"
              entityId={p.folio_comision}
              ventaContext={vctx}
            >
              <EjecucionPagoExternoContent entity={pagoEntity} onClose={close} />
            </EjecucionDrawer>
          );
        }

        if (selected.tipo === "dispersion_interna") {
          const d = selected.data;
          const diasDesdeCompra = d.fecha_compra
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(d.fecha_compra).getTime()) / 86_400_000,
                ),
              )
            : 0;
          const vctx = {
            folio: d.folio_cuenta,
            propiedad:
              [d.proyecto_nombre, d.modelo_nombre, d.numero_departamento ? `Depto ${d.numero_departamento}` : null]
                .filter(Boolean)
                .join(" · ") || "—",
            cliente: "—",
            precio_venta: d.precio_final,
            comision_total_sozu: d.monto_a_dispersar,
            porcentaje_comision: 0,
            estado_venta: "Vendida" as const,
            dias_desde_apartado: diasDesdeCompra,
          };
          return (
            <EjecucionDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="ejecucion_dispersion"
              entityId={d.folio_cuenta}
              ventaContext={vctx}
            >
              <EjecucionDispersionExpedienteContent
                entity={{ folio_cuenta: d.folio_cuenta, id_cuenta_cobranza: d.id_cuenta_cobranza }}
                onClose={close}
              />
            </EjecucionDrawer>
          );
        }

        return null;
      })()}
    </>
  );
}
