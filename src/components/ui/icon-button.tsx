import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Botón-ícono reutilizable (estilo outline: caja con borde). Trae los diseños
 * activo/inactivo; lo único que cambia normalmente es el `icon`. Personalizable
 * con `className` (p. ej. otro color activo) e `iconClassName`. Muestra Tooltip
 * si se pasa `tooltip` (funciona también deshabilitado).
 */

export const ICON_BUTTON_BASE = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-colors";
export const ICON_BUTTON_ACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer";
export const ICON_BUTTON_DISABLED = "text-muted-foreground/30 cursor-default";

export interface IconButtonProps {
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: ReactNode;
  /** Clases extra para el botón (personalización: color activo, tamaño, etc.). */
  className?: string;
  iconClassName?: string;
  ariaLabel?: string;
}

export function IconButton({ icon: Icon, onClick, disabled = false, tooltip, className, iconClassName, ariaLabel }: IconButtonProps) {
  const btn = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(ICON_BUTTON_BASE, disabled ? ICON_BUTTON_DISABLED : ICON_BUTTON_ACTIVE, className)}
    >
      <Icon className={cn("size-4", iconClassName)} />
    </button>
  );

  if (!tooltip) return btn;
  return (
    <Tooltip>
      {/* span envoltorio: permite tooltip también en botón deshabilitado */}
      <TooltipTrigger asChild>{disabled ? <span className="inline-flex">{btn}</span> : btn}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
