import * as React from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ActionCard — tarjeta de acción reutilizable: icono + título + subtítulo + chevron.
 *
 * Genérica (cualquier portal). Estilos con la escala real de Tailwind y tokens del
 * tema (border, card, primary, muted-foreground). Ideal para accesos rápidos.
 */
export interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  /** valor para data-cta (tracking). */
  dataCta?: string;
  /** oculta el chevron de la derecha. */
  hideChevron?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ActionCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  dataCta,
  hideChevron,
  className,
  disabled,
}: ActionCardProps) {
  return (
    <button
      type="button"
      data-cta={dataCta}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {!hideChevron && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
      )}
    </button>
  );
}
