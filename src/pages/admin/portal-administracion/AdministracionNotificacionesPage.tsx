import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Bell,
  AlertOctagon,
  Clock,
  FileOutput,
  Inbox,
  HandCoins,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Loader2,
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
import { Kpi, PageHeader, Panel } from "@/components/admin/portal-alta-direccion/ui";
import { cn } from "@/lib/utils";
import {
  useNotificacionesAltaDireccion,
  type NotificacionAltaDireccion,
  type TipoNotificacion,
} from "@/hooks/useNotificacionesAltaDireccion";

/* ──────────────────────────────────────────────────────────
   Configuración visual por tipo
   ────────────────────────────────────────────────────────── */

const TIPO_CONFIG: Record<
  TipoNotificacion,
  { icon: LucideIcon; bg: string; fg: string; label: string; ctaLabel: string }
> = {
  venta_lista_facturar: {
    icon: FileOutput,
    bg: "bg-blue-100 dark:bg-blue-900/50",
    fg: "text-blue-700 dark:text-blue-300",
    label: "Venta lista para facturar",
    ctaLabel: "Ir a Bandeja",
  },
  pago_externo_validar: {
    icon: AlertTriangle,
    bg: "bg-orange-100 dark:bg-orange-900/50",
    fg: "text-orange-700 dark:text-orange-300",
    label: "Pago externo por validar",
    ctaLabel: "Ir a Bandeja",
  },
  comision_interna_autorizar: {
    icon: HandCoins,
    bg: "bg-amber-100 dark:bg-amber-900/50",
    fg: "text-amber-700 dark:text-amber-300",
    label: "Comisión interna por autorizar",
    ctaLabel: "Ir a Bandeja",
  },
  factura_sozu_vencida: {
    icon: AlertCircle,
    bg: "bg-red-100 dark:bg-red-900/50",
    fg: "text-red-700 dark:text-red-300",
    label: "Factura SOZU vencida",
    ctaLabel: "Ver Facturas Por Cobrar",
  },
  factura_pagar_pendiente: {
    icon: Inbox,
    bg: "bg-violet-100 dark:bg-violet-900/50",
    fg: "text-violet-700 dark:text-violet-300",
    label: "Factura por pagar",
    ctaLabel: "Ver Facturas Por Pagar",
  },
};

/* ──────────────────────────────────────────────────────────
   Helpers de bucket / formato
   ────────────────────────────────────────────────────────── */

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

function getBucket(fechaIso: string, now: Date): Bucket {
  const d = new Date(fechaIso);
  const diff = daysDiff(now, d);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff <= 7) return "Esta semana";
  return "Más antiguo";
}

function relativeTime(fechaIso: string, now: Date): string {
  const d = new Date(fechaIso);
  const diffMs = now.getTime() - d.getTime();
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
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ──────────────────────────────────────────────────────────
   Tarjeta de evento
   ────────────────────────────────────────────────────────── */

function EventoCard({
  e,
  isRead,
  onMarkRead,
  now,
}: {
  e: NotificacionAltaDireccion;
  isRead: boolean;
  onMarkRead: (id: string) => void;
  now: Date;
}) {
  const cfg = TIPO_CONFIG[e.tipo];
  const Icon = cfg.icon;
  const fullDate = formatFullDate(e.fecha_evento);

  return (
    <Card
      onClick={() => !isRead && onMarkRead(e.id)}
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/30",
        !isRead && "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40",
      )}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full shrink-0",
            cfg.bg,
            cfg.fg,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "text-sm leading-tight",
                !isRead ? "font-semibold text-foreground" : "font-medium text-foreground",
              )}
            >
              {e.titulo}
            </p>
            <Badge variant="outline" className="text-[10px] font-normal">
              {cfg.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{e.sub_info}</p>
          <p className="mt-1 text-[10px] text-muted-foreground" title={fullDate}>
            {relativeTime(e.fecha_evento, now)}
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
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={(ev) => ev.stopPropagation()}
          >
            <Link to={e.link_modulo}>
              {cfg.ctaLabel}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionNotificacionesPage() {
  const now = useMemo(() => new Date(), []);
  const { data: eventos = [], isLoading, error } = useNotificacionesAltaDireccion();

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [proyectoFilter, setProyectoFilter] = useState<string>("all");
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const isRead = (e: NotificacionAltaDireccion) => readIds.has(e.id);

  const markRead = (id: string) =>
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const markAllRead = () => setReadIds(new Set(eventos.map((e) => e.id)));

  const proyectoOptions = useMemo(
    () =>
      Array.from(
        new Set(eventos.map((e) => e.proyecto).filter((p): p is string => !!p)),
      ).sort((a, b) => a.localeCompare(b)),
    [eventos],
  );

  const kpis = useMemo(() => {
    const unreadCount = eventos.filter((e) => !isRead(e)).length;
    const criticosCount = eventos.filter((e) => e.critico).length;
    const last24h = now.getTime() - 24 * 3600 * 1000;
    const ult24Count = eventos.filter(
      (e) => new Date(e.fecha_evento).getTime() >= last24h,
    ).length;
    return {
      total: eventos.length,
      no_leidas: unreadCount,
      criticas: criticosCount,
      ultimas_24h: ult24Count,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, readIds, now]);

  const filtered = useMemo(() => {
    const q = search ? norm(search) : null;
    return eventos.filter((e) => {
      if (tipoFilter !== "all" && e.tipo !== tipoFilter) return false;
      if (proyectoFilter !== "all" && e.proyecto !== proyectoFilter) return false;
      if (soloNoLeidas && isRead(e)) return false;
      if (q) {
        const hay = [e.titulo, e.sub_info, e.folio_cuenta].map(norm).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipoFilter, proyectoFilter, soloNoLeidas, readIds, eventos]);

  const grouped = useMemo(() => {
    const map = new Map<Bucket, NotificacionAltaDireccion[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const e of filtered) map.get(getBucket(e.fecha_evento, now))!.push(e);
    return map;
  }, [filtered, now]);

  const hayFiltros =
    !!search || tipoFilter !== "all" || proyectoFilter !== "all" || soloNoLeidas;

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
        description="Validaciones y pagos que requieren acción del Director"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total accionables"
          value={kpis.total}
          hint={`${kpis.total === 1 ? "asunto" : "asuntos"} en el feed`}
          icon={Bell}
          tone="info"
        />
        <div
          className={cn(
            "rounded-lg",
            kpis.no_leidas > 5 && "ring-2 ring-amber-300 dark:ring-amber-900/60",
          )}
        >
          <Kpi
            label="Sin revisar"
            value={kpis.no_leidas}
            hint={kpis.no_leidas > 5 ? "atención requerida" : "pendientes de revisión"}
            icon={Inbox}
            tone="warning"
          />
        </div>
        <Kpi
          label="Críticas"
          value={kpis.criticas}
          hint="rebasaron SLA — bloquean pagos"
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

      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, proyecto o concepto…"
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
              <SelectItem value="all">Todos los tipos</SelectItem>
              {(Object.keys(TIPO_CONFIG) as TipoNotificacion[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TIPO_CONFIG[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
            <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
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

      <Panel
        title="Feed accionable"
        description={`${filtered.length} ${filtered.length === 1 ? "asunto" : "asuntos"} ${hayFiltros ? "con los filtros aplicados" : "en total"}`}
      >
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando notificaciones…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Error al cargar notificaciones: {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {eventos.length === 0
                ? "Sin asuntos pendientes — todas las validaciones están al día."
                : "No hay eventos que coincidan con los filtros."}
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
                        now={now}
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
