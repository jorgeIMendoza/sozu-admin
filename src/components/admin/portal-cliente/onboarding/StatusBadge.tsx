import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { DocStatus } from "@/lib/portal-cliente/onboarding-store";

const MAP: Record<
  DocStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  en_revision: {
    label: "En revisión",
    className: "bg-state-review/10 text-state-review border-state-review/30",
    Icon: Clock,
  },
  validado: {
    label: "Validado",
    className: "bg-primary/10 text-primary border-primary/30",
    Icon: CheckCircle2,
  },
  rechazado: {
    label: "Rechazado",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: XCircle,
  },
  por_confirmar: {
    label: "Por confirmar",
    className: "bg-state-pending/10 text-state-pending border-state-pending/30",
    Icon: AlertCircle,
  },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const c = MAP[status];
  const Icon = c.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${c.className}`}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
