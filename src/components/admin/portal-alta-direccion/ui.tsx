import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Componentes UI compartidos del Portal Alta Dirección.
 * Alineados al Design System SOZU (tipografías, espaciados, radios y tonos).
 * Se mantienen los tokens de Tailwind (HSL) para preservar dark mode y scopes.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-[3px] text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** Trend chip — visual del Design System (verde positivo / rojo negativo). */
export function TrendChip({
  value,
  direction,
}: {
  value: string;
  direction: "up" | "down";
}) {
  const isUp = direction === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium",
        isUp
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      )}
    >
      {isUp ? "↑" : "↓"} {value}
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning" | "info" | "destructive" | "success";
  trend?: { value: string; direction: "up" | "down" };
}) {
  const toneClass: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    destructive: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardContent className="p-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground truncate leading-tight">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <div className="mt-2">
              <TrendChip value={trend.value} direction={trend.direction} />
            </div>
          )}
        </div>
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg shrink-0",
            toneClass[tone],
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </CardContent>
    </Card>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("rounded-xl border border-border shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 px-6 pt-6 pb-4">
        <div>
          <CardTitle className="text-base font-semibold leading-tight">
            {title}
          </CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-medium",
        className ?? "bg-muted text-foreground",
      )}
    >
      {children}
    </span>
  );
}
