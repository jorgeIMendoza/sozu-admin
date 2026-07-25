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
 * DUEÑO ÚNICO del estándar de modales del portal de agentes: aquí viven los
 * tokens de estructura (header/body/footer, secciones, label, segmented).
 * Sustituye por completo al antiguo `form-standard` (eliminado). Los tokens usan
 * clases de Tailwind del tema (border, foreground, muted-foreground, primary):
 * nada de hex ni de valores arbitrarios salvo que el diseño lo exija.
 *
 * Las secciones dentro del body se separan con `SECTION_CLS` (línea superior),
 * nunca con `<Separator />`.
 */

// ── Tokens de estilo (fuente única del estándar de modal) ────────────────────
export const MODAL_HEADER_CLS =
  "flex-row items-start justify-between space-y-0 border-b border-border px-6 py-5";
export const MODAL_TITLE_CLS = "text-lg font-bold text-foreground";
export const MODAL_SUBTITLE_CLS = "mt-0.5 text-xs text-muted-foreground";
export const MODAL_BODY_CLS = "flex flex-col gap-4 overflow-y-auto px-6 py-5";
export const MODAL_FOOTER_CLS = "flex justify-end gap-2.5 border-t border-border px-6 py-4";

// Sección dentro del body: se separa con una línea superior, NO con <Separator />.
export const SECTION_CLS = "border-t border-border pt-4";
/**
 * Título de sección. Debe LEERSE como título: mismo tamaño que el label pero en
 * `font-semibold` y color `foreground` (el label es `font-medium` + gris), para
 * que no se confundan. Solo texto, sin ícono.
 * Usarlo únicamente cuando el título aporte contexto: si los campos ya se
 * explican solos, basta con la línea de `SECTION_CLS`.
 */
export const SECTION_HEADER_CLS = "mb-3 text-sm font-semibold text-foreground";

// Label de campo. Requerido → asterisco rojo.
export const FIELD_LABEL_CLS = "mb-1.5 block text-sm font-medium text-muted-foreground";

// Los campos NO tienen token propio: el estándar es el componente base.
//   texto    → <Input />        (ui/input.tsx)
//   select   → <SelectTrigger/> (ui/select.tsx)
//   botones  → <Button variant="cancel" | "primary-outline" /> (ui/button.tsx)

// Control segmentado (p. ej. Física / Moral).
export const SEG_TRACK_CLS = "flex rounded-md border border-input bg-muted p-1";
export const segBtnCls = (active: boolean) =>
  cn(
    "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors outline-none focus:outline-none focus-visible:outline-none",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );

export function Req() {
  return <span className="text-destructive">*</span>;
}

// Label reutilizable: texto + asterisco opcional + hint gris opcional.
export function FieldLabel({
  children,
  required,
  hint,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn(FIELD_LABEL_CLS, className)}>
      {children}
      {required && (
        <>
          {" "}
          <Req />
        </>
      )}
      {hint && <span className="font-normal text-muted-foreground"> {hint}</span>}
    </div>
  );
}

// Header reutilizable (título + subtítulo opcional).
export function ModalFormHeader({
  title,
  subtitle,
  badge,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Pastilla de estatus junto al título (Validado, En revisión…). */
  badge?: React.ReactNode;
}) {
  return (
    <DialogHeader className={MODAL_HEADER_CLS}>
      <div className="min-w-0 pr-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <DialogTitle className={MODAL_TITLE_CLS}>{title}</DialogTitle>
          {badge}
        </div>
        {/* Siempre se rinde una Description (a11y + evita el warning de Radix).
            Si no hay subtítulo, va oculta con el título como texto accesible. */}
        {subtitle ? (
          <DialogDescription className={MODAL_SUBTITLE_CLS}>{subtitle}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{typeof title === "string" ? title : "Detalle"}</DialogDescription>
        )}
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
