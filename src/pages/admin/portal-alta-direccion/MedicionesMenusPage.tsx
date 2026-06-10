/**
 * Mediciones · Mapa de calor de menús — Portal Alta Dirección.
 *
 * Consume `accesos_por_menu(portal, desde?, hasta?)` para mostrar la
 * frecuencia de navegación de cada menú/submenú del portal seleccionado.
 *
 * El mapa de calor se renderiza como barra horizontal con intensidad
 * relativa al submenú más visitado (max=1).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  "24h": 24, semana: 168, mes: 720, trimestre: 2160, todo: null,
};
const RANGO_LABEL: Record<RangoPreset, string> = {
  "24h": "Últimas 24 h",
  semana: "Última semana",
  mes: "Último mes",
  trimestre: "Último trimestre",
  todo: "Todo el histórico",
};

type AccesoMenuRow = {
  id_menu: number | null;
  menu_nombre: string | null;
  id_submenu: number | null;
  submenu_nombre: string | null;
  vista_front_end: string | null;
  accesos: number;
  usuarios_unicos: number;
  ultimo_acceso: string | null;
};

export default function MedicionesMenusPage() {
  const [portal, setPortal] = useState<string>("clientes");
  const [rango, setRango] = useState<RangoPreset>("mes");

  const desde = useMemo(() => {
    const horas = RANGO_HORAS[rango];
    if (horas == null) return null;
    return new Date(Date.now() - horas * 3600 * 1000).toISOString();
  }, [rango]);

  const q = useQuery<AccesoMenuRow[]>({
    queryKey: ["mediciones", "menus", portal, rango],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("accesos_por_menu", {
        p_portal: portal,
        p_desde: desde,
        p_hasta: null,
      });
      if (error) throw error;
      return (data ?? []) as AccesoMenuRow[];
    },
  });

  const filas = q.data ?? [];
  const maxAccesos = filas.reduce((m, r) => Math.max(m, r.accesos), 0) || 1;
  const totalAccesos = filas.reduce((s, r) => s + r.accesos, 0);

  return (
    <>
      <PageHeader
        title="Mapa de calor de menús"
        description="Accesos por menú / submenú del portal seleccionado — intensidad relativa al submenú más visitado."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", q.isFetching && "animate-spin")} />
            Actualizar
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={portal} onValueChange={setPortal}>
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue placeholder="Selecciona portal…" />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {Object.entries(PORTAL_LABEL)
              .sort((a, b) => a[1].localeCompare(b[1], "es"))
              .map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={rango} onValueChange={(v) => setRango(v as RangoPreset)}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {q.isLoading
            ? "Cargando…"
            : `${filas.length} ${filas.length === 1 ? "fila" : "filas"} · ${totalAccesos} ${totalAccesos === 1 ? "acceso" : "accesos"}`}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {q.error ? (
            <div className="py-10 text-center text-sm text-red-600">
              Error al cargar: {(q.error as Error).message}
            </div>
          ) : q.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Cargando accesos…
            </div>
          ) : filas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sin accesos registrados en el portal {PORTAL_LABEL[portal] ?? portal} para
              el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Menú</TableHead>
                    <TableHead className="text-xs">Submenú</TableHead>
                    <TableHead className="text-xs">Ruta</TableHead>
                    <TableHead className="text-xs text-right">Accesos</TableHead>
                    <TableHead className="text-xs text-right">Usuarios únicos</TableHead>
                    <TableHead className="text-xs">Calor</TableHead>
                    <TableHead className="text-xs">Último acceso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((r, i) => {
                    const pct = r.accesos / maxAccesos;
                    return (
                      <TableRow key={`${r.id_menu}-${r.id_submenu}-${i}`}>
                        <TableCell className="text-sm">
                          {r.menu_nombre || (
                            <span className="text-muted-foreground italic">Sin menú</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.submenu_nombre || (
                            <span className="text-muted-foreground italic">Sin submenú</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
                          {r.vista_front_end ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.accesos}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.usuarios_unicos}
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <HeatBar pct={pct} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.ultimo_acceso ? formatRelativo(r.ultimo_acceso) : "—"}
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

function HeatBar({ pct }: { pct: number }) {
  // Gradiente verde → ámbar → rojo conforme aumenta el % relativo al máximo
  // de la tabla. Tooltip con el porcentaje.
  const clamped = Math.max(0, Math.min(1, pct));
  const color =
    clamped > 0.66
      ? "bg-red-500"
      : clamped > 0.33
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div
      className="h-2 w-full bg-muted/40 rounded-full overflow-hidden"
      title={`${Math.round(clamped * 100)}% del máximo`}
    >
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.max(2, clamped * 100)}%` }}
      />
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
