import { useMemo, useState } from "react";
import { PageHeader, KPICard, StatusBadge, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";

export default function Pagos() {
  const [estatus, setEstatus] = useState("todos");
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const pagos = data?.pagos ?? [];

  const filtered = useMemo(() => pagos.filter((p) => estatus === "todos" || p.estatus_conciliacion === estatus), [pagos, estatus]);
  const totalConciliado = pagos.filter((p) => p.estatus_conciliacion === "conciliado").reduce((s, p) => s + p.monto, 0);
  const totalExcepcion = pagos.filter((p) => p.estatus_conciliacion !== "conciliado").reduce((s, p) => s + p.monto, 0);

  return (
    <div>
      <PageHeader title="Pagos y Conciliación" subtitle={`${filtered.length} movimientos`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Total movimientos" value={String(pagos.length)} />
        <KPICard title="Conciliado" value={formatMXN(totalConciliado)} variant="success" />
        <KPICard title="Excepción / pendiente" value={formatMXN(totalExcepcion)} variant="warning" />
      </div>

      <div className="flex gap-2 mb-3">
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todos</option>
          <option value="conciliado">Conciliados</option>
          <option value="excepcion">Excepción</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </div>

      {(isLoading || error) ? (
        <EstadoVista isLoading={isLoading} error={error} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Unidad</th>
                <th className="px-3 py-2 text-left">Referencia</th>
                <th className="px-3 py-2 text-left">Concepto</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Conciliación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 150).map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{p.fecha}</td>
                  <td className="px-3 py-2 font-medium">#{p.unidad_numero}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.referencia}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.concepto}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMXN(p.monto)}</td>
                  <td className="px-3 py-2"><StatusBadge label={p.estatus_conciliacion} tone={p.estatus_conciliacion === "conciliado" ? "success" : p.estatus_conciliacion === "excepcion" ? "danger" : "warning"} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Sin movimientos.</td></tr>}
            </tbody>
          </table>
          {filtered.length > 150 && <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">Mostrando primeros 150 de {filtered.length}</div>}
        </div>
      )}
    </div>
  );
}
