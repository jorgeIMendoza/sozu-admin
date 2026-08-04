// Selector de MÚLTIPLES propietarios de un ticket. Muestra los seleccionados como chips
// (con X para quitar) y un select para agregar de entre los usuarios disponibles.
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agente } from "@/lib/portal-tickets/tickets-data";

export function PropietariosPicker({
  value,
  onChange,
  agentes,
  label = "Propietarios",
  disabled = false,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  agentes: Agente[];
  label?: string;
  disabled?: boolean;
}) {
  const seleccionados = value
    .map((id) => agentes.find((a) => a.id === id))
    .filter(Boolean) as Agente[];
  const disponibles = agentes.filter((a) => !value.includes(a.id));

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs"
            >
              {a.nombre}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((id) => id !== a.id))}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Quitar ${a.nombre}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <Select value="" onValueChange={(v) => v && onChange([...value, v])}>
          <SelectTrigger>
            <SelectValue
              placeholder={seleccionados.length ? "Agregar otro propietario…" : "Sin asignar — agregar propietario…"}
            />
          </SelectTrigger>
          <SelectContent>
            {disponibles.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay más usuarios</div>
            ) : (
              disponibles.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
