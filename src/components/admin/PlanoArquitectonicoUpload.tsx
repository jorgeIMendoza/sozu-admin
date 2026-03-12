import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";

interface PlanoArquitectonicoUploadProps {
  currentUrl?: string | null;
  onUrlChange: (url: string | null) => void;
}

export function PlanoArquitectonicoUpload({ currentUrl, onUrlChange }: PlanoArquitectonicoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `plano_${Date.now()}.${fileExt}`;
      const filePath = `planos-arquitectonicos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("modelos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("modelos")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onUrlChange(publicUrl);
      toast({ title: "Imagen subida exitosamente" });
    } catch (error) {
      console.error("Error uploading:", error);
      toast({ title: "Error al subir la imagen", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUrlChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>Plano Arquitectónico</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {previewUrl ? (
        <div className="relative border border-border rounded-lg overflow-hidden">
          <img
            src={previewUrl}
            alt="Plano arquitectónico"
            className="w-full h-48 object-contain bg-muted/20"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-32 border-dashed flex flex-col gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Subir imagen del plano</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
