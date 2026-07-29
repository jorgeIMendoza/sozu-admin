import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MODAL_BODY_CLS, MODAL_FOOTER_CLS, ModalFormHeader } from "@/components/ui/modal-form";
import { DocDropzone } from "@/components/admin/expediente/ExpedienteDocsPanel";
import { extractPdfText } from "@/utils/pdfText";
import { extractCSFFields } from "@/utils/pdfDocumentExtractors";
import { validateCSFPdf } from "@/utils/pdfDocumentValidators";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Campos de la Constancia que el cliente confirma antes de guardar. */
export type CsfCampos = {
  rfc: string;
  curp: string;
  nombre: string;
  regimen: string;
  cp: string;
  calle: string;
  numExt: string;
  numInt: string;
  colonia: string;
};

export interface CsfUploadCardProps {
  /** Guarda el archivo y los datos confirmados. Devuelve true si quedó registrada. */
  onGuardar: (file: File, campos: CsfCampos) => Promise<boolean>;
  /** Marca la Constancia como obligatoria (requisito para continuar al pago). */
  required?: boolean;
  /** Texto de apoyo bajo la zona de subida. */
  hint?: string;
}

/**
 * Subida opcional de la Constancia de Situación Fiscal en el flujo público de la
 * oferta digital. Reutiliza la misma mecánica del expediente de los portales:
 * se lee el PDF, se valida que sea una Constancia del SAT vigente, se extraen los
 * datos y el cliente los confirma antes de guardar.
 */
export function CsfUploadCard({ onGuardar, required = false, hint }: CsfUploadCardProps) {
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const [pendiente, setPendiente] = useState<{ file: File; campos: CsfCampos } | null>(null);
  const [edit, setEdit] = useState<CsfCampos | null>(null);

  const handleFile = async (file: File) => {
    setLeyendo(true);
    try {
      let text = "";
      try {
        text = await extractPdfText(file);
      } catch {
        toast.error("No se pudo leer el PDF. Intenta de nuevo.");
        return;
      }
      if (!text || text.trim().length < 20) {
        toast.error("Debe ser el PDF original de la Constancia (no una foto ni un escaneo).", {
          duration: 7000,
        });
        return;
      }
      const v = validateCSFPdf(text);
      if (!v.ok) {
        // `in` en vez de v.reason: con la config de TS del proyecto el union
        // discriminado no se estrecha por el booleano.
        const motivo = "reason" in v ? v.reason : "La Constancia no es válida.";
        toast.error(motivo, { duration: 8000 });
        return;
      }
      const f = extractCSFFields(text);
      const campos: CsfCampos = {
        rfc: f.rfc ?? "",
        curp: f.curp ?? "",
        nombre: f.nombre ?? "",
        regimen: f.regimen ?? "",
        cp: f.codigoPostal ?? "",
        calle: f.calle ?? "",
        numExt: f.numExt ?? "",
        numInt: f.numInt ?? "",
        colonia: f.colonia ?? "",
      };
      setPendiente({ file, campos });
      setEdit(campos);
    } finally {
      setLeyendo(false);
    }
  };

  const confirmar = async () => {
    if (!pendiente || !edit) return;
    setGuardando(true);
    try {
      const ok = await onGuardar(pendiente.file, edit);
      if (ok) {
        setListo(true);
        setPendiente(null);
        toast.success("Constancia registrada.");
      } else {
        toast.error("No se pudo registrar la Constancia. Puedes continuar y subirla después.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const CAMPOS: { key: keyof CsfCampos; label: string }[] = [
    { key: "rfc", label: "RFC" },
    { key: "curp", label: "CURP" },
    { key: "nombre", label: "Nombre / Razón social" },
    { key: "regimen", label: "Régimen fiscal" },
    { key: "cp", label: "Código postal" },
    { key: "calle", label: "Calle" },
    { key: "numExt", label: "Núm. exterior" },
    { key: "numInt", label: "Núm. interior" },
    { key: "colonia", label: "Colonia" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">
          Constancia de Situación Fiscal
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        <span className="text-[11px] text-muted-foreground">{required ? "Requerida" : "Opcional"}</span>
      </div>

      {listo ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/[0.06] px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <p className="text-[12px] text-foreground">
            Constancia registrada. Ya puedes continuar con tu pago.
          </p>
        </div>
      ) : (
        <>
          <DocDropzone accept="application/pdf" uploading={leyendo} onFile={handleFile} />
          <p className="text-[11px] leading-snug text-muted-foreground">
            {hint ?? "Sube el PDF original que descargas del SAT. Leemos tus datos fiscales para que no los captures a mano."}
          </p>
        </>
      )}

      {/* Confirmación de los datos extraídos */}
      <Dialog open={!!pendiente} onOpenChange={(o) => { if (!o && !guardando) setPendiente(null); }}>
        <DialogContent className="light max-w-md gap-0 overflow-hidden p-0">
          <ModalFormHeader
            title="Confirma tus datos fiscales"
            subtitle="Los leímos de tu Constancia. Corrige lo que haga falta."
          />
          <div className={MODAL_BODY_CLS}>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <div key={c.key} className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{c.label}</label>
                  <Input
                    value={edit?.[c.key] ?? ""}
                    onChange={(e) =>
                      setEdit((prev) => (prev ? { ...prev, [c.key]: e.target.value } : prev))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setPendiente(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary-outline" onClick={confirmar} disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar constancia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CsfUploadCard;
