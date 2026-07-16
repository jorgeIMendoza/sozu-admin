import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface FullscreenModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Controles opcionales arriba a la izquierda (ej. zoom). */
  topLeft?: React.ReactNode;
  label?: string;
}

/**
 * Modal de pantalla completa reutilizable para imágenes/planos.
 * - Se monta vía portal en document.body → cubre TODA la pantalla aunque haya
 *   ancestros con transform/overflow (que romperían un `fixed` normal).
 * - Cierra con la X, tecla Escape o clic en el backdrop.
 * - Bloquea el scroll del body mientras está abierto.
 */
const FullscreenModal = ({ open, onClose, children, topLeft, label = "Vista ampliada" }: FullscreenModalProps) => {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {topLeft && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {topLeft}
        </div>
      )}
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 z-10"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full max-w-[95vw] max-h-[90vh] flex items-center justify-center"
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default FullscreenModal;
