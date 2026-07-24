import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  BTN_SECONDARY_CLS,
  BTN_PRIMARY_CLS,
  MODAL_HEADER_CLS,
  MODAL_TITLE_CLS,
  MODAL_SUBTITLE_CLS,
  MODAL_FOOTER_CLS,
} from "@/components/ui/form-standard";

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
          // Si la url original es pública/absoluta, sirve como fallback. Si es una
          // ruta relativa de un bucket privado (p. ej. la carta en firmas-digitales)
          // y falla la firma —típico si el archivo no existe en este ambiente— NO
          // cargar la ruta cruda: resolvería contra el SPA y mostraría un 404.
          if (/^https?:\/\//i.test(url)) {
            setSignedUrl(url);
          } else {
            setSignedUrl(null);
            setError("No se pudo abrir el documento.");
          }
        } else {
          setSignedUrl(data.signedUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [open, url]);

  const effectiveUrl = signedUrl || "";
  const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

  const header = (
    <div className={cn(MODAL_HEADER_CLS, "shrink-0")}>
      <div className="min-w-0 pr-6">
        <h3 className={cn(MODAL_TITLE_CLS, "truncate")}>{title}</h3>
        <p className={MODAL_SUBTITLE_CLS}>Vista previa del documento</p>
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
    <div className={cn(MODAL_FOOTER_CLS, "shrink-0")}>
      <button onClick={() => onOpenChange(false)} className={BTN_SECONDARY_CLS}>
        Cerrar
      </button>
      {effectiveUrl && !loading && (
        <a
          href={effectiveUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={cn(BTN_PRIMARY_CLS, "gap-1.5")}
        >
          <Download className="w-4 h-4" />
          Descargar
        </a>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[90vh] p-0 rounded-t-2xl flex flex-col"
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
      <DialogContent className="max-w-3xl w-full max-h-[90vh] h-[90vh] p-0 flex flex-col overflow-hidden">
        {header}
        {viewer}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
