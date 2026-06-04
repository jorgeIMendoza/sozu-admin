import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Download, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  fileSize?: number;
}

const PDFViewerSheet = ({ open, onClose, title, url, fileSize }: Props) => {
  const isMockEmpty = !url || url === "#";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[75dvh] p-0 rounded-t-2xl flex flex-col [&>button:last-child]:hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <p className="text-xs text-muted-foreground">Vista previa del documento</p>
          </div>
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

        {/* Footer */}
        <div className="px-4 pb-6 pt-4 border-t border-border/50 space-y-2 shrink-0">
          {!isMockEmpty && (
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar
            </a>
          )}
          <button
            onClick={onClose}
            className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PDFViewerSheet;
