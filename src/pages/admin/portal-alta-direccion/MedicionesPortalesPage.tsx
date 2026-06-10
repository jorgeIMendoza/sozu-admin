/**
 * Mediciones · Uso por portal — Portal Alta Dirección.
 *
 * Consume dos RPCs de tracking:
 *   - `usuarios_online_por_portal(min_inactividad)` → ¿quiénes están ahora?
 *   - `visitas_historicas_por_portal(desde?, hasta?)` → totales históricos.
 *
 * Se refresca automáticamente cada 30s para que el conteo de online sea
 * accionable en tiempo casi-real.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, BarChart3, Activity, RefreshCw, ChevronRight, X, Mail, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/portal-alta-direccion/ui";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Catálogo de portales — alineado con el CHECK constraint de `portal_sesiones`. */
const PORTAL_LABEL: Record<string, string> = {
  admin: "Administración",
  clientes: "Clientes",
  agentes: "Agentes",
  inmobiliarias: "Inmobiliarias",
  embajadores: "Embajadores",
  cobranza: "Cobranza",
  escrituracion: "Escrituración",
  "alta-direccion": "Alta Dirección",
  juridico: "Jurídico",
  notaria: "Notaría",
  crm: "CRM",
  condominio: "Condominio",
};

type RangoPreset = "24h" | "semana" | "mes" | "trimestre" | "todo";
const RANGO_HORAS: Record<RangoPreset, number | null> = {
  "24h": 24,
  semana: 24 * 7,
  mes: 24 * 30,
  trimestre: 24 * 90,
  todo: null,
};
const RANGO_LABEL: Record<RangoPreset, string> = {
  "24h": "Últimas 24 horas",
  semana: "Última semana",
  mes: "Último mes",
  trimestre: "Último trimestre",
  todo: "Todo el histórico",
};

type OnlineRow = { portal: string; usuarios_online: number; sesiones_activas: number };
type HistoricoRow = {
  portal: string;
  usuarios_unicos: number;
  total_sesiones: number;
  duracion_promedio_min: number | null;
  primera_sesion: string | null;
  ultima_sesion: string | null;
};
type DetalleUsuarioRow = {
  id_usuario: string;
  email_usuario: string;
  nombre_usuario: string | null;
  primera_sesion: string | null;
  ultima_actividad: string | null;
  total_sesiones: number;
  duracion_total_min: number | null;
  esta_online: boolean;
  dias_desde_ultima_actividad: number | null;
};

type SegmentoDetalle = "todos" | "online" | "inactivos_7" | "inactivos_30";

export default function MedicionesPortalesPage() {
  const [rango, setRango] = useState<RangoPreset>("mes");
  const [detallePortal, setDetallePortal] = useState<string | null>(null);

  const desde = useMemo(() => {
    const horas = RANGO_HORAS[rango];
    if (horas == null) return null;
    return new Date(Date.now() - horas * 3600 * 1000).toISOString();
  }, [rango]);

  // Usuarios online — refetch cada 30s para sensación de tiempo real.
  const onlineQ = useQuery<OnlineRow[]>({
    queryKey: ["mediciones", "online"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "usuarios_online_por_portal",
        { p_minutos_inactividad: 15 },
      );
      if (error) throw error;
      return (data ?? []) as OnlineRow[];
    },
  });

  const historicoQ = useQuery<HistoricoRow[]>({
    queryKey: ["mediciones", "historico", rango],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "visitas_historicas_por_portal",
        { p_desde: desde, p_hasta: null },
      );
      if (error) throw error;
      return (data ?? []) as HistoricoRow[];
    },
  });

  const onlineMap = useMemo(() => {
    const m = new Map<string, OnlineRow>();
    (onlineQ.data ?? []).forEach((r) => m.set(r.portal, r));
    return m;
  }, [onlineQ.data]);

  const portalesOrdenados = useMemo(() => {
    // Union de portales que aparecen en cualquiera de los dos datasets +
    // todos los del catálogo (para mostrar "0" en los sin actividad).
    const set = new Set<string>(Object.keys(PORTAL_LABEL));
    onlineQ.data?.forEach((r) => set.add(r.portal));
    historicoQ.data?.forEach((r) => set.add(r.portal));
    return Array.from(set).sort((a, b) =>
      (PORTAL_LABEL[a] ?? a).localeCompare(PORTAL_LABEL[b] ?? b, "es"),
    );
  }, [onlineQ.data, historicoQ.data]);

  const totalOnline = (onlineQ.data ?? []).reduce((s, r) => s + r.usuarios_online, 0);
  const totalSesionesActivas = (onlineQ.data ?? []).reduce(
    (s, r) => s + r.sesiones_activas, 0,
  );
  const totalUsuariosUnicosPeriodo = (historicoQ.data ?? []).reduce(
    (s, r) => s + r.usuarios_unicos, 0,
  );

  return (
    <>
      <PageHeader
        title="Uso por portal"
        description="Usuarios activos en línea y visitas históricas — mediciones por portal."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onlineQ.refetch();
              historicoQ.refetch();
            }}
            disabled={onlineQ.isFetching || historicoQ.isFetching}
            className="h-9"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 mr-1.5",
                (onlineQ.isFetching || historicoQ.isFetching) && "animate-spin",
              )}
            />
            Actualizar
          </Button>
        }
      />

      {/* KPI globales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiTile
          icon={Activity}
          tone="emerald"
          label="Usuarios online ahora"
          value={onlineQ.isLoading ? "—" : String(totalOnline)}
          sub={
            onlineQ.isLoading
              ? "Cargando…"
              : `${totalSesionesActivas} ${totalSesionesActivas === 1 ? "sesión activa" : "sesiones activas"} · últimos 15 min`
          }
        />
        <KpiTile
          icon={Users}
          tone="blue"
          label={`Usuarios únicos · ${RANGO_LABEL[rango].toLowerCase()}`}
          value={historicoQ.isLoading ? "—" : String(totalUsuariosUnicosPeriodo)}
          sub="Acumulados en los 12 portales"
        />
        <KpiTile
          icon={BarChart3}
          tone="amber"
          label="Portales con actividad"
          value={
            onlineQ.isLoading
              ? "—"
              : String((onlineQ.data ?? []).filter((r) => r.usuarios_online > 0).length)
          }
          sub={`de ${Object.keys(PORTAL_LABEL).length} portales registrados`}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Detalle por portal</h2>
        <Select value={rango} onValueChange={(v) => setRango(v as RangoPreset)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {onlineQ.error || historicoQ.error ? (
            <div className="py-10 text-center text-sm text-red-600">
              Error al cargar:{" "}
              {(onlineQ.error as Error)?.message ||
                (historicoQ.error as Error)?.message}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Portal</TableHead>
                    <TableHead className="text-xs text-right">Online ahora</TableHead>
                    <TableHead className="text-xs text-right">Sesiones activas</TableHead>
                    <TableHead className="text-xs text-right">Usuarios únicos (periodo)</TableHead>
                    <TableHead className="text-xs text-right">Total sesiones</TableHead>
                    <TableHead className="text-xs text-right">Duración prom. (min)</TableHead>
                    <TableHead className="text-xs">Última sesión</TableHead>
                    <TableHead className="text-xs text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalesOrdenados.map((p) => {
                    const online = onlineMap.get(p);
                    const hist = (historicoQ.data ?? []).find((h) => h.portal === p);
                    const isOnline = !!online && online.usuarios_online > 0;
                    const hasActividad =
                      isOnline ||
                      (hist?.usuarios_unicos ?? 0) > 0 ||
                      (hist?.total_sesiones ?? 0) > 0;
                    return (
                      <TableRow
                        key={p}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40",
                          !hasActividad && "opacity-70",
                        )}
                        onClick={() => setDetallePortal(p)}
                      >
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block w-1.5 h-1.5 rounded-full",
                                isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted",
                              )}
                            />
                            {PORTAL_LABEL[p] ?? p}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {p}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isOnline ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {online!.usuarios_online}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {online?.sesiones_activas ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {hist?.usuarios_unicos ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {hist?.total_sesiones ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {hist?.duracion_promedio_min != null
                            ? Number(hist.duracion_promedio_min).toFixed(1)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {hist?.ultima_sesion ? formatRelativo(hist.ultima_sesion) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            data-cta="alta-direccion.mediciones.ver-usuarios-portal"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetallePortal(p);
                            }}
                          >
                            Ver usuarios
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
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

      <DetalleUsuariosSheet
        portal={detallePortal}
        rangoLabel={RANGO_LABEL[rango]}
        desde={desde}
        onClose={() => setDetallePortal(null)}
      />
    </>
  );
}

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  tone: "emerald" | "blue" | "amber";
  label: string;
  value: string;
  sub: string;
}) {
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-50 ring-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-900/40 dark:text-emerald-300"
      : tone === "blue"
        ? "bg-blue-50 ring-blue-200 text-blue-700 dark:bg-blue-950/30 dark:ring-blue-900/40 dark:text-blue-300"
        : "bg-amber-50 ring-amber-200 text-amber-700 dark:bg-amber-950/30 dark:ring-amber-900/40 dark:text-amber-300";
  return (
    <div className={cn("rounded-xl ring-1 p-4", toneCls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/60 dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function formatRelativo(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "hace segundos";
    if (min < 60) return `hace ${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias < 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
    return date.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

/**
 * Sheet drill-down — detalle de usuarios por portal. Permite a Alta
 * Dirección ver quién está online, quiénes son los usuarios únicos del
 * periodo, y filtrar los inactivos (7+ días / 30+ días) para
 * identificarlos y contactarlos.
 *
 * Consume `usuarios_actividad_por_portal(portal, desde, hasta)`. Si la
 * RPC no existe en BD (DDL pendiente), muestra un fallback explicativo
 * en vez de romper la página.
 */
function DetalleUsuariosSheet({
  portal,
  rangoLabel,
  desde,
  onClose,
}: {
  portal: string | null;
  rangoLabel: string;
  desde: string | null;
  onClose: () => void;
}) {
  const [segmento, setSegmento] = useState<SegmentoDetalle>("todos");
  const [busqueda, setBusqueda] = useState("");

  const q = useQuery<DetalleUsuarioRow[]>({
    queryKey: ["mediciones", "detalle-usuarios", portal, desde],
    enabled: !!portal,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "usuarios_actividad_por_portal",
        { p_portal: portal, p_desde: desde, p_hasta: null },
      );
      if (error) throw error;
      return (data ?? []) as DetalleUsuarioRow[];
    },
  });

  // Reset filtros al cambiar de portal
  const handleClose = () => {
    setSegmento("todos");
    setBusqueda("");
    onClose();
  };

  const filas = q.data ?? [];

  // Conteos por segmento (para mostrarlos en los botones).
  const conteos = useMemo(() => {
    const online = filas.filter((r) => r.esta_online).length;
    const inactivos7 = filas.filter(
      (r) => !r.esta_online && (r.dias_desde_ultima_actividad ?? 0) >= 7,
    ).length;
    const inactivos30 = filas.filter(
      (r) => !r.esta_online && (r.dias_desde_ultima_actividad ?? 0) >= 30,
    ).length;
    return { online, inactivos7, inactivos30, total: filas.length };
  }, [filas]);

  // Filas filtradas por segmento + búsqueda libre
  const filasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((r) => {
      if (segmento === "online" && !r.esta_online) return false;
      if (segmento === "inactivos_7") {
        if (r.esta_online) return false;
        if ((r.dias_desde_ultima_actividad ?? 0) < 7) return false;
      }
      if (segmento === "inactivos_30") {
        if (r.esta_online) return false;
        if ((r.dias_desde_ultima_actividad ?? 0) < 30) return false;
      }
      if (!q) return true;
      const text = `${r.email_usuario ?? ""} ${r.nombre_usuario ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [filas, segmento, busqueda]);

  // Detectar fallback por RPC inexistente (PGRST202 / 42883 según versión).
  const errMsg = q.error
    ? ((q.error as any).message as string) ||
      ((q.error as any).details as string) ||
      "Error al cargar"
    : null;
  const isRpcMissing =
    !!errMsg &&
    /usuarios_actividad_por_portal|PGRST202|function .* does not exist/i.test(errMsg);

  return (
    <Sheet open={!!portal} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Detalle de usuarios — {portal ? PORTAL_LABEL[portal] ?? portal : ""}
          </SheetTitle>
          <SheetDescription>
            Rango aplicado: {rangoLabel.toLowerCase()} · Filtra por segmento o
            busca por email/nombre para identificar usuarios a contactar.
          </SheetDescription>
        </SheetHeader>

        {isRpcMissing ? (
          <div className="mt-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
            La RPC <code className="font-mono">usuarios_actividad_por_portal</code> aún
            no está disponible en BD. Aplicar el DDL en{" "}
            <code className="font-mono">
              Ejecuciones_manuales/mediciones_uso_portales_drill_down_usuarios.md
            </code>{" "}
            y refrescar.
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SegmentButton
                active={segmento === "todos"}
                onClick={() => setSegmento("todos")}
                label="Todos"
                count={conteos.total}
                tone="default"
              />
              <SegmentButton
                active={segmento === "online"}
                onClick={() => setSegmento("online")}
                label="Online ahora"
                count={conteos.online}
                tone="emerald"
              />
              <SegmentButton
                active={segmento === "inactivos_7"}
                onClick={() => setSegmento("inactivos_7")}
                label="Inactivos +7 días"
                count={conteos.inactivos7}
                tone="amber"
              />
              <SegmentButton
                active={segmento === "inactivos_30"}
                onClick={() => setSegmento("inactivos_30")}
                label="Inactivos +30 días"
                count={conteos.inactivos30}
                tone="red"
              />
            </div>

            <div className="mt-3 relative">
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por email o nombre…"
                className="pr-8 text-sm"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {q.isLoading
                  ? "Cargando…"
                  : `${filasVisibles.length} ${filasVisibles.length === 1 ? "usuario" : "usuarios"}`}
              </span>
              {filasVisibles.length > 0 && (
                <Button
                  data-cta="alta-direccion.mediciones.copiar-emails-detalle"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    const emails = filasVisibles
                      .map((r) => r.email_usuario)
                      .filter(Boolean)
                      .join("; ");
                    void navigator.clipboard.writeText(emails);
                  }}
                  title="Copiar emails de los usuarios visibles"
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Copiar emails
                </Button>
              )}
            </div>

            <div className="mt-2 rounded-md border overflow-x-auto">
              {q.isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
                </div>
              ) : q.error && !isRpcMissing ? (
                <div className="py-12 text-center text-sm text-red-600">
                  Error: {errMsg}
                </div>
              ) : filasVisibles.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Sin usuarios en este segmento.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Usuario</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Sesiones</TableHead>
                      <TableHead className="text-xs text-right">Duración total (min)</TableHead>
                      <TableHead className="text-xs">Última actividad</TableHead>
                      <TableHead className="text-xs">Primera sesión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasVisibles.map((r) => (
                      <TableRow key={r.id_usuario}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{r.nombre_usuario || r.email_usuario}</div>
                          <div className="text-[11px] text-muted-foreground font-mono break-all">
                            {r.email_usuario}
                          </div>
                        </TableCell>
                        <TableCell>
                          <EstadoBadge
                            online={r.esta_online}
                            dias={r.dias_desde_ultima_actividad ?? null}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.total_sesiones}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.duracion_total_min != null
                            ? Number(r.duracion_total_min).toFixed(1)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.ultima_actividad ? formatRelativo(r.ultima_actividad) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.primera_sesion
                            ? new Date(r.primera_sesion).toISOString().slice(0, 10)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "default" | "emerald" | "amber" | "red";
}) {
  const toneCls = active
    ? tone === "emerald"
      ? "bg-emerald-600 text-white"
      : tone === "amber"
        ? "bg-amber-600 text-white"
        : tone === "red"
          ? "bg-red-600 text-white"
          : "bg-foreground text-background"
    : "bg-card hover:bg-muted/60 text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border border-border px-3 py-2 text-left transition-colors",
        toneCls,
      )}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
      <span className="mt-0.5 text-lg font-bold tabular-nums">{count}</span>
    </button>
  );
}

function EstadoBadge({
  online,
  dias,
}: {
  online: boolean;
  dias: number | null;
}) {
  if (online) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
        Online
      </Badge>
    );
  }
  if (dias != null && dias >= 30) {
    return (
      <Badge variant="outline" className="border-red-400 text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300">
        Inactivo {dias}d
      </Badge>
    );
  }
  if (dias != null && dias >= 7) {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
        Inactivo {dias}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {dias != null ? `Hace ${dias}d` : "Sin datos"}
    </Badge>
  );
}
