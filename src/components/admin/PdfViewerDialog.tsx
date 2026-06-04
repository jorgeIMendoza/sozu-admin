import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { FileText, Download, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

function extractStoragePath(url: string): { bucket: string; path: string } | null {
  const publicMatch = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (publicMatch) return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };

  if (/\/?api\/v1\/documents\/[^/]+\/file(?:_signed)?(?:\?.*)?$/i.test(url)) return null;

  if (!url.startsWith("http") && !url.startsWith("blob:")) {
    return { bucket: "firmas-digitales", path: url };
  }

  return null;
}

export function PdfViewerDialog({
  open,
  onOpenChange,
  url,
  title = "Documento PDF",
}: PdfViewerDialogProps) {
  const isMobile = useIsMobile();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    const mifielMatch = url.match(/\/?api\/v1\/documents\/([^/]+)\/file(?:_signed)?(?:\?.*)?$/i);
    if (mifielMatch?.[1]) {
      setLoading(true);
      setError(null);
      supabase.functions
        .invoke("mifiel-consultar-documento", { body: { document_id: mifielMatch[1] } })
        .then(({ data, error: invokeError }) => {
          if (invokeError || !data?.success) {
            setError("No se pudo cargar el PDF firmado.");
            setSignedUrl(null);
            return;
          }
          const resolvedUrl = data?.signed_pdf_url || data?.pdf_storage_url || null;
          if (!resolvedUrl) {
            setError("No se encontró el PDF firmado.");
            setSignedUrl(null);
            return;
          }
          setSignedUrl(resolvedUrl);
        })
        .finally(() => setLoading(false));
      return;
    }

    const storageInfo = extractStoragePath(url);
    if (!storageInfo) {
      setSignedUrl(url);
      return;
    }

    setLoading(true);
    setError(null);

    supabase.storage
      .from(storageInfo.bucket)
      .createSignedUrl(storageInfo.path, 3600)
      .then(({ data, error: err }) => {
        if (err || !data?.signedUrl) {
          setSignedUrl(url);
        } else {
          setSignedUrl(data.signedUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [open, url]);

  const effectiveUrl = signedUrl || "";
  const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

  const header = (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-foreground text-sm leading-tight truncate">{title}</h3>
        <p className="text-xs text-muted-foreground">Vista previa del documento</p>
      </div>
    </div>
  );

  const viewer = (
    <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
          <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : isImage ? (
        <div className="h-full overflow-auto flex items-center justify-center p-4">
          <img src={effectiveUrl} alt={title} className="max-w-full max-h-full object-contain" />
        </div>
      ) : (
        <iframe
          src={effectiveUrl ? `${effectiveUrl}#toolbar=0&navpanes=0` : ""}
          className="w-full h-full border-0"
          title={title}
          loading="lazy"
        />
      )}
    </div>
  );

  const footer = (
    <div className="px-5 pb-6 pt-4 border-t border-border/50 space-y-2 shrink-0">
      {effectiveUrl && !loading && (
        <a
          href={effectiveUrl}
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
        onClick={() => onOpenChange(false)}
        className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
      >
        Cerrar
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[90vh] p-0 rounded-t-2xl flex flex-col [&>button:last-child]:hidden"
        >
          {header}
          {viewer}
          {footer}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] h-[90vh] p-0 flex flex-col overflow-hidden [&>button:last-child]:hidden">
        {header}
        {viewer}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
