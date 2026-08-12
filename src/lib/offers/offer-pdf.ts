/**
 * Generación y descarga del PDF de una oferta ya creada.
 *
 * El PDF dejó de generarse en automático al crear la oferta digital: se produce a
 * demanda desde el popup de compartir, tanto al generarla como al reenviarla más
 * tarde desde el pipeline.
 */
export type OfertaPdfParams = {
  propertyId: number;
  offerId: number;
  propertyNumber: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  creatorEmail?: string | null;
  /** Ofertas de producto (bodega / estacionamiento) llevan plantilla distinta. */
  isProductOffer?: boolean;
  productId?: number | null;
};

/** Dispara la descarga de un blob con el nombre indicado. */
function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Genera el/los PDF de la oferta. Devuelve cuántos se generaron.
 * Lanza si la generación falla, para que quien llame muestre el aviso.
 *
 * `descargar: false` produce y sube el PDF a Storage (queda en `ofertas.url`)
 * sin bajarlo al equipo: es lo que necesita el correo con PDF adjunto, donde el
 * archivo local nunca se pide.
 */
export async function generarPdfOferta(
  params: OfertaPdfParams,
  opts: { descargar?: boolean } = {},
): Promise<number> {
  const { descargar: bajarArchivo = true } = opts;
  const { generateOfferPDFAsBase64 } = await import("@/services/htmlToPdfService");

  const pdfs = await generateOfferPDFAsBase64({
    propertyId: params.propertyId,
    offerId: params.offerId,
    propertyNumber: params.propertyNumber,
    leadName: params.leadName || "",
    leadEmail: params.leadEmail || "",
    leadPhone: params.leadPhone || "",
    creatorEmail: params.creatorEmail || "",
    ...(params.isProductOffer
      ? { isProductOffer: true, productId: params.productId ?? undefined }
      : {}),
  } as any);

  if (bajarArchivo) {
    for (const pdf of pdfs) {
      descargar(pdf.blob, pdf.filename);
    }
  }
  return pdfs.length;
}

/** Genera el/los PDF y los descarga. Atajo del caso más común. */
export async function generarYDescargarPdfOferta(params: OfertaPdfParams): Promise<number> {
  return generarPdfOferta(params, { descargar: true });
}
