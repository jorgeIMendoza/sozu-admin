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
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, BarChart3, Activity, RefreshCw, ChevronRight, X, Mail, Loader2, Monitor, Smartphone, Tablet, HelpCircle, PieChart as PieChartIcon, Cpu, Globe, Tag, Radio, type LucideIcon } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
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

/** Tipos de dispositivo (clasificados desde user_agent en el RPC dispositivos_uso_por_portal). */
const DEVICE_ORDER = ["desktop", "iphone", "android_phone", "ipad", "android_tablet", "app", "desconocido"] as const;
type DeviceKey = (typeof DEVICE_ORDER)[number];
const DEVICE_LABEL: Record<DeviceKey, string> = {
  desktop: "Escritorio",
  iphone: "iPhone (iOS)",
  android_phone: "Android (teléfono)",
  ipad: "iPad (tablet iOS)",
  android_tablet: "Android (tablet)",
  app: "App clientes",
  desconocido: "Desconocido",
};
const DEVICE_ICON: Record<DeviceKey, LucideIcon> = {
  desktop: Monitor,
  iphone: Smartphone,
  android_phone: Smartphone,
  ipad: Tablet,
  android_tablet: Tablet,
  app: Smartphone,
  desconocido: HelpCircle,
};
type DispositivoRow = { portal: string; tipo_dispositivo: string; usuarios_unicos: number; total_sesiones: number };

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
  // Derivados del user_agent de la sesión MÁS reciente del usuario (RPC).
  // Opcionales: si la RPC aún no fue actualizada en BD, llegan undefined
  // y la UI degrada a "—" sin romperse.
  tipo_dispositivo?: string | null;
  marca_dispositivo?: string | null;
  navegador?: string | null;
};

/** Tipo de dispositivo por usuario (móvil / tablet / escritorio). Nota: el
 *  user_agent no permite distinguir laptop de escritorio — ambos = "desktop". */
const USER_DEVICE_LABEL: Record<string, string> = {
  desktop: "Escritorio / Laptop",
  mobile: "Móvil",
  tablet: "Tablet",
  app: "App clientes",
  desconocido: "Desconocido",
};
const USER_DEVICE_ICON: Record<string, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  app: Smartphone,
  desconocido: HelpCircle,
};

type SegmentoDetalle = "todos" | "online" | "inactivos_7" | "inactivos_30";

export default function MedicionesPortalesPage() {
  const [rango, setRango] = useState<RangoPreset>("mes");
  const [detallePortal, setDetallePortal] = useState<string | null>(null);
  const [graficosPortal, setGraficosPortal] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const desde = useMemo(() => {
    const horas = RANGO_HORAS[rango];
    if (horas == null) return null;
    return new Date(Date.now() - horas * 3600 * 1000).toISOString();
  }, [rango]);

  // Realtime: cualquier INSERT/UPDATE en portal_sesiones (sesión nueva,
  // heartbeat, cierre) invalida todas las queries de mediciones. Debounce de
  // 2s porque los heartbeats de todos los portales llegan en ráfagas.
  // Requiere que la tabla esté en la publicación supabase_realtime + policy
  // SELECT para staff; si no lo está, el canal simplemente no emite y la
  // página degrada al polling de 30s ya existente.
  const invalidateTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel("mediciones-portal-sesiones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_sesiones" },
        () => {
          if (invalidateTimerRef.current != null) return;
          invalidateTimerRef.current = window.setTimeout(() => {
            invalidateTimerRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["mediciones"] });
          }, 2_000);
        },
      )
      .subscribe();
    return () => {
      if (invalidateTimerRef.current != null) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Uso por tipo de dispositivo (clasificado en BD desde user_agent).
  const dispositivosQ = useQuery<DispositivoRow[]>({
    queryKey: ["mediciones", "dispositivos", rango],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "dispositivos_uso_por_portal",
        { p_desde: desde, p_hasta: null },
      );
      // Probe graceful: si la función aún no existe, no romper la página.
      if (error) return [];
      return (data ?? []) as DispositivoRow[];
    },
  });

  const onlineMap = useMemo(() => {
    const m = new Map<string, OnlineRow>();
    (onlineQ.data ?? []).forEach((r) => m.set(r.portal, r));
    return m;
  }, [onlineQ.data]);

  // Sesiones por dispositivo: por portal + totales globales + tipos presentes.
  const dispositivos = useMemo(() => {
    const rows = dispositivosQ.data ?? [];
    const porPortal = new Map<string, Record<string, number>>();
    const global: Record<string, number> = {};
    for (const r of rows) {
      const tipo = (DEVICE_ORDER as readonly string[]).includes(r.tipo_dispositivo)
        ? r.tipo_dispositivo
        : "desconocido";
      const bucket = porPortal.get(r.portal) ?? {};
      bucket[tipo] = (bucket[tipo] ?? 0) + r.total_sesiones;
      porPortal.set(r.portal, bucket);
      global[tipo] = (global[tipo] ?? 0) + r.total_sesiones;
    }
    // Columnas a mostrar: las 5 principales siempre; "app"/"desconocido" solo si hay.
    const cols = DEVICE_ORDER.filter(
      (k) => (k !== "desconocido" && k !== "app") || (global[k] ?? 0) > 0,
    );
    const totalGlobal = Object.values(global).reduce((s, n) => s + n, 0);
    const portales = [...porPortal.keys()].sort(
      (a, b) =>
        Object.values(porPortal.get(b)!).reduce((s, n) => s + n, 0) -
        Object.values(porPortal.get(a)!).reduce((s, n) => s + n, 0),
    );
    return { porPortal, global, cols, totalGlobal, portales };
  }, [dispositivosQ.data]);

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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              data-cta="alta-direccion.mediciones.ver-graficos-portal"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px] px-2"
                              title="Resumen gráfico por dispositivo, tecnología, navegador y marca"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGraficosPortal(p);
                              }}
                            >
                              <PieChartIcon className="h-3.5 w-3.5 mr-0.5" />
                              Gráficos
                            </Button>
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

      {/* ─── Uso por tipo de dispositivo ─── */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Uso por tipo de dispositivo</h3>
            <Badge variant="outline" className="ml-1 text-[10px]">{RANGO_LABEL[rango]}</Badge>
          </div>

          {dispositivosQ.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : dispositivos.totalGlobal === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin sesiones con dispositivo identificado en este período.
            </p>
          ) : (
            <>
              {/* Resumen global por dispositivo */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {dispositivos.cols.map((k) => {
                  const Icon = DEVICE_ICON[k];
                  const val = dispositivos.global[k] ?? 0;
                  const pct = dispositivos.totalGlobal > 0 ? Math.round((val / dispositivos.totalGlobal) * 100) : 0;
                  return (
                    <div key={k} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" /> {DEVICE_LABEL[k]}
                      </div>
                      <p className="mt-1 text-xl font-bold tabular-nums">{val.toLocaleString("es-MX")}</p>
                      <p className="text-[11px] text-muted-foreground">{pct}% de sesiones</p>
                    </div>
                  );
                })}
              </div>

              {/* Desglose por portal */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Portal</TableHead>
                      {dispositivos.cols.map((k) => (
                        <TableHead key={k} className="text-right text-xs whitespace-nowrap">{DEVICE_LABEL[k]}</TableHead>
                      ))}
                      <TableHead className="text-right text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispositivos.portales.map((p) => {
                      const bucket = dispositivos.porPortal.get(p) ?? {};
                      const total = Object.values(bucket).reduce((s, n) => s + n, 0);
                      return (
                        <TableRow key={p}>
                          <TableCell className="text-sm font-medium">{PORTAL_LABEL[p] ?? p}</TableCell>
                          {dispositivos.cols.map((k) => (
                            <TableCell key={k} className="text-right text-sm tabular-nums text-muted-foreground">
                              {(bucket[k] ?? 0) || "—"}
                            </TableCell>
                          ))}
                          <TableCell className="text-right text-sm font-semibold tabular-nums">{total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Conteo de sesiones por dispositivo, clasificado desde el navegador del usuario.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <DetalleUsuariosSheet
        portal={detallePortal}
        rangoLabel={RANGO_LABEL[rango]}
        desde={desde}
        onClose={() => setDetallePortal(null)}
      />

      <GraficosDispositivosSheet
        portal={graficosPortal}
        rangoLabel={RANGO_LABEL[rango]}
        desde={desde}
        onClose={() => setGraficosPortal(null)}
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

/* ─────────────────────────────────────────────────────────────────────────
 * Resumen gráfico por portal — dispositivo / tecnología / navegador / marca.
 * Consume la RPC `desglose_uso_dispositivos_portal(portal, desde, hasta)`.
 * ───────────────────────────────────────────────────────────────────────── */

type DesgloseRow = {
  dimension: string;
  valor: string;
  usuarios_unicos: number;
  total_sesiones: number;
};

type Metrica = "sesiones" | "usuarios";
/** Tabs del sheet de gráficos: métricas históricas + vista en vivo. */
type TabGraficos = Metrica | "envivo";

/** Fila de la RPC `sesiones_activas_por_portal` (sesiones en vivo). */
type SesionEnVivoRow = {
  session_id: string;
  email_usuario: string | null;
  nombre_usuario: string | null;
  sesion_inicio: string | null;
  ultima_actividad: string | null;
  tipo_dispositivo: string | null;
  tecnologia: string | null;
  navegador: string | null;
  marca_dispositivo: string | null;
};

/** Dimensiones a graficar, en orden fijo. */
const DIMENSIONES: { key: string; titulo: string; icon: LucideIcon }[] = [
  { key: "tipo", titulo: "Tipo de dispositivo", icon: Smartphone },
  { key: "tecnologia", titulo: "Tecnología (SO)", icon: Cpu },
  { key: "navegador", titulo: "Navegador", icon: Globe },
  { key: "marca", titulo: "Marca del dispositivo", icon: Tag },
];

/** Paleta categórica del design system (definida en index.css: --chart-1..5).
 *  El bucket "Otros" usa un gris neutro — nunca consume un slot categórico. */
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const OTROS_COLOR = "hsl(var(--muted-foreground))";
const MAX_SLICES = 5; // top 5 + "Otros"
/** Valores del RPC que significan "sin clasificar": siempre van al bucket gris "Otros". */
const NEUTRAL_VALUES = new Set(["Otro", "Otros", "Desconocido"]);
/** La app nativa de clientes es categoría de primera clase: nunca se pliega en "Otros". */
const APP_SLICE = "App clientes";

type Slice = { valor: string; valor_num: number; color: string; pct: number };

function GraficosDispositivosSheet({
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
  const [tab, setTab] = useState<TabGraficos>("sesiones");
  const metrica: Metrica = tab === "usuarios" ? "usuarios" : "sesiones";

  const q = useQuery<DesgloseRow[]>({
    queryKey: ["mediciones", "desglose-dispositivos", portal, desde],
    enabled: !!portal && tab !== "envivo",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "desglose_uso_dispositivos_portal",
        { p_portal: portal, p_desde: desde, p_hasta: null },
      );
      if (error) throw error;
      return (data ?? []) as DesgloseRow[];
    },
  });

  const handleClose = () => {
    setTab("sesiones");
    onClose();
  };

  const filas = q.data ?? [];

  // Pivotar por dimensión → slices con color y porcentaje (top 5 + "Otros").
  // "Otros" agrupa SOLO lo no clasificado ('Otro'/'Desconocido' del RPC) más el
  // excedente del top; "App clientes" nunca se pliega ahí (si queda fuera del
  // top desplaza al último clasificado).
  const porDimension = useMemo(() => {
    const out: Record<string, { slices: Slice[]; total: number }> = {};
    for (const dim of DIMENSIONES) {
      const rows = filas
        .filter((r) => r.dimension === dim.key)
        .map((r) => ({
          valor: r.valor,
          valor_num: metrica === "sesiones"
            ? Number(r.total_sesiones ?? 0)
            : Number(r.usuarios_unicos ?? 0),
        }))
        .filter((r) => r.valor_num > 0)
        .sort((a, b) => b.valor_num - a.valor_num);

      const total = rows.reduce((s, r) => s + r.valor_num, 0);

      const nombradas = rows.filter((r) => !NEUTRAL_VALUES.has(r.valor));
      const neutrasNum = rows
        .filter((r) => NEUTRAL_VALUES.has(r.valor))
        .reduce((s, r) => s + r.valor_num, 0);

      const top = nombradas.slice(0, MAX_SLICES);
      const resto = nombradas.slice(MAX_SLICES);
      const appIdx = resto.findIndex((r) => r.valor === APP_SLICE);
      if (appIdx >= 0) {
        const app = resto.splice(appIdx, 1)[0];
        if (top.length === MAX_SLICES) resto.unshift(top.pop()!);
        top.push(app);
      }
      const otrosNum = neutrasNum + resto.reduce((s, r) => s + r.valor_num, 0);

      const slices: Slice[] = top.map((r, i) => ({
        valor: r.valor,
        valor_num: r.valor_num,
        color: CHART_COLORS[i % CHART_COLORS.length],
        pct: total > 0 ? Math.round((r.valor_num / total) * 100) : 0,
      }));
      if (otrosNum > 0) {
        slices.push({
          valor: "Otros",
          valor_num: otrosNum,
          color: OTROS_COLOR,
          pct: total > 0 ? Math.round((otrosNum / total) * 100) : 0,
        });
      }
      out[dim.key] = { slices, total };
    }
    return out;
  }, [filas, metrica]);

  const errMsg = q.error
    ? ((q.error as any).message as string) ||
      ((q.error as any).details as string) ||
      "Error al cargar"
    : null;
  const isRpcMissing =
    !!errMsg &&
    /desglose_uso_dispositivos_portal|PGRST202|function .* does not exist/i.test(errMsg);

  const sinDatos =
    !q.isLoading &&
    !q.error &&
    DIMENSIONES.every((d) => (porDimension[d.key]?.total ?? 0) === 0);

  return (
    <Sheet open={!!portal} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Resumen gráfico — {portal ? PORTAL_LABEL[portal] ?? portal : ""}
          </SheetTitle>
          <SheetDescription>
            {tab === "envivo"
              ? "Sesiones conectadas en este momento — se actualiza en tiempo real."
              : `Rango aplicado: ${rangoLabel.toLowerCase()} · Distribución de ${
                  metrica === "sesiones" ? "sesiones" : "usuarios únicos"
                } por tipo de dispositivo, tecnología, navegador y marca.`}
          </SheetDescription>
        </SheetHeader>

        {isRpcMissing ? (
          <div className="mt-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
            La RPC <code className="font-mono">desglose_uso_dispositivos_portal</code>{" "}
            aún no está disponible en BD. Aplicar el DDL en{" "}
            <code className="font-mono">Ejecuciones_manuales/mediciones_dispositivos.md</code>{" "}
            y refrescar.
          </div>
        ) : (
          <>
            {/* Toggle métrica / en vivo */}
            <div className="mt-5 inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(["sesiones", "usuarios", "envivo"] as TabGraficos[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTab(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                    tab === m
                      ? m === "envivo"
                        ? "bg-emerald-600 text-white"
                        : "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "envivo" && (
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        tab === "envivo" ? "bg-white animate-pulse" : "bg-emerald-500",
                      )}
                    />
                  )}
                  {m === "sesiones" ? "Por sesiones" : m === "usuarios" ? "Por usuarios" : "En vivo"}
                </button>
              ))}
            </div>

            {tab === "envivo" ? (
              <SesionesEnVivoPanel portal={portal} />
            ) : q.isLoading ? (
              <div className="mt-8 flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando gráficos…
              </div>
            ) : q.error && !isRpcMissing ? (
              <div className="mt-8 py-16 text-center text-sm text-red-600">
                Error: {errMsg}
              </div>
            ) : sinDatos ? (
              <div className="mt-8 py-16 text-center text-sm text-muted-foreground">
                Sin sesiones con dispositivo identificado en este período.
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DIMENSIONES.map((dim) => (
                  <DonutCard
                    key={dim.key}
                    titulo={dim.titulo}
                    icon={dim.icon}
                    slices={porDimension[dim.key]?.slices ?? []}
                    total={porDimension[dim.key]?.total ?? 0}
                    metrica={metrica}
                  />
                ))}
              </div>
            )}

            {tab !== "envivo" && (
              <p className="mt-4 text-[11px] text-muted-foreground">
                Clasificado desde el navegador del usuario. Los accesos desde la app
                móvil se cuentan como "App clientes". El user_agent no distingue
                laptop de escritorio (ambos = "Escritorio / Laptop"); la marca en
                Android es aproximada.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Panel "En vivo" — sesiones conectadas ahora mismo en el portal.
 * Consume la RPC `sesiones_activas_por_portal(portal, minutos)`. Se refresca
 * por realtime (invalidación de ["mediciones"]) + polling de respaldo de 15s.
 */
function SesionesEnVivoPanel({ portal }: { portal: string | null }) {
  const q = useQuery<SesionEnVivoRow[]>({
    queryKey: ["mediciones", "en-vivo", portal],
    enabled: !!portal,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "sesiones_activas_por_portal",
        { p_portal: portal, p_minutos_inactividad: 15 },
      );
      if (error) throw error;
      return (data ?? []) as SesionEnVivoRow[];
    },
  });

  const errMsg = q.error
    ? ((q.error as any).message as string) ||
      ((q.error as any).details as string) ||
      "Error al cargar"
    : null;
  const isRpcMissing =
    !!errMsg &&
    /sesiones_activas_por_portal|PGRST202|function .* does not exist/i.test(errMsg);

  if (isRpcMissing) {
    return (
      <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
        La RPC <code className="font-mono">sesiones_activas_por_portal</code> aún no
        está disponible en BD. Aplicar la migración de mediciones en vivo y refrescar.
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando sesiones en vivo…
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="mt-6 py-16 text-center text-sm text-red-600">Error: {errMsg}</div>
    );
  }

  const filas = q.data ?? [];
  const usuariosUnicos = new Set(filas.map((r) => r.email_usuario).filter(Boolean)).size;

  return (
    <div className="mt-5">
      {/* Contador en vivo */}
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
            {filas.length}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filas.length === 1 ? "sesión activa" : "sesiones activas"} ·{" "}
            {usuariosUnicos} {usuariosUnicos === 1 ? "usuario" : "usuarios"} · últimos
            15 min
          </p>
        </div>
        <Radio className="ml-auto h-5 w-5 text-emerald-500" />
      </div>

      {filas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nadie conectado en este momento.
        </p>
      ) : (
        <div className="mt-3 rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Usuario</TableHead>
                <TableHead className="text-xs">Dispositivo</TableHead>
                <TableHead className="text-xs">Navegador</TableHead>
                <TableHead className="text-xs">Marca</TableHead>
                <TableHead className="text-xs">Conectado desde</TableHead>
                <TableHead className="text-xs">Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.session_id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {r.nombre_usuario || r.email_usuario || "—"}
                        </div>
                        {r.nombre_usuario && r.email_usuario && (
                          <div className="text-[11px] text-muted-foreground font-mono break-all">
                            {r.email_usuario}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DispositivoCell tipo={r.tipo_dispositivo} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.navegador || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.marca_dispositivo || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.sesion_inicio ? formatRelativo(r.sesion_inicio) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.ultima_actividad ? formatRelativo(r.ultima_actividad) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Tarjeta con gráfico de dona + leyenda con conteo y porcentaje. */
function DonutCard({
  titulo,
  icon: Icon,
  slices,
  total,
  metrica,
}: {
  titulo: string;
  icon: LucideIcon;
  slices: Slice[];
  total: number;
  metrica: Metrica;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{titulo}</h4>
      </div>

      {total === 0 || slices.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Sin datos</p>
      ) : (
        <div className="flex items-center gap-4">
          {/* Dona con total al centro */}
          <div className="relative h-[104px] w-[104px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={slices}
                  dataKey="valor_num"
                  nameKey="valor"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={50}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {slices.map((s) => (
                    <Cell key={s.valor} fill={s.color} />
                  ))}
                </Pie>
                <ReTooltip content={<DonutTooltip total={total} metrica={metrica} />} />
              </RePieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold tabular-nums leading-none">
                {total.toLocaleString("es-MX")}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {metrica === "sesiones" ? "sesiones" : "usuarios"}
              </span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {slices.map((s) => (
              <div key={s.valor} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={s.valor}>
                  {s.valor}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {s.valor_num.toLocaleString("es-MX")}
                </span>
                <span className="w-9 text-right font-semibold tabular-nums">
                  {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DonutTooltip({
  active,
  payload,
  total,
  metrica,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: Slice }>;
  total: number;
  metrica: Metrica;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const slice = p.payload as Slice | undefined;
  const val = Number(p.value ?? 0);
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{ backgroundColor: slice?.color }}
        />
        <span className="font-medium text-foreground">{slice?.valor}</span>
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {val.toLocaleString("es-MX")} {metrica === "sesiones" ? "sesiones" : "usuarios"} · {pct}%
      </div>
    </div>
  );
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
                      <TableHead className="text-xs">Dispositivo</TableHead>
                      <TableHead className="text-xs">Marca</TableHead>
                      <TableHead className="text-xs">Navegador</TableHead>
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
                        <TableCell>
                          <DispositivoCell tipo={r.tipo_dispositivo} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.marca_dispositivo || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.navegador || "—"}
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

/** Celda de dispositivo por usuario — icono + etiqueta legible. Degrada a
 *  "—" si la RPC todavía no devuelve `tipo_dispositivo`. */
function DispositivoCell({ tipo }: { tipo?: string | null }) {
  if (!tipo) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const key = tipo in USER_DEVICE_LABEL ? tipo : "desconocido";
  const Icon = USER_DEVICE_ICON[key];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {USER_DEVICE_LABEL[key]}
    </span>
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
