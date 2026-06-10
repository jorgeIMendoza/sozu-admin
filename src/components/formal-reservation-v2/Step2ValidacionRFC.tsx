import { useRef, useState } from "react";
import {
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useFormalReservationStore, type FormalReservation } from "@/lib/offers/formal-reservation-data";

type ValidationState = "idle" | "uploading" | "analyzing" | "validated" | "error";

interface ExtractedData {
  rfc: string;
  legalName: string;
  regimenFiscal: string;
}

interface Step2ValidacionRFCProps {
  formalReservation: FormalReservation;
  onComplete: () => void;
  onBack?: () => void;
}

const Step2ValidacionRFC = ({ formalReservation, onComplete, onBack }: Step2ValidacionRFCProps) => {
  const setFiscalIdentity = useFormalReservationStore((s) => s.setFiscalIdentity);

  const [state, setState] = useState<ValidationState>(
    formalReservation.fiscalIdentity ? "validated" : "idle"
  );
  const [fileName, setFileName] = useState<string | null>(
    formalReservation.fiscalIdentity?.csfDocumentName ?? null
  );
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    formalReservation.fiscalIdentity
      ? {
          rfc: formalReservation.fiscalIdentity.rfc,
          legalName: formalReservation.fiscalIdentity.legalName,
          regimenFiscal: formalReservation.fiscalIdentity.regimenFiscal,
        }
      : null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const buyerType = formalReservation.buyerType;

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setState("uploading");
    setTimeout(() => {
      setState("analyzing");
      setTimeout(() => {
        const mockData: ExtractedData =
          buyerType === "legal_entity"
            ? {
                rfc: "GIN9012XX001",
                legalName: "GRUPO INVERSIONES INMOBILIARIAS SA DE CV",
                regimenFiscal: "601 — General de Ley Personas Morales",
              }
            : buyerType === "individual_foreign"
            ? {
                rfc: "PEXX850101XX1",
                legalName: "JOHN PETER EXTRANJERO",
                regimenFiscal: "608 — Demás ingresos",
              }
            : {
                rfc: "EUCR850115K42",
                legalName: "RAMON ESCOBAR ULLOA",
                regimenFiscal: "612 — Personas Físicas con Actividades Empresariales y Profesionales",
              };
        setExtractedData(mockData);
        setState("validated");
      }, 2200);
    }, 1200);
  };

  const handleConfirm = () => {
    if (!extractedData) return;
    setFiscalIdentity(formalReservation.id, {
      ...extractedData,
      csfDocumentName: fileName,
      csfValidatedAt: new Date().toISOString(),
    });
    onComplete();
  };

  const handleRetry = () => {
    setState("idle");
    setFileName(null);
    setExtractedData(null);
  };

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al paso anterior
        </button>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Paso 2 de 3 · Identidad fiscal
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          Valida tu RFC con tu Constancia del SAT
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sube tu Constancia de Situación Fiscal (CSF) para verificar tu RFC.
          Esto garantiza que el apartado se haga a tu nombre fiscal real.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-4">
        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
          <p className="font-semibold mb-1">¿No tienes tu CSF a la mano?</p>
          <p>
            La Constancia de Situación Fiscal la puedes descargar gratis en{" "}
            <a href="https://sat.gob.mx" target="_blank" rel="noreferrer" className="underline font-medium">
              sat.gob.mx
            </a>{" "}
            con tu RFC y contraseña. Toma 2 minutos.
          </p>
        </div>
      </div>

      {state === "idle" && (
        <label className="block cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <div className="rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-8 text-center bg-card">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Sube tu Constancia de Situación Fiscal
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Archivo PDF descargado del portal del SAT · Máx 5MB
            </p>
          </div>
        </label>
      )}

      {(state === "uploading" || state === "analyzing") && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state === "uploading" ? "Subiendo archivo…" : "Validando con el SAT…"}
              </p>
            </div>
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          </div>
        </div>
      )}

      {state === "validated" && extractedData && (
        <div className="rounded-2xl border-2 border-success/30 bg-success/[0.04] p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Constancia validada</p>
              <p className="text-xs text-muted-foreground truncate">{fileName}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-background p-4 border border-border">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">RFC</span>
              <span className="text-sm text-foreground font-mono tabular-nums font-medium">{extractedData.rfc}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nombre fiscal</span>
              <span className="text-sm text-foreground font-medium">{extractedData.legalName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Régimen fiscal</span>
              <span className="text-xs text-foreground font-medium">{extractedData.regimenFiscal}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Subir otra constancia
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Confirmar y continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/[0.04] p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground">No pudimos validar tu Constancia</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-success/[0.06] border border-success/20 p-3">
        <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Tu Constancia se procesa de forma cifrada. SOZU no almacena el documento,
          solo los datos validados (RFC, nombre, régimen).
        </p>
      </div>
    </div>
  );
};

export default Step2ValidacionRFC;
