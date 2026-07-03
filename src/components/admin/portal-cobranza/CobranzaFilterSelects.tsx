import { useState, useRef, useEffect } from 'react';
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

// Multi-select con typeahead + navegación por teclado.
// - Muestra ~6 opciones visibles; el resto queda tras scroll.
// - Al escribir, filtra (autocompletar).
// - Flechas ↑/↓ mueven el resaltado, Enter aplica (toggle), Esc cierra.
// Empty state siempre "Todos" (el label externo ya dice a qué aplica).
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
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = niveles.filter(n =>
    !search.trim() || n.toLowerCase().includes(search.toLowerCase())
  );

  // Reinicia el resaltado al abrir o al escribir.
  useEffect(() => { setHighlight(0); }, [search, open]);
  // Mantiene el resaltado visible dentro del scroll.
  useEffect(() => {
    (listRef.current?.children[highlight] as HTMLElement | undefined)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const toggle = (nivel: string) => {
    onChange(value.includes(nivel) ? value.filter(v => v !== nivel) : [...value, nivel]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setHighlight(h => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlight]) toggle(filtered[highlight]); }
    else if (e.key === 'Escape')    { setOpen(false); setSearch(''); }
  };

  const label = value.length === 0
    ? 'Todos'
    : value.length === 1
    ? value[0]
    : `${value.length} ${noun}`;

  return (
    <div
      className={cn("relative", className ?? "w-[155px]")}
      onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setSearch(''); }, 150); }}
      onFocus={() => clearTimeout(blurTimer.current)}
    >
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => searchRef.current?.focus(), 10); }}
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
              onKeyDown={onKeyDown}
              placeholder="Buscar"
              className="flex-1 text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {/* max-h ≈ 6 filas (36px c/u) → después scroll */}
          <div ref={listRef} className="py-1 max-h-[216px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">Sin coincidencias</p>
            ) : filtered.map((nivel, i) => (
              <button
                key={nivel}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={e => { e.preventDefault(); toggle(nivel); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors',
                  i === highlight ? 'bg-accent' : 'hover:bg-accent',
                )}
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

// Estatus de disponibilidad de la propiedad. La bandeja excluye 8 (Entregada) y
// 9 (Pagada completamente), así que solo se ofrecen los estatus alcanzables aquí.
// El filtro compara contra `estatus_propiedad` (nombre) que devuelve el RPC.
export const ESTATUS_PROPIEDAD: string[] = [
  'Inventario', 'Disponible', 'Apartada', 'Vendido', 'Escrituración',
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
