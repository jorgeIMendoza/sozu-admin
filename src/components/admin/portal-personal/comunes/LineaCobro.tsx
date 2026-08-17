import { Banknote, FileText, KeyRound, PenLine, UserCheck } from "lucide-react";
import type { NodoLinea } from "@/lib/portal-personal/selectores";
import { cn } from "@/lib/utils";

const ICONOS = {
  "user-check": UserCheck,
  "file-text": FileText,
  "pen-line": PenLine,
  "key-round": KeyRound,
  banknote: Banknote,
} as const;

/**
 * INVARIANTE — HONESTIDAD DEL SIMULADOR:
 * ningún monto proyectado se renderiza sin su horizonte temporal.
 */
export function LineaCobro({
  nodos,
  nota,
  compacta = false,
}: {
  nodos: NodoLinea[];
  nota?: string;
  compacta?: boolean;
}) {
  return (
    <div>
      <ol className="flex flex-col gap-4 md:flex-row md:items-start md:gap-0">
        {nodos.map((n, i) => {
          const Icon = ICONOS[n.icono];
          return (
            <li key={n.titulo} className="flex flex-1 gap-3 md:flex-col md:gap-2">
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    n.alcanzado
                      ? "border-verde bg-verde-claro text-verde-oscuro"
                      : "border-border bg-secondary text-gris",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {i < nodos.length - 1 && (
                  <span
                    className={cn(
                      "w-px flex-1 md:h-px md:w-full",
                      nodos[i + 1]?.alcanzado ? "bg-verde" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="pb-2 md:pr-4">
                <p
                  className={cn(
                    "font-semibold leading-tight",
                    compacta ? "text-xs" : "text-sm",
                    n.alcanzado ? "text-verde-oscuro" : "text-negro",
                  )}
                >
                  {n.titulo}
                </p>
                <p className="num text-xs text-gris">{n.fecha}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {nota && <p className="mt-3 text-xs text-gris">{nota}</p>}
    </div>
  );
}
