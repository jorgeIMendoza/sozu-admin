import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Controles de filtro compartidos por los menús espejo del portal de cobranza
// (Inmuebles y Complementos). Un solo lugar para el diseño; cambios afectan ambos.
// Popover = ancho del trigger (mismo que el input), minWidth 160, opciones con ellipsis.

// Etiqueta de campo (AÑO / MES / …).
export const FilterLabel = ({ label }: { label: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{label}</span>
);

// Combobox de una sola selección (Año / Mes / Tipo). value '' = "Todos" (gris).
export function SelectCombobox({ options, value, onChange, placeholder, className }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = options.find(o => o.value === value)?.label ?? '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}>
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '160px' }}>
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList className="!max-h-[228px]">
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value || '__empty__'} value={opt.label} onSelect={() => { onChange(opt.value); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <span className={cn('truncate min-w-0', !opt.value && 'text-muted-foreground')}>{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Multi-select de dueños. value = [] → "Todos" (gris).
export function OwnerMultiSelect({ options, value, onChange, placeholder = 'Todos', className }: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} dueños`;
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter(v => v !== n) : [...value, n]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn('h-9 justify-between text-[13px] font-normal min-w-0', className)}>
          <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '160px' }}>
        <Command>
          <CommandInput placeholder="Buscar dueño..." />
          <CommandList className="!max-h-[228px]">
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map(n => (
                <CommandItem key={n} value={n} onSelect={() => toggle(n)}>
                  <div className={cn('mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
                    value.includes(n) ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                    {value.includes(n) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate min-w-0">{n}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
