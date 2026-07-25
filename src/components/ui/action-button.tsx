import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * ActionButton — botón de acción de PÁGINA (no de modal).
 *
 * Es el "Nueva oferta", "Nuevo prospecto", "Agregar cuenta", "Gestionar
 * documentos"… Antes cada uno repetía sus clases a mano y se desincronizaban.
 * Este es el componente padre: cambiar aquí (color, alto, tipografía, tamaño de
 * ícono) se propaga a todos.
 *
 * Reglas que encapsula:
 * - Estilo por defecto `variant="primary-outline"` (el estándar del portal).
 * - El ícono se pasa por prop `icon`, no como children, y siempre mide 4.
 *   En modales los botones NO llevan ícono: ahí se usa `<Button>` directo.
 * - `shortLabel` da el texto corto para móvil sin duplicar markup.
 *
 * Uso:
 *   <ActionButton icon={Plus} onClick={…}>Nueva oferta</ActionButton>
 *   <ActionButton icon={Plus} shortLabel="Nuevo" size="sm">Nuevo prospecto</ActionButton>
 */
export interface ActionButtonProps extends Omit<ButtonProps, "asChild"> {
  /** Ícono lucide a la izquierda del texto. */
  icon?: LucideIcon;
  /** Texto alterno para pantallas < sm (si se omite, el texto no cambia). */
  shortLabel?: React.ReactNode;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, shortLabel, variant = "primary-outline", children, ...props }, ref) => (
    <Button ref={ref} variant={variant} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {shortLabel ? (
        <>
          <span className="hidden sm:inline">{children}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  ),
);
ActionButton.displayName = "ActionButton";
