import { useMemo, useState } from "react";
import { PageHeader, KPICard, StatusBadge } from "./_helpers";
import { cargos, formatMXN } from "@/data/portalCondominio/mockData";
import { Plus } from "lucide-react";

const tone = (s: string) =>
  s === "pagado" ? "success" : s === "vencido" ? "danger" : s === "cancelado" ? "default" : "warning";

export default function Cargos() {
  const [cat, setCat] = useState("todos");
  const [estatus, setEstatus] = useState("todos");

  const filtered = useMemo(() => cargos.filter((c) => (cat === "todos" || c.categoria === cat) && (estatus === "todos" || c.estatus === estatus)), [cat, estatus]);

  const totalPendiente = cargos.filter((c) => c.estatus === "pendiente" || c.estatus === "vencido").reduce((s, c) => s + c.monto, 0);
  const totalPagado = cargos.filter((c) => c.estatus === "pagado").reduce((s, c) => s + c.monto, 0);

  return (
    <div>
      <PageHeader
        title="Cargos"
        subtitle={`${filtered.length} cargos`}
        actions={<button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"><Plus className="h-4 w-4" /> Nuevo cargo</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Total emitido" value={formatMXN(cargos.reduce((s, c) => s + c.monto, 0))} />
        <KPICard title="Pagado" value={formatMXN(totalPagado)} variant="success" />
        <KPICard title="Pendiente / vencido" value={formatMXN(totalPendiente)} variant="warning" />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todas las categorías</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="multa">Multa</option>
          <option value="extraordinario">Extraordinario</option>
          <option value="amenidad">Amenidad</option>
        </select>
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todos los estatus</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="vencido">Vencido</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Vence</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.slice(0, 100).map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">#{c.unidad_numero}</td>
                <td className="px-3 py-2">{c.concepto}</td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{c.categoria}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.fecha_vencimiento}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMXN(c.monto)}</td>
                <td className="px-3 py-2"><StatusBadge label={c.estatus} tone={tone(c.estatus) as any} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}