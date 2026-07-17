import { useRef, useState, useEffect } from "react";
import * as Icons from "lucide-react";
import {
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  ShieldCheck,
  FileText,
  X,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { DocumentRecord } from "@/lib/portal-cliente/document-data";
import {
  getStatusInfo,
  getTypeInfo,
  formatFileSize,
} from "@/lib/portal-cliente/document-data";
import { supabase } from "@/integrations/supabase/client";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import SupportLauncher from "@/components/admin/portal-cliente/support/SupportLauncher";
import type { SupportContext } from "@/lib/portal-cliente/advisor-data";

interface DetailSheetProps {
  document: DocumentRecord;
  open: boolean;
  onClose: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function triggerAnchor(href: string, download?: string) {
  const a = document.createElement("a");
  a.href = href;
  if (download) a.download = download;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadFile(url: string, fileName?: string) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (driveMatch) {
    triggerAnchor(`https://drive.google.com/uc?export=download&id=${driveMatch[1]}`);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    triggerAnchor(objUrl, fileName ?? url.split("/").pop()?.split("?")[0] ?? "archivo");
    setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
  } catch {
    triggerAnchor(url);
  }
}

const DocumentDetailSheet = ({ document, open, onClose }: DetailSheetProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const typeInfo = getTypeInfo(document.type);
  const statusInfo = getStatusInfo(document.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TypeIcon = ((Icons as any)[typeInfo.icon] ?? Icons.FileText) as React.ComponentType<{
    className?: string;
  }>;

  const toneIconStyle: Record<string, { bg: string; text: string }> = {
    warning: { bg: "bg-amber-50", text: "text-amber-600" },
    primary: { bg: "bg-primary/10", text: "text-primary" },
    success: { bg: "bg-emerald-50", text: "text-emerald-600" },
    destructive: { bg: "bg-red-50", text: "text-red-500" },
  };
  const iconStyle = toneIconStyle[statusInfo.tone] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  const { data: portfolio = [] } = usePortfolioCliente();
  const inv = portfolio.find((p) => p.property.id === document.propertyId);
  const hasRealUrl = !!document.url && document.url !== "#";
  const isImage = document.fileExtension === "jpg" || document.fileExtension === "png";

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido. Sube JPG, PNG o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo excede 10 MB.");
      return;
    }
    setUploadedFile(file);
  };

  const handleUpload = async () => {
    if (!uploadedFile) return;
    setSubmitting(true);
    try {
      const timestamp = Date.now();
      const fileName = `doc_${timestamp}_${uploadedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, uploadedFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from("documentos")
        .update({ url: publicUrl, id_estatus_verificacion: 1 })
        .eq("id", parseInt(document.id));
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["cliente-documents"] });
      toast.success("Documento subido. Te avisaremos al validarlo en máx. 24 hrs hábiles.");
      setUploadedFile(null);
      setTimeout(() => onClose(), 400);
    } catch {
      toast.error("No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (hasRealUrl) {
      downloadFile(document.url!, document.fileName);
    } else {
      toast.success(`Descargando ${document.fileName ?? document.name}...`);
    }
  };

  const renderUploadZone = () => (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full rounded-md border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-colors p-5 flex flex-col items-center gap-2 mb-3"
      >
        {uploadedFile ? (
          <>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground truncate max-w-[240px]">
                {uploadedFile.name}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Toca para seleccionar archivo</p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG o PDF · máx. 10 MB</p>
            </div>
          </>
        )}
      </button>
    </>
  );

  const renderMetadata = () => {
    if (!document.fileName) return null;
    return (
      <div className="rounded-md border border-border bg-muted/20 p-4 mb-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Detalles del archivo
        </p>
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Nombre</span>
          <span className="text-foreground font-medium truncate ml-2 max-w-[200px]">
            {document.fileName}
          </span>
        </div>
        {document.fileSize && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Tamaño</span>
            <span className="text-foreground tabular-nums">{formatFileSize(document.fileSize)}</span>
          </div>
        )}
        {document.fileExtension && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Formato</span>
            <span className="text-foreground uppercase">{document.fileExtension}</span>
          </div>
        )}
        {document.uploadedAt && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Subido</span>
            <span className="text-foreground">{formatDate(document.uploadedAt)}</span>
          </div>
        )}
      </div>
    );
  };

  const renderBody = ({ inDialog }: { inDialog: boolean }) => (
    <div className="pt-4">
      {/* Status-specific blocks */}
      {document.status === "pendiente" && (
        <>
          {document.origin === "client_uploaded" && (
            <>
              {renderUploadZone()}
              <button
                onClick={handleUpload}
                disabled={!uploadedFile || submitting}
                className="w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  "Subir documento"
                )}
              </button>
            </>
          )}
        </>
      )}

      {document.status === "recibido" && (
        <>
          {renderMetadata()}
        </>
      )}

      {document.status === "validado" && (
        <>
          {renderMetadata()}
        </>
      )}

      {document.status === "rechazado" && (
        <>
          {document.rejectionReason && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{document.rejectionReason}</p>
          )}
          {document.fileName && (
            <div className="rounded-md border border-border bg-muted/20 p-3 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Tu última subida
                </p>
                <p className="text-xs text-foreground truncate">{document.fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(document.uploadedAt)}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                Ver
              </button>
            </div>
          )}
          {renderUploadZone()}
          <button
            onClick={handleUpload}
            disabled={!uploadedFile || submitting}
            className="w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              "Subir nueva versión"
            )}
          </button>
          {inv && (
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                ¿No entiendes por qué fue rechazado?
              </p>
              <SupportLauncher
                context={{
                  propertyId: inv.property.id,
                  propertyName: inv.property.projectName,
                  unitNumber: inv.property.unitNumber,
                  flowName: "Documento rechazado",
                  flowStep: document.name,
                  additionalNotes: document.rejectionReason,
                } satisfies SupportContext}
                variant="compact"
              />
            </div>
          )}
        </>
      )}

      {document.status === "firmado" && (
        <>
          <div className="rounded-md bg-success/10 border border-success/20 p-4 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-success" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-success">
                Firmado electrónicamente
              </span>
            </div>
            <p className="text-sm text-foreground mt-2 leading-relaxed">
              Firmado por ambas partes el {formatDate(document.signedAt)} mediante{" "}
              {document.signatureProvider === "mifiel" ? "MIFIEL" : "firma manual"}.
            </p>
            {document.nom151ConstancyUrl && (
              <div className="inline-flex items-center gap-1 text-[10px] text-success font-semibold mt-2">
                <ShieldCheck className="w-3 h-3" />
                NOM-151 - Validez legal completa
              </div>
            )}
          </div>
          {renderMetadata()}
        </>
      )}

      {/* File preview - mobile only, after details */}
      {!inDialog && hasRealUrl && (
        <div className="rounded-md overflow-hidden bg-muted mt-4 border border-border">
          {isImage ? (
            <img
              src={document.url}
              alt={document.name}
              className="w-full max-h-72 object-contain bg-black/5"
            />
          ) : (
            <iframe
              src={document.url}
              title={document.name}
              className="w-full h-72"
              style={{ border: "none" }}
            />
          )}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="px-5 pb-8 pt-4 border-t border-border/50 space-y-2 shrink-0">
      {hasRealUrl && (
        <button
          onClick={() => downloadFile(document.url!, document.fileName)}
          className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar
        </button>
      )}
      {document.nom151ConstancyUrl && (
        <button
          onClick={() => downloadFile(document.nom151ConstancyUrl!, "constancia-nom151.pdf")}
          className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-md transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Constancia NOM-151
        </button>
      )}
      <button
        onClick={onClose}
        className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-md transition-colors"
      >
        Cerrar
      </button>
    </div>
  );

  const stickyHeader = (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-5 pt-5 pb-4 bg-card border-b border-border shrink-0">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconStyle.bg}`}>
        <TypeIcon className={`w-[18px] h-[18px] ${iconStyle.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-sm text-foreground leading-tight truncate">
          {document.name}
        </h2>
        <p className="text-xs text-muted-foreground truncate">
          {typeInfo.label}{inv ? ` · ${inv.property.projectName} U-${inv.property.unitNumber}` : ""}
        </p>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-md [&>button:last-child]:hidden" style={{ maxHeight: "90vh" }}>
          <div className="flex h-full" style={{ minHeight: hasRealUrl ? "560px" : undefined }}>
            {/* Left preview pane */}
            {hasRealUrl && (
              <div className="flex-1 bg-muted border-r border-border flex items-stretch">
                {isImage ? (
                  <img src={document.url} alt={document.name} className="w-full object-contain" />
                ) : (
                  <iframe
                    src={document.url}
                    title={document.name}
                    className="w-full h-full"
                    style={{ border: "none", minHeight: "560px" }}
                  />
                )}
              </div>
            )}
            {/* Right details pane */}
            <div className={`${hasRealUrl ? "w-[360px] shrink-0" : "w-full"} flex flex-col overflow-hidden`}>
              {stickyHeader}
              <div className="overflow-y-auto px-5 pb-2 flex-1">
                {renderBody({ inDialog: true })}
              </div>
              {footer}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[75dvh] p-0 flex flex-col overflow-hidden [&>button:last-child]:hidden"
      >
        {stickyHeader}
        <div className="overflow-y-auto px-5 pb-2 flex-1">
          {renderBody({ inDialog: false })}
        </div>
        {footer}
      </SheetContent>
    </Sheet>
  );
};

export default DocumentDetailSheet;
