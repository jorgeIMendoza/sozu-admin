import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Bell,
  AlertOctagon,
  Clock,
  CheckCircle2,
  FileOutput,
  Inbox,
  TrendingDown,
  HandCoins,
  UserCheck,
  Users,
  AlertCircle,
  AlertTriangle,
  Check,
  Coins,
  PenLine,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Kpi, PageHeader, Panel, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────
   Ancla temporal del demo
   ────────────────────────────────────────────────────────── */

const NOW = new Date("2026-05-14T18:00:00");

/* ──────────────────────────────────────────────────────────
   Tipo de evento + config visual
   ────────────────────────────────────────────────────────── */

type TipoEvento =
  | "venta_reconocida"
  | "factura_emitida_desarrollador"
  | "factura_recibida_externo"
  | "pago_recibido_desarrollador"
  | "comision_externa_pagada"
  | "comision_interna_aprobada"
  | "dispersion_interna_ejecutada"
  | "factura_vencida"
  | "excepcion_solicitada"
  | "excepcion_aprobada"
  | "excepcion_rechazada"
  | "apartado_realizado"
  | "firma_completada";

const TIPO_EVENTO_CONFIG: Record<
  TipoEvento,
  { icon: LucideIcon; colorBg: string; colorText: string; label: string }
> = {
  venta_reconocida: {
    icon: CheckCircle2,
    colorBg: "bg-emerald-100 dark:bg-emerald-900/50",
    colorText: "text-emerald-700 dark:text-emerald-300",
    label: "Venta reconocida",
  },
  factura_emitida_desarrollador: {
    icon: FileOutput,
    colorBg: "bg-blue-100 dark:bg-blue-900/50",
    colorText: "text-blue-700 dark:text-blue-300",
    label: "Factura emitida al desarrollador",
  },
  factura_recibida_externo: {
    icon: Inbox,
    colorBg: "bg-amber-100 dark:bg-amber-900/50",
    colorText: "text-amber-700 dark:text-amber-300",
    label: "Factura recibida de externo",
  },
  pago_recibido_desarrollador: {
    icon: TrendingDown,
    colorBg: "bg-emerald-100 dark:bg-emerald-900/50",
    colorText: "text-emerald-700 dark:text-emerald-300",
    label: "Pago recibido del desarrollador",
  },
  comision_externa_pagada: {
    icon: HandCoins,
    colorBg: "bg-emerald-100 dark:bg-emerald-900/50",
    colorText: "text-emerald-700 dark:text-emerald-300",
    label: "Comisión externa pagada",
  },
  comision_interna_aprobada: {
    icon: UserCheck,
    colorBg: "bg-blue-100 dark:bg-blue-900/50",
    colorText: "text-blue-700 dark:text-blue-300",
    label: "Comisión interna aprobada",
  },
  dispersion_interna_ejecutada: {
    icon: Users,
    colorBg: "bg-emerald-100 dark:bg-emerald-900/50",
    colorText: "text-emerald-700 dark:text-emerald-300",
    label: "Dispersión interna ejecutada",
  },
  factura_vencida: {
    icon: AlertCircle,
    colorBg: "bg-red-100 dark:bg-red-900/50",
    colorText: "text-red-700 dark:text-red-300",
    label: "Factura vencida",
  },
  excepcion_solicitada: {
    icon: AlertTriangle,
    colorBg: "bg-orange-100 dark:bg-orange-900/50",
    colorText: "text-orange-700 dark:text-orange-300",
    label: "Excepción solicitada",
  },
  excepcion_aprobada: {
    icon: Check,
    colorBg: "bg-emerald-100 dark:bg-emerald-900/50",
    colorText: "text-emerald-700 dark:text-emerald-300",
    label: "Excepción aprobada",
  },
  excepcion_rechazada: {
    icon: X,
    colorBg: "bg-red-100 dark:bg-red-900/50",
    colorText: "text-red-700 dark:text-red-300",
    label: "Excepción rechazada",
  },
  apartado_realizado: {
    icon: Coins,
    colorBg: "bg-blue-100 dark:bg-blue-900/50",
    colorText: "text-blue-700 dark:text-blue-300",
    label: "Apartado realizado",
  },
  firma_completada: {
    icon: PenLine,
    colorBg: "bg-blue-100 dark:bg-blue-900/50",
    colorText: "text-blue-700 dark:text-blue-300",
    label: "Firma completada",
  },
};

type Proyecto = "Daiku" | "Bottura" | "Monócolo";

type NotificacionEvento = {
  id: number;
  tipo: TipoEvento;
  titulo: string;
  sub_info: string;
  proyecto?: Proyecto;
  venta_referencia?: string;
  fecha_evento: string; // ISO datetime
  leido: boolean;
  critico: boolean;
  link_modulo?: string;
  monto?: number;
};

/* ──────────────────────────────────────────────────────────
   Mock data — 15 eventos cronológicos
   ────────────────────────────────────────────────────────── */

const EVENTOS: NotificacionEvento[] = [
  // ─── Hoy ───
  {
    id: 1,
    tipo: "excepcion_solicitada",
    titulo: "Descuento 8% solicitado · COB-1045 Daiku A-205",
    sub_info: "Carlos Mendoza Ávalos · monto impactado $1,520,000 · delta $121,600",
    proyecto: "Daiku",
    venta_referencia: "COB-1045",
    fecha_evento: "2026-05-14T09:32:00",
    leido: false,
    critico: true,
    link_modulo: "/admin/portal-alta-direccion/bandeja",
    monto: 121600,
  },

  // ─── Ayer ───
  {
    id: 2,
    tipo: "dispersion_interna_ejecutada",
    titulo: "Bottura PH-2 (COB-1046) · Dispersión interna completada",
    sub_info: "2 comisionistas · total $76,000 · ciclo completo cerrado",
    proyecto: "Bottura",
    venta_referencia: "COB-1046",
    fecha_evento: "2026-05-13T16:45:00",
    leido: false,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/comisiones-internas",
    monto: 76000,
  },
  {
    id: 3,
    tipo: "comision_interna_aprobada",
    titulo: "Comisión COM-875 aprobada · Patricia Luna Olvera",
    sub_info: "Bottura PH-3 · $12,000 (0.50%) · pendiente autorización Director",
    proyecto: "Bottura",
    venta_referencia: "COB-1042",
    fecha_evento: "2026-05-13T11:20:00",
    leido: false,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/comisiones-internas",
    monto: 12000,
  },

  // ─── Esta semana ───
  {
    id: 4,
    tipo: "comision_externa_pagada",
    titulo: "Pago a Premier Brokers MX ejecutado",
    sub_info: "Bottura PH-1 venta previa · $48,000 · F-PR-2204",
    proyecto: "Bottura",
    venta_referencia: "COB-1037",
    fecha_evento: "2026-05-12T14:00:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/comisiones-externas",
    monto: 48000,
  },
  {
    id: 5,
    tipo: "factura_recibida_externo",
    titulo: "Factura recibida · Broker Capital MX",
    sub_info: "Bottura PH-3 · F-MX-3382 · $54,000 · en revisión",
    proyecto: "Bottura",
    venta_referencia: "COB-1042",
    fecha_evento: "2026-05-12T10:30:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/facturas-por-pagar",
    monto: 54000,
  },
  {
    id: 6,
    tipo: "factura_emitida_desarrollador",
    titulo: "Factura emitida a Grupo Bottura",
    sub_info: "F-S2026-0042 · COB-1042 Bottura PH-3 · $120,000",
    proyecto: "Bottura",
    venta_referencia: "COB-1042",
    fecha_evento: "2026-05-10T16:00:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/facturas-por-cobrar",
    monto: 120000,
  },
  {
    id: 7,
    tipo: "venta_reconocida",
    titulo: "VENTA reconocida · COB-1042 Bottura PH-3",
    sub_info: "Juan Pérez Silva · $2,400,000 · 19 días desde apartado",
    proyecto: "Bottura",
    venta_referencia: "COB-1042",
    fecha_evento: "2026-05-08T15:00:00",
    leido: true,
    critico: true,
    link_modulo: "/admin/portal-alta-direccion/ciclo-venta?caso=COB-1042",
    monto: 2400000,
  },
  {
    id: 8,
    tipo: "pago_recibido_desarrollador",
    titulo: "Pago recibido de Grupo Daiku",
    sub_info: "Daiku C-302 venta previa · $76,500 · F-S2026-0038",
    proyecto: "Daiku",
    venta_referencia: "COB-1038",
    fecha_evento: "2026-05-07T11:00:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/facturas-por-cobrar",
    monto: 76500,
  },
  {
    id: 9,
    tipo: "comision_interna_aprobada",
    titulo: "Comisión COM-871 aprobada · Roberto Hernández Solís",
    sub_info: "Daiku A-201 · $28,350 (1.50%) · pendiente autorización Director",
    proyecto: "Daiku",
    venta_referencia: "COB-1041",
    fecha_evento: "2026-05-07T09:30:00",
    leido: false,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/comisiones-internas",
    monto: 28350,
  },

  // ─── Más antiguo ───
  {
    id: 10,
    tipo: "venta_reconocida",
    titulo: "VENTA reconocida · COB-1041 Daiku A-201",
    sub_info: "María García López · $1,890,000 · 23 días desde apartado",
    proyecto: "Daiku",
    venta_referencia: "COB-1041",
    fecha_evento: "2026-05-06T16:00:00",
    leido: true,
    critico: true,
    link_modulo: "/admin/portal-alta-direccion/ciclo-venta?caso=COB-1041",
    monto: 1890000,
  },
  {
    id: 11,
    tipo: "firma_completada",
    titulo: "Firma de contrato completada · María García López",
    sub_info: "Daiku A-201 · vía MiFiel",
    proyecto: "Daiku",
    venta_referencia: "COB-1041",
    fecha_evento: "2026-05-04T17:00:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/ciclo-venta?caso=COB-1041",
  },
  {
    id: 12,
    tipo: "apartado_realizado",
    titulo: "Apartado registrado · Monócolo B-1",
    sub_info: "Sofía Rivera Mendoza · COB-1043 · primer pago $35,000",
    proyecto: "Monócolo",
    venta_referencia: "COB-1043",
    fecha_evento: "2026-05-02T14:00:00",
    leido: true,
    critico: false,
    monto: 35000,
  },
  {
    id: 13,
    tipo: "factura_vencida",
    titulo: "Factura vencida sin cobrar",
    sub_info: "Constructora Monócolo · F-S2026-0033 · $58,000 · 47 días vencida",
    proyecto: "Monócolo",
    venta_referencia: "COB-1033",
    fecha_evento: "2026-04-30T09:00:00",
    leido: false,
    critico: true,
    link_modulo: "/admin/portal-alta-direccion/facturas-por-cobrar",
    monto: 58000,
  },
  {
    id: 14,
    tipo: "comision_externa_pagada",
    titulo: "Pago a Inmobiliaria Vértice ejecutado",
    sub_info: "Daiku B-308 venta previa · $42,000 · F-VX-4421",
    proyecto: "Daiku",
    venta_referencia: "COB-1024",
    fecha_evento: "2026-04-26T15:00:00",
    leido: true,
    critico: false,
    link_modulo: "/admin/portal-alta-direccion/comisiones-externas",
    monto: 42000,
  },
  {
    id: 15,
    tipo: "apartado_realizado",
    titulo: "Apartado registrado · Daiku A-201",
    sub_info: "María García López · COB-1041 · primer pago $50,000",
    proyecto: "Daiku",
    venta_referencia: "COB-1041",
    fecha_evento: "2026-04-21T13:00:00",
    leido: true,
    critico: false,
    monto: 50000,
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

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysDiff(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

type Bucket = "Hoy" | "Ayer" | "Esta semana" | "Más antiguo";
const BUCKET_ORDER: Bucket[] = ["Hoy", "Ayer", "Esta semana", "Más antiguo"];

function getBucket(fechaIso: string): Bucket {
  const d = new Date(fechaIso);
  const diff = daysDiff(NOW, d);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff <= 7) return "Esta semana";
  return "Más antiguo";
}

function relativeTime(fechaIso: string): string {
  const d = new Date(fechaIso);
  const diffMs = NOW.getTime() - d.getTime();
  if (diffMs < 0) return "ahora";
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs} ${diffHrs === 1 ? "hora" : "horas"}`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  const months = Math.floor(diffDays / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

function formatFullDate(fechaIso: string): string {
  const d = new Date(fechaIso);
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${yr} · ${hh}:${mm}`;
}

/* ──────────────────────────────────────────────────────────
   Tarjeta de evento
   ────────────────────────────────────────────────────────── */

function EventoCard({
  e,
  isRead,
  onMarkRead,
}: {
  e: NotificacionEvento;
  isRead: boolean;
  onMarkRead: (id: number) => void;
}) {
  const config = TIPO_EVENTO_CONFIG[e.tipo];
  const Icon = config.icon;
  const fullDate = formatFullDate(e.fecha_evento);

  const handleClick = () => {
    if (!isRead) onMarkRead(e.id);
  };

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/30",
        !isRead && "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40"
      )}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full shrink-0",
            config.colorBg,
            config.colorText
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm leading-tight", !isRead ? "font-semibold text-foreground" : "font-medium text-foreground")}>
              {e.titulo}
            </p>
            <Badge variant="outline" className="text-[10px] font-normal">
              {config.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{e.sub_info}</p>
          <p className="mt-1 text-[10px] text-muted-foreground" title={fullDate}>
            {relativeTime(e.fecha_evento)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isRead && (
            <span
              className="h-2 w-2 rounded-full bg-blue-500"
              title="No leído"
              aria-label="No leído"
            />
          )}
          {e.critico && (
            <Badge
              variant="outline"
              className="text-[10px] border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40"
            >
              Crítico
            </Badge>
          )}
          {e.link_modulo && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={(ev) => ev.stopPropagation()}
            >
              <Link to={e.link_modulo}>
                Ver
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionNotificacionesPage() {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  // Estado local: IDs que el usuario marcó como leídos en esta sesión.
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  const isRead = (e: NotificacionEvento) => e.leido || readIds.has(e.id);

  const markRead = (id: number) =>
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const markAllRead = () =>
    setReadIds(new Set(EVENTOS.filter((e) => !e.leido).map((e) => e.id)));

  /* ─── KPIs (siempre globales, no se ven afectados por filtros) ─── */
  const kpis = useMemo(() => {
    const unreadCount = EVENTOS.filter((e) => !isRead(e)).length;
    const criticosCount = EVENTOS.filter((e) => e.critico).length;
    const last24h = NOW.getTime() - 24 * 3600 * 1000;
    const ult24Count = EVENTOS.filter(
      (e) => new Date(e.fecha_evento).getTime() >= last24h
    ).length;
    return {
      total: EVENTOS.length,
      no_leidas: unreadCount,
      criticas: criticosCount,
      ultimas_24h: ult24Count,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readIds]);

  /* ─── Filtrado del feed ─── */
  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return EVENTOS.filter((e) => {
      if (tipoFilter !== "all" && e.tipo !== tipoFilter) return false;
      if (proyectoFilter !== "all" && e.proyecto !== proyectoFilter) return false;
      if (soloNoLeidas && isRead(e)) return false;
      if (q) {
        const hay = [e.titulo, e.sub_info].map(norm).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(
      (a, b) =>
        new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFilter, proyectoFilter, soloNoLeidas, readIds]);

  /* ─── Agrupación por bucket ─── */
  const grouped = useMemo(() => {
    const map = new Map<Bucket, NotificacionEvento[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const e of filtered) {
      const b = getBucket(e.fecha_evento);
      map.get(b)!.push(e);
    }
    return map;
  }, [filtered]);

  const hayFiltros = !!search || tipoFilter !== "all" || proyectoFilter !== "all" || soloNoLeidas;

  const limpiar = () => {
    setSearch("");
    setTipoFilter("all");
    setProyectoFilter("all");
    setSoloNoLeidas(false);
  };

  return (
    <>
      <PageHeader
        title="Centro de Notificaciones"
        description="Eventos clave del ciclo de venta SOZU"
        action={<DemoBadge />}
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total eventos"
          value={kpis.total}
          hint={`${kpis.total === 1 ? "evento" : "eventos"} en el feed`}
          icon={Bell}
          tone="info"
        />
        <div
          className={cn(
            "rounded-lg",
            kpis.no_leidas > 5 && "ring-2 ring-amber-300 dark:ring-amber-900/60"
          )}
        >
          <Kpi
            label="No leídas"
            value={kpis.no_leidas}
            hint={kpis.no_leidas > 5 ? "atención requerida" : "pendientes de revisión"}
            icon={Inbox}
            tone="warning"
          />
        </div>
        <Kpi
          label="Críticas"
          value={kpis.criticas}
          hint="eventos que requieren atención"
          icon={AlertOctagon}
          tone="destructive"
        />
        <Kpi
          label="Últimas 24 horas"
          value={kpis.ultimas_24h}
          hint="actividad reciente"
          icon={Clock}
          tone="default"
        />
      </div>

      {/* ─── Filtros ─── */}
      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en eventos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[260px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(Object.keys(TIPO_EVENTO_CONFIG) as TipoEvento[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TIPO_EVENTO_CONFIG[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              <SelectItem value="Daiku">Daiku</SelectItem>
              <SelectItem value="Bottura">Bottura</SelectItem>
              <SelectItem value="Monócolo">Monócolo</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 px-2">
            <Switch
              id="solo-no-leidas"
              checked={soloNoLeidas}
              onCheckedChange={setSoloNoLeidas}
            />
            <Label htmlFor="solo-no-leidas" className="text-xs cursor-pointer">
              Solo no leídas
            </Label>
          </div>

          {hayFiltros && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}

          {kpis.no_leidas > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-8 text-xs ml-auto text-primary"
              onClick={markAllRead}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* ─── Feed agrupado ─── */}
      <Panel
        title="Feed de eventos"
        description={`${filtered.length} ${filtered.length === 1 ? "evento" : "eventos"} ${hayFiltros ? "con los filtros aplicados" : "en total"}`}
      >
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No hay eventos que coincidan con los filtros.
            </p>
            {hayFiltros && (
              <Button variant="outline" size="sm" onClick={limpiar}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {BUCKET_ORDER.map((bucket) => {
              const items = grouped.get(bucket) || [];
              if (items.length === 0) return null;
              return (
                <div key={bucket}>
                  <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    {bucket} · {items.length}
                  </h3>
                  <div className="space-y-2">
                    {items.map((e) => (
                      <EventoCard
                        key={e.id}
                        e={e}
                        isRead={isRead(e)}
                        onMarkRead={markRead}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
