import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFormalReservationStore,
  type FormalReservation,
} from "@/lib/offers/formal-reservation-data";
import type { PreReservation, OfertaComercial } from "@/lib/offers/offer-data";
import {
  ArrowLeft,
  ShieldCheck,
  Upload,
  CheckCircle2,
  Loader2,
  ExternalLink,
  FileText,
  Eye,
  EyeOff,
  Circle,
} from "lucide-react";

interface Props {
  formalReservation: FormalReservation;
  preReservation?: PreReservation;
  offer?: OfertaComercial;
}

type SignatureState = "idle" | "verifying" | "signed";

const VERIFY_MESSAGES = [
  "Validando certificado del SAT",
  "Verificando vigencia de la e.firma",
  "Generando hash criptográfico",
  "Sellando con timestamp NOM-151",
];

const Step6Signature = ({ formalReservation, offer }: Props) => {
  const navigate = useNavigate();
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);
  const initiateContractSignature = useFormalReservationStore(
    (s) => s.initiateContractSignature
  );
  const completeContractSignature = useFormalReservationStore(
    (s) => s.completeContractSignature
  );
  const completeFormalReservation = useFormalReservationStore(
    (s) => s.completeFormalReservation
  );

  const [state, setState] = useState<SignatureState>("idle");
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [signedData, setSignedData] = useState<{
    hash: string;
    timestamp: string;
    folio: string;
    certificateRFC: string;
    certificateName: string;
    certificateValidUntil: string;
  } | null>(null);

  const personal = formalReservation.personalData ?? {};
  const buyerType = formalReservation.buyerType;
  const property = offer?.property;
  const development = offer?.development;

  const isFormValid = !!cerFile && !!keyFile && password.length >= 8;

  const handleSign = () => {
    if (!isFormValid) return;
    setState("verifying");
    setVerifyStep(0);
    initiateContractSignature(formalReservation.id);

    const messageInterval = setInterval(() => {
      setVerifyStep((prev) => {
        if (prev >= VERIFY_MESSAGES.length - 1) {
          clearInterval(messageInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    setTimeout(() => {
      clearInterval(messageInterval);

      const chars = "0123456789ABCDEF";
      let hash = "";
      for (let i = 0; i < 64; i++)
        hash += chars[Math.floor(Math.random() * chars.length)];

      const now = new Date();
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 4);

      const certRFC =
        buyerType === "legal_entity"
          ? personal.companyRFC ?? "XAXX010101000"
          : personal.rfc ?? "XAXX010101000";

      const certName =
        buyerType === "legal_entity"
          ? personal.companyName ?? "Empresa SA de CV"
          : personal.fullName ?? "Persona Física";

      const newSignedData = {
        hash,
        timestamp: now.toISOString(),
        folio: `MIFIEL-${Date.now().toString(36).toUpperCase()}`,
        certificateRFC: certRFC,
        certificateName: certName,
        certificateValidUntil: validUntil.toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };

      setSignedData(newSignedData);
      setState("signed");
      completeContractSignature(formalReservation.id, {
        signatureHash: newSignedData.hash,
        signedAt: newSignedData.timestamp,
        mifielFolio: newSignedData.folio,
      });
    }, 2500);
  };

  const handleComplete = () => {
    completeFormalReservation(formalReservation.id);
    if (formalReservation.preReservationId) {
      navigate(`/mi-pre-apartado/${formalReservation.preReservationId}/apartar-formal/exito`);
    } else {
      navigate(`/apartar/${formalReservation.id}/exito`);
    }
  };

  // ─── signed ───
  if (state === "signed" && signedData) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-success">
            Paso 6 de 6 · Firma completada
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Contrato firmado exitosamente
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu firma digital tiene la misma validez legal que una firma autógrafa, conforme al
            Código de Comercio y la NOM-151-SCFI-2016.
          </p>
        </div>

        <div className="rounded-2xl border border-success/30 bg-success/5 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-success/20 bg-success/10">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Firma digital verificada
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Folio MIFIEL · {signedData.folio}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Hash de la firma (SHA-256)
              </p>
              <p className="text-[11px] font-mono break-all text-foreground bg-card border border-border rounded-lg p-3">
                {signedData.hash}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Fecha y hora
                </p>
                <p className="text-xs text-foreground tabular-nums">
                  {new Date(signedData.timestamp).toLocaleString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Hora del centro (UTC-6)
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Certificado del SAT
                </p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {signedData.certificateName}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  RFC: {signedData.certificateRFC}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Vigente hasta {signedData.certificateValidUntil}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Verificar firma en MIFIEL
              </a>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleComplete}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Continuar
        </button>
      </div>
    );
  }

  // ─── verifying ───
  if (state === "verifying") {
    return (
      <div className="max-w-md mx-auto px-4 md:px-6 py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Verificando con el SAT
        </h2>

        <div className="space-y-3 text-left">
          {VERIFY_MESSAGES.map((msg, idx) => {
            const isActive = idx === verifyStep;
            const isDone = idx < verifyStep;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card"
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    isDone
                      ? "text-success font-medium"
                      : isActive
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {msg}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          No cierres esta ventana. La verificación toma unos segundos.
        </p>
      </div>
    );
  }

  // ─── idle ───
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 6 de 6 · Firma digital
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          Firma con tu e.firma del SAT
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tu firma se procesa a través de MIFIEL, plataforma certificada conforme a la
          NOM-151-SCFI-2016.
        </p>
      </div>

      {/* Mock logo MIFIEL */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            M
          </div>
          <span className="text-sm font-bold text-foreground">MIFIEL</span>
          <span className="text-[11px] text-muted-foreground">· Firma certificada</span>
        </div>
      </div>

      {/* Preview del documento */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              Contrato preliminar de compraventa
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Folio {formalReservation.id} · {development?.legalName ?? property?.projectName ?? "Desarrollo"} ·
              Unidad {property?.unitNumber ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Banner seguridad */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Tu e.firma es información sensible
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nunca compartas tus archivos .cer, .key o la contraseña con nadie. SOZU no almacena tu
            llave privada — la firma sucede de forma segura en tu navegador y solo el resultado se
            envía a MIFIEL.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Archivo del certificado (.cer)*
          </label>
          <FileInput
            file={cerFile}
            accept=".cer"
            onChange={setCerFile}
            placeholder="Selecciona tu archivo .cer"
          />
          <p className="text-[10px] text-muted-foreground">
            Este archivo te lo proporcionó el SAT al tramitar tu e.firma.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Archivo de la llave privada (.key)*
          </label>
          <FileInput
            file={keyFile}
            accept=".key"
            onChange={setKeyFile}
            placeholder="Selecciona tu archivo .key"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Contraseña de la llave privada*
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              className="w-full h-11 px-3 pr-10 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar" : "Mostrar"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password.length > 0 && password.length < 8 && (
            <p className="text-[11px] text-warning">
              La contraseña debe tener al menos 8 caracteres.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(formalReservation.id, 5)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          type="button"
          disabled={!isFormValid}
          onClick={handleSign}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Firmar documento
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Al firmar, aceptas los términos del contrato preliminar. Tu firma queda registrada con
        sello de tiempo NOM-151.
      </p>
    </div>
  );
};

const FileInput = ({
  file,
  accept,
  onChange,
  placeholder,
}: {
  file: File | null;
  accept: string;
  onChange: (f: File | null) => void;
  placeholder: string;
}) => (
  <label className="flex items-center gap-3 h-11 px-3 rounded-lg bg-card border border-border cursor-pointer hover:border-foreground/30 transition-colors">
    <input
      type="file"
      accept={accept}
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      className="hidden"
    />
    {file ? (
      <>
        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        <span className="text-xs text-foreground truncate">{file.name}</span>
      </>
    ) : (
      <>
        <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{placeholder}</span>
      </>
    )}
  </label>
);

export default Step6Signature;
