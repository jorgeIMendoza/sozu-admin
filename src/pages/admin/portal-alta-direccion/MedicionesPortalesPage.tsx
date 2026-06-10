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
import { Users, Clock, BarChart3, Activity, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export default function MedicionesPortalesPage() {
  const [rango, setRango] = useState<RangoPreset>("mes");

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalesOrdenados.map((p) => {
                    const online = onlineMap.get(p);
                    const hist = (historicoQ.data ?? []).find((h) => h.portal === p);
                    const isOnline = !!online && online.usuarios_online > 0;
                    return (
                      <TableRow key={p}>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
