import { useState } from "react";
import { CheckCircle2, FileUp, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./StatusBadge";
import { DOC_HELP, DOC_LABELS, usePortal, type DocType, type UploadedDoc } from "@/lib/portal-cliente/onboarding-store";
import { simulateOcr } from "@/lib/portal-cliente/onboarding-mock-ocr";

interface Props {
  type: DocType;
  allowManagedBySozu?: boolean;
  optional?: boolean;
}

/**
 * Patrón documento-primero: subir → mock OCR → card verde
 * "Detectamos estos datos. Revísalos y confírmalos" → Corregir/Confirmar.
 */
export function DocumentUploader({ type, allowManagedBySozu, optional }: Props) {
  const doc = usePortal((s) => s.onboarding.docs.find((d) => d.type === type));
  const addDoc = usePortal((s) => s.addDoc);
  const updateDoc = usePortal((s) => s.updateDoc);
  const removeDoc = usePortal((s) => s.removeDoc);
  const state = usePortal();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function onFile(file: File) {
    const id = "doc-" + Math.random().toString(36).slice(2, 9);
    setBusy(true);
    // SWAP POINT: OCR real (por ejemplo Google Doc AI / Textract) en lugar de simulateOcr.
    const res = await simulateOcr(type, file.name, state, id);
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
    setBusy(false);
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

      {!doc && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-sm text-muted-foreground transition hover:bg-secondary">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Extrayendo datos…
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" /> Subir archivo (PDF, JPG, PNG)
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
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
                    {f.value}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing((v) => !v)}
                type="button"
              >
                <Pencil className="mr-1 h-3 w-3" />
                {editing ? "Listo" : "Corregir"}
              </Button>
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
