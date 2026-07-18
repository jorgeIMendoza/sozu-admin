// =============================================================
// Portal Condominio · Presupuesto — helpers de presentación.
// Paleta SOZU: verde=dentro de presupuesto, ámbar=cerca del límite,
// rojo=sobre-ejercido/alerta. tabular-nums en importes/%/fechas.
// =============================================================
import { CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Semaforo } from "./logic";
import { fmtPct } from "./logic";

export const SEMAFORO_META: Record<Semaforo, { label: string; icon: LucideIcon; badge: string; text: string; bar: string }> = {
  dentro: {
    label: "Dentro",
    icon: CheckCircle2,
    badge: "bg-success/15 text-success",
    text: "text-success",
    bar: "bg-success",
  },
  cerca: {
    label: "Cerca del límite",
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  excedido: {
    label: "Sobre-ejercido",
    icon: XCircle,
    badge: "bg-destructive/15 text-destructive",
    text: "text-destructive",
    bar: "bg-destructive",
  },
};

export function SemaforoBadge({ estado }: { estado: Semaforo }) {
  const m = SEMAFORO_META[estado];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap", m.badge)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

/** Barra de % ejercido + número. El color sigue el semáforo. */
export function BarraEjercido({
  porcentaje,
  estado,
  className,
}: {
  porcentaje: number;
  estado: Semaforo;
  className?: string;
}) {
  const m = SEMAFORO_META[estado];
  const ancho = Math.max(0, Math.min(100, porcentaje));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 rounded bg-muted overflow-hidden min-w-[48px]">
        <div className={cn("h-full rounded", m.bar)} style={{ width: `${ancho}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums w-12 text-right", porcentaje > 100 ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {fmtPct(porcentaje)}
      </span>
    </div>
  );
}

/** Importe con signo y color para variación (>0 = sobre-ejercido, rojo). */
export function Variacion({ monto }: { monto: number }) {
  const cero = Math.abs(monto) < 0.5;
  const cls = cero ? "text-muted-foreground" : monto > 0 ? "text-destructive" : "text-success";
  const signo = monto > 0 ? "+" : "";
  return (
    <span className={cn("tabular-nums", cls)}>
      {cero ? "—" : `${signo}${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Math.round(monto))}`}
    </span>
  );
}
