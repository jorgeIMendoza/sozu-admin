import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatCard — tarjeta de métrica reutilizable: label + valor + sublabel.
 *
 * Genérica (cualquier portal). Escala real de Tailwind y tokens del tema.
 * `tone` colorea label y valor; `size` ajusta el valor (money vs count).
 */
type Tone = "default" | "success" | "warning" | "danger";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

export interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: Tone;
  /** 'count' → valor grande; 'money' → valor mediano en una línea. */
  size?: "money" | "count";
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
  size = "money",
  onClick,
  className,
}: StatCardProps) {
  const interactive = !!onClick;
  const Comp: React.ElementType = interactive ? "button" : "div";
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group rounded-lg border bg-card p-4 text-left transition-shadow",
        interactive && "hover:shadow-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", tone === "default" ? "text-muted-foreground" : TONE_TEXT[tone])}>
          {label}
        </span>
        {interactive && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
        )}
      </div>
      <p
        className={cn(
          "font-bold leading-none tabular-nums",
          size === "count" ? "text-3xl" : "whitespace-nowrap text-xl tracking-tight",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1.5 text-xs text-muted-foreground">{sublabel}</p>}
    </Comp>
  );
}
