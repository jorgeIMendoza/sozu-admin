import { Sheet, SheetContent } from "@/components/ui/sheet";
import { X, Download, ExternalLink, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  fileSize?: number;
}

const PDFViewerSheet = ({ open, onClose, title, url, fileSize }: Props) => {
  const isMockEmpty = !url || url === "#";

  const handleOpenExternal = () => {
    if (!isMockEmpty) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[95vh] p-0 rounded-t-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <p className="text-xs text-muted-foreground">
              PDF{fileSize ? ` · ${(fileSize / (1024 * 1024)).toFixed(1)} MB` : ""}
            </p>
          </div>
          <button
            onClick={handleOpenExternal}
            disabled={isMockEmpty}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
          <a
            href={isMockEmpty ? undefined : url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted ${isMockEmpty ? "opacity-30 pointer-events-none" : ""}`}
            aria-label="Descargar"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Viewer */}
        <div className="flex-1 bg-muted/20 overflow-hidden">
          {isMockEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Vista previa no disponible
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                El PDF se cargará al integrar con backend
              </p>
            </div>
          ) : (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              title={title}
              loading="lazy"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PDFViewerSheet;
