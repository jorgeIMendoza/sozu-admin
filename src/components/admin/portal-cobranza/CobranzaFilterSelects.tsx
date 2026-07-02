import { useState, useRef } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Componentes de filtro compartidos entre la Bandeja (Cuentas de Cobranza) y
// Relación de Pagos. Fuente única → los filtros nunca divergen visualmente.

export type NivelPrioridad = 'Al día' | 'Alerta' | 'Urgente' | 'Crítico';
export const NIVELES_PRIORIDAD: NivelPrioridad[] = ['Al día', 'Alerta', 'Urgente', 'Crítico'];

export function nivelDeParcialidades(n: number): NivelPrioridad {
  if (n === 0) return 'Al día';
  if (n === 1) return 'Alerta';
  if (n === 2) return 'Urgente';
  return 'Crítico';
}

export type TipoCategoria = 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento';
export const TIPOS: TipoCategoria[] = ['Propiedad', 'Bodega', 'Estacionamiento', 'Producto', 'Mantenimiento'];

export function NivelMultiSelect({
  value,
  onChange,
  niveles,
  className,
  noun = 'niveles',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  niveles: string[];
  className?: string;
  noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  const toggle = (nivel: string) => {
    onChange(value.includes(nivel) ? value.filter(v => v !== nivel) : [...value, nivel]);
  };

  const label = value.length === 0
    ? 'Todos'
    : value.length === 1
    ? value[0]
    : `${value.length} ${noun}`;

  return (
    <div
      className={cn("relative", className ?? "w-[155px]")}
      onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
      onFocus={() => clearTimeout(blurTimer.current)}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/50 focus:outline-none',
          open ? 'ring-1 ring-ring border-ring' : ''
        )}
      >
        <span className={cn('truncate text-left flex-1', value.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md py-1">
          {niveles.map(nivel => (
            <button
              key={nivel}
              type="button"
              onMouseDown={e => { e.preventDefault(); toggle(nivel); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-accent text-left transition-colors"
            >
              <div className={cn(
                'size-[14px] rounded-[3px] border flex items-center justify-center shrink-0',
                value.includes(nivel)
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-input bg-background'
              )}>
                {value.includes(nivel) && <Check className="size-[9px]" />}
              </div>
              <span className="text-[12px] text-foreground">{nivel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const PrioridadMultiSelect = ({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={NIVELES_PRIORIDAD} className={className} />;

export const InvalidosMultiSelect = ({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={NIVELES_PRIORIDAD} className={className} />;

// Estatus de validación del pago (Relación de Pagos).
export const ESTATUS_PAGO: string[] = ['Válido', 'Inválido', 'Error', 'Sin revisar'];
export const ESTATUS_PAGO_KEY: Record<string, string> = {
  'Válido': 'valido', 'Inválido': 'invalido', 'Error': 'error', 'Sin revisar': 'sin_revisar',
};
export const EstatusMultiSelect = ({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={ESTATUS_PAGO} className={className} noun="estatus" />;

export function TipoMultiSelect({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = TIPOS.filter(t =>
    !search.trim() || t.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (tipo: string) => {
    onChange(value.includes(tipo) ? value.filter(v => v !== tipo) : [...value, tipo]);
  };

  const label = value.length === 0
    ? 'Todos los tipos'
    : value.length === 1
    ? value[0]
    : `${value.length} tipos`;

  return (
    <div
      className={cn("relative", className ?? "w-[175px]")}
      onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setSearch(''); }, 150); }}
      onFocus={() => clearTimeout(blurTimer.current)}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o);
          if (!open) setTimeout(() => searchRef.current?.focus(), 10);
        }}
        className={cn(
          'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/50 focus:outline-none',
          open ? 'ring-1 ring-ring border-ring' : ''
        )}
      >
        <span className={cn('truncate text-left flex-1', value.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar tipos"
              className="flex-1 text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="py-1">
            {filtered.map(tipo => (
              <button
                key={tipo}
                type="button"
                onMouseDown={e => { e.preventDefault(); toggle(tipo); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-accent text-left transition-colors"
              >
                <div className={cn(
                  'size-[14px] rounded-[3px] border flex items-center justify-center shrink-0',
                  value.includes(tipo)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input bg-background'
                )}>
                  {value.includes(tipo) && <Check className="size-[9px]" />}
                </div>
                <span className="text-[12px] text-foreground">{tipo}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
