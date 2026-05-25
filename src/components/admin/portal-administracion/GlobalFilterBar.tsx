import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { useAltaDireccionFilters } from "@/contexts/AltaDireccionFiltersContext";

const projects = [
  { id: "all", name: "Todos los desarrollos" },
  { id: "daiku", name: "Daiku" },
  { id: "bottura", name: "Bottura" },
  { id: "monocolo", name: "Monócolo" },
];
const channels = [
  { id: "all", name: "Todos los canales" },
  { id: "inmobiliaria", name: "Inmobiliaria" },
  { id: "broker", name: "Broker" },
  { id: "embajador", name: "Embajador" },
  { id: "referido", name: "Referido" },
  { id: "interno", name: "Canal Interno" },
];
const periods = [
  { id: "all", name: "Todo el periodo" },
  { id: "this_month", name: "Este mes" },
  { id: "last_month", name: "Mes pasado" },
  { id: "this_quarter", name: "Este trimestre" },
  { id: "this_year", name: "Este año" },
];

export function GlobalFilterBar() {
  const { filters, setFilter, resetFilters } = useAltaDireccionFilters();
  const hasFilters = filters.projectId || filters.channel || filters.period || filters.search;
  return (
    <div className="bg-card px-4 lg:px-6 py-2 flex items-center gap-2 flex-wrap border-b border-border -mx-4 lg:-mx-8 -mt-4 lg:-mt-6 mb-4">
      <Select value={filters.projectId || "all"} onValueChange={(v) => setFilter("projectId", v === "all" ? null : v)}>
        <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.channel || "all"} onValueChange={(v) => setFilter("channel", v === "all" ? null : v)}>
        <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.period || "all"} onValueChange={(v) => setFilter("period", v === "all" ? null : v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => setFilter("search", e.target.value || null)}
          placeholder="Buscar cliente, expediente…"
          className="h-8 pl-7 text-xs"
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
          <X className="h-3 w-3 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}