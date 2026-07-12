import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Edit, Scale } from "lucide-react";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LegalNotice {
  id: number;
  contenido: string;
  orden: number;
  activo: boolean;
}

interface ProjectLegalNoticesSectionProps {
  projectId: number;
}

// Sortable Card Component
const SortableCard = ({ notice, onEdit, onDelete }: { 
  notice: LegalNotice; 
  onEdit: (e: React.MouseEvent, notice: LegalNotice) => void; 
  onDelete: (e: React.MouseEvent, id: number) => void; 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: notice.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none rounded-lg border border-border bg-card transition-colors hover:border-primary/40" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label="Reordenar">
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/10 px-1.5 text-xs font-semibold tabular-nums text-primary">
            {notice.orden}
          </span>
          <span className="text-sm font-medium">Aviso legal</span>
        </div>
        <div className="flex items-center gap-1">
          <IconTooltip label="Editar aviso">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar aviso" onClick={(e) => onEdit(e, notice)}>
              <Edit className="h-4 w-4" />
            </Button>
          </IconTooltip>
          <IconTooltip label="Eliminar aviso">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar aviso" onClick={(e) => onDelete(e, notice.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </IconTooltip>
        </div>
      </div>
      <p className="whitespace-pre-wrap px-3 py-3 text-sm text-muted-foreground">
        {notice.contenido}
      </p>
    </div>
  );
};

export const ProjectLegalNoticesSection = ({ projectId }: ProjectLegalNoticesSectionProps) => {
  const [editingNotice, setEditingNotice] = useState<LegalNotice | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Create validation schema with memoization
  const validationSchema = useMemo(() => {
    return z.object({
      contenido: z.string().min(1, "El contenido es requerido"),
      orden: z.string()
        .min(1, "El orden es requerido")
        .refine((val) => {
          const num = parseInt(val);
          return num >= 1 && num <= 5;
        }, "El orden debe estar entre 1 y 5")
        .refine((val) => {
          const num = parseInt(val);
          const isDuplicate = legalNotices.some(notice => 
            notice.orden === num && notice.id !== editingNotice?.id
          );
          return !isDuplicate;
        }, "Ya existe un aviso legal con este orden"),
    });
  }, [legalNotices, editingNotice?.id]);

  const form = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      contenido: "",
      orden: "",
    },
  });

  // Update form when editing notice changes
  useEffect(() => {
    if (editingNotice) {
      form.reset({
        contenido: editingNotice.contenido,
        orden: editingNotice.orden.toString(),
      });
    } else {
      form.reset({
        contenido: "",
        orden: "",
      });
    }
  }, [editingNotice, form]);

  // Mutation to create a new legal notice
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof validationSchema>) => {
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
      // Don't close dialog after creation
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
    mutationFn: async (values: z.infer<typeof validationSchema> & { id: number }) => {
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
      setIsFormOpen(false);
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
      setDeleteNoticeId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el aviso legal.",
        variant: "destructive",
      });
      setDeleteNoticeId(null);
    },
  });

  // Mutation to update order via drag
  const updateOrderMutation = useMutation({
    mutationFn: async (updates: { id: number; orden: number }[]) => {
      const promises = updates.map(({ id, orden }) =>
        supabase
          .from("avisos_legales")
          .update({ orden })
          .eq("id", id)
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        throw new Error("Error updating orders");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-notices", projectId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al reordenar los avisos legales.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: z.infer<typeof validationSchema>) => {
    if (editingNotice) {
      updateMutation.mutate({ ...values, id: editingNotice.id });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = legalNotices.findIndex((notice) => notice.id === active.id);
      const newIndex = legalNotices.findIndex((notice) => notice.id === over?.id);

      const newOrder = arrayMove(legalNotices, oldIndex, newIndex);
      
      // Update orders based on new positions
      const updates = newOrder.map((notice, index) => ({
        id: notice.id,
        orden: index + 1,
      }));

      updateOrderMutation.mutate(updates);
    }
  };

  const handleEdit = (notice: LegalNotice) => {
    setEditingNotice(notice);
    setIsFormOpen(true);
  };

  const handleDelete = (noticeId: number) => {
    setDeleteNoticeId(noticeId);
  };

  const confirmDelete = () => {
    if (deleteNoticeId) {
      deleteMutation.mutate(deleteNoticeId);
    }
  };


  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, notice: LegalNotice) => {
    e.preventDefault();
    e.stopPropagation();
    handleEdit(notice);
  };

  const handleDeleteClick = (e: React.MouseEvent, noticeId: number) => {
    e.preventDefault();
    e.stopPropagation();
    handleDelete(noticeId);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit(onSubmit)(e);
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormOpen(false);
    setEditingNotice(null);
    form.reset({
      contenido: "",
      orden: "",
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-4">Cargando avisos legales...</div>;
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
    <FormSection
      title={`Avisos Legales del Proyecto (${legalNotices.length}/5)`}
      icon={Scale}
      actions={
        <Button
          type="button"
          size="sm"
          onClick={handleAddClick}
          disabled={legalNotices.length >= 5}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      }
    >
      {isFormOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <Card>
            <CardHeader>
              <CardTitle>
                {editingNotice ? "Editar Aviso Legal" : "Agregar Aviso Legal"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={handleFormSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
                            onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => e.stopPropagation()}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={handleCancelClick}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!editingNotice && legalNotices.length >= 5}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingNotice ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={deleteNoticeId !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar aviso legal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El aviso legal será eliminado permanentemente del proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDeleteNoticeId(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2">
        {legalNotices.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
            <Scale className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm">No hay avisos legales configurados para este proyecto.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={legalNotices.map(n => n.id)} strategy={verticalListSortingStrategy}>
              {legalNotices.map((notice) => (
                <SortableCard
                  key={notice.id}
                  notice={notice}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </FormSection>
    </div>
  );
};