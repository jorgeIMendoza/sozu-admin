import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Encabezado de columna ordenable, compartido por los menús del portal de cobranza.
// Click alterna asc/desc. Activo = verde empresa; inactivo = gris. Icono ArrowUpDown.
// El ordenamiento es CLIENT-SIDE en la página (fluido, sin viaje al servidor).

export interface SortState<K extends string> {
  key: K | null;
  dir: 'asc' | 'desc';
}

// Helper para el toggle asc/desc de una columna.
export function toggleSortState<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  return prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

export function SortHeader<K extends string>({
  label, sortKey, sort, onSort, thClass, align = 'center',
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  thClass?: string;
  align?: 'center' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn(align === 'right' ? '!text-right' : 'text-center', thClass)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 uppercase select-none transition-colors',
          active ? 'text-success font-semibold' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        <ArrowUpDown
          strokeWidth={2.25}
          className={cn('size-3.5 shrink-0', active ? 'text-success' : 'text-muted-foreground/50')}
        />
      </button>
    </th>
  );
}
