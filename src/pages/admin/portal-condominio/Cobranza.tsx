import { PageHeader, KPICard, StatusBadge, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";

export default function Cobranza() {
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const morosos = data?.morosos ?? [];
  const antiguedad = data?.antiguedad ?? [];

  const total = morosos.reduce((s, c) => s + c.monto_vencido, 0);
  const cuentas90 = morosos.filter((c) => c.antiguedad === "90+").length;

  return (
    <div>
      <PageHeader title="Cobranza" subtitle={`${morosos.length} casos activos`} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <KPICard title="Cartera vencida" value={formatMXN(total)} variant="danger" />
        <KPICard title="Casos activos" value={String(morosos.length)} variant="warning" />
        <KPICard title="Cuentas 90+ días" value={String(cuentas90)} variant="danger" />
        <KPICard title="Promedio por caso" value={formatMXN(morosos.length ? total / morosos.length : 0)} />
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

      {(isLoading || error) ? (
        <EstadoVista isLoading={isLoading} error={error} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Unidad</th>
                <th className="px-3 py-2 text-left">Propietario</th>
                <th className="px-3 py-2 text-right">Monto vencido</th>
                <th className="px-3 py-2 text-left">Antigüedad</th>
                <th className="px-3 py-2 text-left">Último pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {morosos.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">#{c.unidad_numero}</td>
                  <td className="px-3 py-2">{c.propietario}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatMXN(c.monto_vencido)}</td>
                  <td className="px-3 py-2"><StatusBadge label={c.antiguedad} tone={c.antiguedad === "90+" ? "danger" : c.antiguedad === "61-90" ? "warning" : "default"} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{c.ultimo_pago || "—"}</td>
                </tr>
              ))}
              {morosos.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Sin cartera vencida.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
