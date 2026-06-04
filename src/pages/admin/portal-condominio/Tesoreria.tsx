import { PageHeader, KPICard, StatusBadge } from "./_helpers";
import { egresos, formatMXN, getKPIs } from "@/data/portalCondominio/mockData";
import { Plus } from "lucide-react";

export default function Tesoreria() {
  const k = getKPIs();
  const byCat = egresos.reduce<Record<string, number>>((acc, e) => { acc[e.categoria] = (acc[e.categoria] || 0) + e.monto; return acc; }, {});

  return (
    <div>
      <PageHeader
        title="Tesorería"
        subtitle="Ingresos y egresos del condominio"
        actions={<button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"><Plus className="h-4 w-4" /> Nuevo egreso</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <KPICard title="Ingresos del mes" value={formatMXN(k.totalCobrado)} variant="success" />
        <KPICard title="Egresos del mes" value={formatMXN(k.totalEgresos)} variant="warning" />
        <KPICard title="Balance neto" value={formatMXN(k.balanceNeto)} />
        <KPICard title="Egresos pendientes" value={String(egresos.filter((e) => e.estatus !== "pagado").length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {Object.entries(byCat).map(([cat, monto]) => (
          <div key={cat} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{cat}</p>
            <p className="text-lg font-bold tabular-nums">{formatMXN(monto)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Proveedor</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {egresos.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">{e.fecha}</td>
                <td className="px-3 py-2">{e.categoria}</td>
                <td className="px-3 py-2">{e.concepto}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.proveedor}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMXN(e.monto)}</td>
                <td className="px-3 py-2"><StatusBadge label={e.estatus} tone={e.estatus === "pagado" ? "success" : e.estatus === "programado" ? "info" : "warning"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}