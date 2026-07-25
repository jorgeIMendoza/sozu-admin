import { ModalViewer } from "@/components/ui/modal-viewer";

/**
 * Visor de documentos (PDF/imagen) en modal.
 *
 * Se conserva el nombre por compatibilidad con las pantallas que ya lo usan,
 * pero el estándar vive en `ui/modal-viewer`: este archivo solo delega. Para
 * código nuevo, importar `ModalViewer` directamente.
 */
interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function PdfViewerDialog({
  open,
  onOpenChange,
  url,
  title = "Documento PDF",
}: PdfViewerDialogProps) {
  return <ModalViewer open={open} onOpenChange={onOpenChange} url={url} title={title} />;
}
