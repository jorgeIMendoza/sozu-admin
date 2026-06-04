import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge } from "./_helpers";
import { unidades, formatMXN } from "@/data/portalCondominio/mockData";
import { Search, ChevronRight, Download } from "lucide-react";

const statusTone: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  ocupado: "success", vacante: "default", renta_corta: "info", mantenimiento: "warning",
};
const statusLabel: Record<string, string> = {
  ocupado: "Ocupado", vacante: "Vacante", renta_corta: "Renta corta", mantenimiento: "Mantenimiento",
};

export default function Departamentos() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() =>
    unidades.filter((u) => {
      const ms = !search || u.numero.includes(search) || u.propietario.toLowerCase().includes(search.toLowerCase()) || u.clabe.includes(search);
      const mst = statusFilter === "todos" || u.estatus === statusFilter;
      const mo = !overdueOnly || u.saldo_vencido > 0;
      return ms && mst && mo;
    }),
  [search, statusFilter, overdueOnly]);

  return (
    <div>
      <PageHeader
        title="Departamentos"
        subtitle={`${filtered.length} de ${unidades.length} unidades`}
        actions={<button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"><Download className="h-4 w-4" /> Exportar</button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, propietario o CLABE..." className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todos los estatus</option>
          <option value="ocupado">Ocupado</option>
          <option value="vacante">Vacante</option>
          <option value="renta_corta">Renta corta</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground px-3">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Solo con saldo vencido
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Estatus</th>
              <th className="px-3 py-2 text-left">Propietario</th>
              <th className="px-3 py-2 text-right">Cuota</th>
              <th className="px-3 py-2 text-right">Saldo vencido</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.slice(0, 100).map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/admin/portal-condominio/departamentos/${u.numero}`)}>
                <td className="px-3 py-2 font-medium">#{u.numero}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.tipo}</td>
                <td className="px-3 py-2"><StatusBadge label={statusLabel[u.estatus]} tone={statusTone[u.estatus]} /></td>
                <td className="px-3 py-2">{u.propietario}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMXN(u.cuota_mensual)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${u.saldo_vencido > 0 ? "text-destructive font-medium" : ""}`}>{u.saldo_vencido > 0 ? formatMXN(u.saldo_vencido) : "—"}</td>
                <td className="px-3 py-2 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">Mostrando primeras 100 de {filtered.length}</div>}
      </div>
    </div>
  );
}