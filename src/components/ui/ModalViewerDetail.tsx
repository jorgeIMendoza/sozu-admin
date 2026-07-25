import * as React from "react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ModalFormHeader, MODAL_BODY_CLS, MODAL_FOOTER_CLS } from "@/components/ui/ModalForm";

/**
 * ModalViewerDetail — modal partido: a la IZQUIERDA un recurso visual (PDF,
 * imagen, doc) y a la DERECHA información/datos escritos (header + body + footer).
 *
 * Caso de uso: ver una evidencia junto a su detalle/edición (p. ej. comprobante
 * de pago + formulario de validación). Agnóstico al tipo de archivo. Resuelve
 * rutas del bucket privado `firmas-digitales` y documentos Mifiel; URLs públicas
 * directo. Componente padre reutilizable (piloto: portal de agentes).
 *
 * Para mostrar SOLO el recurso visual, ver `ModalViewer`.
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

/** Resuelve la URL de un recurso (firma bucket privado / Mifiel / pública). */
function useResourceUrl(open: boolean, url: string | null | undefined) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) {
      setResolved(null);
      setError(null);
      return;
    }
    const mifiel = url.match(/\/?api\/v1\/documents\/([^/]+)\/file(?:_signed)?(?:\?.*)?$/i);
    if (mifiel?.[1]) {
      setLoading(true);
      setError(null);
      supabase.functions
        .invoke("mifiel-consultar-documento", { body: { document_id: mifiel[1] } })
        .then(({ data, error: err }) => {
          const r = data?.signed_pdf_url || data?.pdf_storage_url || null;
          if (err || !data?.success || !r) { setError("No se pudo abrir el documento."); setResolved(null); return; }
          setResolved(r);
        })
        .finally(() => setLoading(false));
      return;
    }
    const info = extractStoragePath(url);
    if (!info) { setResolved(url); return; }
    setLoading(true);
    setError(null);
    supabase.storage
      .from(info.bucket)
      .createSignedUrl(info.path, 3600)
      .then(({ data, error: err }) => {
        if (err || !data?.signedUrl) {
          if (/^https?:\/\//i.test(url)) setResolved(url);
          else { setResolved(null); setError("No se pudo abrir el documento."); }
        } else setResolved(data.signedUrl);
      })
      .finally(() => setLoading(false));
  }, [open, url]);

  return { url: resolved || "", loading, error };
}

export interface ModalViewerDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Recurso visual a mostrar a la izquierda (PDF / imagen / doc). */
  resourceUrl: string | null | undefined;
  /** Contenido/detalle escrito (panel derecho). */
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** ancho/estilos del contenedor (default max-w-4xl). */
  className?: string;
  bodyClassName?: string;
}

export function ModalViewerDetail({
  open,
  onOpenChange,
  title,
  subtitle,
  resourceUrl,
  children,
  footer,
  className,
  bodyClassName,
}: ModalViewerDetailProps) {
  const { url, loading, error } = useResourceUrl(open, resourceUrl);
  const isImage = resourceUrl ? /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(resourceUrl) : false;

  const resource = (
    <div className="min-h-[240px] bg-[#F6F7F8] md:h-[90vh] md:min-h-0">
      {loading ? (
        <div className="flex h-full items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !url ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 py-16 text-center">
          <AlertCircle className="h-9 w-9 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || "Sin recurso para mostrar."}</p>
        </div>
      ) : isImage ? (
        <div className="flex h-full items-center justify-center overflow-auto p-4">
          <img src={url} alt={typeof title === "string" ? title : "Recurso"} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <iframe
          src={url}
          className="h-full min-h-[60vh] w-full border-0"
          title={typeof title === "string" ? title : "Recurso"}
          loading="lazy"
        />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("w-[95vw] max-w-4xl gap-0 overflow-hidden p-0", className)}>
        <div className="grid max-h-[90vh] md:grid-cols-2">
          {/* Izquierda: recurso visual */}
          {resource}
          {/* Derecha: header + detalle + footer */}
          <div className="flex min-h-0 flex-col md:max-h-[90vh]">
            <ModalFormHeader title={title} subtitle={subtitle} />
            <div className={cn(MODAL_BODY_CLS, "flex-1", bodyClassName)}>{children}</div>
            {footer ? <div className={MODAL_FOOTER_CLS}>{footer}</div> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
