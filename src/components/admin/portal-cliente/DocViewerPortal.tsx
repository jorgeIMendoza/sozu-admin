import { createPortal } from "react-dom";
import { FileText, Download } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  subtitle?: string;
  downloadFilename?: string;
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

const DocViewerPortal = ({
  open,
  onClose,
  url,
  title,
  subtitle,
  downloadFilename,
}: Props) => {
  if (!open || !url) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl flex flex-col h-[75dvh] sm:h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/10">
          {isImageUrl(url) ? (
            <img
              src={url}
              alt={title}
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              className="w-full h-full border-0"
              title={title}
              loading="lazy"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-4 border-t border-border/50 space-y-2 shrink-0">
          <a
            href={url}
            download={downloadFilename}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar
          </a>
          <button
            onClick={onClose}
            className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DocViewerPortal;
