import { useRef, useState, useMemo } from "react";
import {
  Receipt,
  CreditCard,
  Users,
  AlertTriangle,
  Clock,
  Eye,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { VentaParaFacturarContent } from "@/components/admin/portal-alta-direccion/drawers/content/VentaParaFacturarContent";
import { PagoExternoContent } from "@/components/admin/portal-alta-direccion/drawers/content/PagoExternoContent";
import { ComisionInternaContent } from "@/components/admin/portal-alta-direccion/drawers/content/ComisionInternaContent";
import { ExcepcionContent } from "@/components/admin/portal-alta-direccion/drawers/content/ExcepcionContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

type ValidacionVentaFacturar = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  proyecto: string;
  numero_propiedad: string;
  comprador_principal: string;
  rfc_comprador: string;
  monto_factura_desarrollador: number;
  fecha_venta: string;
  dias_esperando: number;
};

type ValidacionPagoExterno = {
  id_factura: number;
  folio_factura: string;
  agente_nombre: string;
  agente_tipo: "inmobiliaria" | "broker" | "aliado_comercial" | "agente_externo";
  venta_referencia: string;
  monto: number;
  fecha_emision_factura: string;
  dias_esperando: number;
  ya_se_cobro_al_desarrollador: boolean;
};

type ValidacionComisionInterna = {
  id_comisionista: number;
  folio_comision: string;
  comisionista_nombre: string;
  comisionista_rol: string;
  venta_referencia: string;
  porcentaje_comision: number;
  monto: number;
  dias_esperando: number;
};

type ValidacionExcepcion = {
  id_excepcion: number;
  tipo: "descuento_fuera_politica" | "pago_parcial_fuera_esquema" | "ajuste_manual" | "otro";
  descripcion_corta: string;
  solicitante: string;
  venta_referencia: string;
  monto_impactado: number;
  delta: number;
  dias_esperando: number;
};

type SelectedItem =
  | { tipo: "venta"; data: ValidacionVentaFacturar }
  | { tipo: "externo"; data: ValidacionPagoExterno }
  | { tipo: "interna"; data: ValidacionComisionInterna }
  | { tipo: "excepcion"; data: ValidacionExcepcion };

/* ──────────────────────────────────────────────────────────
   Mock data
   ────────────────────────────────────────────────────────── */

const VENTAS_FACTURAR: ValidacionVentaFacturar[] = [
  {
    id_cuenta_cobranza: 1041,
    folio_cuenta: "COB-1041",
    proyecto: "Daiku",
    numero_propiedad: "A-201",
    comprador_principal: "María García López",
    rfc_comprador: "GALM850712ABC",
    monto_factura_desarrollador: 135000,
    fecha_venta: "2026-05-05",
    dias_esperando: 8,
  },
  {
    id_cuenta_cobranza: 1042,
    folio_cuenta: "COB-1042",
    proyecto: "Bottura",
    numero_propiedad: "PH-3",
    comprador_principal: "Juan Pérez Silva",
    rfc_comprador: "PESJ720430XYZ",
    monto_factura_desarrollador: 108000,
    fecha_venta: "2026-05-08",
    dias_esperando: 6,
  },
  {
    id_cuenta_cobranza: 1043,
    folio_cuenta: "COB-1043",
    proyecto: "Monócolo",
    numero_propiedad: "B-1",
    comprador_principal: "Sofía Rivera Mendoza",
    rfc_comprador: "RIMS900218QWE",
    monto_factura_desarrollador: 53000,
    fecha_venta: "2026-05-11",
    dias_esperando: 3,
  },
];

const PAGOS_EXTERNOS: ValidacionPagoExterno[] = [
  {
    id_factura: 4521,
    folio_factura: "F-A4521",
    agente_nombre: "Inmobiliaria Vértice SA de CV",
    agente_tipo: "inmobiliaria",
    venta_referencia: "Daiku A-201",
    monto: 67500,
    fecha_emision_factura: "2026-05-06",
    dias_esperando: 8,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_factura: 4522,
    folio_factura: "F-A4522",
    agente_nombre: "Carlos Mendoza Ávalos",
    agente_tipo: "agente_externo",
    venta_referencia: "Bottura PH-3",
    monto: 54000,
    fecha_emision_factura: "2026-05-08",
    dias_esperando: 6,
    ya_se_cobro_al_desarrollador: true,
  },
  {
    id_factura: 4523,
    folio_factura: "F-A4523",
    agente_nombre: "Broker Capital MX",
    agente_tipo: "broker",
    venta_referencia: "Monócolo B-1",
    monto: 58000,
    fecha_emision_factura: "2026-05-09",
    dias_esperando: 5,
    ya_se_cobro_al_desarrollador: false, // ⚠️ riesgo operativo
  },
  {
    id_factura: 4524,
    folio_factura: "F-A4524",
    agente_nombre: "Aliados Inmuebles SA",
    agente_tipo: "aliado_comercial",
    venta_referencia: "Daiku C-402",
    monto: 26500,
    fecha_emision_factura: "2026-05-12",
    dias_esperando: 2,
    ya_se_cobro_al_desarrollador: true,
  },
];

const COMISIONES_INTERNAS: ValidacionComisionInterna[] = [
  {
    id_comisionista: 871,
    folio_comision: "COM-871",
    comisionista_nombre: "Roberto Hernández Solís",
    comisionista_rol: "Director Comercial",
    venta_referencia: "COB-1041 · Daiku A-201",
    porcentaje_comision: 1.5,
    monto: 28350,
    dias_esperando: 7, // > 5 → rojo
  },
  {
    id_comisionista: 872,
    folio_comision: "COM-872",
    comisionista_nombre: "Ana Patricia Ruiz",
    comisionista_rol: "Ejecutivo Senior",
    venta_referencia: "COB-1041 · Daiku A-201",
    porcentaje_comision: 1.2,
    monto: 22680,
    dias_esperando: 7, // > 5 → rojo
  },
  {
    id_comisionista: 873,
    folio_comision: "COM-873",
    comisionista_nombre: "Roberto Hernández Solís",
    comisionista_rol: "Director Comercial",
    venta_referencia: "COB-1042 · Bottura PH-3",
    porcentaje_comision: 1.5,
    monto: 36000,
    dias_esperando: 5,
  },
  {
    id_comisionista: 874,
    folio_comision: "COM-874",
    comisionista_nombre: "Diego Soto Vargas",
    comisionista_rol: "Ejecutivo",
    venta_referencia: "COB-1042 · Bottura PH-3",
    porcentaje_comision: 0.8,
    monto: 19200,
    dias_esperando: 5,
  },
  {
    id_comisionista: 875,
    folio_comision: "COM-875",
    comisionista_nombre: "Patricia Luna Olvera",
    comisionista_rol: "Ejecutiva",
    venta_referencia: "COB-1042 · Bottura PH-3",
    porcentaje_comision: 0.5,
    monto: 12000,
    dias_esperando: 5,
  },
];

const EXCEPCIONES: ValidacionExcepcion[] = [
  {
    id_excepcion: 91,
    tipo: "descuento_fuera_politica",
    descripcion_corta: "Descuento 8% solicitado vs política 5% máximo",
    solicitante: "Carlos Mendoza Ávalos",
    venta_referencia: "Daiku A-205",
    monto_impactado: 360000,
    delta: 28800, // 8% sobre 360,000
    dias_esperando: 4, // > 3 → rojo
  },
  {
    id_excepcion: 92,
    tipo: "pago_parcial_fuera_esquema",
    descripcion_corta: "5 parcialidades vs 3 del esquema estándar",
    solicitante: "Inmobiliaria Vértice SA de CV",
    venta_referencia: "Bottura PH-2",
    monto_impactado: 4200000,
    delta: 1680000, // diferencia financiera del nuevo esquema
    dias_esperando: 2,
  },
];

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

function Antiguedad({ dias, umbral }: { dias: number; umbral: number }) {
  const danger = dias > umbral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        danger ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={danger ? `Supera el umbral de ${umbral} días` : undefined}
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

const TIPO_EXTERNO_LABEL: Record<ValidacionPagoExterno["agente_tipo"], string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

const TIPO_EXCEPCION_LABEL: Record<ValidacionExcepcion["tipo"], string> = {
  descuento_fuera_politica: "Descuento fuera de política",
  pago_parcial_fuera_esquema: "Pago parcial fuera de esquema",
  ajuste_manual: "Ajuste manual",
  otro: "Otro",
};

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
  count: number;
  amountLabel: string;
  icon: typeof Receipt;
  tone: "emerald" | "amber" | "blue" | "rose";
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, { bg: string; ring: string; iconBg: string; iconText: string }> = {
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
    rose: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      ring: "ring-rose-200 dark:ring-rose-900/40 hover:ring-rose-300",
      iconBg: "bg-rose-100 dark:bg-rose-900/50",
      iconText: "text-rose-700 dark:text-rose-300",
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
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
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

/* ──────────────────────────────────────────────────────────
   Sección genérica
   ────────────────────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  count,
}: {
  icon: typeof Receipt;
  iconColor: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg", iconColor)}>
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <Badge variant="secondary" className="ml-1">
        {count}
      </Badge>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionBandejaValidacionesPage() {
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const ventasRef = useRef<HTMLDivElement>(null);
  const externosRef = useRef<HTMLDivElement>(null);
  const internasRef = useRef<HTMLDivElement>(null);
  const excepcionesRef = useRef<HTMLDivElement>(null);

  const totales = useMemo(
    () => ({
      ventas: VENTAS_FACTURAR.reduce((s, v) => s + v.monto_factura_desarrollador, 0),
      externos: PAGOS_EXTERNOS.reduce((s, p) => s + p.monto, 0),
      internas: COMISIONES_INTERNAS.reduce((s, c) => s + c.monto, 0),
    }),
    []
  );

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        title="Bandeja de Validaciones"
        description="Pendientes de decisión — Dirección General"
        action={<DemoBadge />}
      />

      {/* ─── Resumen ejecutivo ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Ventas para facturar"
          count={VENTAS_FACTURAR.length}
          amountLabel={fmtMxn(totales.ventas)}
          icon={Receipt}
          tone="emerald"
          onClick={() => scrollTo(ventasRef)}
        />
        <KpiCard
          label="Pagos a externos"
          count={PAGOS_EXTERNOS.length}
          amountLabel={fmtMxn(totales.externos)}
          icon={CreditCard}
          tone="amber"
          onClick={() => scrollTo(externosRef)}
        />
        <KpiCard
          label="Comisiones internas"
          count={COMISIONES_INTERNAS.length}
          amountLabel={fmtMxn(totales.internas)}
          icon={Users}
          tone="blue"
          onClick={() => scrollTo(internasRef)}
        />
        <KpiCard
          label="Excepciones"
          count={EXCEPCIONES.length}
          amountLabel="Requieren VoBo"
          icon={AlertTriangle}
          tone="rose"
          onClick={() => scrollTo(excepcionesRef)}
        />
      </div>

      {/* ─── 1. Ventas para facturar ─── */}
      <section ref={ventasRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Receipt}
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          title="Ventas para facturar"
          count={VENTAS_FACTURAR.length}
        />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Folio</TableHead>
                  <TableHead className="text-xs">Propiedad</TableHead>
                  <TableHead className="text-xs">Comprador</TableHead>
                  <TableHead className="text-xs">RFC</TableHead>
                  <TableHead className="text-xs text-right">Monto factura</TableHead>
                  <TableHead className="text-xs">Fecha venta</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VENTAS_FACTURAR.map((v) => (
                  <TableRow key={v.id_cuenta_cobranza}>
                    <TableCell className="font-medium text-sm">{v.folio_cuenta}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{v.proyecto}</div>
                      <div className="text-xs text-muted-foreground">{v.numero_propiedad}</div>
                    </TableCell>
                    <TableCell className="text-sm">{v.comprador_principal}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{v.rfc_comprador}</TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      {fmtMxn(v.monto_factura_desarrollador)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.fecha_venta}</TableCell>
                    <TableCell>
                      <Antiguedad dias={v.dias_esperando} umbral={7} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelected({ tipo: "venta", data: v })}
                        aria-label={`Revisar venta para facturar ${v.folio_cuenta}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ─── 2. Pagos a externos ─── */}
      <section ref={externosRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={CreditCard}
          iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          title="Pagos a externos"
          count={PAGOS_EXTERNOS.length}
        />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Folio</TableHead>
                  <TableHead className="text-xs">Beneficiario</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Venta</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                  <TableHead className="text-xs">Emisión</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs">Flag</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PAGOS_EXTERNOS.map((p) => (
                  <TableRow
                    key={p.id_factura}
                    className={cn(!p.ya_se_cobro_al_desarrollador && "bg-amber-50/50 dark:bg-amber-950/20")}
                  >
                    <TableCell className="font-medium text-sm">{p.folio_factura}</TableCell>
                    <TableCell className="text-sm">{p.agente_nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {TIPO_EXTERNO_LABEL[p.agente_tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.venta_referencia}</TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">{fmtMxn(p.monto)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.fecha_emision_factura}</TableCell>
                    <TableCell>
                      <Antiguedad dias={p.dias_esperando} umbral={7} />
                    </TableCell>
                    <TableCell>
                      {!p.ya_se_cobro_al_desarrollador && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                          title="No pagar antes de cobrar al desarrollador"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pendiente cobrar al desarrollador
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelected({ tipo: "externo", data: p })}
                        aria-label={`Revisar pago externo ${p.folio_factura}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ─── 3. Comisiones internas ─── */}
      <section ref={internasRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Users}
          iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          title="Comisiones internas"
          count={COMISIONES_INTERNAS.length}
        />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Folio</TableHead>
                  <TableHead className="text-xs">Comisionista</TableHead>
                  <TableHead className="text-xs">Rol</TableHead>
                  <TableHead className="text-xs">Venta</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMISIONES_INTERNAS.map((c) => (
                  <TableRow key={c.id_comisionista}>
                    <TableCell className="font-medium text-sm">{c.folio_comision}</TableCell>
                    <TableCell className="text-sm">{c.comisionista_nombre}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.comisionista_rol}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.venta_referencia}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{c.porcentaje_comision.toFixed(2)}%</TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">{fmtMxn(c.monto)}</TableCell>
                    <TableCell>
                      <Antiguedad dias={c.dias_esperando} umbral={5} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelected({ tipo: "interna", data: c })}
                        aria-label={`Revisar comisión interna ${c.folio_comision}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ─── 4. Excepciones ─── */}
      <section ref={excepcionesRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={AlertTriangle}
          iconColor="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
          title="Excepciones"
          count={EXCEPCIONES.length}
        />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs">Solicitante</TableHead>
                  <TableHead className="text-xs">Venta</TableHead>
                  <TableHead className="text-xs text-right">Monto impactado</TableHead>
                  <TableHead className="text-xs text-right">Delta solicitado</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EXCEPCIONES.map((e) => (
                  <TableRow key={e.id_excepcion}>
                    <TableCell className="font-medium text-sm">#{e.id_excepcion}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {TIPO_EXCEPCION_LABEL[e.tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[260px]">{e.descripcion_corta}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.solicitante}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.venta_referencia}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                      {fmtMxn(e.monto_impactado)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                      {fmtMxn(e.delta)}
                    </TableCell>
                    <TableCell>
                      <Antiguedad dias={e.dias_esperando} umbral={3} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelected({ tipo: "excepcion", data: e })}
                        aria-label={`Revisar excepción #${e.id_excepcion}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ─── Drawer unificado del Portal Alta Dirección ─── */}
      {selected && (() => {
        const close = () => setSelected(null);
        const open = !!selected;
        const onOpenChange = (o: boolean) => { if (!o) close(); };

        if (selected.tipo === "venta") {
          const v = selected.data;
          const vctx = getVentaContext(v.folio_cuenta);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="venta_para_facturar"
              entityId={v.folio_cuenta}
              ventaContext={vctx}
            >
              <VentaParaFacturarContent
                entity={{
                  folio_cuenta: v.folio_cuenta,
                  fecha_venta: v.fecha_venta,
                  dias_esperando: v.dias_esperando,
                  monto_factura_desarrollador: v.monto_factura_desarrollador,
                  comprador_principal: v.comprador_principal,
                  rfc_comprador: v.rfc_comprador,
                  desarrollador_nombre: v.proyecto === "Daiku"
                    ? "Grupo Daiku Desarrollos SA de CV"
                    : v.proyecto === "Bottura"
                      ? "Grupo Bottura SA de CV"
                      : "Constructora Monócolo SA de CV",
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "externo") {
          const p = selected.data;
          const cob = resolveCobFolio(p.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="pago_externo"
              entityId={p.folio_factura}
              ventaContext={vctx}
            >
              <PagoExternoContent
                entity={{
                  folio_cfdi: p.folio_factura,
                  beneficiario_nombre: p.agente_nombre,
                  beneficiario_tipo: p.agente_tipo,
                  monto: p.monto,
                  fecha_emision: p.fecha_emision_factura,
                  dias_desde_emision: p.dias_esperando,
                  ya_se_cobro_al_desarrollador: p.ya_se_cobro_al_desarrollador,
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "interna") {
          const c = selected.data;
          const cob = resolveCobFolio(c.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="comision_interna"
              entityId={c.folio_comision}
              ventaContext={vctx}
            >
              <ComisionInternaContent
                entity={{
                  folio: c.folio_comision,
                  comisionista_nombre: c.comisionista_nombre,
                  comisionista_rol: c.comisionista_rol,
                  porcentaje_comision: c.porcentaje_comision,
                  monto: c.monto,
                  dias_esperando_director: c.dias_esperando,
                  estado: "aprobada",
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "excepcion") {
          const e = selected.data;
          const cob = resolveCobFolio(e.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="excepcion"
              entityId={`#${e.id_excepcion}`}
              ventaContext={vctx}
            >
              <ExcepcionContent
                entity={{
                  id_excepcion: e.id_excepcion,
                  tipo: e.tipo,
                  descripcion_corta: e.descripcion_corta,
                  solicitante: e.solicitante,
                  monto_impactado: e.monto_impactado,
                  delta: e.delta,
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        return null;
      })()}
    </>
  );
}
