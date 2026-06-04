import { ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";

// Renderiza estados de carga / error / vacío para vistas cableadas a BD.
export function EstadoVista({
  isLoading,
  error,
  vacio,
  mensajeVacio = "Sin datos para este condominio.",
}: {
  isLoading: boolean;
  error?: unknown;
  vacio?: boolean;
  mensajeVacio?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando información…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-destructive">
        <AlertCircle className="h-5 w-5" /> Error al cargar: {error instanceof Error ? error.message : "desconocido"}
      </div>
    );
  }
  if (vacio) {
    return <div className="py-16 text-center text-muted-foreground">{mensajeVacio}</div>;
  }
  return null;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function KPICard({ title, value, subtitle, variant = "default" }: { title: string; value: string; subtitle?: string; variant?: "default" | "success" | "warning" | "danger" }) {
  const ring = {
    default: "border-border",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-destructive/30",
  }[variant];
  return (
    <div className={`rounded-xl border ${ring} bg-card p-4`}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight mt-1.5">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const cls = {
    default: "bg-muted text-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-primary/15 text-primary",
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>{label}</span>;
}