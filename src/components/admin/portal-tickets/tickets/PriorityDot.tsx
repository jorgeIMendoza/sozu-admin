import type { Priority } from "@/lib/portal-tickets/tickets-data";
import { PRIORIDADES } from "@/lib/portal-tickets/tickets-data";
import { cn } from "@/lib/utils";

const dotClass: Record<Priority, string> = {
  alta: "bg-destructive",
  media: "bg-amber-500",
  baja: "bg-emerald-500",
  sin: "bg-muted-foreground/40",
};

export function PriorityDot({
  prioridad,
  className,
  conTexto = true,
}: {
  prioridad: Priority;
  className?: string;
  conTexto?: boolean;
}) {
  const nombre = PRIORIDADES.find((p) => p.id === prioridad)?.nombre ?? "Sin prioridad";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className={cn("size-2.5 rounded-full", dotClass[prioridad])} aria-hidden />
      {conTexto && <span>{nombre}</span>}
    </span>
  );
}