import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import type { DocumentType } from "@/lib/portal-cliente/document-data";
import { getTypeInfo } from "@/lib/portal-cliente/document-data";

interface FiltersProps {
  portfolio: InvestmentProperty[];
  filterProperty: string | null;
  filterType: DocumentType | null;
  groupBy: "property" | "status";
  onChangeProperty: (v: string | null) => void;
  onChangeType: (v: string | null) => void;
  onChangeGroupBy: (v: "property" | "status") => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

const TYPES: DocumentType[] = [
  "contrato",
  "escritura",
  "comprobante",
  "cfdi",
  "identificacion",
  "garantia",
  "otro",
];

const DocumentFilters = ({
  portfolio,
  filterProperty,
  filterType,
  groupBy,
  onChangeProperty,
  onChangeType,
  onChangeGroupBy,
  hasActiveFilters,
  onClearAll,
}: FiltersProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 md:px-0 pb-3 scrollbar-hide items-center">
      <Select
        value={filterProperty ?? "todos"}
        onValueChange={(v) => onChangeProperty(v === "todos" ? null : v)}
      >
        <SelectTrigger className="h-8 text-[11px] flex-shrink-0 w-auto min-w-[130px] rounded-md font-medium">
          <SelectValue placeholder="Propiedad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas las propiedades</SelectItem>
          {portfolio.map((inv) => (
            <SelectItem key={inv.property.id} value={inv.property.id}>
              {inv.property.projectName} · {inv.property.unitNumber}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filterType ?? "todos"}
        onValueChange={(v) => onChangeType(v === "todos" ? null : v)}
      >
        <SelectTrigger className="h-8 text-[11px] flex-shrink-0 w-auto min-w-[110px] rounded-md font-medium">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los tipos</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {getTypeInfo(t).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex h-8 rounded-md border border-input overflow-hidden flex-shrink-0 bg-background">
        <button
          onClick={() => onChangeGroupBy("property")}
          className={`px-3 text-[11px] font-medium transition-colors whitespace-nowrap ${
            groupBy === "property"
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Propiedad
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={() => onChangeGroupBy("status")}
          className={`px-3 text-[11px] font-medium transition-colors whitespace-nowrap ${
            groupBy === "status"
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Estado
        </button>
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="h-8 flex-shrink-0 flex items-center gap-1.5 px-2.5 text-[11px] font-medium text-destructive bg-destructive/[0.08] border border-destructive/20 rounded-md hover:bg-destructive/[0.12] transition-colors whitespace-nowrap"
        >
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}
    </div>
  );
};

export default DocumentFilters;
