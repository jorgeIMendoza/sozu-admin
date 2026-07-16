import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  /** Icono del encabezado (lucide). Omitir para card sin header. */
  icon?: LucideIcon;
  /** Título del encabezado. Omitir (junto con icon) para card sin header. */
  title?: string;
  /** Contenido opcional alineado a la derecha del encabezado (badge, acción, %). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** Clases del cuerpo. Default: padding estándar. */
  bodyClassName?: string;
  /** Clases extra del contenedor. */
  className?: string;
  id?: string;
}

/**
 * Card estándar de las secciones de la oferta digital.
 * - Sombra sutil (shadow-sm) para destacar, SIN animaciones de zoom/hover
 *   (las secciones no son clickeables).
 * - Encabezado unificado: strip con icono + título (y acción opcional a la derecha).
 * Reutilizable por todas las secciones para mantener el mismo lenguaje visual.
 */
const SectionCard = ({
  icon: Icon,
  title,
  headerRight,
  children,
  bodyClassName = "p-5 md:p-6",
  className = "",
  id,
}: SectionCardProps) => (
  <section
    id={id}
    className={`rounded-md border border-border bg-card overflow-hidden shadow-sm ${className}`}
  >
    {(title || headerRight) && (
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary shrink-0" />}
          {title && <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

export default SectionCard;
