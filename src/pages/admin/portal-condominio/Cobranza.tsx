import { PageHeader, KPICard, StatusBadge } from "./_helpers";
import { cobranza, formatMXN, antiguedad } from "@/data/portalCondominio/mockData";

export default function Cobranza() {
  const total = cobranza.reduce((s, c) => s + c.monto_vencido, 0);
  const promesas = cobranza.filter((c) => c.tipo_accion === "promesa_pago").length;

  return (
    <div>
      <PageHeader title="Cobranza" subtitle={`${cobranza.length} casos activos`} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <KPICard title="Cartera vencida" value={formatMXN(total)} variant="danger" />
        <KPICard title="Casos activos" value={String(cobranza.length)} variant="warning" />
        <KPICard title="Promesas pago" value={String(promesas)} />
        <KPICard title="Cuentas 90+ días" value={String(cobranza.filter((c) => c.antiguedad === "90+").length)} variant="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
        {antiguedad.map((a) => (
          <div key={a.rango} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{a.rango}</p>
            <p className="text-lg font-bold tabular-nums">{formatMXN(a.monto)}</p>
            <p className="text-xs text-muted-foreground">{a.cuentas} cuentas</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Propietario</th>
              <th className="px-3 py-2 text-right">Monto vencido</th>
              <th className="px-3 py-2 text-left">Antigüedad</th>
              <th className="px-3 py-2 text-left">Última acción</th>
              <th className="px-3 py-2 text-left">Agente</th>
              <th className="px-3 py-2 text-left">Promesa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cobranza.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">#{c.unidad_numero}</td>
                <td className="px-3 py-2">{c.propietario}</td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatMXN(c.monto_vencido)}</td>
                <td className="px-3 py-2"><StatusBadge label={c.antiguedad} tone={c.antiguedad === "90+" ? "danger" : c.antiguedad === "61-90" ? "warning" : "default"} /></td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{c.tipo_accion.replace("_", " ")}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.agente}</td>
                <td className="px-3 py-2">{c.fecha_promesa || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}