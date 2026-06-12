import { useRef, useState } from "react";
import {
  useFormalReservationStore,
  DOCUMENT_LABELS,
  type DocumentType,
  type UploadedDocument,
} from "@/lib/offers/formal-reservation-data";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface Props {
  formalReservationId: string;
  documentType: DocumentType;
  document?: UploadedDocument;
}

const MAX_SIZE_MB = 10;
const VALID_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

const DocumentUploadCard = ({ formalReservationId, documentType, document }: Props) => {
  const uploadDocument = useFormalReservationStore((s) => s.uploadDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localFileType, setLocalFileType] = useState<string | null>(null);

  const status = document?.status ?? "pending";
  const fileName = document?.fileName;
  const rejectionReason = document?.rejectionReason;
  const meta = DOCUMENT_LABELS[documentType];
  const label = meta?.label ?? documentType;
  const description = meta?.description;

  const handleFile = (file: File) => {
    setLocalError(null);

    if (!VALID_TYPES.includes(file.type)) {
      setLocalError("Formato no válido. Acepta JPG, PNG o PDF.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`Archivo muy grande. Máximo ${MAX_SIZE_MB} MB.`);
      return;
    }

    setLocalFileType(file.type);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setLocalPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLocalPreviewUrl(null);
    }

    uploadDocument(formalReservationId, documentType, {
      fileName: file.name,
      fileSize: file.size,
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const trigger = () => fileInputRef.current?.click();

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,application/pdf"
      onChange={onFileChange}
      className="hidden"
    />
  );

  // ── PENDING ──
  if (status === "pending") {
    return (
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              {description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
          <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground tracking-wider flex-shrink-0">
            Pendiente
          </span>
        </div>

        <button
          type="button"
          onClick={trigger}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full rounded-xl border-2 border-dashed transition-colors p-5 flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? "border-success bg-success/5"
              : "border-border bg-background hover:border-foreground/30 hover:bg-muted/40"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            {isDragOver ? "Suelta el archivo aquí" : "Arrastra el archivo o haz clic"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG o PDF · máx {MAX_SIZE_MB} MB
          </p>
        </button>

        {localError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {hiddenInput}
      </div>
    );
  }

  // ── UPLOADING ──
  if (status === "uploading") {
    return (
      <div className="rounded-2xl bg-card border border-primary/30 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Subiendo {fileName ?? "archivo"}…
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary tracking-wider flex-shrink-0">
            Subiendo
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-3/5 bg-primary animate-pulse" />
        </div>
      </div>
    );
  }

  const previewable = localPreviewUrl && localFileType?.startsWith("image/");
  const isPdf = localFileType === "application/pdf";
  const ThumbBox = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`}>
      {children}
    </div>
  );

  const Thumb = ({ accent }: { accent: "review" | "success" | "destructive" }) => {
    const bg =
      accent === "success" ? "bg-success/10" : accent === "destructive" ? "bg-destructive/10" : "bg-primary/10";
    const ic =
      accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-primary";
    if (previewable) {
      return (
        <ThumbBox>
          <img src={localPreviewUrl!} alt={label} className="w-full h-full object-cover" />
        </ThumbBox>
      );
    }
    return (
      <ThumbBox className={bg}>
        {isPdf ? <FileText className={`w-5 h-5 ${ic}`} /> : <ImageIcon className={`w-5 h-5 ${ic}`} />}
      </ThumbBox>
    );
  };

  // ── UNDER REVIEW ──
  if (status === "under_review") {
    return (
      <div className="rounded-2xl bg-card border border-primary/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Thumb accent="review" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {fileName ?? "Archivo"} · Verificando con nuestro equipo legal…
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary tracking-wider flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            En revisión
          </span>
        </div>
      </div>
    );
  }

  // ── APPROVED ──
  if (status === "approved") {
    return (
      <div className="rounded-2xl bg-card border border-success/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Thumb accent="success" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {fileName ?? "Archivo"} · Validado por nuestro equipo legal
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-semibold px-2 py-1 rounded-full bg-success/15 text-success tracking-wider flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Aprobado
          </span>
        </div>
      </div>
    );
  }

  // ── REJECTED ──
  if (status === "rejected") {
    return (
      <div className="rounded-2xl bg-card border border-destructive/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Thumb accent="destructive" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {fileName ?? "Archivo"}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded-full bg-destructive/15 text-destructive tracking-wider flex-shrink-0">
            Rechazado
          </span>
        </div>

        {rejectionReason && (
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-xs text-foreground leading-relaxed">
              <span className="font-semibold">Razón:</span> {rejectionReason}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={trigger}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Subir nuevamente
        </button>

        {hiddenInput}
      </div>
    );
  }

  return null;
};

export default DocumentUploadCard;
