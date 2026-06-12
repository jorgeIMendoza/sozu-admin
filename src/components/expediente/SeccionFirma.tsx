import { useState, useRef } from "react";
import {
  CheckCircle2,
  ChevronDown,
  PenTool,
  Loader2,
  Upload,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Info,
} from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import SeccionLocked from "./SeccionLocked";

type SignState = "idle" | "validating" | "signed";

const SeccionFirma = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const signWithMifiel = useFormalReservationStore((s) => s.signWithMifiel);

  const seccion = formalReservation.expediente!.firma;
  const data = seccion.data;
  const isCompleted = seccion.status === "completed";
  const isLocked = seccion.status === "locked";

  const [expanded, setExpanded] = useState(!isCompleted && !isLocked);
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [signState, setSignState] = useState<SignState>(isCompleted ? "signed" : "idle");
  const [showEfirmaInfo, setShowEfirmaInfo] = useState(false);

  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const contratoData = formalReservation.expediente!.contratoPreliminar.data;
  const canSign = !!contratoData;

  const statusLabel = isCompleted ? "Firmada" : isLocked ? "Bloqueada" : "Pendiente";

  const handleSign = () => {
    if (!cerFile || !keyFile || !password || !canSign) return;
    setSignState("validating");
    setTimeout(() => {
      const cerSerie = (cerFile.name.replace(/\D/g, "").slice(-4) || "0000");
      signWithMifiel(formalReservation.id, {
        signedAt: new Date().toISOString(),
        mifielDocumentId: `MIFIEL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        nom151Hash: `SHA256-${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase()}`,
        certificadoSerie: cerSerie,
        ipAddress: "187.234.56.78",
      });
      setSignState("signed");
    }, 3000);
  };

  if (isLocked) {
    return (
      <SeccionLocked
        number={6}
        title="Firma electrónica"
        description="Firma con tu e.firma vía MIFIEL"
        status={seccion.status}
      />
    );
  }

  return (
    <div className={`rounded-2xl bg-card border-2 overflow-hidden ${isCompleted ? "border-success/30" : "border-border"}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? "bg-success/15" : "bg-primary/10"}`}>
          {isCompleted ? <CheckCircle2 className="w-5 h-5 text-success" /> : <PenTool className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sección 6</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isCompleted ? "text-success" : "text-primary"}`}>{statusLabel}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Firma con e.firma SAT</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {isCompleted ? "Firmada · NOM-151" : "Firma digital con MIFIEL"}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {signState === "signed" && data ? (
            <div className="space-y-3 pt-4">
              <div className="rounded-xl bg-success/[0.06] border border-success/25 p-5 space-y-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <p className="text-base font-bold text-foreground">Documento firmado</p>
                  <p className="text-xs text-muted-foreground">Tu contrato preliminar tiene validez legal NOM-151</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-success/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Firmado el</p>
                      <p className="text-xs text-foreground font-medium mt-0.5">
                        {new Date(data.signedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(data.signedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Documento MIFIEL</p>
                      <p className="text-xs text-foreground font-mono mt-0.5 break-all">{data.mifielDocumentId}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hash NOM-151</p>
                    <p className="text-[10px] text-foreground font-mono mt-0.5 break-all">{data.nom151Hash}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Serie .cer</p>
                      <p className="text-xs text-foreground font-mono mt-0.5">****{data.certificadoSerie}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">IP</p>
                      <p className="text-xs text-foreground font-mono mt-0.5">{data.ipAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => alert("Mock: descarga PDF firmado con sello NOM-151")}
                className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Descargar contrato firmado (PDF)
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 p-4 rounded-xl bg-primary/[0.04] border border-primary/15">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">¿Qué es la firma con e.firma SAT?</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      Es tu firma digital con validez legal en México bajo la NOM-151. Reemplaza la firma manuscrita
                      en documentos oficiales. Usamos MIFIEL, autoridad certificadora autorizada por el SAT.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowEfirmaInfo(!showEfirmaInfo)}
                      className="text-[11px] text-primary font-semibold hover:underline mt-1"
                    >
                      {showEfirmaInfo ? "Ocultar info" : "¿No tengo e.firma?"}
                    </button>
                    {showEfirmaInfo && (
                      <div className="mt-2 p-3 rounded-lg bg-background border border-border space-y-2">
                        <p className="text-xs text-foreground/80">Tu e.firma se compone de:</p>
                        <ul className="space-y-1 text-xs text-foreground/80">
                          <li>• Archivo .cer (certificado)</li>
                          <li>• Archivo .key (llave privada)</li>
                          <li>• Contraseña que definiste al tramitarla</li>
                        </ul>
                        <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                          Gratis en oficina del SAT con cita previa.{" "}
                          <a
                            href="https://citas.sat.gob.mx"
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary font-semibold hover:underline"
                          >
                            Tramitar e.firma →
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!canSign && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Debes aceptar los términos del contrato preliminar (Sección 5) antes de poder firmar.
                  </p>
                </div>
              )}

              {canSign && signState !== "validating" && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Certificado (.cer) *
                    </label>
                    <input
                      ref={cerInputRef}
                      type="file"
                      accept=".cer"
                      onChange={(e) => setCerFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => cerInputRef.current?.click()}
                      className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${
                        cerFile
                          ? "border-success/30 bg-success/[0.04]"
                          : "border-dashed border-border hover:border-primary/50 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {cerFile ? (
                          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        ) : (
                          <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {cerFile ? cerFile.name : "Selecciona tu archivo .cer"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {cerFile ? `${(cerFile.size / 1024).toFixed(0)} KB` : "Archivo binario emitido por el SAT"}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Llave privada (.key) *
                    </label>
                    <input
                      ref={keyInputRef}
                      type="file"
                      accept=".key"
                      onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => keyInputRef.current?.click()}
                      className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${
                        keyFile
                          ? "border-success/30 bg-success/[0.04]"
                          : "border-dashed border-border hover:border-primary/50 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {keyFile ? (
                          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        ) : (
                          <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {keyFile ? keyFile.name : "Selecciona tu archivo .key"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {keyFile ? `${(keyFile.size / 1024).toFixed(0)} KB` : "Archivo de llave privada"}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Contraseña de tu e.firma *
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña que definiste al tramitar tu e.firma"
                      className="w-full h-11 px-3 rounded-lg bg-card border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!cerFile || !keyFile || !password}
                    onClick={handleSign}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar con MIFIEL
                  </button>
                </div>
              )}

              {signState === "validating" && (
                <div className="rounded-xl bg-primary/[0.06] border border-primary/20 p-6 flex flex-col items-center text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-foreground">Validando con MIFIEL…</p>
                  <p className="text-xs text-muted-foreground">Verificando certificado contra SAT y generando hash NOM-151</p>
                </div>
              )}

              {signState === "idle" && canSign && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-success/[0.06] border border-success/20">
                  <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    Tu e.firma se procesa en el cliente (no se almacena). MIFIEL genera el hash NOM-151 con validez legal equivalente a la firma manuscrita.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SeccionFirma;
