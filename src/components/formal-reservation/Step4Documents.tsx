import {
  useFormalReservationStore,
  getRequiredDocumentTypes,
  type FormalReservation,
  type UploadedDocument,
  type DocumentType,
} from "@/lib/offers/formal-reservation-data";
import type { PreReservation } from "@/lib/offers/offer-data";
import DocumentUploadCard from "./DocumentUploadCard";
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  formalReservation: FormalReservation;
  preReservation?: PreReservation;
}

const Step4Documents = ({ formalReservation }: Props) => {
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);

  const buyerType = formalReservation.buyerType;
  if (!buyerType) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Falta completar paso 1 (tipo de comprador) antes de continuar.
        </p>
      </div>
    );
  }

  const requiredTypes = getRequiredDocumentTypes(buyerType);
  const documents = formalReservation.documents ?? [];
  const byType = new Map<DocumentType, UploadedDocument>();
  documents.forEach((d) => byType.set(d.documentType, d));

  const approved = requiredTypes.filter((t) => byType.get(t)?.status === "approved").length;
  const rejected = requiredTypes.filter((t) => byType.get(t)?.status === "rejected").length;
  const underReview = requiredTypes.filter((t) => byType.get(t)?.status === "under_review").length;
  const allApproved = approved === requiredTypes.length;
  const remaining = requiredTypes.length - approved;
  const progressPct = (approved / requiredTypes.length) * 100;

  const handleContinue = () => {
    if (allApproved) setCurrentStep(formalReservation.id, 5);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 4 de 6 · Documentos
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          Sube tus documentos
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cada documento es revisado por nuestro equipo legal. Suelen aprobarse en pocos segundos
          si la calidad es buena. Acepta JPG, PNG o PDF, máximo 10 MB.
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${allApproved ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {approved} de {requiredTypes.length} documentos aprobados
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {approved > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                <CheckCircle2 className="w-3 h-3" />
                {approved} aprobado{approved !== 1 ? "s" : ""}
              </span>
            )}
            {underReview > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                {underReview} en revisión
              </span>
            )}
            {rejected > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                <AlertCircle className="w-3 h-3" />
                {rejected} rechazado{rejected !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {requiredTypes.map((type) => (
          <DocumentUploadCard
            key={type}
            formalReservationId={formalReservation.id}
            documentType={type}
            document={byType.get(type)}
          />
        ))}
      </div>

      {!allApproved && (
        <div className="rounded-xl bg-muted/40 border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Tip:</span> asegúrate de que la foto del
            documento esté bien iluminada, sin reflejos, y los datos sean legibles. Si tu documento
            es un PDF, súbelo directamente sin convertir.
          </p>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(formalReservation.id, 3)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          type="button"
          disabled={!allApproved}
          onClick={handleContinue}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {allApproved
            ? "Continuar al contrato"
            : `Falta${remaining !== 1 ? "n" : ""} ${remaining} documento${remaining !== 1 ? "s" : ""}`}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step4Documents;
