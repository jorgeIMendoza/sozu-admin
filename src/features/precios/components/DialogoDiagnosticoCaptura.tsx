import { CircleCheck, CircleX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PUNTOS_INSTRUMENTACION } from "../lib/instrumentacion";

/** Diálogo de diagnóstico: enumera los puntos de captura de auditoría del módulo. */
export function DialogoDiagnosticoCaptura({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const total = PUNTOS_INSTRUMENTACION.length;
  const instrumentados = PUNTOS_INSTRUMENTACION.filter((p) => p.instrumentado).length;
  const hayFallas = instrumentados < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Diagnóstico de captura</DialogTitle>
          <DialogDescription>
            Puntos del módulo que deberían emitir un evento hacia la bitácora de auditoría.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {PUNTOS_INSTRUMENTACION.map((p) => (
            <li
              key={`${p.categoria}-${p.etiqueta}`}
              className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">{p.categoria} · </span>
                  {p.etiqueta}
                </p>
                {p.nota && (
                  <p className="text-xs text-muted-foreground">{p.nota}</p>
                )}
              </div>
              {p.instrumentado ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
            </li>
          ))}
        </ul>
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            hayFallas ? "text-destructive" : "text-emerald-700",
          )}
        >
          {instrumentados} de {total} puntos instrumentados
        </p>
      </DialogContent>
    </Dialog>
  );
}
