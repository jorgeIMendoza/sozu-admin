import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalFormHeader, MODAL_FOOTER_CLS } from "@/components/ui/ModalForm";

/**
 * ModalViewer — modal que muestra ÚNICAMENTE un recurso visual (PDF, imagen, doc).
 *
 * Agnóstico al tipo de archivo. Resuelve rutas del bucket privado
 * `firmas-digitales` a signed URL y documentos Mifiel (`/api/v1/documents/<id>/file`)
 * vía Edge Function; las URLs públicas se abren directo. Header/footer estándar
 * (Descargar / Cerrar). Componente padre reutilizable (piloto: portal de agentes).
 *
 * Para recurso visual + información escrita al lado, ver `ModalViewerDetail`.
 */

function extractStoragePath(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  if (/\/?api\/v1\/documents\/[^/]+\/file(?:_signed)?(?:\?.*)?$/i.test(url)) return null;
  if (!url.startsWith("http") && !url.startsWith("blob:")) {
    return { bucket: "firmas-digitales", path: url.replace(/^\/+/, "") };
  }
  return null;
}

export interface ModalViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function ModalViewer({ open, onOpenChange, url, title = "Documento" }: ModalViewerProps) {
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

    // Documento Mifiel → resolver vía Edge Function.
    const mifiel = url.match(/\/?api\/v1\/documents\/([^/]+)\/file(?:_signed)?(?:\?.*)?$/i);
    if (mifiel?.[1]) {
      setLoading(true);
      setError(null);
      supabase.functions
        .invoke("mifiel-consultar-documento", { body: { document_id: mifiel[1] } })
        .then(({ data, error: err }) => {
          const resolved = data?.signed_pdf_url || data?.pdf_storage_url || null;
          if (err || !data?.success || !resolved) {
            setError("No se pudo abrir el documento.");
            setSignedUrl(null);
            return;
          }
          setSignedUrl(resolved);
        })
        .finally(() => setLoading(false));
      return;
    }

    const info = extractStoragePath(url);
    if (!info) {
      setSignedUrl(url);
      return;
    }

    setLoading(true);
    setError(null);
    supabase.storage
      .from(info.bucket)
      .createSignedUrl(info.path, 3600)
      .then(({ data, error: err }) => {
        if (err || !data?.signedUrl) {
          // URL pública absoluta → sirve como fallback; ruta relativa privada
          // fallida → error controlado (no cargar la ruta cruda → 404 del SPA).
          if (/^https?:\/\//i.test(url)) setSignedUrl(url);
          else {
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
  const isImage = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(url);

  const body = (
    <div className="min-h-0 flex-1 overflow-hidden bg-[#F6F7F8]">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : isImage ? (
        <div className="flex h-full items-center justify-center overflow-auto p-4">
          <img src={effectiveUrl} alt={title} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <iframe
          src={effectiveUrl ? `${effectiveUrl}#toolbar=0&navpanes=0` : ""}
          className="h-full w-full border-0"
          title={title}
          loading="lazy"
        />
      )}
    </div>
  );

  const footer = (
    <div className={MODAL_FOOTER_CLS}>
      <Button variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>
      {effectiveUrl && !loading && (
        <Button variant="primary-outline" asChild>
          <a href={effectiveUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" /> Descargar
          </a>
        </Button>
      )}
    </div>
  );

  const content = (
    <>
      <ModalFormHeader title={title} subtitle="Vista previa del documento" />
      {body}
      {footer}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex h-[90vh] flex-col rounded-t-2xl p-0">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex h-[90vh] max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0")}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
