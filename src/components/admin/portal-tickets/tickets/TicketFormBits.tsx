// Piezas compartidas del formulario de tickets (Crear y Detalle), para que AMBOS se vean igual
// y no se desincronicen: encabezado de sección + selector de prioridad en chips de color.
import type { ReactNode } from "react";
import { PRIORIDADES, type Priority } from "@/lib/portal-tickets/tickets-data";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Sección con encabezado (Detalles · Clasificación · Personas · Archivos).
export function Section({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

// Estilo de los chips de prioridad (punto de color + resaltado del activo).
const PRIO_STYLE: Record<Priority, { dot: string; active: string }> = {
  alta: { dot: "bg-destructive", active: "border-destructive bg-destructive/10 text-foreground" },
  media: { dot: "bg-amber-500", active: "border-amber-500 bg-amber-500/10 text-foreground" },
  baja: { dot: "bg-emerald-500", active: "border-emerald-500 bg-emerald-500/10 text-foreground" },
  sin: { dot: "bg-muted-foreground/40", active: "border-muted-foreground/40 bg-muted text-foreground" },
};

// Selector de prioridad como chips de color (un clic). Controlado; se usa en Crear y en Detalle.
export function PrioridadChips({
  value,
  onChange,
  disabled,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Prioridad</Label>
      <div className="flex flex-wrap gap-2">
        {PRIORIDADES.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              value === p.id
                ? cn(PRIO_STYLE[p.id].active, "font-medium")
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span className={cn("size-2.5 rounded-full", PRIO_STYLE[p.id].dot)} aria-hidden />
            {p.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
