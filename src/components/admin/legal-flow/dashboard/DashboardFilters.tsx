import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

const COMPANIES = ['SOZU Developments', 'SOZU Capital', 'SOZU Tech', 'SOZU Operations'];
const PRIORITIES = [
  { value: 'high', label: 'Alta', dot: 'bg-destructive' },
  { value: 'medium', label: 'Media', dot: 'bg-[hsl(var(--status-warning))]' },
  { value: 'low', label: 'Baja', dot: 'bg-[hsl(var(--status-info))]' },
];

interface DashboardFiltersProps {
  filters: Record<string, string>;
  onFiltersChange: (filters: Record<string, string>) => void;
}

export default function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const update = (key: string, value: string) => {
    const next = { ...filters, [key]: filters[key] === value ? '' : value };
    onFiltersChange(next);
  };

  const clear = () => onFiltersChange({});

  return (
    <div className="panel">
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar expediente, contraparte, proyecto, firmante..."
            className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/50 outline-none"
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${expanded ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-primary/20 text-primary-foreground rounded-full px-1.5 text-[10px] font-bold">{activeCount}</span>
          )}
        </button>
        {activeCount > 0 && (
          <button onClick={clear} className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
            <X className="h-3 w-3" /> Limpiar todo
          </button>
        )}
      </div>

      {activeCount > 0 && !expanded && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {filters.company && (
            <FilterChip label={`Empresa: ${filters.company.replace('SOZU ', '')}`} onRemove={() => update('company', filters.company)} />
          )}
          {filters.priority && (
            <FilterChip label={`Prioridad: ${PRIORITIES.find(p => p.value === filters.priority)?.label || filters.priority}`} onRemove={() => update('priority', filters.priority)} />
          )}
          {filters.signature === 'pending' && (
            <FilterChip label="Solo pendientes de firma" onRemove={() => update('signature', 'pending')} />
          )}
          {filters.urgent === 'true' && (
            <FilterChip label="Solo urgentes" onRemove={() => update('urgent', 'true')} />
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t px-5 py-4 flex flex-wrap gap-3">
          <FilterGroup label="Empresa">
            {COMPANIES.map((c) => (
              <Chip key={c} active={filters.company === c} onClick={() => update('company', c)}>{c.replace('SOZU ', '')}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Prioridad">
            {PRIORITIES.map((p) => (
              <Chip key={p.value} active={filters.priority === p.value} onClick={() => update('priority', p.value)}>
                <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />{p.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Firma">
            <Chip active={filters.signature === 'pending'} onClick={() => update('signature', 'pending')}>Solo pendientes</Chip>
          </FilterGroup>
          <FilterGroup label="Urgencia">
            <Chip active={filters.urgent === 'true'} onClick={() => update('urgent', 'true')}>Solo urgentes</Chip>
          </FilterGroup>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold mr-1">{label}</span>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-foreground/20'}`}
    >
      {children}
    </button>
  );
}
