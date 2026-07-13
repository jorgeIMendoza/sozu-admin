import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload, FileText, ExternalLink, Eye, ClipboardList } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";

interface ProjectFichaTecnicaSectionProps {
  projectId: number;
}

export const ProjectFichaTecnicaSection = ({ projectId }: ProjectFichaTecnicaSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fichas, isLoading } = useQuery({
    queryKey: ["project-fichas-tecnicas", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("id_tipo_documento", 49)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Error", description: "Solo se permiten archivos PDF", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${projectId}_ficha_${Date.now()}.pdf`;
      const filePath = `fichas-tecnicas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documentos")
        .getPublicUrl(filePath);

      const { error: insertError } = await (supabase as any)
        .from("documentos")
        .insert({
          id_proyecto: projectId,
          url: publicUrl,
          id_tipo_documento: 49,
          id_estatus_verificacion: 2,
        });

      if (insertError) throw insertError;

      toast({ title: "Ficha técnica cargada", description: "El archivo se ha cargado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["project-fichas-tecnicas", projectId] });
    } catch (error) {
      console.error("Error uploading ficha técnica:", error);
      toast({ title: "Error", description: "Hubo un error al cargar la ficha técnica.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (documentId: number) => {
    try {
      const { error } = await (supabase as any)
        .from("documentos")
        .update({ activo: false })
        .eq("id", documentId);

      if (error) throw error;
      toast({ title: "Ficha eliminada", description: "La ficha técnica se ha eliminado." });
      queryClient.invalidateQueries({ queryKey: ["project-fichas-tecnicas", projectId] });
    } catch (error) {
      toast({ title: "Error", description: "Hubo un error al eliminar.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-4">Cargando fichas técnicas...</div>;

  return (
    <FormSection
      title="Fichas Técnicas del Proyecto"
      icon={ClipboardList}
      actions={
        <>
          <input type="file" id="ficha-upload" accept="application/pdf" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
          <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => document.getElementById("ficha-upload")?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {isUploading ? "Cargando..." : "Cargar PDF"}
          </Button>
        </>
      }
    >
      {fichas && fichas.length > 0 ? (
        <div className="space-y-2">
          {fichas.map((ficha: any) => (
            <div key={ficha.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Ficha Técnica #{ficha.id}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ficha.fecha_creacion).toLocaleDateString('es-MX')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconTooltip label="Vista previa">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Vista previa" onClick={() => setPreviewUrl(ficha.url)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </IconTooltip>
                <IconTooltip label="Abrir en pestaña">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir en pestaña" onClick={() => window.open(ficha.url, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </IconTooltip>
                <AlertDialog>
                  <IconTooltip label="Eliminar ficha">
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar ficha">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </IconTooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción eliminará la ficha técnica.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(ficha.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="text-sm">No hay fichas técnicas cargadas para este proyecto</p>
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader><DialogTitle>Vista previa de la ficha técnica</DialogTitle></DialogHeader>
          <div className="flex-1 w-full h-full">
            {previewUrl && <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />}
          </div>
        </DialogContent>
      </Dialog>
    </FormSection>
  );
};
