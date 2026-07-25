import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * ModalForm — modal estándar de FORMULARIO (header / body / footer).
 *
 * Componente padre reutilizable. Editar aquí propaga a todas las modales que lo
 * usen. Contenido flexible en `children`; acciones en `footer` (usa
 * `Button variant="cancel"` / `variant="primary-outline"`). El header trae la X
 * de cierre nativa de shadcn.
 *
 * Nota: se crea desde cero (independiente de `form-standard`) para arrancar la
 * homogeneización por componente. Piloto: portal de agentes.
 */

// ── Tokens de estilo (fuente única del estándar de modal) ────────────────────
export const MODAL_HEADER_CLS =
  "flex-row items-start justify-between space-y-0 border-b border-border px-6 py-5";
export const MODAL_TITLE_CLS = "text-lg font-bold text-foreground";
export const MODAL_SUBTITLE_CLS = "mt-0.5 text-xs text-muted-foreground";
export const MODAL_BODY_CLS = "flex flex-col gap-4 overflow-y-auto px-6 py-5";
export const MODAL_FOOTER_CLS = "flex justify-end gap-2.5 border-t border-border px-6 py-4";

// Label de campo. Requerido → asterisco rojo.
export const FIELD_LABEL_CLS = "mb-1.5 block text-sm font-medium text-muted-foreground";
export const FIELD_INPUT_CLS =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground";

export function Req() {
  return <span className="text-red-500">*</span>;
}

// Header reutilizable (título + subtítulo opcional).
export function ModalFormHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <DialogHeader className={MODAL_HEADER_CLS}>
      <div className="min-w-0 pr-6">
        <DialogTitle className={MODAL_TITLE_CLS}>{title}</DialogTitle>
        {subtitle ? (
          <DialogDescription className={MODAL_SUBTITLE_CLS}>{subtitle}</DialogDescription>
        ) : null}
      </div>
    </DialogHeader>
  );
}

export interface ModalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** ancho/estilos del contenedor (p. ej. "max-w-lg") */
  className?: string;
  bodyClassName?: string;
}

export function ModalForm({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  className,
  bodyClassName,
}: ModalFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0", className)}>
        <ModalFormHeader title={title} subtitle={subtitle} />
        <div className={cn(MODAL_BODY_CLS, "flex-1", bodyClassName)}>{children}</div>
        {footer ? <div className={MODAL_FOOTER_CLS}>{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
