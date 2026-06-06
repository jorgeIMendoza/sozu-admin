import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, KPICard, EstadoVista, StatusBadge } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(0,50%,45%)"];

const conciliacionLabel: Record<string, string> = {
  conciliado: "Conciliado",
  excepcion: "Excepción",
  pendiente: "Pendiente",
};

export default function CondominioDashboard() {
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ["condominio-dataset", proyectoId] });
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  if (isLoading || error || !data) {
    return (
      <div>
        <PageHeader title="Dashboard Condominio" subtitle="Vista general" />
        <EstadoVista isLoading={isLoading} error={error} />
      </div>
    );
  }

  const k = data.kpis;
  const excepciones = data.pagos
    .filter((p) => p.estatus_conciliacion !== "conciliado")
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard Condominio"
        subtitle={`Vista general · ${data.proyecto_nombre}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-[12px]"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refrescar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Cobranza esperada"
          value={formatMXN(k.totalEsperado)}
          subtitle={`${k.numUnidades} ${k.numUnidades === 1 ? "unidad" : "unidades"}`}
        />
        <KPICard
          title="Cobrado histórico"
          value={formatMXN(k.totalCobrado)}
          subtitle={`${k.tasaCobranza}% de avance`}
          variant="success"
        />
        <KPICard
          title="Cartera vencida"
          value={formatMXN(k.totalVencido)}
          subtitle={`${k.morosos} ${k.morosos === 1 ? "moroso" : "morosos"}`}
          variant="danger"
        />
        <KPICard
          title="Excepciones"
          value={String(k.excepciones)}
          subtitle="Pagos por revisar"
          variant="warning"
        />
        <KPICard
          title="Saldo pendiente"
          value={formatMXN(k.saldoPendiente)}
          subtitle="Por cobrar total"
        />
      </div>

      {/* Tendencia + Antigüedad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Tendencia mensual</h2>
          {data.tendenciaMensual.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-10 text-center">
              Sin movimientos registrados.
            </p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={data.tendenciaMensual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => abbrMxn(Number(v))} />
                  <Tooltip
                    formatter={(v: number) => formatMXN(v)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="esperado" name="Esperado" fill="hsl(213,27%,84%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cobrado" name="Cobrado" fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Antigüedad de cartera</h2>
          {data.antiguedad.every((b) => b.monto === 0) ? (
            <p className="text-[13px] text-muted-foreground py-10 text-center">
              Sin cartera pendiente.
            </p>
          ) : (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data.antiguedad}
                      dataKey="monto"
                      nameKey="rango"
                      outerRadius={75}
                      label={(d: any) => d.rango}
                    >
                      {data.antiguedad.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatMXN(v)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 mt-2">
                {data.antiguedad.map((b, i) => (
                  <li key={b.rango} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      {b.rango}
                    </span>
                    <span className="tabular-nums">
                      {formatMXN(b.monto)}{" "}
                      <span className="text-muted-foreground/70">
                        ({b.cuentas} {b.cuentas === 1 ? "cta." : "ctas."})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Excepciones + Top morosos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Excepciones recientes */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Excepciones recientes
            </h2>
            {excepciones.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => navigate("/admin/portal-condominio/pagos")}
              >
                Ver todas →
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border text-sm">
            {excepciones.map((p) => (
              <li key={p.id} className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      #{p.unidad_numero}{" "}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        · {p.folio_mant}
                      </span>
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">{p.propietario}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StatusBadge
                        label={conciliacionLabel[p.estatus_conciliacion] ?? p.estatus_conciliacion}
                        tone={p.estatus_conciliacion === "excepcion" ? "danger" : "warning"}
                      />
                      <span className="text-[11px] text-muted-foreground/70">
                        {p.fecha || "—"} · {p.metodo_pago}
                      </span>
                    </div>
                    {p.nota_conciliacion && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1 italic">
                        {p.nota_conciliacion}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap">
                    {formatMXN(p.monto)}
                  </span>
                </div>
              </li>
            ))}
            {excepciones.length === 0 && (
              <li className="px-4 py-6 text-[13px] text-muted-foreground text-center">
                Sin excepciones — todos los pagos están conciliados.
              </li>
            )}
          </ul>
        </div>

        {/* Top morosos */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Top morosos</h2>
            {data.morosos.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => navigate("/admin/portal-condominio/cobranza")}
              >
                Ver cobranza →
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border text-sm">
            {data.morosos.slice(0, 6).map((m) => (
              <li
                key={m.id}
                className="px-4 py-3 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/admin/portal-condominio/departamentos/${m.unidad_numero}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">#{m.unidad_numero}</p>
                    <p className="text-[12px] text-muted-foreground truncate max-w-[200px]">
                      {m.propietario}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          m.antiguedad === "90+"
                            ? "border-red-500 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40"
                            : m.antiguedad === "61-90"
                              ? "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40"
                              : m.antiguedad === "31-60"
                                ? "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40"
                                : "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
                        )}
                      >
                        {m.antiguedad} días
                      </Badge>
                      {m.ultimo_pago && (
                        <span className="text-[11px] text-muted-foreground/70">
                          Últ. pago: {m.ultimo_pago}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="tabular-nums text-destructive font-semibold whitespace-nowrap">
                    {formatMXN(m.monto_vencido)}
                  </span>
                </div>
              </li>
            ))}
            {data.morosos.length === 0 && (
              <li className="px-4 py-6 text-[13px] text-muted-foreground text-center">
                Sin morosos — todas las unidades al corriente.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function abbrMxn(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}
