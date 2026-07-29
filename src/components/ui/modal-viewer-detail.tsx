import * as React from "react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ModalFormHeader, MODAL_BODY_CLS, MODAL_FOOTER_CLS } from "@/components/ui/modal-form";

/**
 * ModalViewerDetail - modal partido: un recurso visual (PDF, imagen, doc) a un
 * lado e información/datos escritos al otro (header + body + footer).
 *
 * Por defecto el recurso va a la IZQUIERDA. Con `resourceSide="right"` se
 * invierte: primero el formulario y la vista previa a la derecha (útil cuando el
 * usuario elige/sube el archivo dentro del propio modal y la previsualización es
 * consecuencia de lo que capturó).
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
  resourceUrl?: string | null;
  /**
   * Panel izquierdo propio (carrusel, mapa, plano interactivo…). Si se pasa,
   * manda sobre `resourceUrl` y el componente no resuelve ninguna URL.
   */
  resource?: React.ReactNode;
  /** Contenido/detalle escrito (panel derecho). */
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** ancho/estilos del contenedor (default max-w-4xl). */
  className?: string;
  bodyClassName?: string;
  /** Estilos extra del panel del recurso (p. ej. `aspect-[4/3] md:aspect-auto`). */
  resourceClassName?: string;
  /** Lado del recurso visual en desktop. Default `left`. */
  resourceSide?: "left" | "right";
}

export function ModalViewerDetail({
  open,
  onOpenChange,
  title,
  subtitle,
  resourceUrl,
  resource: customResource,
  children,
  footer,
  className,
  bodyClassName,
  resourceClassName,
  resourceSide = "left",
}: ModalViewerDetailProps) {
  const { url, loading, error } = useResourceUrl(open, resourceUrl);
  const isImage = resourceUrl ? /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(resourceUrl) : false;

  // En móvil el recurso siempre va arriba; en desktop el orden lo decide resourceSide.
  const resourceWrapperCls = cn(
    "relative min-h-[240px] overflow-hidden bg-muted md:h-[90vh] md:min-h-0",
    resourceSide === "right" && "md:order-2",
    resourceClassName,
  );

  const resource = customResource ? (
    <div className={resourceWrapperCls}>{customResource}</div>
  ) : (
    <div className={resourceWrapperCls}>
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
      <DialogContent className={cn("w-full gap-0 overflow-hidden p-0 sm:w-[95vw] sm:max-w-4xl", className)}>
        <div className="grid max-h-[90vh] grid-cols-1 md:grid-cols-2">
          {/* Recurso visual (izquierda por defecto, derecha con resourceSide) */}
          {resource}
          {/* Header + detalle + footer */}
          <div className={cn("flex min-h-0 flex-col md:max-h-[90vh]", resourceSide === "right" && "md:order-1")}>
            <ModalFormHeader title={title} subtitle={subtitle} />
            <div className={cn(MODAL_BODY_CLS, "flex-1", bodyClassName)}>{children}</div>
            {footer ? <div className={MODAL_FOOTER_CLS}>{footer}</div> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
