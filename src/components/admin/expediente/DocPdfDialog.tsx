import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalViewerDetail } from "@/components/ui/modal-viewer-detail";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FIELD_LABEL_CLS } from "@/components/ui/modal-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Modal partido para subir un documento en PDF: formulario a la izquierda y vista
 * previa del archivo a la derecha, con el estándar global `ui/modal-viewer-detail`.
 * Es el mismo patrón que ya usa el Portal Cliente para la identificación oficial,
 * extraído aquí para que agentes, embajadores e inmobiliarias no lo reimplementen.
 *
 * Por qué solo PDF: la identificación dejó de capturarse con cámara por temas
 * legales — se adjunta el documento escaneado completo y legible.
 */

export interface DocPdfOpcion {
  value: string;
  label: string;
  /** Segunda línea de la opción en el selector. */
  hint?: string;
  /** Aviso amarillo que se muestra al elegir esta opción. */
  aviso: string;
}

export interface DocPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Con 2+ opciones se pinta el selector; con una sola se omite. */
  opciones?: DocPdfOpcion[];
  opcion?: string;
  onOpcionChange?: (value: string) => void;
  selectLabel?: string;
  /** Aviso fijo cuando no hay selector (p. ej. la Constancia). */
  aviso?: string;
  /** Nota al pie del formulario: qué pasa con el documento después de guardarlo. */
  nota?: ReactNode;
  /** Contenido extra bajo el adjunto (p. ej. los campos extraídos de la CSF). */
  children?: ReactNode;
  saving?: boolean;
  /** Se habilita Guardar aunque no haya archivo (cuando el flujo ya lo trae). */
  archivoOpcional?: boolean;
  onSave: (file: File | null) => void;
  saveLabel?: string;
}

export function DocPdfDialog({
  open, onOpenChange, title, subtitle,
  opciones, opcion, onOpcionChange, selectLabel = "Tipo de documento",
  aviso, nota, children, saving = false, archivoOpcional = false, onSave, saveLabel = "Guardar",
}: DocPdfDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  // El blob de la vista previa se libera al cambiar de archivo y al cerrar.
  const setArchivo = (f: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = f ? URL.createObjectURL(f) : null;
    setPreview(previewRef.current);
    setFile(f);
  };

  useEffect(() => {
    if (!open) setArchivo(null);
    return () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (f?: File | null) => {
    if (!f) return;
    const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) {
      toast.error("Solo se permiten archivos PDF.");
      return;
    }
    setArchivo(f);
  };

  const avisoTexto = aviso ?? opciones?.find((o) => o.value === opcion)?.aviso;

  return (
    <ModalViewerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      resourceSide="right"
      className="sm:max-w-4xl"
      resourceClassName="md:h-auto md:min-h-[420px]"
      resource={
        preview ? (
          <object data={`${preview}#toolbar=0&navpanes=0`} type="application/pdf" className="h-[45vh] w-full md:h-full">
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Tu navegador no puede mostrar el PDF aquí. El archivo se guardará igual.
              </p>
            </div>
          </object>
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
            <FileText className="h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Vista previa</p>
            <p className="max-w-[220px] text-xs text-muted-foreground/80">
              Adjunta tu PDF para revisarlo aquí antes de guardarlo.
            </p>
          </div>
        )
      }
      footer={
        <>
          <Button variant="cancel" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary-outline"
            onClick={() => onSave(file)}
            disabled={saving || (!file && !archivoOpcional)}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando</> : saveLabel}
          </Button>
        </>
      }
    >
      {opciones && opciones.length > 1 && (
        <div>
          <div className={cn(FIELD_LABEL_CLS, "after:ml-0.5 after:text-destructive after:content-['*']")}>
            {selectLabel}
          </div>
          <SearchableSelect
            value={opcion ?? opciones[0].value}
            onValueChange={(v) => onOpcionChange?.(v)}
            options={opciones.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
            placeholder="Selecciona el documento"
          />
        </div>
      )}

      {avisoTexto && (
        <div className="flex items-start gap-2.5 rounded-md border border-amber-300/70 bg-amber-50 px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-900">{avisoTexto}</p>
        </div>
      )}

      <div>
        <div className={cn(FIELD_LABEL_CLS, "after:ml-0.5 after:text-destructive after:content-['*']")}>
          Archivo PDF
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-muted/40 px-4 py-6 text-center transition-colors hover:bg-muted">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{file ? "Cambiar archivo" : "Adjuntar PDF"}</span>
          <span className="text-xs text-muted-foreground">Solo PDF, escaneado y legible</span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={saving}
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        {file && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 tabular-nums">· {(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </p>
        )}
      </div>

      {children}

      {nota && (
        <div className="rounded-md border border-border bg-muted/40 px-3.5 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{nota}</p>
        </div>
      )}
    </ModalViewerDetail>
  );
}
