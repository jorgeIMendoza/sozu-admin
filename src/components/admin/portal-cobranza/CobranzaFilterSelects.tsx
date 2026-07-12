import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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

export type TipoCategoria = 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento' | 'Adicional';
export const TIPOS: TipoCategoria[] = ['Propiedad', 'Bodega', 'Estacionamiento', 'Producto', 'Mantenimiento', 'Adicional'];

// Multi-select con typeahead + navegación por teclado.
// - Muestra ~6 opciones visibles; el resto queda tras scroll.
// - Al escribir, filtra (autocompletar).
// - Flechas ↑/↓ mueven el resaltado, Enter aplica (toggle), Esc cierra.
// Empty state siempre "Todos" (el label externo ya dice a qué aplica).
// Multi-select con el MISMO diseño que CobranzaProjectFilter (Popover + Command):
// misma tipografía, mismo buscador, mismo popover a ancho de trigger. Única
// diferencia: casilla (check) por opción para selección múltiple; al elegir NO
// cierra el popover. Empty state siempre "Todos".
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

  const toggle = (nivel: string) =>
    onChange(value.includes(nivel) ? value.filter(v => v !== nivel) : [...value, nivel]);

  const label = value.length === 0
    ? 'Todos'
    : value.length === 1
    ? value[0]
    : `${value.length} ${noun}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-[38px] justify-between text-[13px] font-normal", className ?? "w-[155px]")}
        >
          <span className={cn("truncate", value.length === 0 ? "text-muted-foreground" : "text-foreground")}>
            {label}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: "160px" }}
      >
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList className="!max-h-[228px]">
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {niveles.map((nivel) => (
                <CommandItem key={nivel} value={nivel} onSelect={() => toggle(nivel)}>
                  <div className={cn(
                    'mr-2 size-4 rounded-[4px] border flex items-center justify-center shrink-0',
                    value.includes(nivel)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input bg-background',
                  )}>
                    {value.includes(nivel) && <Check className="size-3" />}
                  </div>
                  <span className="truncate min-w-0">{nivel}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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

// Estatus de disponibilidad de la propiedad. El RPC devuelve TODO el universo
// (sin excluir ningún estatus); este filtro decide qué mostrar. Se comparan
// contra `estatus_propiedad` (nombre) que devuelve el RPC.
export const ESTATUS_PROPIEDAD: string[] = [
  'Inventario', 'Disponible', 'Apartada', 'Vendido', 'Escrituración', 'Entregada', 'Pagada completamente', 'Cancelada',
];
// `options` viene de la DB (distinct de los datos cargados). Si no se pasa,
// cae al catálogo fijo como respaldo.
export const EstatusPropiedadMultiSelect = ({ value, onChange, className, options }: { value: string[]; onChange: (v: string[]) => void; className?: string; options?: string[] }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={options ?? ESTATUS_PROPIEDAD} className={className} noun="estatus" />;

export const TipoMultiSelect = ({ value, onChange, className, options }: { value: string[]; onChange: (v: string[]) => void; className?: string; options?: string[] }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={options ?? TIPOS} className={className} noun="tipos" />;

// Modelos: 100% dinámico desde la DB (no hay catálogo fijo).
export const ModeloMultiSelect = ({ value, onChange, className, options }: { value: string[]; onChange: (v: string[]) => void; className?: string; options: string[] }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={options} className={className} noun="modelos" />;

// Método de pago: dinámico desde los pagos cargados (Relación de Pagos).
export const MetodoMultiSelect = ({ value, onChange, className, options }: { value: string[]; onChange: (v: string[]) => void; className?: string; options: string[] }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={options} className={className} noun="métodos" />;
