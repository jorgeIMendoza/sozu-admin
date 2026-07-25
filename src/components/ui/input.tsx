import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Estándar de campo de texto del core (foco primary). Es el estándar también
 * dentro de las modales: usar `<Input />`. `INPUT_CLS` se exporta solo para
 * elementos nativos que no son `<input>` (p. ej. `<select>`, `<textarea>`).
 */
export const INPUT_CLS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base font-medium ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(INPUT_CLS, className)} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
