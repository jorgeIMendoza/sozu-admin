import * as React from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SELECT_TRIGGER_CLS } from "@/components/ui/select";

/**
 * Selector ÚNICO del sistema — cubre lista corta y catálogo largo con el mismo
 * componente y el mismo disparador; no hay que decidir entre dos.
 *
 * Se adapta al tamaño de `options`:
 *   · ≤ `searchThreshold` (8): sin buscador, lista completa. Igual que un select.
 *   · >  `searchThreshold`: buscador arriba. Al abrir se listan las primeras
 *     `previewCount` (3) con la seleccionada al frente — el panel nunca tapa el
 *     formulario — y se escribe para llegar al resto.
 *
 * La búsqueda arranca en `minChars` (2), así no se filtra ni se pide datos por
 * cada tecla. Las coincidencias salen ordenadas por cercanía (prefijo > inicio
 * de palabra > contiene > aproximada) y topadas a `maxResults`. Si no hay
 * ninguna, se dice con el término buscado.
 *
 * El filtrado es local sobre `options`. Para catálogos que viven en el servidor
 * se pasa `onSearch` (ya viene debounceado) y se le entregan las `options` que
 * devuelva la consulta; la lógica de datos de cada componente no cambia.
 */

export interface SearchableOption {
  value: string;
  label: string;
  /** Texto extra buscable que no se pinta (código, alias, RFC, clave…). */
  keywords?: string;
  /** Segunda línea opcional de la opción. */
  hint?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Ejemplos visibles antes de buscar. Default 3. */
  previewCount?: number;
  /** Caracteres mínimos para buscar. Default 2. */
  minChars?: number;
  /** Máximo de coincidencias listadas. Default 8. */
  maxResults?: number;
  /**
   * A partir de cuántas opciones aparece el buscador. Default 8.
   * Por debajo del umbral el componente se comporta como un select normal:
   * sin buscador y con la lista completa (así no hacen falta dos componentes).
   */
  searchThreshold?: number;
  /** Plural de lo que se lista, para los textos de ayuda ("municipios"). */
  itemsLabel?: string;
  /** Búsqueda en servidor: recibe el término (debounceado) cuando ≥ minChars. */
  onSearch?: (term: string) => void;
  /** Spinner en el panel mientras la búsqueda remota está en vuelo. */
  loading?: boolean;
  /** Permite deseleccionar (botón ✕ en el disparador y re-clic en la opción). */
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  id?: string;
  "aria-label"?: string;
}

/** minúsculas + sin acentos + espacios colapsados: compara "Regimen" con "régimen". */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** ¿Están las letras de `term` en `text`, en orden? (tolera typos por omisión) */
function isSubsequence(term: string, text: string) {
  let i = 0;
  for (const ch of text) {
    if (ch === term[i]) i++;
    if (i === term.length) return true;
  }
  return false;
}

/**
 * 0 = el label empieza con el término · 1 = alguna palabra empieza con él ·
 * 2 = lo mismo en keywords · 3 = lo contiene · 4 = aproximada · null = no aplica.
 */
function score(option: SearchableOption, term: string): number | null {
  const label = norm(option.label);
  const keys = option.keywords ? norm(option.keywords) : "";
  if (label.startsWith(term)) return 0;
  if (label.split(" ").some((w) => w.startsWith(term))) return 1;
  if (keys && (keys.startsWith(term) || keys.split(" ").some((w) => w.startsWith(term)))) return 2;
  if (label.includes(term) || keys.includes(term)) return 3;
  if (term.length >= 3 && (isSubsequence(term, label) || (keys && isSubsequence(term, keys)))) return 4;
  return null;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecciona",
  searchPlaceholder = "Buscar…",
  previewCount = 3,
  minChars = 2,
  maxResults = 8,
  searchThreshold = 8,
  itemsLabel = "opciones",
  onSearch,
  loading = false,
  allowClear = false,
  disabled = false,
  className,
  contentClassName,
  id,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const term = norm(search);
  const searching = term.length >= minChars;
  const selected = options.find((o) => o.value === value) || null;

  // Búsqueda remota: un solo disparo por término, 250 ms después de dejar de teclear.
  React.useEffect(() => {
    if (!onSearch) return;
    if (!searching) return;
    const t = setTimeout(() => onSearch(term), 250);
    return () => clearTimeout(t);
  }, [onSearch, searching, term]);

  /** Coincidencias ordenadas por cercanía (sin recortar). */
  const matches = React.useMemo(() => {
    if (!searching) return [];
    return options
      .map((option, index) => ({ option, index, s: score(option, term) }))
      .filter((r): r is { option: SearchableOption; index: number; s: number } => r.s !== null)
      .sort((a, b) => a.s - b.s || a.option.label.length - b.option.label.length || a.index - b.index)
      .map((r) => r.option);
  }, [options, searching, term]);

  /** Antes de escribir: primeras `previewCount` opciones, con la seleccionada al frente. */
  const preview = React.useMemo(() => {
    const head = options.slice(0, previewCount);
    if (selected && !head.some((o) => o.value === selected.value)) {
      return [selected, ...head.slice(0, Math.max(0, previewCount - 1))];
    }
    return head;
  }, [options, previewCount, selected]);

  // Listas cortas: sin buscador y sin recorte — se comportan como un select normal.
  const showSearch = options.length > searchThreshold;
  const visible = !showSearch ? options : searching ? matches.slice(0, maxResults) : preview;

  // Reset del cursor cada vez que cambia la lista visible.
  React.useEffect(() => setActiveIndex(0), [term, open]);

  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = (option: SearchableOption) => {
    if (option.disabled) return;
    onValueChange(allowClear && option.value === value ? "" : option.value);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!visible.length) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + dir + visible.length) % visible.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = visible[activeIndex];
      if (option) commit(option);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(SELECT_TRIGGER_CLS, !selected && "font-normal text-muted-foreground", className)}
        >
          <span className="truncate text-left">{selected ? selected.label : placeholder}</span>
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {allowClear && selected && !disabled && (
              <span
                role="button"
                aria-label="Limpiar selección"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onValueChange("");
                }}
                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => {
          if (!showSearch) return; // sin buscador: el foco lo toma el panel y navega con flechas
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onKeyDown={showSearch ? undefined : handleKeyDown}
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden p-0", contentClassName)}
      >
        {/* Buscador — solo cuando la lista es larga; en listas cortas sobra. */}
        {showSearch && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={listboxId}
              className="h-6 w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        )}

        {/* Lista */}
        <div ref={listRef} id={listboxId} role="listbox" className="max-h-[240px] overflow-y-auto p-1">
          {visible.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {searching ? `Sin coincidencias para “${search.trim()}”` : `Sin ${itemsLabel} disponibles`}
              </p>
              {searching && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Revisa la ortografía o busca con una palabra más corta.
                </p>
              )}
            </div>
          ) : (
            visible.map((option, i) => {
              const isSelected = option.value === value;
              const isActive = i === activeIndex;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  data-active={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(option)}
                  className={cn(
                    "flex cursor-pointer select-none items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    isActive && "bg-muted",
                    isSelected && "font-semibold text-primary",
                    option.disabled && "pointer-events-none opacity-50"
                  )}
                >
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs font-normal text-muted-foreground">{option.hint}</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
