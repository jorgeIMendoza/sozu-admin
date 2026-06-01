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
  onChangeProperty: (v: string | null) => void;
  onChangeType: (v: string | null) => void;
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
  onChangeProperty,
  onChangeType,
  hasActiveFilters,
  onClearAll,
}: FiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 md:px-0 pb-1">
      <Select
        value={filterProperty ?? "todos"}
        onValueChange={(v) => onChangeProperty(v === "todos" ? null : v)}
      >
        <SelectTrigger className="h-9 text-xs min-w-[140px] w-auto">
          <SelectValue placeholder="Todas las propiedades" />
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
        <SelectTrigger className="h-9 text-xs min-w-[120px] w-auto">
          <SelectValue placeholder="Todos los tipos" />
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

      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}
    </div>
  );
};

export default DocumentFilters;
