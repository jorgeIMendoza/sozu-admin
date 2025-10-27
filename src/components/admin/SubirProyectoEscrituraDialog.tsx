import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2 } from "lucide-react";

interface SubirProyectoEscrituraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaCobranzaId: number;
  onSuccess?: () => void;
}

export default function SubirProyectoEscrituraDialog({
  open,
  onOpenChange,
  cuentaCobranzaId,
  onSuccess,
}: SubirProyectoEscrituraDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validar extensión
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PDF",
        variant: "destructive",
      });
      setFile(null);
      e.target.value = '';
      return;
    }

    // Validar tamaño (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "Error",
        description: "El archivo debe ser menor a 10MB",
        variant: "destructive",
      });
      setFile(null);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Debe seleccionar un archivo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // 1. Subir archivo a Storage
      const timestamp = new Date().getTime();
      const fileName = `proyecto-escritura-${timestamp}.pdf`;
      const storagePath = `documentos-legales/proyectos-escritura/cuenta-${cuentaCobranzaId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Error al subir el archivo: ${uploadError.message}`);
      }

      // 2. Obtener URL pública del archivo
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(storagePath);

      if (!urlData?.publicUrl) {
        throw new Error('No se pudo obtener la URL del documento');
      }

      // 3. Crear registro en tabla documentos
      const { error: insertError } = await supabase
        .from('documentos')
        .insert({
          id_cuenta_cobranza: cuentaCobranzaId,
          id_tipo_documento: 29, // Proyecto de escritura
          url: urlData.publicUrl,
          es_verificado: false,
          activo: true,
        });

      if (insertError) {
        console.error('Error inserting document:', insertError);
        
        // Si falla el insert, intentar eliminar el archivo subido
        await supabase.storage.from('documentos').remove([storagePath]);
        
        throw new Error(`Error al guardar el registro: ${insertError.message}`);
      }

      toast({
        title: "✅ Proyecto de escritura subido",
        description: "El documento se ha guardado correctamente",
      });

      setFile(null);
      onOpenChange(false);
      onSuccess?.();

    } catch (error: any) {
      console.error('Error completo:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el documento",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Subir Proyecto de Escritura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file">Documento PDF</Label>
            <div className="flex flex-col gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{file.name}</span>
                  <span>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Solo archivos PDF</p>
            <p>• Tamaño máximo: 10 MB</p>
            <p>• Cuenta de cobranza: {cuentaCobranzaId}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
