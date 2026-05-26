import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  body,
  children,
}: {
  title: string;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h3>
      {body}
      {children}
    </section>
  );
}

export function KV({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm font-medium text-foreground truncate",
            mono && "font-mono"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function Timeline({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2.5">{children}</ol>;
}

export function TimelineItem({
  label,
  meta,
  tone,
}: {
  label: string;
  meta: string;
  tone?: "success" | "warning" | "danger";
}) {
  const dotClass =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "danger"
          ? "bg-red-500"
          : "bg-muted-foreground/40";
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", dotClass)} />
      <div className="min-w-0">
        <p className="text-sm text-foreground leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
    </li>
  );
}

export function StatusCard({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "success" | "warning" | "danger" | "info";
  icon: LucideIcon;
  title: React.ReactNode;
  body?: React.ReactNode;
}) {
  const cls = {
    success:
      "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200/60 dark:ring-emerald-900/40 text-emerald-800 dark:text-emerald-200",
    warning:
      "bg-amber-50 dark:bg-amber-950/30 ring-amber-200/60 dark:ring-amber-900/40 text-amber-800 dark:text-amber-200",
    danger:
      "bg-red-50 dark:bg-red-950/30 ring-red-200/60 dark:ring-red-900/40 text-red-800 dark:text-red-200",
    info:
      "bg-blue-50 dark:bg-blue-950/30 ring-blue-200/60 dark:ring-blue-900/40 text-blue-800 dark:text-blue-200",
  }[tone];
  return (
    <div className={cn("rounded-md ring-1 p-3 flex items-start gap-2.5", cls)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="font-semibold">{title}</p>
        {body && <p className="mt-0.5">{body}</p>}
      </div>
    </div>
  );
}

/** Stepper vertical de pasos lineales con highlight del paso actual. */
export function StepList({
  steps,
}: {
  steps: { label: string; status: "done" | "current" | "pending" }[];
}) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const dot =
          s.status === "done"
            ? "bg-emerald-500"
            : s.status === "current"
              ? "bg-amber-500 ring-4 ring-amber-200 dark:ring-amber-900/50"
              : "bg-muted-foreground/30";
        const text =
          s.status === "current"
            ? "text-amber-700 dark:text-amber-300 font-semibold"
            : s.status === "done"
              ? "text-foreground"
              : "text-muted-foreground";
        return (
          <li key={i} className="flex items-center gap-2.5">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dot)} />
            <p className={cn("text-sm", text)}>
              {s.label}
              {s.status === "current" && (
                <span className="ml-2 text-[10px] uppercase tracking-wider">← actual</span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
