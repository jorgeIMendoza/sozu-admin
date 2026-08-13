import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileText, Loader2, Plus, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/useActivityLogger";

/**
 * Documentos que se pueden cargar desde el detalle de una cuenta de cobranza
 * (productos y cuentas canceladas): nota de crédito, evidencia de la devolución,
 * comprobante de la transferencia al cliente, más las facturas.
 *
 * Se filtran por NOMBRE y no por id porque el catálogo `tipos_documento` no
 * garantiza los mismos ids entre Preview y Producción. Si alguno todavía no
 * existe en la BD, simplemente no aparece en el selector y se avisa en el modal.
 */
export const TIPOS_DOCUMENTO_CUENTA = [
  "Nota de crédito",
  "Evidencia de devolución",
  "Comprobante de transferencia al cliente",
  "Factura XML",
  "Factura PDF",
] as const;

interface FilaDocumento {
  id: string;
  tipoId: string;
  file: File | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaId: number;
  propiedadId?: number | null;
  productoId?: number | null;
  onUploaded?: () => void;
}

const nuevaFila = (): FilaDocumento => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  tipoId: "",
  file: null,
});

export function SubirDocumentosCuentaDialog({
  open,
  onOpenChange,
  cuentaId,
  propiedadId,
  productoId,
  onUploaded,
}: Props) {
  const { toast } = useToast();
  const { registrarSubidaDocumento } = useActivityLogger();
  const [filas, setFilas] = useState<FilaDocumento[]>([nuevaFila()]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: tiposDocumento, isLoading: tiposLoading } = useQuery({
    queryKey: ["tipos_documento_cuenta_cobranza"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_documento")
        .select("id, nombre")
        .in("nombre", TIPOS_DOCUMENTO_CUENTA as unknown as string[])
        .eq("activo", true);

      if (error) throw error;
      // Respetar el orden declarado en TIPOS_DOCUMENTO_CUENTA
      return (data || []).sort(
        (a, b) =>
          TIPOS_DOCUMENTO_CUENTA.indexOf(a.nombre as typeof TIPOS_DOCUMENTO_CUENTA[number]) -
          TIPOS_DOCUMENTO_CUENTA.indexOf(b.nombre as typeof TIPOS_DOCUMENTO_CUENTA[number]),
      );
    },
  });

  const tiposFaltantes = TIPOS_DOCUMENTO_CUENTA.filter(
    (nombre) => !(tiposDocumento || []).some((t) => t.nombre === nombre),
  );

  const filasListas = filas.filter((f) => f.tipoId && f.file);

  const actualizarFila = (id: string, cambios: Partial<FilaDocumento>) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  };

  const handleClose = (nextOpen: boolean) => {
    if (isUploading) return;
    if (!nextOpen) setFilas([nuevaFila()]);
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (filasListas.length === 0) return;

    setIsUploading(true);
    let subidos = 0;

    try {
      for (const fila of filasListas) {
        const file = fila.file!;
        const tipoId = Number(fila.tipoId);
        const tipoNombre = (tiposDocumento || []).find((t) => t.id === tipoId)?.nombre || "Documento";
        const ext = file.name.split(".").pop();
        const filePath = `documentos_cuenta/${cuentaId}_${tipoId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("documentos").getPublicUrl(filePath);

        const { error: dbError } = await (supabase as any).from("documentos").insert({
          id_cuenta_cobranza: cuentaId,
          id_propiedad: propiedadId ?? null,
          id_producto: productoId ?? null,
          id_tipo_documento: tipoId,
          url: publicUrl,
          id_estatus_verificacion: 1, // Pendiente
          activo: true,
        });

        if (dbError) throw dbError;

        await registrarSubidaDocumento({
          tipo: "documento_cuenta_cobranza",
          id_cuenta_cobranza: cuentaId,
          id_tipo_documento: tipoId,
          tipo_documento: tipoNombre,
          nombre_archivo: file.name,
          url: publicUrl,
        });

        subidos++;
      }

      toast({
        title: subidos === 1 ? "Documento subido" : "Documentos subidos",
        description: `Se ${subidos === 1 ? "guardó 1 documento" : `guardaron ${subidos} documentos`} en la cuenta de cobranza.`,
      });

      setFilas([nuevaFila()]);
      onUploaded?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error subiendo documentos de la cuenta:", error);

      await registrarSubidaDocumento(
        { tipo: "documento_cuenta_cobranza", id_cuenta_cobranza: cuentaId },
        "error",
        error instanceof Error ? error.message : "Error desconocido",
      );

      toast({
        title: "Error",
        description:
          subidos > 0
            ? `Se subieron ${subidos} documento(s) antes del error. Revisa e intenta de nuevo con los restantes.`
            : "No se pudieron subir los documentos.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agregar documentos
          </DialogTitle>
          <DialogDescription>
            Carga la nota de crédito, la evidencia de la devolución, el comprobante de la
            transferencia al cliente y las facturas de esta cuenta de cobranza.
          </DialogDescription>
        </DialogHeader>

        {tiposFaltantes.length > 0 && !tiposLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Tipos de documento pendientes de dar de alta en el catálogo:{" "}
              {tiposFaltantes.join(", ")}.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {filas.map((fila, idx) => (
            <div key={fila.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Tipo de documento</Label>
                <Select
                  value={fila.tipoId}
                  onValueChange={(value) => actualizarFila(fila.id, { tipoId: value })}
                  disabled={isUploading || tiposLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tiposLoading ? "Cargando..." : "Selecciona el tipo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(tiposDocumento || []).map((tipo) => (
                      <SelectItem key={tipo.id} value={String(tipo.id)}>
                        {tipo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Archivo</Label>
                <Input
                  type="file"
                  accept=".pdf,.xml,.jpg,.jpeg,.png"
                  disabled={isUploading}
                  onChange={(e) => actualizarFila(fila.id, { file: e.target.files?.[0] ?? null })}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                disabled={isUploading || (filas.length === 1 && idx === 0)}
                onClick={() => setFilas((prev) => prev.filter((f) => f.id !== fila.id))}
                title="Quitar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilas((prev) => [...prev, nuevaFila()])}
            disabled={isUploading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar otro documento
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || filasListas.length === 0}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir {filasListas.length > 0 ? `(${filasListas.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SubirDocumentosCuentaDialog;
