import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Upload, X, ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { optimizedImage } from "@/lib/image-transform";

interface ImageUploadFieldProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  /** "card" = preview/dropzone cuadrado a todo el ancho, imagen completa visible. */
  variant?: "default" | "card";
}

export function ImageUploadField({ label, value, onChange, accept = "image/*", variant = "default" }: ImageUploadFieldProps) {
  const isCard = variant === "card";
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { toast } = useToast();

  const clearImage = () => {
    setImageError(false);
    onChange("");
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `projects/images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      onChange(data.publicUrl);
      setImageError(false);
      toast({ title: "Archivo subido exitosamente" });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: "Error al subir archivo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = accept;

    tempInput.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) uploadFile(target.files[0]);
    };

    tempInput.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {value ? (
        <div className="space-y-2">
          <div className={isCard ? "relative w-full max-w-36" : "relative inline-block"}>
            {imageError ? (
              <div className={`flex flex-col items-center justify-center border rounded-lg bg-muted ${isCard ? "aspect-square w-full p-4" : "max-w-32 max-h-32 min-w-24 min-h-24 p-2"}`}>
                <ImageOff className="h-8 w-8 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground text-center">Vista previa no disponible</span>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver archivo
                </a>
              </div>
            ) : isCard ? (
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-2">
                <img
                  src={optimizedImage(value, { width: 400 })}
                  alt={label}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
              </div>
            ) : (
              <img
                src={optimizedImage(value, { width: 320 })}
                alt={label}
                loading="lazy"
                className="max-w-32 max-h-32 object-contain border rounded-lg"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            )}
            <IconTooltip label="Quitar imagen">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 z-10"
                aria-label="Quitar imagen"
                onClick={clearImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </IconTooltip>
          </div>
          <p className="text-xs text-muted-foreground">Imagen actual cargada</p>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/20"} ${isCard ? "aspect-square w-full max-w-36 p-4" : "p-6"}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUpload();
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {uploading ? "Subiendo..." : `Haz clic o arrastra para subir ${label.toLowerCase()}`}
          </p>
        </div>
      )}
      
      {uploading && (
        <p className="text-xs text-muted-foreground">Subiendo...</p>
      )}
    </div>
  );
}