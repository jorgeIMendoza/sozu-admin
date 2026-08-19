// Módulo "Logs" del CRM: auditoría de QUIÉN hizo cada acción. Lee la bitácora `logs_actividad`
// filtrada a las acciones del CRM (workflow LIKE 'crm_%', que escribe el hook useCrmLogger).
// Solo Super Administrador (gated por el submenú/permiso). Filtros + paginación + detalle antes/después.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronDown, ChevronRight, ScrollText, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtDateTime } from "@/lib/crm-lib";

const PAGE_SIZE = 50;

// actividad_id -> etiqueta + color (subconjunto que usa el CRM).
const ACCION_META: Record<number, { label: string; cls: string }> = {
  1:  { label: "Creó",       cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" },
  2:  { label: "Editó",      cls: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400" },
  3:  { label: "Eliminó",    cls: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400" },
  6:  { label: "Vio",        cls: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400" },
  7:  { label: "Exportó",    cls: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:text-cyan-400" },
  11: { label: "Asignó",     cls: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-400" },
  12: { label: "Desasignó",  cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400" },
};
const accionMeta = (id: number) => ACCION_META[id] ?? { label: `#${id}`, cls: "bg-muted text-muted-foreground border-border" };

const ACCIONES_FILTRO = [
  { v: "all", l: "Todas las acciones" },
  { v: "1", l: "Creó" }, { v: "2", l: "Editó" }, { v: "3", l: "Eliminó" },
  { v: "11", l: "Asignó" }, { v: "12", l: "Desasignó" },
];
const ENTIDADES_FILTRO = [
  { v: "all", l: "Todas las entidades" },
  { v: "contacto", l: "Contacto" }, { v: "negocio", l: "Negocio" }, { v: "tarea", l: "Tarea" },
  { v: "cita", l: "Cita" }, { v: "nota", l: "Nota" }, { v: "comentario", l: "Comentario" },
  { v: "categoria", l: "Categoría" }, { v: "carga_masiva", l: "Carga masiva" },
];

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—");

export function CrmLogs() {
  const [search, setSearch] = useState("");
  const [accion, setAccion] = useState("all");
  const [entidad, setEntidad] = useState("all");
  const [estatus, setEstatus] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["crm-logs", { search, accion, entidad, estatus, desde, hasta, page }],
    queryFn: async () => {
      let q = (supabase as any).from("logs_actividad")
        .select("id, usuario_id, actividad_id, nuevo_valor, valor_anterior, workflow, primer_nodo, estatus_ejecucion, fecha_creacion, ambiente", { count: "exact" })
        .like("workflow", "crm_%")
        .order("fecha_creacion", { ascending: false });
      const s = search.trim();
      if (s) q = q.ilike("usuario_id", `%${s}%`);
      if (accion !== "all") q = q.eq("actividad_id", Number(accion));
      if (entidad !== "all") q = q.eq("primer_nodo", entidad);
      if (estatus !== "all") q = q.eq("estatus_ejecucion", estatus);
      if (desde) q = q.gte("fecha_creacion", desde);
      if (hasta) q = q.lte("fecha_creacion", hasta + " 23:59:59");
      const from = page * PAGE_SIZE;
      const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
      if (error) return { rows: [] as any[], total: 0 };
      return { rows: (data ?? []) as any[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = search || accion !== "all" || entidad !== "all" || estatus !== "all" || desde || hasta;
  const resetFiltros = () => { setSearch(""); setAccion("all"); setEntidad("all"); setEstatus("all"); setDesde(""); setHasta(""); setPage(0); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ScrollText className="h-6 w-6 text-primary" />Logs de actividad</h1>
          <p className="text-sm text-muted-foreground">Registro de quién hace cada acción en el CRM · {total} evento{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar por usuario (correo)…" className="pl-8" />
        </div>
        <Select value={accion} onValueChange={(v) => { setAccion(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{ACCIONES_FILTRO.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={entidad} onValueChange={(v) => { setEntidad(v); setPage(0); }}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{ENTIDADES_FILTRO.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={estatus} onValueChange={(v) => { setEstatus(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estatus</SelectItem>
            <SelectItem value="exito">Éxito</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(0); }} className="w-[150px]" title="Desde" />
        <Input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(0); }} className="w-[150px]" title="Hasta" />
        {hasFilters && <Button variant="ghost" size="sm" onClick={resetFiltros}><X className="h-4 w-4 mr-1" />Limpiar</Button>}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 w-8"></th>
                <th className="p-3 text-left font-medium whitespace-nowrap">Fecha / hora</th>
                <th className="p-3 text-left font-medium">Usuario</th>
                <th className="p-3 text-left font-medium">Acción</th>
                <th className="p-3 text-left font-medium">Entidad</th>
                <th className="p-3 text-left font-medium">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {hasFilters ? "Sin logs para este filtro." : "Aún no hay actividad registrada del CRM."}
                </td></tr>
              )}
              {rows.map((r) => {
                const m = accionMeta(r.actividad_id);
                const isOpen = expanded === r.id;
                const nv = r.nuevo_valor ?? {};
                const impersona = nv?._visto_como;
                return (
                  <>
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <td className="p-3 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="p-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDateTime(r.fecha_creacion)}</td>
                      <td className="p-3">
                        <span className="font-medium">{r.usuario_id}</span>
                        {impersona ? <span className="text-[11px] text-amber-600 dark:text-amber-400 ml-1.5">(viendo como {String(impersona)})</span> : null}
                      </td>
                      <td className="p-3"><Badge variant="outline" className={m.cls}>{m.label}</Badge></td>
                      <td className="p-3">{cap(r.primer_nodo ?? nv?.entidad ?? "")}</td>
                      <td className="p-3">
                        {r.estatus_ejecucion === "error"
                          ? <span className="inline-flex items-center gap-1 text-destructive text-xs"><ShieldAlert className="h-3.5 w-3.5" />Error</span>
                          : <span className="text-xs text-emerald-600 dark:text-emerald-400">Éxito</span>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-border bg-muted/20">
                        <td></td>
                        <td colSpan={5} className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Nuevo valor</div>
                              <pre className="text-xs bg-background border border-border rounded-md p-2 overflow-x-auto max-h-56">{JSON.stringify(r.nuevo_valor ?? null, null, 2)}</pre>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Valor anterior</div>
                              <pre className="text-xs bg-background border border-border rounded-md p-2 overflow-x-auto max-h-56">{JSON.stringify(r.valor_anterior ?? null, null, 2)}</pre>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-2">workflow: <code>{r.workflow}</code> · ambiente: {r.ambiente ?? "—"}</div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {page + 1} de {totalPages} · {total} eventos</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrmLogs;
