import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldGridProps {
  /** Columnas en desktop. Siempre 1 columna en móvil (responsive). */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

// 1 columna en móvil → N columnas en breakpoints. Reemplaza los `grid-cols-2`
// fijos que rompían en móvil por un grid responsive consistente.
const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

/** Grilla responsive de campos de formulario. */
export const FieldGrid = ({ cols = 2, className, children }: FieldGridProps) => (
  <div className={cn("grid gap-4", COLS[cols], className)}>{children}</div>
);

export default FieldGrid;
