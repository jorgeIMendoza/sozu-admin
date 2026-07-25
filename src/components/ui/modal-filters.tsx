import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * ModalFilters — estándar de PANEL DE FILTROS (distinto al de formulario).
 *
 * Es el hermano de `ui/modal-form`: mismo criterio (dueño único de los estilos,
 * clases del tema, componentes base de shadcn) pero para filtrar listados:
 * panel lateral, campos que aplican al instante y footer con Limpiar / Ver
 * resultados. Los campos se arman con `<FilterSelect />` (usa el `<Select />`
 * de shadcn sin retoques) o con `<FilterField />` para controles libres
 * (sliders, chips, rangos).
 *
 * Uso:
 *   <ModalFilters open={open} onOpenChange={setOpen}
 *     onClear={clearAll} clearDisabled={!hasActiveFilters}>
 *     <FilterSelect label="Desarrollo" value={v} onChange={setV} options={opts} />
 *     <FilterField label="Rango de precio"><Slider … /></FilterField>
 *   </ModalFilters>
 */

// ── Tokens de estilo (fuente única del estándar de filtros) ──────────────────
export const FILTERS_HEADER_CLS = "space-y-2 border-b border-border px-6 py-5 text-left";
export const FILTERS_TITLE_CLS = "text-lg font-bold text-foreground";
export const FILTERS_SUBTITLE_CLS = "text-sm text-muted-foreground";
export const FILTERS_BODY_CLS = "flex-1 space-y-5 overflow-y-auto px-6 py-5";
export const FILTERS_FOOTER_CLS =
  "flex items-center justify-between gap-3 border-t border-border px-6 py-4";
// Label de filtro: gris, igual jerarquía que el label del estándar de formulario.
export const FILTER_LABEL_CLS = "px-0.5 text-sm font-medium text-muted-foreground";

export interface ModalFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título del panel. Por defecto "Filtros". */
  title?: React.ReactNode;
  /** Texto de apoyo bajo el título. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Limpia todos los filtros. Si no se pasa, el botón no se pinta. */
  onClear?: () => void;
  clearDisabled?: boolean;
  clearLabel?: string;
  /** Cierra el panel (los filtros se aplican al instante). */
  onApply?: () => void;
  applyLabel?: string;
  side?: "right" | "left";
  className?: string;
  bodyClassName?: string;
}

export function ModalFilters({
  open,
  onOpenChange,
  title = "Filtros",
  subtitle,
  children,
  onClear,
  clearDisabled,
  clearLabel = "Limpiar",
  onApply,
  applyLabel = "Ver resultados",
  side = "right",
  className,
  bodyClassName,
}: ModalFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("flex w-full flex-col gap-0 p-0 sm:w-[380px] sm:max-w-[380px]", className)}
      >
        <SheetHeader className={FILTERS_HEADER_CLS}>
          <SheetTitle className={FILTERS_TITLE_CLS}>{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription className={FILTERS_SUBTITLE_CLS}>{subtitle}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              {typeof title === "string" ? title : "Filtros"}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className={cn(FILTERS_BODY_CLS, bodyClassName)}>{children}</div>

        {(onClear || onApply) && (
          <div className={FILTERS_FOOTER_CLS}>
            {onClear ? (
              <Button variant="ghost" onClick={onClear} disabled={clearDisabled}>
                {clearLabel}
              </Button>
            ) : (
              <span />
            )}
            {onApply && (
              <Button variant="primary-outline" onClick={onApply}>
                {applyLabel}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Campo de filtro genérico: label + control libre (slider, chips, rango…). */
export function FilterField({
  label,
  action,
  children,
  className,
}: {
  label: React.ReactNode;
  /** Acción a la derecha del label (p. ej. "Restablecer"). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <span className={cn(FILTER_LABEL_CLS, "px-0")}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Filtro de selección. Usa el `<Select />` de shadcn tal cual (sin overrides). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <span className={FILTER_LABEL_CLS}>{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
