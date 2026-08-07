import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Tooltip de los iconos de acción de las tablas. Mismo comportamiento que el de
 * portal-cobranza: nada de `title` nativo, popup consistente en todos los portales.
 * Requiere un `TooltipProvider` arriba (ya está en App.tsx).
 */
export function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">{label}</TooltipContent>
    </Tooltip>
  );
}
