import * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Estándar de formularios/modales (base: modal "Nuevo Prospecto").
 * FUENTE ÚNICA de estilos: cambiar aquí afecta a todas las modales que lo usen,
 * sin editar componente por componente. Solo cambia el contenido, no el estilo.
 */

// Label de campo. Requerido → asterisco rojo.
export const FIELD_LABEL_CLS =
  "mb-1.5 block text-[13px] font-medium text-[#4B5563]";

// Input de texto (homologado con el estándar).
export const FIELD_INPUT_CLS =
  "w-full rounded-md border border-[#ECEEF0] bg-white px-3 py-2.5 text-[14px] font-medium text-[#171A1D] outline-none transition-all placeholder:font-normal placeholder:text-[#9AA3AD] focus:border-[hsl(158_64%_38%)] focus:ring-2 focus:ring-[hsl(158_64%_38%)]/15 disabled:bg-[#F6F7F8] disabled:text-[#9AA3AD]";

// Trigger de <Select> (shadcn) homologado al input.
export const FIELD_SELECT_TRIGGER_CLS =
  "w-full rounded-md border border-[#ECEEF0] bg-white px-3 py-2.5 h-auto text-[14px] font-medium text-[#171A1D] data-[placeholder]:font-normal data-[placeholder]:text-[#9AA3AD] focus:border-[hsl(158_64%_38%)] focus:ring-2 focus:ring-[hsl(158_64%_38%)]/15 focus:ring-offset-0";

// Encabezado de sección (uppercase pequeño, gris).
export const SECTION_HEADER_CLS =
  "mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-[#9AA3AD]";

// Botón secundario neutro (Atrás / acciones no destructivas). Hover gris suave.
export const BTN_SECONDARY_CLS =
  "rounded-md border border-[#ECEEF0] bg-white px-[18px] py-2.5 text-[13px] font-semibold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]";

// Botón de descarte (Cancelar / Cerrar). Hover → texto y borde rojos.
// Usar SOLO en botones que cancelan/cierran, no en "Atrás".
export const BTN_CANCEL_CLS =
  "rounded-md border border-[#ECEEF0] bg-white px-[18px] py-2.5 text-[13px] font-semibold text-[#4B5563] transition-colors hover:border-red-300 hover:text-red-600";

// Botón primario (Guardar / Siguiente / Finalizar): outline verde, hover se rellena.
export const BTN_PRIMARY_CLS =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

// Control segmentado (tabs tipo filtro).
export const SEG_TRACK_CLS =
  "flex rounded-md border border-[#ECEEF0] bg-[#F6F7F8] p-[3px]";
export const segBtnCls = (active: boolean) =>
  cn(
    "flex-1 rounded-md py-[7px] text-[12px] font-semibold transition-colors outline-none focus:outline-none focus-visible:outline-none",
    active
      ? "bg-white text-[#171A1D] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      : "text-[#6B7280] hover:text-[#171A1D]"
  );

// Asterisco de campo obligatorio.
export function Req() {
  return <span className="text-red-500">*</span>;
}

// Título de modal (mismo tamaño en todo el portal).
export const MODAL_TITLE_CLS = "text-[18px] font-bold text-[#171A1D]";
export const MODAL_SUBTITLE_CLS = "mt-0.5 text-[12.5px] text-[#9AA3AD]";
export const MODAL_HEADER_CLS =
  "flex-row items-start justify-between space-y-0 border-b border-[#ECEEF0] px-[22px] py-5";
export const MODAL_BODY_CLS =
  "flex flex-col gap-[18px] overflow-y-auto px-[22px] py-[22px]";
export const MODAL_FOOTER_CLS =
  "flex justify-end gap-2.5 border-t border-[#ECEEF0] px-[22px] py-4";

// Header estándar de modal: solo título (subtítulo opcional). Componente global.
export function ModalHeader({
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

/**
 * Modal estándar del portal: estructura fija header / body / footer sobre el
 * Dialog de shadcn. El header estandariza título + subtítulo (+ X de cierre que
 * trae DialogContent). El body admite cualquier contenido; el footer, cualquier
 * acción (botones estándar `variant="cancel"` / `variant="primary-outline"`).
 *
 * Uso:
 *   <StandardDialog open={open} onOpenChange={setOpen} title="Nuevo Prospecto"
 *     subtitle="..." footer={<><Button variant="cancel">Cancelar</Button>
 *       <Button variant="primary-outline">Guardar</Button></>}>
 *     ...campos...
 *   </StandardDialog>
 */
export function StandardDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string; // ancho/estilos del contenedor (p. ej. "max-w-lg")
  bodyClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0", className)}>
        <ModalHeader title={title} subtitle={subtitle} />
        <div className={cn(MODAL_BODY_CLS, "flex-1", bodyClassName)}>{children}</div>
        {footer ? <div className={MODAL_FOOTER_CLS}>{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
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
      {required && <> <Req /></>}
      {hint && <span className="font-normal text-[#9AA3AD]"> {hint}</span>}
    </div>
  );
}
