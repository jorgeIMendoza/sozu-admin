import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload, FileText, ExternalLink, Eye, BookOpen } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";

interface ProjectBrochuresSectionProps {
  projectId: number;
}

export const ProjectBrochuresSection = ({ projectId }: ProjectBrochuresSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brochures, isLoading } = useQuery({
    queryKey: ["project-brochures", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("id_tipo_documento", 30)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate PDF file type
    if (file.type !== "application/pdf") {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PDF",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = "pdf";
      const fileName = `${projectId}_${Date.now()}.${fileExt}`;
      const filePath = `brochures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documentos")
        .getPublicUrl(filePath);

      // Save document record
      const { error: insertError } = await supabase
        .from("documentos")
        .insert({
          id_proyecto: projectId,
          url: publicUrl,
          id_tipo_documento: 30,
          id_estatus_verificacion: 2, // 2 = Validado
        });

      if (insertError) throw insertError;

      toast({
        title: "Brochure cargado",
        description: "El archivo PDF se ha cargado exitosamente.",
      });

      queryClient.invalidateQueries({ queryKey: ["project-brochures", projectId] });
    } catch (error) {
      console.error("Error uploading brochure:", error);
      toast({
        title: "Error",
        description: "Hubo un error al cargar el brochure.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (documentId: number) => {
    try {
      const { error } = await supabase
        .from("documentos")
        .update({ activo: false })
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Brochure eliminado",
        description: "El brochure se ha eliminado exitosamente.",
      });

      queryClient.invalidateQueries({ queryKey: ["project-brochures", projectId] });
    } catch (error) {
      console.error("Error deleting brochure:", error);
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el brochure.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-4">Cargando brochures...</div>;
  }

  return (
    <FormSection
      title="Brochures del Proyecto"
      icon={BookOpen}
      actions={
        <>
          <input
            type="file"
            id="brochure-upload"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById("brochure-upload")?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            {isUploading ? "Cargando..." : "Cargar PDF"}
          </Button>
        </>
      }
    >
      {brochures && brochures.length > 0 ? (
        <div className="space-y-2">
          {brochures.map((brochure) => (
            <div key={brochure.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Brochure #{brochure.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(brochure.fecha_creacion).toLocaleDateString('es-MX')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconTooltip label="Vista previa">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Vista previa" onClick={() => setPreviewUrl(brochure.url)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </IconTooltip>
                <IconTooltip label="Abrir en pestaña">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir en pestaña" onClick={() => window.open(brochure.url, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </IconTooltip>
                <AlertDialog>
                  <IconTooltip label="Eliminar brochure">
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar brochure">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </IconTooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará el brochure. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(brochure.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="text-sm">No hay brochures cargados para este proyecto</p>
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Vista previa del brochure</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </FormSection>
  );
};
