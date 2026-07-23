import { ReactNode } from "react";
import { Sparkles, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PageHeader({
  title,
  description,
  subtitle,
  actions,
  children,
}: {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  // `subtitle` es alias de `description`; `children` se muestra junto a `actions`
  // en el área superior derecha (badges, selects, botones del encabezado).
  const sub = description ?? subtitle;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && (
          <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
      {(actions || children) && <div className="flex flex-wrap items-center gap-2">{actions}{children}</div>}
    </div>
  );
}

export function MockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      Mock
    </span>
  );
}

type DataSource = "mock" | "sandbox" | "imported" | "manual" | "mixed";

const DATA_SOURCE_TONE: Record<DataSource, string> = {
  mock: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sandbox: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  imported: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  manual: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  mixed: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
};

export function DataSourceBadge({ source = "mock", note }: { source?: DataSource; note?: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] inline-flex items-center gap-1 ${DATA_SOURCE_TONE[source]}`}>
      <FlaskConical className="h-3 w-3" />
      <span className="capitalize">{source}</span>
      {note && <span className="opacity-70">· {note}</span>}
    </Badge>
  );
}

export function MockDataDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      Mock data — production values may differ. Las métricas se recalcularán automáticamente al conectar datos reales post-deploy.
    </p>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: any;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && (
        <div className="rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>}
      </div>
      {action}
    </Card>
  );
}

export function ComingSoon({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-6">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">
        Esta pantalla se construye en una sub-fase posterior. Lo que incluirá:
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground list-disc list-inside">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </Card>
  );
}

// Fila etiqueta/valor compacta (para paneles de detalle y tarjetas).
export function ARow({ label, v, mono }: { label: string; v?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xs truncate max-w-[180px] ${mono ? "font-mono" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}

// Campo etiqueta/valor en columna (label arriba, contenido abajo) para formularios/detalle.
export function DField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
