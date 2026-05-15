import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type DrawerAction = {
  label: string;
  variant: "primary" | "secondary" | "destructive";
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  requiresNote?: boolean;
};

export type DrawerActionFooterProps = {
  actions: DrawerAction[];
  notePlaceholder?: string;
  /** Cierra el drawer después de ejecutar una acción válida. */
  onCancel: () => void;
};

export function DrawerActionFooter({
  actions,
  notePlaceholder,
  onCancel,
}: DrawerActionFooterProps) {
  const [note, setNote] = useState("");
  const [errorOn, setErrorOn] = useState<string | null>(null);

  const handleAction = (a: DrawerAction) => {
    if (a.requiresNote && !note.trim()) {
      setErrorOn(a.label);
      // Limpia el error tras ~1.5s para que el textarea vuelva a verse normal.
      setTimeout(() => setErrorOn(null), 1500);
      return;
    }
    a.onClick();
    toast(
      `✓ ${a.label} registrada en demo — la persistencia se habilita al conectar con BD productiva.`,
      { duration: 4000 }
    );
    onCancel();
  };

  // Ordena: destructive aparte (izquierda), después secondary, después primary.
  const destructiveAction = actions.find((a) => a.variant === "destructive");
  const nonDestructive = actions.filter((a) => a.variant !== "destructive");
  const ordered = [
    ...nonDestructive.filter((a) => a.variant === "secondary"),
    ...nonDestructive.filter((a) => a.variant === "primary"),
  ];

  return (
    <div className="mt-6 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Notas
        </p>
        <Textarea
          rows={3}
          placeholder={notePlaceholder || "Agregar notas a esta decisión…"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className={cn(
            "resize-none transition-colors",
            errorOn && "border-red-400 ring-1 ring-red-400 focus-visible:ring-red-400"
          )}
        />
        <div className="flex items-center justify-between mt-1">
          {errorOn ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              Notas son requeridas para esta acción
            </p>
          ) : (
            <span />
          )}
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {note.length} / 500
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
        {/* Izquierda — Cancelar + Destructive */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          {destructiveAction && (
            <Button
              variant="outline"
              size="sm"
              disabled={destructiveAction.disabled}
              onClick={() => handleAction(destructiveAction)}
              title={destructiveAction.disabled ? destructiveAction.disabledReason : undefined}
              className={cn(
                !destructiveAction.disabled &&
                  "border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
              )}
            >
              {destructiveAction.label}
            </Button>
          )}
        </div>

        {/* Derecha — secondary → primary */}
        <div className="flex items-center gap-2">
          {ordered.map((a) => (
            <Button
              key={a.label}
              variant={a.variant === "primary" ? "default" : "outline"}
              size="sm"
              disabled={a.disabled}
              onClick={() => handleAction(a)}
              title={a.disabled ? a.disabledReason : undefined}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
