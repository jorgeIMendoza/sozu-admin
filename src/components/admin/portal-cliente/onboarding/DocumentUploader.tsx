import { useState } from "react";
import { AlertCircle, CheckCircle2, FileCheck, FileUp, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./StatusBadge";
import { DOC_HELP, DOC_LABELS, usePortal, type DocField, type DocStatus, type DocType, type UploadedDoc } from "@/lib/portal-cliente/onboarding-store";
import { extractPdfText } from "@/utils/pdfExtractText";
import { validateCURPPdf, validateCSFPdf } from "@/utils/pdfDocumentValidators";
import { extractCURPFields, extractCSFFields } from "@/utils/pdfDocumentExtractors";

interface Props {
  type: DocType;
  allowManagedBySozu?: boolean;
  optional?: boolean;
}

// Documentos que se extraen de un PDF real con regex (solo PDF; sin cámara ni mock).
function isPdfExtractType(type: DocType): boolean {
  return type === "curp" || type === "csf";
}
// Identificaciones oficiales (INE / pasaporte): se sube el PDF escaneado, con
// frente y reverso en el mismo archivo, y lo revisa una persona. Ya no se
// captura con la cámara ni se valida biométricamente.
function isIdType(type: DocType): boolean {
  return type === "id_oficial" || type === "id_rl";
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
 * Patrón documento-primero: subir → extracción → card verde
 * "Detectamos estos datos. Revísalos y confírmalos" → Corregir/Confirmar.
 * CURP/CSF: extracción real de PDF. INE/ID del RL y resto: PDF sin extracción,
 * se confirman y quedan para revisión manual.
 */
export function DocumentUploader({ type, allowManagedBySozu, optional }: Props) {
  const doc = usePortal((s) => s.onboarding.docs.find((d) => d.type === type));
  const addDoc = usePortal((s) => s.addDoc);
  const updateDoc = usePortal((s) => s.updateDoc);
  const removeDoc = usePortal((s) => s.removeDoc);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdfExtract = isPdfExtractType(type);
  const idType = isIdType(type);

  async function onFile(file: File) {
    const id = "doc-" + Math.random().toString(36).slice(2, 9);
    setBusy(true);
    setError(null);
    try {
      if (idType) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          throw new Error("La identificación debe subirse en PDF. Escanea el documento (frente y reverso) y sube el archivo.");
        }
      }
      const res = isPdfExtract
        ? await extractFromPdf(type, file, id)
        : // identificación/escritura/predial/acta/poder: PDF, se registra "capturado" sin datos.
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

      {/* Subida de archivo (todos los documentos, identificación incluida) */}
      {!doc && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-sm text-muted-foreground transition hover:bg-secondary">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {isPdfExtract ? "Extrayendo datos…" : "Procesando…"}
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

      {idType && !doc && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-950/30">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
            Sube un solo archivo PDF: el frente y el reverso de tu INE, o la página de datos de tu
            pasaporte. El documento debe estar escaneado, completo y legible. Si no cumple estas
            condiciones, la revisión se rechazará y deberás cargarlo nuevamente.
          </p>
        </div>
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

      {/* Documento SIN extracción (INE, escritura, predial, acta, poder): solo cargado, revisión manual */}
      {doc && !doc.managedBySozu && doc.fields.length === 0 && (
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {doc.confirmed ? <CheckCircle2 className="h-4 w-4" /> : <FileCheck className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {doc.confirmed ? "Documento confirmado" : "Documento cargado"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {doc.filename} ·{" "}
                {doc.confirmed
                  ? "quedará para revisión del área de SOZU"
                  : "revísalo y confírmalo para enviarlo a revisión"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => removeDoc(doc.id)} type="button">
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
      )}

      {/* Documento CON datos extraídos (CURP / CSF): revisar y confirmar */}
      {doc && !doc.managedBySozu && doc.fields.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Detectamos estos datos. Revísalos y confírmalos.
          </div>
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              Confianza: <span className="num">{Math.round(doc.confidence * 100)}%</span>
              {doc.confidence < 0.75 && " · marcado como Por confirmar"}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} type="button">
                <Pencil className="mr-1 h-3 w-3" />
                {editing ? "Listo" : "Corregir"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeDoc(doc.id)} type="button">
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
