import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IconTooltipProps {
  label: string;
  children: ReactNode;
}

/**
 * Tooltip rápido para botones de icono sin etiqueta. Delay corto (120ms) para
 * que se sienta ágil. `children` debe ser un único elemento que reenvíe ref
 * (ej. un Button, o un DialogTrigger asChild que envuelve un Button).
 */
export const IconTooltip = ({ label, children }: IconTooltipProps) => (
  <TooltipProvider delayDuration={120} skipDelayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default IconTooltip;
