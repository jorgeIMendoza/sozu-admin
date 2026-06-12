/**
 * Mediciones · Mapa de calor de CTAs — Portal Alta Dirección.
 *
 * Consume `accesos_por_cta(portal, desde?, hasta?, id_submenu?)` para
 * mostrar el ranking de CTAs clickeados por los usuarios en el portal
 * seleccionado. Sirve como insight de qué acciones se usan más / cuáles
 * podrían mejorar su UX.
 *
 * El listado de CTAs se construye sembrando `data-cta="<nombre>"` en los
 * botones. El listener global del `PortalTrackingProvider` (Fase 2)
 * captura cualquier click sobre ese atributo y lo registra como
 * `cta_click`.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, MousePointerClick } from "lucide-react";
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

type CtaRow = {
  cta_nombre: string;
  id_submenu: number | null;
  submenu_nombre: string | null;
  clicks: number;
  usuarios_unicos: number;
  ultimo_click: string | null;
};

const SUBMENU_ALL = "__all__";

export default function MedicionesCtasPage() {
  const [portal, setPortal] = useState<string>("clientes");
  const [rango, setRango] = useState<RangoPreset>("mes");
  const [submenuFilter, setSubmenuFilter] = useState<string>(SUBMENU_ALL);

  const desde = useMemo(() => {
    const horas = RANGO_HORAS[rango];
    if (horas == null) return null;
    return new Date(Date.now() - horas * 3600 * 1000).toISOString();
  }, [rango]);

  const q = useQuery<CtaRow[]>({
    queryKey: ["mediciones", "ctas", portal, rango, submenuFilter],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("accesos_por_cta", {
        p_portal: portal,
        p_desde: desde,
        p_hasta: null,
        p_id_submenu: submenuFilter === SUBMENU_ALL ? null : Number(submenuFilter),
      });
      if (error) throw error;
      return (data ?? []) as CtaRow[];
    },
  });

  const filas = q.data ?? [];
  const maxClicks = filas.reduce((m, r) => Math.max(m, r.clicks), 0) || 1;
  const totalClicks = filas.reduce((s, r) => s + r.clicks, 0);

  // Opciones de submenú: derivadas de las filas devueltas (cuando hay
  // resultados) — permite acotar el ranking a un submenú específico.
  const submenuOptions = useMemo(() => {
    const seen = new Map<number, string>();
    filas.forEach((r) => {
      if (r.id_submenu != null && r.submenu_nombre) {
        seen.set(r.id_submenu, r.submenu_nombre);
      }
    });
    return Array.from(seen.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [filas]);

  return (
    <>
      <PageHeader
        title="Mapa de calor de CTAs"
        description="Ranking de CTAs por clicks en el portal seleccionado — fuente: atributos data-cta sembrados en la UI."
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
        <Select value={portal} onValueChange={(v) => { setPortal(v); setSubmenuFilter(SUBMENU_ALL); }}>
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

        {submenuOptions.length > 0 && (
          <Select value={submenuFilter} onValueChange={setSubmenuFilter}>
            <SelectTrigger className="h-9 w-[240px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={SUBMENU_ALL}>Todos los submenús</SelectItem>
              {submenuOptions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {q.isLoading
            ? "Cargando…"
            : `${filas.length} ${filas.length === 1 ? "CTA" : "CTAs"} · ${totalClicks} ${totalClicks === 1 ? "click" : "clicks"}`}
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
              Cargando CTAs…
            </div>
          ) : filas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <MousePointerClick className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p>Sin CTAs registrados en {PORTAL_LABEL[portal] ?? portal} para este rango.</p>
              <p className="text-xs">
                Para que los CTAs aparezcan aquí, deben tener el atributo{" "}
                <code className="bg-muted px-1 rounded">data-cta="nombre.del.cta"</code>{" "}
                en su botón.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">CTA</TableHead>
                    <TableHead className="text-xs">Submenú</TableHead>
                    <TableHead className="text-xs text-right">Clicks</TableHead>
                    <TableHead className="text-xs text-right">Usuarios únicos</TableHead>
                    <TableHead className="text-xs">Calor</TableHead>
                    <TableHead className="text-xs">Último click</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((r, i) => {
                    const pct = r.clicks / maxClicks;
                    return (
                      <TableRow key={`${r.cta_nombre}-${r.id_submenu}-${i}`}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell className="text-sm">
                          <code className="text-[12px] font-mono">{r.cta_nombre}</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.submenu_nombre || (
                            <span className="italic">Sin submenú</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.clicks}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.usuarios_unicos}
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <HeatBar pct={pct} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.ultimo_click ? formatRelativo(r.ultimo_click) : "—"}
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
