import { PageHeader, KPICard, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(0,50%,45%)"];

export default function CondominioDashboard() {
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);

  if (isLoading || error || !data) {
    return (
      <div>
        <PageHeader title="Dashboard Condominio" subtitle="Vista general" />
        <EstadoVista isLoading={isLoading} error={error} />
      </div>
    );
  }

  const k = data.kpis;
  const excepciones = data.pagos.filter((p) => p.estatus_conciliacion !== "conciliado").slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard Condominio" subtitle="Vista general · Mantenimiento" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard title="Cobranza esperada" value={formatMXN(k.totalEsperado)} subtitle={`${k.numUnidades} unidades`} />
        <KPICard title="Cobrado histórico" value={formatMXN(k.totalCobrado)} subtitle={`${k.tasaCobranza}% de avance`} variant="success" />
        <KPICard title="Cartera vencida" value={formatMXN(k.totalVencido)} subtitle={`${k.morosos} morosos`} variant="danger" />
        <KPICard title="Excepciones" value={String(k.excepciones)} subtitle="Pagos por revisar" variant="warning" />
        <KPICard title="Saldo pendiente" value={formatMXN(k.saldoPendiente)} subtitle="Por cobrar total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Tendencia mensual</h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data.tendenciaMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMXN(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="esperado" name="Esperado" fill="hsl(213,27%,84%)" />
                <Bar dataKey="cobrado" name="Cobrado" fill="hsl(142,71%,45%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Antigüedad de cartera</h2>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.antiguedad} dataKey="monto" nameKey="rango" outerRadius={80} label={(d: any) => d.rango}>
                  {data.antiguedad.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatMXN(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Excepciones recientes</h2>
          <ul className="divide-y divide-border text-sm">
            {excepciones.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>#{p.unidad_numero} · {p.referencia}</span>
                <span className="tabular-nums text-warning">{formatMXN(p.monto)}</span>
              </li>
            ))}
            {excepciones.length === 0 && <li className="py-2 text-muted-foreground">Sin excepciones.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Top morosos</h2>
          <ul className="divide-y divide-border text-sm">
            {data.morosos.slice(0, 5).map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>#{c.unidad_numero} · {c.propietario}</span>
                <span className="tabular-nums text-destructive">{formatMXN(c.monto_vencido)}</span>
              </li>
            ))}
            {data.morosos.length === 0 && <li className="py-2 text-muted-foreground">Sin morosos.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
