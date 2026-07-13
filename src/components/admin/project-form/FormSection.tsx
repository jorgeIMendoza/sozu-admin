import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface FormSectionProps {
  /** Título de la sección (opcional; sin título no se renderiza el header). */
  title?: string;
  /** Descripción breve bajo el título. */
  description?: string;
  /** Icono lucide junto al título (se pinta en un chip). */
  icon?: LucideIcon;
  /** Acción alineada a la derecha del header (ej. botón "Agregar"). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Contenedor de sección de formulario reutilizable. Header con chip de icono +
 * título + divisor, y cuerpo con padding consistente. Es la PRIMITIVA de diseño:
 * se modifica aquí una vez y aplica en TODAS las secciones del modal (mismo estándar).
 */
export const FormSection = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: FormSectionProps) => (
  <Card className={cn("overflow-hidden border-border/70 shadow-sm", className)}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{title}</h3>
            )}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    )}
    <div className={cn("space-y-4 p-4 md:p-5", contentClassName)}>{children}</div>
  </Card>
);

export default FormSection;
