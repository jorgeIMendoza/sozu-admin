import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ModalFormHeader, MODAL_BODY_CLS } from "@/components/ui/modal-form";
import { Globe, Mail, Copy, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// `personas.clave_pais_telefono` guarda el código ISO del país ("MX"), no la
// lada numérica. Para armar el enlace de wa.me se necesita la lada.
const ISO_A_LADA: Record<string, string> = {
  MX: "52", US: "1", CA: "1", ES: "34", AR: "54", CO: "57", PE: "51", CL: "56",
};

export function claveALada(raw: string | null | undefined): string {
  if (!raw) return "52";
  const t = raw.trim();
  if (/^\d+$/.test(t)) return t; // dato legacy ya numérico
  return ISO_A_LADA[t.toUpperCase()] ?? "52";
}

export interface ShareDigitalOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Link público de la oferta digital (`/oferta/O-xxxxxx/RES-xxxxxx`). */
  url: string;
  /** Nombre del prospecto, para personalizar el mensaje. */
  leadName?: string;
  /** Correo del prospecto: destinatario por defecto del mailto. */
  leadEmail?: string;
  /** Teléfono a 10 dígitos del prospecto. */
  leadPhone?: string;
  /** ISO del país del teléfono ("MX") o lada numérica. */
  leadPhoneCountry?: string;
  propertyNumber?: string;
  projectName?: string;
  /** Forzar tema claro (portal de agentes en móvil). */
  forceLight?: boolean;
  /** Genera y descarga el PDF de la oferta (a demanda, ya no en automático). */
  onDownloadPdf?: () => void | Promise<void>;
  downloadingPdf?: boolean;
  /** Callback de analítica por método compartido. */
  onShare?: (method: "web" | "whatsapp" | "email" | "copy" | "pdf") => void;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/**
 * Popup para compartir la oferta digital recién generada: WhatsApp (al teléfono
 * capturado del prospecto), correo, copiar link y abrir la página pública.
 */
export function ShareDigitalOfferDialog({
  open,
  onOpenChange,
  url,
  leadName,
  leadEmail,
  leadPhone,
  leadPhoneCountry,
  propertyNumber,
  projectName,
  forceLight = false,
  onDownloadPdf,
  downloadingPdf = false,
  onShare,
}: ShareDigitalOfferDialogProps) {
  const { toast } = useToast();

  const unidad = [propertyNumber && `Departamento ${propertyNumber}`, projectName]
    .filter(Boolean)
    .join(" · ");

  const saludo = leadName ? `Hola ${leadName.split(" ")[0]}, ` : "";
  const mensaje = `${saludo}aquí está tu oferta digital${unidad ? ` — ${unidad}` : ""}:\n${url}`;

  const whatsappDigits = (leadPhone || "").replace(/\D/g, "");
  const whatsappTarget = whatsappDigits
    ? `${claveALada(leadPhoneCountry)}${whatsappDigits}`
    : "";

  const handle = (method: "web" | "whatsapp" | "email" | "copy") => {
    onShare?.(method);
    switch (method) {
      case "web":
        window.open(url, "_blank", "noopener");
        break;
      case "whatsapp":
        window.open(
          whatsappTarget
            ? `https://wa.me/${whatsappTarget}?text=${encodeURIComponent(mensaje)}`
            : `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
          "_blank",
          "noopener",
        );
        break;
      case "email":
        window.open(
          `mailto:${leadEmail || ""}?subject=${encodeURIComponent(
            `Tu oferta digital${unidad ? ` — ${unidad}` : ""}`,
          )}&body=${encodeURIComponent(mensaje)}`,
          "_blank",
          "noopener",
        );
        break;
      case "copy":
        navigator.clipboard.writeText(url);
        toast({ title: "Copiado", description: "Link de la oferta copiado al portapapeles." });
        break;
    }
    // El popup NO se cierra al compartir: el agente puede mandar el link por
    // varios medios y descargar el PDF. Solo cierra con Esc o la X.
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-sm gap-0 overflow-hidden p-0", forceLight && "light")}
        // Solo cierra con Esc o la X: un clic fuera no debe tirar el link.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <ModalFormHeader
          title="Compartir oferta digital"
          subtitle={unidad || undefined}
        />
        <div className={cn(MODAL_BODY_CLS, "gap-3")}>
          <Button variant="primary-outline" className="w-full" onClick={() => handle("web")}>
            <Globe className="h-4 w-4" /> Ver página web
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handle("whatsapp")}>
              <WhatsAppIcon className="h-5 w-5 text-green-500" /> WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handle("email")}>
              <Mail className="h-5 w-5 text-muted-foreground" /> Correo
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handle("copy")}>
              <Copy className="h-5 w-5 text-muted-foreground" /> Copiar link
            </Button>
            <Button
              variant="outline"
              className="gap-2 justify-start"
              disabled={!onDownloadPdf || downloadingPdf}
              onClick={() => { onShare?.("pdf"); onDownloadPdf?.(); }}
            >
              {downloadingPdf ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Download className="h-5 w-5 text-muted-foreground" />
              )}
              {downloadingPdf ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
          {whatsappTarget && (
            <p className="text-xs text-muted-foreground">
              WhatsApp se abrirá con el número +{whatsappTarget}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
