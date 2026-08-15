import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MODAL_BODY_CLS, MODAL_FOOTER_CLS, ModalFormHeader } from "@/components/ui/modal-form";
import { DocDropzone } from "@/components/admin/expediente/ExpedienteDocsPanel";
import { extractPdfText } from "@/utils/pdfText";
import { extractCSFFields } from "@/utils/pdfDocumentExtractors";
import { validateCSFPdf } from "@/utils/pdfDocumentValidators";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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

const CAMPOS_VACIOS: CsfCampos = {
  rfc: "", curp: "", nombre: "", regimen: "",
  cp: "", calle: "", numExt: "", numInt: "", colonia: "",
};

/**
 * Mismo formato que exige `guardar_csf_oferta`: si no cuadra, la RPC lo descarta en
 * silencio. El RFC además es el único dato con el que el backend valida la
 * transferencia del apartado (`insertar_pago_stp` compara el RFC del ordenante contra
 * el del expediente), así que sin RFC válido el pago se devuelve.
 */
const RFC_RE = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

export interface CsfUploadCardProps {
  /** Guarda el archivo y los datos confirmados. Devuelve true si quedó registrada. */
  onGuardar: (file: File, campos: CsfCampos) => Promise<boolean>;
  /** Marca la Constancia como obligatoria (requisito para continuar al pago). */
  required?: boolean;
  /** Texto de apoyo bajo la zona de subida. */
  hint?: string;
}

/**
 * Subida de la Constancia de Situación Fiscal en el flujo público de la oferta.
 *
 * El camino feliz lee el PDF del SAT y precarga los datos. Pero muchos clientes suben
 * la Constancia escaneada o "impresa a PDF" desde el celular: ahí no hay capa de texto,
 * `extractPdfText` no devuelve nada y antes eso terminaba en un toast rojo que dejaba al
 * cliente atorado sin poder pagar. Ahora ese caso NO bloquea: se abre el mismo diálogo en
 * modo captura manual, el cliente teclea RFC y nombre (lo mínimo para facturar) y el
 * archivo se guarda igual, con su documento en estatus "pendiente de verificación" para
 * que el asesor lo revise.
 */
export function CsfUploadCard({ onGuardar, required = false, hint }: CsfUploadCardProps) {
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const [pendiente, setPendiente] = useState<{ file: File; manual: boolean } | null>(null);
  const [edit, setEdit] = useState<CsfCampos | null>(null);

  /** Abre el diálogo en captura manual: el PDF no se pudo leer, pero el flujo sigue. */
  const abrirCapturaManual = (file: File, aviso: string) => {
    toast.info(aviso, { duration: 7000 });
    setPendiente({ file, manual: true });
    setEdit(CAMPOS_VACIOS);
  };

  const handleFile = async (file: File) => {
    setLeyendo(true);
    try {
      let text = "";
      try {
        text = await extractPdfText(file);
      } catch {
        abrirCapturaManual(file, "No pudimos leer el PDF. Escribe tus datos y seguimos.");
        return;
      }

      // PDF sin capa de texto (escaneo o foto exportada a PDF).
      if (!text || text.trim().length < 20) {
        abrirCapturaManual(
          file,
          "Tu Constancia parece un escaneo, así que no pudimos leerla. Escribe tus datos y seguimos.",
        );
        return;
      }

      const v = validateCSFPdf(text);
      if (!v.ok) {
        // `in` en vez de v.reason: con la config de TS del proyecto el union
        // discriminado no se estrecha por el booleano.
        const motivo = "reason" in v ? v.reason : "No pudimos validar la Constancia.";
        abrirCapturaManual(file, `${motivo} Escribe tus datos y seguimos.`);
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
      // Aun leyendo bien el PDF, el SAT cambia formatos: si el RFC no salió, se
      // trata como captura manual para que el cliente lo escriba.
      setPendiente({ file, manual: !campos.rfc });
      setEdit(campos);
    } finally {
      setLeyendo(false);
    }
  };

  const rfc = (edit?.rfc ?? "").trim().toUpperCase();
  const nombre = (edit?.nombre ?? "").trim();
  const rfcValido = RFC_RE.test(rfc);
  // Obligatorios: RFC (con formato) y nombre. El resto es opcional — el asesor
  // completa el domicilio fiscal desde el panel si hace falta.
  const puedeGuardar = rfcValido && nombre.length >= 3;

  const confirmar = async () => {
    if (!pendiente || !edit || !puedeGuardar) return;
    setGuardando(true);
    try {
      const ok = await onGuardar(pendiente.file, { ...edit, rfc, nombre });
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

  const CAMPOS: { key: keyof CsfCampos; label: string; requerido?: boolean }[] = [
    { key: "rfc", label: "RFC", requerido: true },
    { key: "nombre", label: "Nombre / Razón social", requerido: true },
    { key: "curp", label: "CURP (opcional)" },
    { key: "regimen", label: "Régimen fiscal" },
    { key: "cp", label: "Código postal" },
    { key: "calle", label: "Calle" },
    { key: "numExt", label: "Núm. exterior" },
    { key: "numInt", label: "Núm. interior" },
    { key: "colonia", label: "Colonia" },
  ];

  const manual = pendiente?.manual === true;

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
            {hint ?? "Sube el PDF que descargas del SAT. Si podemos leerlo, llenamos tus datos solos; si no, los escribes tú y sigues igual. Tu RFC debe ser el del titular de la cuenta desde la que vas a transferir."}
          </p>
        </>
      )}

      {/* Confirmación de los datos (extraídos o capturados a mano) */}
      <Dialog open={!!pendiente} onOpenChange={(o) => { if (!o && !guardando) setPendiente(null); }}>
        <DialogContent className="light max-w-md gap-0 overflow-hidden p-0">
          <ModalFormHeader
            title={manual ? "Escribe tus datos fiscales" : "Confirma tus datos fiscales"}
            subtitle={
              manual
                ? "No pudimos leer el PDF. Con tu RFC y tu nombre seguimos al pago."
                : "Los leímos de tu Constancia. Corrige lo que haga falta."
            }
          />
          <div className={MODAL_BODY_CLS}>
            {manual && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-snug text-amber-800">
                  Tu archivo se guarda igual y tu asesor lo revisa. Solo necesitamos que
                  escribas el RFC tal como aparece en tu Constancia: es el dato con el que
                  validamos tu transferencia.
                </p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <div key={c.key} className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {c.label}
                    {c.requerido && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  <Input
                    value={edit?.[c.key] ?? ""}
                    autoCapitalize={c.key === "rfc" || c.key === "curp" ? "characters" : undefined}
                    onChange={(e) =>
                      setEdit((prev) => (prev ? { ...prev, [c.key]: e.target.value } : prev))
                    }
                  />
                </div>
              ))}
            </div>
            {!!rfc && !rfcValido && (
              <p className="mt-2 text-[11px] text-destructive">
                El RFC no tiene el formato del SAT (12 caracteres para empresa, 13 para persona física).
              </p>
            )}
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setPendiente(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="primary-outline"
              onClick={confirmar}
              disabled={guardando || !puedeGuardar}
            >
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
