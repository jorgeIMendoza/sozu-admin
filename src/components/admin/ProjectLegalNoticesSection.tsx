import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Edit } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const legalNoticeSchema = z.object({
  contenido: z.string().min(1, "El contenido es requerido"),
  orden: z.string()
    .min(1, "El orden es requerido")
    .refine((val) => {
      const num = parseInt(val);
      return num >= 1 && num <= 5;
    }, "El orden debe estar entre 1 y 5"),
});

interface LegalNotice {
  id: number;
  contenido: string;
  orden: number;
  activo: boolean;
}

interface ProjectLegalNoticesSectionProps {
  projectId: number;
}

export const ProjectLegalNoticesSection = ({ projectId }: ProjectLegalNoticesSectionProps) => {
  const [editingNotice, setEditingNotice] = useState<LegalNotice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof legalNoticeSchema>>({
    resolver: zodResolver(legalNoticeSchema),
    defaultValues: {
      contenido: "",
      orden: "",
    },
  });

  // Query to fetch legal notices for the project
  const { data: legalNotices = [], isLoading } = useQuery({
    queryKey: ["legal-notices", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos_legales")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("orden");
      
      if (error) throw error;
      return data;
    },
  });

  // Mutation to create a new legal notice
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof legalNoticeSchema>) => {
      if (legalNotices.length >= 5) {
        throw new Error("No se pueden agregar más de 5 avisos legales por proyecto");
      }
      
      const { data, error } = await supabase
        .from("avisos_legales")
        .insert({
          id_proyecto: projectId,
          contenido: values.contenido,
          orden: parseInt(values.orden),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-notices", projectId] });
      toast({
        title: "Aviso legal creado",
        description: "El aviso legal se ha creado exitosamente.",
      });
      form.reset({
        contenido: "",
        orden: "",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al crear el aviso legal.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update a legal notice
  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof legalNoticeSchema> & { id: number }) => {
      const { data, error } = await supabase
        .from("avisos_legales")
        .update({
          contenido: values.contenido,
          orden: parseInt(values.orden),
        })
        .eq("id", values.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-notices", projectId] });
      toast({
        title: "Aviso legal actualizado",
        description: "El aviso legal se ha actualizado exitosamente.",
      });
      form.reset({
        contenido: "",
        orden: "",
      });
      setIsDialogOpen(false);
      setEditingNotice(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al actualizar el aviso legal.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a legal notice
  const deleteMutation = useMutation({
    mutationFn: async (noticeId: number) => {
      const { error } = await supabase
        .from("avisos_legales")
        .update({ activo: false })
        .eq("id", noticeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-notices", projectId] });
      toast({
        title: "Aviso legal eliminado",
        description: "El aviso legal se ha eliminado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el aviso legal.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: z.infer<typeof legalNoticeSchema>) => {
    if (editingNotice) {
      updateMutation.mutate({ ...values, id: editingNotice.id });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (notice: LegalNotice) => {
    setEditingNotice(notice);
    form.reset({
      contenido: notice.contenido,
      orden: notice.orden.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (noticeId: number) => {
    if (confirm("¿Está seguro de que desea eliminar este aviso legal?")) {
      deleteMutation.mutate(noticeId);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingNotice(null);
      form.reset({
        contenido: "",
        orden: "",
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-4">Cargando avisos legales...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Avisos Legales del Proyecto</h3>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              disabled={legalNotices.length >= 5}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Aviso Legal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingNotice ? "Editar Aviso Legal" : "Agregar Aviso Legal"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="contenido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenido</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ingrese el contenido del aviso legal" 
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orden"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orden</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Orden de aparición"
                          min={1}
                          max={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!editingNotice && legalNotices.length >= 5}
                  >
                    {editingNotice ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {legalNotices.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No hay avisos legales configurados para este proyecto.
            </CardContent>
          </Card>
        ) : (
          legalNotices.map((notice) => (
            <Card key={notice.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Orden {notice.orden}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(notice)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(notice.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {notice.contenido}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};