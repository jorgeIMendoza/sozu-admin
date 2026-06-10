import { useState, useRef } from "react";
import { CheckCircle2, ChevronDown, FileText, Clock, Upload, FileCheck, X } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type {
  FormalReservation,
  ExpedienteDocumentType,
  ExpedienteDocument,
} from "@/lib/offers/formal-reservation-data";

const DOC_LABELS: Record<ExpedienteDocumentType, { label: string; description: string }> = {
  ine_anverso: { label: "INE — Anverso", description: "Lado frontal de tu identificación" },
  ine_reverso: { label: "INE — Reverso", description: "Lado posterior con tu firma" },
  comprobante_domicilio: {
    label: "Comprobante de domicilio",
    description: "Agua, luz, gas o teléfono · ≤3 meses",
  },
};

const DOC_TYPES: ExpedienteDocumentType[] = ["ine_anverso", "ine_reverso", "comprobante_domicilio"];

const SeccionDocumentos = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const seccion = formalReservation.expediente!.documentos;
  const documents = seccion.data?.documents ?? [];
  const isCompleted = seccion.status === "completed";
  const isInProgress = seccion.status === "in_progress";

  const [expanded, setExpanded] = useState(!isCompleted);
  const statusLabel = isCompleted ? "Completada" : isInProgress ? "En progreso" : "Pendiente";
  const uploadedCount = documents.length;
  const getDocByType = (type: ExpedienteDocumentType) => documents.find((d) => d.type === type);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : isInProgress ? (
            <Clock className="w-4 h-4 text-warning" />
          ) : (
            <FileText className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sección 4
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">Documentos</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {uploadedCount === 0
                ? "INE y comprobante de domicilio reciente"
                : `${uploadedCount} de 3 documentos subidos`}
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed pt-4">
            Sube los siguientes documentos. Acepta JPG, PNG o PDF de hasta 10MB.
          </p>

          {DOC_TYPES.map((type) => (
            <DocumentUploadCard
              key={type}
              type={type}
              label={DOC_LABELS[type].label}
              description={DOC_LABELS[type].description}
              document={getDocByType(type)}
              formalReservationId={formalReservation.id}
            />
          ))}

          {isCompleted && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                Todos los documentos subidos. Sección completada automáticamente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DocumentUploadCard = ({
  type,
  label,
  description,
  document,
  formalReservationId,
}: {
  type: ExpedienteDocumentType;
  label: string;
  description: string;
  document: ExpedienteDocument | undefined;
  formalReservationId: string;
}) => {
  const addDocument = useFormalReservationStore((s) => s.addDocument);
  const removeDocument = useFormalReservationStore((s) => s.removeDocument);
  const unlockNextSections = useFormalReservationStore((s) => s.unlockNextSections);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo excede 10MB");
      return;
    }

    let previewDataUrl: string | undefined;
    if (file.type.startsWith("image/")) {
      previewDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const doc: ExpedienteDocument = {
      id: `DOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      type,
      fileName: file.name,
      fileSize: file.size,
      fileMimeType: file.type,
      uploadedAt: new Date().toISOString(),
      previewDataUrl,
    };

    addDocument(formalReservationId, doc);
    unlockNextSections(formalReservationId);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document) removeDocument(formalReservationId, document.id);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (document) {
    return (
      <div className="rounded-xl bg-card border-2 border-success/30 p-3">
        <div className="flex items-center gap-3">
          {document.previewDataUrl ? (
            <img
              src={document.previewDataUrl}
              alt={label}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-5 h-5 text-success" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground truncate">{document.fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatSize(document.fileSize)} · Subido
            </p>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            aria-label="Eliminar documento"
            className="w-7 h-7 rounded-full bg-muted hover:bg-destructive/15 hover:text-destructive text-muted-foreground flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      className="w-full text-left rounded-xl bg-card border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.02] p-4 transition-colors group"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
          <p className="text-[11px] text-primary font-medium mt-1">Toca para subir</p>
        </div>
      </div>
    </button>
  );
};

export default SeccionDocumentos;
