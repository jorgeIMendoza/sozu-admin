import { Search, X } from 'lucide-react';

interface DashboardFiltersProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DashboardFilters({ value, onChange }: DashboardFiltersProps) {
  return (
    <div className="panel">
      <div className="flex items-center gap-3 px-5 py-3">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Buscar por ID de cuenta, contraparte o unidad…"
          className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/50 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
