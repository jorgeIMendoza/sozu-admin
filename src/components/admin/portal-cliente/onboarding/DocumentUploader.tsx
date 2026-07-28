import { useState } from "react";
import { AlertCircle, Camera, CheckCircle2, FileUp, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./StatusBadge";
import { OnboardingINECapture } from "./OnboardingINECapture";
import { DOC_HELP, DOC_LABELS, usePortal, type DocField, type DocStatus, type DocType, type UploadedDoc } from "@/lib/portal-cliente/onboarding-store";
import { extractPdfText } from "@/utils/pdfExtractText";
import { validateCURPPdf, validateCSFPdf } from "@/utils/pdfDocumentValidators";
import { extractCURPFields, extractCSFFields } from "@/utils/pdfDocumentExtractors";
import type { VerificationResult } from "@/components/admin/DocumentVerification";

interface Props {
  type: DocType;
  allowManagedBySozu?: boolean;
  optional?: boolean;
}

// Documentos que se extraen de un PDF real con regex (solo PDF; sin cámara ni mock).
function isPdfExtractType(type: DocType): boolean {
  return type === "curp" || type === "csf";
}
// Identificaciones que se capturan con la cámara del dispositivo + verificación IA.
function isCameraType(type: DocType): boolean {
  return type === "id_oficial" || type === "id_rl";
}

/**
 * En el INE la IA suele leer el nombre como "APELLIDOS NOMBRES"; lo reordenamos a
 * "NOMBRES APELLIDOS" para mostrarlo como el resto de los documentos.
 */
function ineDisplayName(full: string | null | undefined): string {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  if (parts.length >= 3) {
    const [apPaterno, apMaterno, ...nombres] = parts;
    return [...nombres, apPaterno, apMaterno].join(" ");
  }
  return full;
}

/**
 * Extrae los campos reales de un PDF (CURP RENAPO / CSF SAT) reutilizando las
 * utilerías existentes: valida autenticidad+antigüedad y saca datos por regex.
 */
async function extractFromPdf(
  type: DocType,
  file: File,
  docId: string,
): Promise<{ fields: DocField[]; status: DocStatus; confidence: number }> {
  const text = await extractPdfText(file);
  if (!text || text.length < 20) {
    throw new Error("El PDF no tiene texto legible (¿es un escaneado o imagen?). Sube el PDF oficial descargado.");
  }
  const mk = (arr: { key: string; label: string; value: string }[]): DocField[] =>
    arr.map((x) => ({ ...x, sourceDocId: docId, status: "en_revision" as const }));

  if (type === "curp") {
    const v = validateCURPPdf(text);
    if (!v.ok) throw new Error(v.reason);
    const f = extractCURPFields(text);
    return {
      status: "en_revision",
      confidence: 0.95,
      fields: mk([
        { key: "curp", label: "CURP", value: f.curp ?? "" },
        { key: "nombre", label: "Nombre", value: f.nombre ?? "" },
        { key: "fecha_nacimiento", label: "Fecha de nacimiento", value: f.fechaNacimiento ?? "" },
        { key: "sexo", label: "Sexo", value: f.sexo ?? "" },
      ]),
    };
  }

  // csf
  const v = validateCSFPdf(text);
  if (!v.ok) throw new Error(v.reason);
  const f = extractCSFFields(text);
  const domicilio = [
    f.calle,
    f.numExt ? `#${f.numExt}` : null,
    f.numInt ? `Int ${f.numInt}` : null,
    f.colonia,
    f.codigoPostal ? `CP ${f.codigoPostal}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    status: "en_revision",
    confidence: 0.95,
    fields: mk([
      { key: "rfc", label: "RFC", value: f.rfc ?? "" },
      { key: "razon_social", label: "Nombre / Razón social", value: f.nombre ?? "" },
      { key: "regimen", label: "Régimen", value: f.regimen ?? "" },
      { key: "codigo_postal", label: "Código postal fiscal", value: f.codigoPostal ?? "" },
      { key: "domicilio", label: "Domicilio fiscal", value: domicilio },
    ]),
  };
}

/**
 * Patrón documento-primero: subir/capturar → extracción → card verde
 * "Detectamos estos datos. Revísalos y confírmalos" → Corregir/Confirmar.
 * CURP/CSF: extracción real de PDF. INE/ID del RL: cámara + IA. Resto: mock (Fase C).
 */
export function DocumentUploader({ type, allowManagedBySozu, optional }: Props) {
  const doc = usePortal((s) => s.onboarding.docs.find((d) => d.type === type));
  const addDoc = usePortal((s) => s.addDoc);
  const updateDoc = usePortal((s) => s.updateDoc);
  const removeDoc = usePortal((s) => s.removeDoc);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const isPdfExtract = isPdfExtractType(type);
  const cameraType = isCameraType(type);
  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  async function onFile(file: File) {
    const id = "doc-" + Math.random().toString(36).slice(2, 9);
    setBusy(true);
    setError(null);
    try {
      const res = isPdfExtract
        ? await extractFromPdf(type, file, id)
        : // escritura/predial/acta/poder: PDF, se registra "capturado" sin datos.
          // Extracción real pendiente: predial (parser regex con muestra) y escritura
          // (suele venir escaneada → OCR/IA, Fase D). No inventamos datos.
          { fields: [] as DocField[], status: "en_revision" as DocStatus, confidence: 0.9 };
      const newDoc: UploadedDoc = {
        id,
        type,
        filename: file.name,
        status: res.status,
        confidence: res.confidence,
        fields: res.fields,
        confirmed: false,
        createdAt: new Date().toISOString(),
      };
      if (doc) removeDoc(doc.id);
      addDoc(newDoc);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo leer el documento. Debe ser un PDF con texto (no una imagen/escaneado).",
      );
    } finally {
      setBusy(false);
    }
  }

  // Resultado de la cámara + IA: mapea a campos del wizard (sin persistir en BD).
  function onIneResult(result: VerificationResult | null) {
    const id = "doc-ine-" + Math.random().toString(36).slice(2, 9);
    const mk = (key: string, label: string, value: string | null | undefined): DocField => ({
      key,
      label,
      value: value ?? "",
      status: "en_revision",
      sourceDocId: id,
    });
    const fields: DocField[] = [];
    if (result) {
      fields.push(mk("nombre", "Nombre", ineDisplayName(result.full_name)));
      fields.push(mk("curp", "CURP", result.curp));
      fields.push(mk("fecha_nacimiento", "Fecha de nacimiento", result.fecha_nacimiento));
      fields.push(mk("sexo", "Sexo", result.sexo));
      if (result.vigencia) fields.push(mk("vigencia", "Vigencia", result.vigencia));
    }
    const newDoc: UploadedDoc = {
      id,
      type,
      filename: result ? "INE / Pasaporte (cámara)" : "Identificación (cámara)",
      status: "en_revision",
      confidence: result?.confidence ?? 0.9,
      fields,
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
    if (doc) removeDoc(doc.id);
    addDoc(newDoc);
  }

  function markManaged() {
    const id = "doc-managed-" + type;
    if (doc) removeDoc(doc.id);
    addDoc({
      id,
      type,
      filename: "Gestionado por SOZU",
      status: "en_revision",
      confidence: 1,
      fields: [],
      confirmed: true,
      managedBySozu: true,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{DOC_LABELS[type]}</h4>
            {optional && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                opcional
              </span>
            )}
          </div>
          {DOC_HELP[type] && (
            <p className="mt-0.5 text-xs text-muted-foreground">{DOC_HELP[type]}</p>
          )}
        </div>
        {doc && <StatusBadge status={doc.status} />}
      </div>

      {/* Captura con cámara (INE / ID del RL) */}
      {!doc && cameraType && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-4 py-6 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <Camera className="h-4 w-4" /> Tomar foto con la cámara
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground transition hover:text-foreground">
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
              </>
            ) : (
              <>o subir archivo (PDF, JPG, PNG)</>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              disabled={busy}
            />
          </label>
          <OnboardingINECapture
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            isDesktop={isDesktop}
            onResult={onIneResult}
          />
        </div>
      )}

      {/* Subida de archivo (resto de documentos) */}
      {!doc && !cameraType && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-sm text-muted-foreground transition hover:bg-secondary">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Extrayendo datos…
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" /> Subir PDF
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              disabled={busy}
            />
          </label>
          {allowManagedBySozu && (
            <Button variant="outline" onClick={markManaged} type="button">
              <ShieldCheck className="mr-2 h-4 w-4" />
              SOZU lo gestiona
            </Button>
          )}
        </div>
      )}

      {!doc && error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {isPdfExtract && !doc && !error && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sube el PDF oficial (no una foto ni escaneado). Leemos los datos y solo confirmas.
        </p>
      )}

      {doc && doc.managedBySozu && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          SOZU gestionará la verificación registral ante el RPP de Jalisco usando el folio real
          de tu escritura.
          {/* SWAP POINT: alta de solicitud de verificación registral. */}
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => removeDoc(doc.id)}>
              <Trash2 className="mr-1 h-3 w-3" /> Deshacer
            </Button>
          </div>
        </div>
      )}

      {doc && !doc.managedBySozu && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Detectamos estos datos. Revísalos y confírmalos.
          </div>
          {doc.fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Documento capturado. Confírmalo para continuar.
            </p>
          ) : (
            <div className="space-y-2">
              {doc.fields.map((f) => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  {editing ? (
                    <Input
                      className="col-span-2 h-8 num text-sm"
                      value={f.value}
                      onChange={(e) =>
                        updateDoc(doc.id, {
                          fields: doc.fields.map((x) =>
                            x.key === f.key ? { ...x, value: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  ) : (
                    <div className="col-span-2 num text-sm font-medium text-foreground">
                      {f.value || <span className="text-muted-foreground">—</span>}
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        Tomado de: {doc.filename}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              Confianza: <span className="num">{Math.round(doc.confidence * 100)}%</span>
              {doc.confidence < 0.75 && " · marcado como Por confirmar"}
            </div>
            <div className="flex gap-2">
              {doc.fields.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing((v) => !v)}
                  type="button"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  {editing ? "Listo" : "Corregir"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeDoc(doc.id)}
                type="button"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Quitar
              </Button>
              <Button
                size="sm"
                onClick={() => updateDoc(doc.id, { confirmed: true, status: "validado" })}
                disabled={doc.confirmed}
                type="button"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {doc.confirmed ? "Confirmado" : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
