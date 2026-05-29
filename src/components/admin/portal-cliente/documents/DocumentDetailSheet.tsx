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
import type { DocumentRecord } from "@/lib/portal-cliente/document-data";
import {
  getStatusInfo,
  getTypeInfo,
  formatFileSize,
  uploadDocument,
  simulateValidation,
} from "@/lib/portal-cliente/document-data";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import SupportLauncher from "@/components/admin/portal-cliente/support/SupportLauncher";
import type { SupportContext } from "@/lib/portal-cliente/advisor-data";

interface DetailSheetProps {
  document: DocumentRecord;
  open: boolean;
  onClose: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const DocumentDetailSheet = ({ document, open, onClose }: DetailSheetProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await new Promise((r) => setTimeout(r, 1200));
    const ext =
      uploadedFile.type === "application/pdf"
        ? "pdf"
        : uploadedFile.type === "image/png"
          ? "png"
          : "jpg";
    uploadDocument(document.id, uploadedFile.name, ext, uploadedFile.size);
    setSubmitting(false);
    toast.success("Documento subido. Te avisaremos al validarlo en máx. 24 hrs hábiles.");
    setUploadedFile(null);
    setTimeout(() => onClose(), 400);
  };

  const handleDownload = () => {
    if (hasRealUrl) {
      window.open(document.url, "_blank", "noopener,noreferrer");
    } else {
      toast.success(`Descargando ${document.fileName ?? document.name}...`);
    }
  };

  const handleSimulateValidation = () => {
    simulateValidation(document.id);
    toast.success("Documento validado.");
    setTimeout(() => onClose(), 300);
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
        className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-colors p-5 flex flex-col items-center gap-2 mb-3"
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
      <div className="rounded-xl border border-border bg-muted/20 p-4 mb-4 space-y-2">
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
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.className}`}
        >
          {document.status === "firmado" && <Zap className="w-3 h-3" />}
          {statusInfo.label}
        </span>
      </div>

      {/* File preview — only in Sheet (mobile), not in dialog right pane */}
      {!inDialog && hasRealUrl && (
        <div className="rounded-xl overflow-hidden bg-muted mb-4 border border-border">
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

      {/* Status-specific blocks */}
      {document.status === "pendiente" && (
        <>
          <div className="rounded-xl border border-warning/30 bg-warning/[0.05] p-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-warning">
                Acción requerida
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed mt-2">
              {document.description ??
                "Necesitamos que subas este documento para continuar con tu proceso."}
            </p>
          </div>
          {document.origin === "client_uploaded" && (
            <>
              {renderUploadZone()}
              <button
                onClick={handleUpload}
                disabled={!uploadedFile || submitting}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
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
          <div className="rounded-xl bg-primary/[0.05] border border-primary/20 p-4 mb-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
                En revisión
              </span>
            </div>
            <p className="text-sm text-foreground mt-2 leading-relaxed">
              Recibimos tu documento. Lo estamos validando, esto puede tomar hasta 24 hrs hábiles.
              Te avisaremos cuando esté listo.
            </p>
          </div>
          {renderMetadata()}
          <button
            onClick={handleDownload}
            className="w-full h-11 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar mi copia
          </button>
          <button
            onClick={handleSimulateValidation}
            className="w-full h-9 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            [DEMO] Simular validación de ops
          </button>
        </>
      )}

      {document.status === "validado" && (
        <>
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-success">
                Validado
              </span>
            </div>
            <p className="text-sm text-foreground mt-2">
              Documento validado por SOZU el {formatDate(document.validatedAt ?? document.uploadedAt)}.
            </p>
          </div>
          {renderMetadata()}
          <button
            onClick={handleDownload}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar
          </button>
        </>
      )}

      {document.status === "rechazado" && (
        <>
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-destructive">
                Rechazado - Acción requerida
              </span>
            </div>
            <p className="text-sm text-foreground mt-2 leading-relaxed">
              {document.rejectionReason}
            </p>
          </div>
          {document.fileName && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 mb-4 flex items-center gap-3">
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
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 mb-4">
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
          <button
            onClick={handleDownload}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar documento firmado
          </button>
          {document.nom151ConstancyUrl && (
            <button
              onClick={handleDownload}
              className="w-full h-11 mt-2 rounded-xl bg-muted/50 hover:bg-muted text-foreground font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Descargar constancia NOM-151
            </button>
          )}
        </>
      )}
    </div>
  );

  const stickyHeader = (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-card border-b border-border flex-shrink-0">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <TypeIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground leading-none mb-0.5">
          {typeInfo.label}
        </p>
        <h2 className="font-display font-semibold text-sm text-foreground leading-tight truncate">
          {document.name}
        </h2>
        {inv && (
          <p className="text-[11px] text-muted-foreground truncate">
            {inv.property.projectName} - U-{inv.property.unitNumber}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors flex-shrink-0 shadow-sm"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl" style={{ maxHeight: "90vh" }}>
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
              <div className="overflow-y-auto px-5 pb-6 flex-1">
                {renderBody({ inDialog: true })}
              </div>
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
        className="rounded-t-2xl max-h-[75vh] p-0 flex flex-col overflow-hidden"
      >
        {stickyHeader}
        <div className="overflow-y-auto px-5 pb-8 flex-1">
          {renderBody({ inDialog: false })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DocumentDetailSheet;
