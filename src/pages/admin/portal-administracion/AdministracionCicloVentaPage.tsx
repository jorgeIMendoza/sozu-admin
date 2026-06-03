import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  Clock,
  AlertTriangle,
  Ban,
  Star,
  ArrowLeft,
  ArrowRight,
  Building2,
  User,
  DollarSign,
  FileText,
  Eye,
  Mail,
  Search,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useCicloVentaCasos } from "@/hooks/useCicloVentaCasos";
import {
  useExpedienteVentaDetalle,
  type ExpedienteVentaDetalle,
} from "@/hooks/useExpedienteVentaDetalle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { PaginationBar, ADMIN_PAGE_SIZE } from "@/components/admin/PaginationBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Pill, Panel } from "@/components/admin/portal-administracion/ui";
import { fmtMxn } from "@/data/administracion/mockData";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

type EstadoCaso = "vendida" | "en_firma" | "en_apartado" | "en_oferta" | "liquidada";

type CasoIndice = {
  folio: string;
  propiedad: string;
  cliente: string;
  estado: EstadoCaso;
  etapa: string;
  dias_desde_apartado: number;
  monto_venta: number;
  nota?: string;
};

type TimelineStepData = {
  paso: number;
  nombre: string;
  estado: "completado" | "pendiente" | "atrasado" | "no_aplica";
  fecha?: string;
  responsable?: string;
  detalle?: string;
  es_hito?: boolean;
  url?: string;
  url_label?: string;
  urls?: Array<{ url: string; label: string }>;
  expand?: {
    type: "comisionistas_internos";
    items: Array<{
      nombre: string;
      rol: string;
      porcentaje: number;
      monto: number;
      aprobada: boolean;
      pagada: boolean;
    }>;
  };
};

type ActorExpediente = {
  rol: string;
  nombre: string;
  tipo: string;
  contacto: string;
  estado_pago: string;
  monto?: number;
  monto_label?: string;
};

type FlujoCapa = {
  comprometido: number;
  ejecutado: number;
  estado: string;
  ultima_fecha?: string;
  pendiente_vobo?: boolean;
  dias_esperando?: number;
  bloqueado_por?: string;
};

type ExpedienteVenta = {
  folio_cuenta: string;
  id_cuenta_cobranza: number;
  propiedad: { proyecto: string; numero: string; m2: number; piso: string; vista: string };
  precio_venta: number;
  clabe_stp: string;
  estado_actual_primario: string;
  estado_actual_secundario: string;
  dias_desde_apartado: number;
  pagado_cliente: number;
  comision_total_sozu: number;
  resultado_neto_proyectado: number;
  actores: ActorExpediente[];
  timeline: TimelineStepData[];
  flujo_dinero: {
    capa_a_cobranza: FlujoCapa;
    capa_b_factura_desarrollador: FlujoCapa;
    capa_c_pago_externos: FlujoCapa;
    capa_d_dispersion_internas: FlujoCapa;
  };
};

/* ──────────────────────────────────────────────────────────
   Mock data — Índice
   ────────────────────────────────────────────────────────── */

const CASOS: CasoIndice[] = [
  {
    folio: "COB-1041",
    propiedad: "Daiku · A-201",
    cliente: "María García López",
    estado: "vendida",
    etapa: "Pdte factura desarrollador",
    dias_desde_apartado: 23,
    monto_venta: 1890000,
  },
  {
    folio: "COB-1042",
    propiedad: "Bottura · PH-3",
    cliente: "Juan Pérez Silva",
    estado: "vendida",
    etapa: "Pdte pago externo",
    dias_desde_apartado: 19,
    monto_venta: 2400000,
  },
  {
    folio: "COB-1043",
    propiedad: "Monócolo · B-1",
    cliente: "Sofía Rivera Mendoza",
    estado: "en_firma",
    etapa: "Esperando firma cliente",
    dias_desde_apartado: 12,
    monto_venta: 1180000,
  },
  {
    folio: "COB-1044",
    propiedad: "Daiku · C-402",
    cliente: "Familia López-Núñez (copropietarios)",
    estado: "en_apartado",
    etapa: "Pdte documentación",
    dias_desde_apartado: 8,
    monto_venta: 1650000,
  },
  {
    folio: "COB-1045",
    propiedad: "Daiku · A-205",
    cliente: "Carlos Mendoza Cliente",
    estado: "en_oferta",
    etapa: "Excepción 8% pendiente VoBo",
    dias_desde_apartado: 6,
    monto_venta: 1520000,
    nota: "descuento solicitado",
  },
  {
    folio: "COB-1046",
    propiedad: "Bottura · PH-2",
    cliente: "Empresa Constructora ABC SA",
    estado: "liquidada",
    etapa: "Comisiones internas dispersadas",
    dias_desde_apartado: 87,
    monto_venta: 3800000,
  },
];

const ESTADO_TONE: Record<EstadoCaso, string> = {
  vendida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  en_firma: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  en_apartado: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  en_oferta: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  liquidada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const ESTADO_LABEL: Record<EstadoCaso, string> = {
  vendida: "Vendida",
  en_firma: "En firma",
  en_apartado: "En apartado",
  en_oferta: "En oferta",
  liquidada: "Liquidada",
};

/* ──────────────────────────────────────────────────────────
   Mock data — Expediente detallado COB-1041
   ────────────────────────────────────────────────────────── */

const EXPEDIENTE_COB_1041: ExpedienteVenta = {
  folio_cuenta: "COB-1041",
  id_cuenta_cobranza: 1041,
  propiedad: {
    proyecto: "Daiku",
    numero: "A-201",
    m2: 78,
    piso: "Piso 12",
    vista: "Vista jardín",
  },
  precio_venta: 1890000,
  clabe_stp: "646180•••••••••3456",
  estado_actual_primario: "Vendida",
  estado_actual_secundario: "Pendiente factura a desarrollador",
  dias_desde_apartado: 23,
  pagado_cliente: 1890000,
  comision_total_sozu: 94500,
  resultado_neto_proyectado: 32800,
  actores: [
    {
      rol: "Cliente principal",
      nombre: "María García López",
      tipo: "Persona física · RFC GALM850712ABC",
      contacto: "maria.garcia@email.com",
      estado_pago: "Pagó 100%",
      monto: 1890000,
      monto_label: "$1,890,000 cobrado",
    },
    {
      rol: "Agente externo",
      nombre: "Carlos Mendoza Ávalos",
      tipo: "Inmobiliaria Vértice SA de CV",
      contacto: "carlos.mendoza@vertice.mx",
      estado_pago: "Comisión externa pendiente",
      monto: 37800,
      monto_label: "$37,800 (2.00% sobre venta)",
    },
    {
      rol: "Comisionista interno",
      nombre: "Roberto Hernández Solís",
      tipo: "Director Comercial SOZU",
      contacto: "rh.solis@sozu.com",
      estado_pago: "Comisión interna pendiente",
      monto: 22500,
      monto_label: "$22,500 (1.5%)",
    },
    {
      rol: "Comisionista interno",
      nombre: "Ana Patricia Ruiz",
      tipo: "Ejecutiva Senior SOZU",
      contacto: "ana.ruiz@sozu.com",
      estado_pago: "Comisión interna pendiente",
      monto: 18000,
      monto_label: "$18,000 (1.2%)",
    },
    {
      rol: "Aprobador comercial",
      nombre: "Ramón Escobar",
      tipo: "Director General SOZU",
      contacto: "joseramon.escobar@sozu.com",
      estado_pago: "Aprobó oferta el 2026-03-25",
    },
    {
      rol: "Desarrollador",
      nombre: "Grupo Daiku Desarrollos SA de CV",
      tipo: "Cliente B2B",
      contacto: "contacto@daiku.mx",
      estado_pago: "Factura por emitir",
      monto: 94500,
      monto_label: "$94,500 (5% comisión total)",
    },
  ],
  timeline: [
    {
      paso: 1,
      nombre: "Prospecto creado",
      estado: "completado",
      fecha: "2026-04-08",
      responsable: "Carlos Mendoza Ávalos (agente externo)",
    },
    {
      paso: 2,
      nombre: "Cita realizada",
      estado: "completado",
      fecha: "2026-04-13",
      responsable: "Carlos Mendoza Ávalos",
    },
    {
      paso: 3,
      nombre: "Oferta generada",
      estado: "completado",
      fecha: "2026-04-16",
      responsable: "Sistema",
      detalle: "Folio OFR-2941",
    },
    {
      paso: 4,
      nombre: "Apartado: CLABE generada, primer pago $50,000",
      estado: "completado",
      fecha: "2026-04-21",
      responsable: "STP / Cliente",
    },
    {
      paso: 5,
      nombre: "Documentación validada",
      estado: "completado",
      fecha: "2026-04-28",
      responsable: "Equipo Compradores",
    },
    {
      paso: 6,
      nombre: "Contrato generado",
      estado: "completado",
      fecha: "2026-05-01",
      responsable: "Edge Function generar-contrato",
    },
    {
      paso: 7,
      nombre: "Firma cliente vía MiFiel",
      estado: "completado",
      fecha: "2026-05-04",
      responsable: "María García López",
    },
    {
      paso: 8,
      nombre: "Firma SOZU",
      estado: "completado",
      fecha: "2026-05-05",
      responsable: "Representante legal SOZU",
    },
    {
      paso: 9,
      nombre: "Enganche completo $189,000 (10%)",
      estado: "completado",
      fecha: "2026-05-06",
      responsable: "STP / Cliente",
    },
    {
      paso: 10,
      nombre: "VENTA reconocida",
      estado: "completado",
      fecha: "2026-05-06",
      responsable: "Sistema · cambio a estatus Vendida",
      es_hito: true,
    },
    {
      paso: 11,
      nombre: "Factura SOZU al desarrollador",
      estado: "pendiente",
      responsable: "Dirección General",
      detalle: "Pendiente VoBo · 8 días esperando",
    },
    {
      paso: 12,
      nombre: "Pago del desarrollador a SOZU",
      estado: "no_aplica",
      detalle: "No aplica hasta emitir factura",
    },
    {
      paso: 13,
      nombre: "Factura externo (Carlos Mendoza Ávalos)",
      estado: "no_aplica",
      detalle: "No aplica hasta cobro al desarrollador",
    },
    {
      paso: 14,
      nombre: "Pago a externo",
      estado: "no_aplica",
      detalle: "No aplica",
    },
    {
      paso: 15,
      nombre: "Cálculo de comisiones internas",
      estado: "no_aplica",
      detalle: "No aplica",
    },
    {
      paso: 16,
      nombre: "Dispersión de comisiones internas",
      estado: "no_aplica",
      detalle: "No aplica",
    },
  ],
  flujo_dinero: {
    capa_a_cobranza: {
      comprometido: 1890000,
      ejecutado: 1890000,
      estado: "Liquidado completo",
      ultima_fecha: "2026-04-26",
    },
    capa_b_factura_desarrollador: {
      comprometido: 94500,
      ejecutado: 0,
      estado: "Esperando autorización para facturar",
      pendiente_vobo: true,
      dias_esperando: 8,
    },
    capa_c_pago_externos: {
      comprometido: 37800,
      ejecutado: 0,
      estado: "En espera de cobro a desarrollador",
      bloqueado_por: "Capa B no ejecutada",
    },
    capa_d_dispersion_internas: {
      comprometido: 40500,
      ejecutado: 0,
      estado: "Pendiente hasta liberación de fondos",
      bloqueado_por: "Capa C no ejecutada",
    },
  },
};

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

/* ──────────────────────────────────────────────────────────
   Índice (vista inicial)
   ────────────────────────────────────────────────────────── */

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function IndiceView({ onOpen }: { onOpen: (folio: string) => void }) {
  const [search, setSearch] = useState("");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data: casos = [], isLoading, error } = useCicloVentaCasos();

  const proyectoOptions = useMemo(
    () =>
      Array.from(new Set(casos.map((c) => c.proyecto_nombre).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [casos],
  );

  const filtrados = useMemo(() => {
    const q = search ? norm(search) : null;
    return casos.filter((c) => {
      if (proyectoFilter !== "all" && c.proyecto_nombre !== proyectoFilter) return false;
      if (tipoFilter !== "all" && c.tipo !== tipoFilter) return false;
      if (q) {
        const hay = [
          c.folio,
          c.proyecto_nombre,
          c.modelo_nombre,
          c.numero_departamento,
          c.propietario,
        ]
          .map(norm)
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, proyectoFilter, tipoFilter, casos]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / ADMIN_PAGE_SIZE));
  const filtradosPage = useMemo(
    () => filtrados.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE),
    [filtrados, page],
  );

  const hayFiltros = !!search || proyectoFilter !== "all" || tipoFilter !== "all";

  const limpiar = () => {
    setSearch("");
    setProyectoFilter("all");
    setTipoFilter("all");
  };

  const totalDesc = hayFiltros
    ? `${filtrados.length} de ${casos.length} expedientes`
    : `${casos.length} expedientes`;

  return (
    <>
      <PageHeader
        title="Ciclo de Venta"
        description="Expedientes en ciclo — propiedades en estatus Apartado o Vendido"
      />

      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cuenta, proyecto, modelo, depto o propietario…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
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
            <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="Propiedad">Propiedad</SelectItem>
              <SelectItem value="Producto">Producto</SelectItem>
              <SelectItem value="Servicio">Servicio</SelectItem>
            </SelectContent>
          </Select>

          {hayFiltros && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <Panel title="Expedientes" description={totalDesc}>
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando ventas…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Error al cargar ventas: {(error as Error).message}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {casos.length === 0
                ? "No hay expedientes registrados."
                : "No se encontraron ventas con esos criterios."}
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
                  <TableHead className="text-xs">No. Departamento</TableHead>
                  <TableHead className="text-xs">Propietario</TableHead>
                  <TableHead className="text-xs text-right">Precio/m²</TableHead>
                  <TableHead className="text-xs text-right">Precio Final</TableHead>
                  <TableHead className="text-xs">Días</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradosPage.map((c) => (
                  <TableRow key={c.id_cuenta_cobranza}>
                    <TableCell className="font-medium text-sm font-mono whitespace-nowrap">
                      {c.folio}
                    </TableCell>
                    <TableCell className="text-xs">{c.tipo}</TableCell>
                    <TableCell className="text-sm">{c.proyecto_nombre || "-"}</TableCell>
                    <TableCell className="text-sm">{c.modelo_nombre || "-"}</TableCell>
                    <TableCell className="text-sm">{c.numero_departamento || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.propietario || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {c.precio_m2 > 0 ? fmtMxn(c.precio_m2) : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      {fmtMxn(c.precio_final)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{c.dias_desde_compra}d</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => onOpen(c.folio)}
                        aria-label={`Abrir expediente ${c.folio}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalCount={filtrados.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Panel>
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Timeline step
   ────────────────────────────────────────────────────────── */

function TimelineStep({ step, isLast }: { step: TimelineStepData; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const iconConfig = {
    completado: {
      Icon: Check,
      bg: "bg-emerald-100 dark:bg-emerald-900/50",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-200 dark:ring-emerald-900/40",
    },
    pendiente: {
      Icon: Clock,
      bg: "bg-amber-100 dark:bg-amber-900/50",
      text: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-200 dark:ring-amber-900/40",
    },
    atrasado: {
      Icon: AlertTriangle,
      bg: "bg-red-100 dark:bg-red-900/50",
      text: "text-red-700 dark:text-red-300",
      ring: "ring-red-200 dark:ring-red-900/40",
    },
    no_aplica: {
      Icon: Ban,
      bg: "bg-muted",
      text: "text-muted-foreground",
      ring: "ring-border",
    },
  }[step.estado];
  const Icon = step.es_hito ? Star : iconConfig.Icon;
  const greyOut = step.estado === "no_aplica";

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "rounded-full flex items-center justify-center shrink-0 ring-2 transition-all",
            step.es_hito ? "w-10 h-10 ring-4 ring-emerald-300 dark:ring-emerald-700" : "w-8 h-8",
            step.es_hito ? "bg-emerald-500 dark:bg-emerald-600 text-white" : cn(iconConfig.bg, iconConfig.text, iconConfig.ring)
          )}
        >
          <Icon className={step.es_hito ? "h-5 w-5" : "h-4 w-4"} />
        </div>
        {!isLast && (
          <div className={cn("w-px flex-1 mt-1", step.es_hito ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border")} />
        )}
      </div>
      <div className={cn("flex-1 pb-6", greyOut && "opacity-60")}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
            Paso {step.paso}
          </span>
          {step.es_hito && (
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[9px] px-1.5 py-0">
              HITO
            </Badge>
          )}
        </div>
        <p className={cn("text-sm mt-0.5", step.es_hito ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-medium text-foreground")}>
          {step.nombre}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {step.fecha && <span className="tabular-nums">{step.fecha}</span>}
          {step.fecha && step.responsable && <span>·</span>}
          {step.responsable && <span>{step.responsable}</span>}
        </div>
        {step.detalle && !step.expand && (
          <p className={cn(
            "mt-1 text-xs",
            step.estado === "pendiente" ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"
          )}>
            {step.detalle}
          </p>
        )}
        {step.expand && step.expand.items.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline",
                step.estado === "pendiente"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-primary",
              )}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {step.detalle ?? "Ver detalle"}
            </button>
            {expanded && (
              <div className="mt-2 rounded-md border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-[10px]">Nombre</TableHead>
                      <TableHead className="h-8 text-[10px]">Rol</TableHead>
                      <TableHead className="h-8 text-[10px] text-right">%</TableHead>
                      <TableHead className="h-8 text-[10px] text-right">Monto</TableHead>
                      <TableHead className="h-8 text-[10px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {step.expand.items.map((com, idx) => (
                      <TableRow key={`${idx}-${com.nombre}`}>
                        <TableCell className="text-xs font-medium">{com.nombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{com.rol}</TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {com.porcentaje.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-right">
                          {fmtMxn(com.monto)}
                        </TableCell>
                        <TableCell>
                          {com.pagada ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                              Pagada
                            </Badge>
                          ) : com.aprobada ? (
                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                              Aprobada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Sin aprobar
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
        {step.url && (
          <a
            href={step.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <FileText className="h-3 w-3" />
            {step.url_label || "Ver documento"}
          </a>
        )}
        {step.urls && step.urls.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {step.urls.map((u, idx) => (
              <a
                key={`${idx}-${u.url}`}
                href={u.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <FileText className="h-3 w-3" />
                {u.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Flujo de dinero (carriles A→B→C→D)
   ────────────────────────────────────────────────────────── */

function FlujoCard({
  letter,
  title,
  subtitle,
  capa,
  tone,
}: {
  letter: "A" | "B" | "C" | "D";
  title: string;
  subtitle: string;
  capa: FlujoCapa;
  tone: "emerald" | "amber" | "blue" | "violet";
}) {
  const toneClasses = {
    emerald: {
      letterBg: "bg-emerald-500 text-white",
      ring: "ring-emerald-200 dark:ring-emerald-900/40",
    },
    amber: {
      letterBg: "bg-amber-500 text-white",
      ring: "ring-amber-200 dark:ring-amber-900/40",
    },
    blue: {
      letterBg: "bg-blue-500 text-white",
      ring: "ring-blue-200 dark:ring-blue-900/40",
    },
    violet: {
      letterBg: "bg-violet-500 text-white",
      ring: "ring-violet-200 dark:ring-violet-900/40",
    },
  }[tone];

  const pct = capa.comprometido > 0 ? Math.round((capa.ejecutado / capa.comprometido) * 100) : 0;

  return (
    <Card className={cn("ring-1", toneClasses.ring)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg font-bold text-sm shrink-0", toneClasses.letterBg)}>
            {letter}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Comprometido</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{fmtMxn(capa.comprometido)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ejecutado</span>
            <span className={cn("text-sm font-semibold tabular-nums", capa.ejecutado > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
              {fmtMxn(capa.ejecutado)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-transparent"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-right text-muted-foreground tabular-nums">{pct}% ejecutado</p>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-foreground font-medium">{capa.estado}</p>
          {capa.ultima_fecha && (
            <p className="text-[11px] text-muted-foreground">Último movimiento: {capa.ultima_fecha}</p>
          )}
          {capa.pendiente_vobo && capa.dias_esperando != null && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {capa.dias_esperando} días esperando VoBo
            </Badge>
          )}
          {capa.bloqueado_por && (
            <p className="text-[11px] text-muted-foreground italic">Bloqueado por: {capa.bloqueado_por}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────
   Vista de detalle del expediente
   ────────────────────────────────────────────────────────── */

type DetailNavProps = {
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  prevLabel?: string;
  nextLabel?: string;
};

function DetailNavBar({ onBack, onPrev, onNext, prevLabel, nextLabel }: DetailNavProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 -ml-2">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver al índice
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev || undefined}
          disabled={!onPrev}
          aria-label={prevLabel ? `Caso anterior: ${prevLabel}` : "No hay caso anterior"}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Caso anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext || undefined}
          disabled={!onNext}
          aria-label={nextLabel ? `Siguiente caso: ${nextLabel}` : "No hay caso siguiente"}
        >
          Siguiente caso <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function ExpedienteView({
  data,
  onBack,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  data: ExpedienteVenta;
} & DetailNavProps) {
  return (
    <>
      <DetailNavBar
        onBack={onBack}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
      />

      <PageHeader
        title="Expediente de Venta"
        description={`${data.folio_cuenta} · ${data.propiedad.proyecto} ${data.propiedad.numero}`}
        action={<DemoBadge />}
      />

      {/* HERO */}
      <Card className="mb-8 ring-1 ring-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Izquierda */}
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Folio</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{data.folio_cuenta}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Propiedad
                </p>
                <p className="text-base font-semibold text-foreground mt-1">
                  {data.propiedad.proyecto} — {data.propiedad.numero}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.propiedad.m2} m² interior · {data.propiedad.piso} · {data.propiedad.vista}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Precio venta
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5">
                  {fmtMxn(data.precio_venta)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado actual</p>
                <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-900/40">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {data.estado_actual_primario}
                  </span>
                  <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">—</span>
                  <span className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                    {data.estado_actual_secundario}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">CLABE STP</p>
                <p className="text-sm font-mono text-foreground tabular-nums mt-0.5">{data.clabe_stp}</p>
              </div>
            </div>

            {/* Derecha — mini stats */}
            <div className="lg:border-l lg:pl-6 lg:border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Indicadores
              </p>
              <div className="space-y-4">
                <Stat label="Días desde apartado" value={`${data.dias_desde_apartado} días`} />
                <Stat
                  label="Pagado por cliente"
                  value={fmtMxn(data.pagado_cliente)}
                  hint={`100% del precio venta`}
                  tone="emerald"
                />
                <Stat
                  label="Comisión total SOZU"
                  value={fmtMxn(data.comision_total_sozu)}
                  hint="5% sobre precio venta"
                />
                <Stat
                  label="Resultado neto proyectado"
                  value={fmtMxn(data.resultado_neto_proyectado)}
                  hint="Tras pagar externos e internos"
                  tone="emerald"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 1 — TIMELINE */}
      <Section title="Timeline del ciclo" icon={Clock} description="Estado de los 16 pasos del expediente">
        <Card>
          <CardContent className="p-6">
            <div>
              {data.timeline.map((step, i) => (
                <TimelineStep
                  key={step.paso}
                  step={step}
                  isLast={i === data.timeline.length - 1}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* SECCIÓN 2 — ACTORES */}
      <Section title="Actores del ciclo" icon={User} description="Personajes involucrados y su estado de pago/cobro">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rol</TableHead>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Contacto</TableHead>
                  <TableHead className="text-xs">Estado de pago / cobro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.actores.map((a, i) => (
                  <TableRow key={`${a.rol}-${i}`}>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {a.rol}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{a.nombre}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.tipo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {a.contacto}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="text-foreground">{a.estado_pago}</p>
                      {a.monto_label && (
                        <p className="text-xs text-muted-foreground tabular-nums">{a.monto_label}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* SECCIÓN 3 — FLUJO DE DINERO */}
      <Section title="Flujo de dinero" icon={DollarSign} description="Cuatro capas con dependencia secuencial">
        <Card className="mb-3 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900/40">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Orden obligatorio:</span> A → B → C → D. Si se invierte
              C o D antes de B, SOZU financia involuntariamente la operación con su flujo propio.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FlujoCard
            letter="A"
            title="Cliente → SOZU"
            subtitle="Cobranza en CLABE STP"
            capa={data.flujo_dinero.capa_a_cobranza}
            tone="emerald"
          />
          <div className="hidden lg:flex items-center justify-center -mx-3">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <FlujoCard
            letter="B"
            title="SOZU → Desarrollador"
            subtitle="Factura por intermediación"
            capa={data.flujo_dinero.capa_b_factura_desarrollador}
            tone="amber"
          />
          <div className="hidden lg:flex items-center justify-center -mx-3">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <FlujoCard
            letter="C"
            title="SOZU → Externos"
            subtitle="Pago a aliado comercial"
            capa={data.flujo_dinero.capa_c_pago_externos}
            tone="blue"
          />
          <div className="hidden lg:flex items-center justify-center -mx-3">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <FlujoCard
            letter="D"
            title="SOZU → Internos"
            subtitle="Dispersión de comisiones"
            capa={data.flujo_dinero.capa_d_dispersion_internas}
            tone="violet"
          />
        </div>
      </Section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Stat helper (para el hero)
   ────────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums mt-0.5",
          tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Section header reutilizable
   ────────────────────────────────────────────────────────── */

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Placeholder para casos no cableados
   ────────────────────────────────────────────────────────── */

function ExpedienteDetalleReal({
  data,
  onBack,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: { data: ExpedienteVentaDetalle } & DetailNavProps) {
  return (
    <>
      <DetailNavBar
        onBack={onBack}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
      />

      <PageHeader
        title="Expediente de Venta"
        description={`${data.folio} · ${data.propiedad_label || data.proyecto_nombre}`}
      />

      {/* HERO */}
      <Card className="mb-8 ring-1 ring-border">
        <CardContent className="p-6 space-y-6">
          {/* Encabezado: ID Cuenta */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-border">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">ID Cuenta</p>
              <p className="text-2xl font-bold text-foreground font-mono">{data.folio}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado</p>
              <p className="text-sm font-medium text-foreground">
                {data.estatus_disponibilidad || "—"}
                {data.fecha_compra && (
                  <span className="text-muted-foreground ml-1">· {data.fecha_compra}</span>
                )}
              </p>
            </div>
          </div>

          {/* 3 columnas: Propiedad | Indicadores financieros | Compradores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Datos de la propiedad */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Datos de la propiedad
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Proyecto" value={data.proyecto_nombre || "—"} />
                <Info label="Edificio" value={data.edificio_nombre || "—"} />
                <Info label="Modelo" value={data.modelo_nombre || "—"} />
                <Info label="No. Depto" value={data.numero_departamento || "—"} />
                <Info label="Tipo" value={data.tipo} />
                {data.tipo !== "Propiedad" && (
                  <Info label="Producto" value={data.producto_nombre || "—"} />
                )}
                <Info
                  label="Metraje"
                  value={data.metraje > 0 ? `${data.metraje.toFixed(2)} m²` : "—"}
                />
                <Info label="Días" value={`${data.dias_desde_compra} días`} />
              </div>
              {data.propietario && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Info label="Propietario / Receptor" value={data.propietario} />
                </div>
              )}
            </div>

            {/* Indicadores financieros */}
            <div className="lg:border-l lg:pl-6 lg:border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Indicadores financieros
              </p>
              <div className="space-y-4">
                <Stat
                  label="Precio / m²"
                  value={data.precio_m2 > 0 ? fmtMxn(data.precio_m2) : "—"}
                  hint={data.metraje > 0 ? `${data.metraje.toFixed(2)} m²` : undefined}
                />
                <Stat label="Precio final" value={fmtMxn(data.precio_final)} tone="emerald" />
                <Stat
                  label="Comisión total SOZU"
                  value={fmtMxn(data.comision_total_sozu)}
                  hint={`${data.porcentaje_comision_venta}% sobre precio venta`}
                />
                <Stat
                  label="Comisión externa"
                  value={fmtMxn(data.comision_externa)}
                  hint={
                    data.comision_externa > 0
                      ? "A pagar a inmobiliaria/agente externo"
                      : "Sin externos en esta venta"
                  }
                />
                <Stat
                  label="Comisión a dispersar"
                  value={fmtMxn(data.comision_a_dispersar)}
                  hint="Equipo interno SOZU"
                  tone="emerald"
                />
              </div>
            </div>

            {/* Compradores */}
            <div className="lg:border-l lg:pl-6 lg:border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                <User className="h-3 w-3" /> Compradores
              </p>
              {data.compradores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin compradores registrados</p>
              ) : (
                <ul className="space-y-3">
                  {data.compradores.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-card p-2.5"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Nombre
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {c.nombre}
                        {c.porcentaje > 0 && c.porcentaje < 100 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({c.porcentaje}%)
                          </span>
                        )}
                      </p>
                      {i === 0 && data.rfc_comprador && (
                        <>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
                            RFC
                          </p>
                          <p className="text-sm font-mono text-foreground">
                            {data.rfc_comprador}
                          </p>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline del ciclo (16 pasos) */}
      <Section
        title="Timeline del ciclo"
        icon={Clock}
        description="Estado de los 16 pasos del expediente"
      >
        <Card>
          <CardContent className="p-6">
            <div>
              {data.timeline.map((step, i) => (
                <TimelineStep
                  key={step.paso}
                  step={{
                    paso: step.paso,
                    nombre: step.nombre,
                    estado:
                      step.estado === "sin_evidencia"
                        ? "no_aplica"
                        : step.estado === "completado"
                          ? "completado"
                          : step.estado === "pendiente"
                            ? "pendiente"
                            : "no_aplica",
                    fecha: step.fecha,
                    responsable: step.responsable,
                    detalle:
                      step.estado === "sin_evidencia" && !step.detalle
                        ? "Sin información en BD"
                        : step.detalle,
                    es_hito: step.es_hito,
                    url: step.url,
                    url_label: step.url_label,
                    urls: step.urls,
                    expand: step.expand,
                  }}
                  isLast={i === data.timeline.length - 1}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Desglose de comisionistas */}
      {data.comisionistas.length > 0 && (
        <Section
          title="Comisionistas asignados"
          icon={User}
          description="Internos y externos que participan en esta venta"
        >
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Rol</TableHead>
                    <TableHead className="text-xs text-right">%</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    <TableHead className="text-xs">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.comisionistas.map((c, i) => (
                    <TableRow key={`${c.email}-${i}`}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-normal whitespace-nowrap",
                            c.es_externo
                              ? "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40"
                              : "border-violet-400 text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40",
                          )}
                        >
                          {c.es_externo ? "Externo" : "Interno"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.rol}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {c.porcentaje.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">
                        {fmtMxn(c.monto)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.pagada ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                          >
                            Pagada
                          </Badge>
                        ) : c.aprobada ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-violet-400 text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40"
                          >
                            Aprobada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground"
                          >
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      )}
    </>
  );
}

function ExpedienteDetalleLoader({
  folio,
  onBack,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: { folio: string } & DetailNavProps) {
  const { data, isLoading, error } = useExpedienteVentaDetalle(folio);

  if (isLoading) {
    return (
      <>
        <DetailNavBar
          onBack={onBack}
          onPrev={onPrev}
          onNext={onNext}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        />
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando expediente…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DetailNavBar
          onBack={onBack}
          onPrev={onPrev}
          onNext={onNext}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        />
        <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
          Error al cargar expediente: {(error as Error).message}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <DetailNavBar
          onBack={onBack}
          onPrev={onPrev}
          onNext={onNext}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        />
        <PageHeader title={`Expediente ${folio}`} description="No se encontró la cuenta." />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              No se encontró el expediente <span className="font-mono">{folio}</span> en la base de datos.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <ExpedienteDetalleReal
      data={data}
      onBack={onBack}
      onPrev={onPrev}
      onNext={onNext}
      prevLabel={prevLabel}
      nextLabel={nextLabel}
    />
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Main — dispatch por ?caso=...
   ────────────────────────────────────────────────────────── */

export default function AdministracionCicloVentaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const caso = searchParams.get("caso");

  const scrollTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToCase = (folio: string) => {
    setSearchParams({ caso: folio });
    scrollTop();
  };
  const back = () => {
    setSearchParams({});
    scrollTop();
  };

  if (!caso) return <IndiceView onOpen={goToCase} />;

  return (
    <ExpedienteDetalleLoader
      folio={caso}
      onBack={back}
      onPrev={null}
      onNext={null}
    />
  );
}
