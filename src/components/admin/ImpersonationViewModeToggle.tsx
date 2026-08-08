import { Eye, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useImpersonationViewMode, type ImpersonationViewMode } from "@/contexts/ImpersonationViewModeContext";

/**
 * Selector de modo de vista al impersonar. Solo iconos: el texto vive en el
 * tooltip para no comerse el header.
 *
 *   Vista completa (ojo)      → lo que ve el admin: todo visible y editable.
 *   Vista del usuario (check) → lo que ve él: su rol, sus menús, sin edición.
 *
 * Se pinta solo cuando hay alguien impersonado; el que llama decide eso.
 */

const OPTIONS: {
  value: ImpersonationViewMode;
  label: string;
  icon: typeof Eye;
  hint: string;
}[] = [
  {
    value: "completa",
    label: "Vista completa",
    icon: Eye,
    hint: "Ves y editas todo como administrador.",
  },
  {
    value: "fiel",
    label: "Vista del usuario",
    icon: UserCheck,
    hint: "Sus menús y permisos, en solo lectura.",
  },
];

interface Props {
  /** Nombre del usuario impersonado, para el texto de ayuda. */
  targetName?: string | null;
  className?: string;
}

export function ImpersonationViewModeToggle({ targetName, className }: Props) {
  const { viewMode, setViewMode } = useImpersonationViewMode();

  return (
    <div
      role="group"
      aria-label="Modo de vista al impersonar"
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-muted/60 p-0.5",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const active = viewMode === opt.value;
        const Icon = opt.icon;
        return (
          // `delayDuration={100}`: el default de Radix (700 ms) hacía sentir el
          // hover lento en un control que se usa a cada rato.
          <Tooltip key={opt.value} delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setViewMode(opt.value)}
                aria-pressed={active}
                aria-label={opt.label}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  active
                    ? opt.value === "fiel"
                      ? "bg-amber-100 text-amber-800 shadow-sm dark:bg-amber-500/20 dark:text-amber-200"
                      : "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="font-bold">{opt.label}</p>
              <p className="text-xs opacity-90">
                {opt.hint}
                {opt.value === "fiel" && targetName ? ` Como lo ve ${targetName}.` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Aviso fijo mientras la vista fiel está activa: sin él es fácil creer que el
 * portal "se rompió" o que faltan permisos, cuando en realidad se está viendo
 * como el usuario.
 */
export function ImpersonationViewModeBanner({ targetName }: { targetName?: string | null }) {
  const { isFiel, setViewMode } = useImpersonationViewMode();
  if (!isFiel) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:px-6 lg:px-8">
      <UserCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        <strong>Vista del usuario</strong>
        {targetName ? ` · ${targetName}` : ""} · menús y permisos suyos, edición bloqueada.
      </span>
      <button
        type="button"
        onClick={() => setViewMode("completa")}
        className="ml-auto shrink-0 rounded-md border border-amber-300 bg-card px-2 py-0.5 font-bold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/20"
      >
        Ver todo
      </button>
    </div>
  );
}
