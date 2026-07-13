import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Building2, ChevronDown, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUploadField } from "./ImageUploadField";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { optimizedImage } from "@/lib/image-transform";

const formSchema = z.object({
  id_edificio: z.string().min(1, "El edificio es requerido"),
  id_tipo_espacio_reservable: z.string().min(1, "El tipo de espacio es requerido"),
  descripcion: z.string().optional(),
  costo_por_hr: z.string().default("0"),
  permitir_reservas_recurrentes: z.boolean().default(false),
  duracion_reserva: z.string().optional(),
  url_imagen: z.string().optional(),
});

interface ProjectReservableSpacesSectionProps {
  projectId: number;
}

export const ProjectReservableSpacesSection = ({ projectId }: ProjectReservableSpacesSectionProps) => {
  const [open, setOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id_edificio: "",
      id_tipo_espacio_reservable: "",
      descripcion: "",
      costo_por_hr: "0",
      permitir_reservas_recurrentes: false,
      duracion_reserva: "",
      url_imagen: "",
    },
  });

  // Fetch buildings for this project
  const { data: edificios } = useQuery({
    queryKey: ["edificios-proyecto", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edificios")
        .select("id, nombre")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch space types
  const { data: tiposEspacio } = useQuery({
    queryKey: ["tipos-espacio-reservables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_espacio_reservables" as any)
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch reservable spaces for this project's buildings
  const { data: espaciosReservables, isLoading } = useQuery({
    queryKey: ["espacios-reservables-proyecto", projectId],
    queryFn: async () => {
      if (!edificios || edificios.length === 0) return [];
      
      const edificioIds = edificios.map(e => e.id);
      const { data, error } = await supabase
        .from("espacios_reservables_edificio" as any)
        .select(`
          *,
          edificios:id_edificio(id, nombre),
          tipos_espacio_reservables(id, nombre)
        `)
        .in("id_edificio", edificioIds)
        .eq("activo", true)
        .order("id_edificio");
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!edificios && edificios.length > 0,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase
        .from("espacios_reservables_edificio" as any)
        .insert({
          id_edificio: parseInt(values.id_edificio),
          id_tipo_espacio_reservable: parseInt(values.id_tipo_espacio_reservable),
          descripcion: values.descripcion || null,
          costo_por_hr: parseFloat(values.costo_por_hr),
          permitir_reservas_recurrentes: values.permitir_reservas_recurrentes,
          duracion_reserva: values.duracion_reserva || null,
          url_imagen: values.url_imagen || null,
          activo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["espacios-reservables-proyecto", projectId] });
      toast({
        title: "Espacio creado",
        description: "El espacio reservable ha sido creado exitosamente.",
      });
      // Use setTimeout to prevent event propagation to parent dialog
      setTimeout(() => {
        setOpen(false);
        form.reset();
      }, 0);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el espacio reservable",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: z.infer<typeof formSchema> }) => {
      const { data, error } = await supabase
        .from("espacios_reservables_edificio" as any)
        .update({
          id_edificio: parseInt(values.id_edificio),
          id_tipo_espacio_reservable: parseInt(values.id_tipo_espacio_reservable),
          descripcion: values.descripcion || null,
          costo_por_hr: parseFloat(values.costo_por_hr),
          permitir_reservas_recurrentes: values.permitir_reservas_recurrentes,
          duracion_reserva: values.duracion_reserva || null,
          url_imagen: values.url_imagen || null,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["espacios-reservables-proyecto", projectId] });
      toast({
        title: "Espacio actualizado",
        description: "El espacio reservable ha sido actualizado exitosamente.",
      });
      // Use setTimeout to prevent event propagation to parent dialog
      setTimeout(() => {
        setOpen(false);
        setEditingSpace(null);
        form.reset();
      }, 0);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el espacio reservable",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("espacios_reservables_edificio" as any)
        .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["espacios-reservables-proyecto", projectId] });
      toast({
        title: "Espacio eliminado",
        description: "El espacio reservable ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el espacio reservable",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    form.handleSubmit((values) => {
      if (editingSpace) {
        updateMutation.mutate({ id: editingSpace.id, values });
      } else {
        createMutation.mutate(values);
      }
    })(e);
  };

  const handleEdit = (space: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setEditingSpace(space);
    
    // Use setTimeout to ensure state is set before opening dialog
    setTimeout(() => {
      form.reset({
        id_edificio: space.id_edificio?.toString() || "",
        id_tipo_espacio_reservable: space.id_tipo_espacio_reservable?.toString() || "",
        descripcion: space.descripcion || "",
        costo_por_hr: space.costo_por_hr?.toString() || "0",
        permitir_reservas_recurrentes: space.permitir_reservas_recurrentes || false,
        duracion_reserva: space.duracion_reserva || "",
        url_imagen: space.url_imagen || "",
      });
      setOpen(true);
    }, 0);
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingSpace(null);
      form.reset();
    }
  };

  // Group spaces by building
  const spacesGroupedByBuilding = espaciosReservables?.reduce((acc: any, space: any) => {
    const buildingName = space.edificios?.nombre || "Sin edificio";
    if (!acc[buildingName]) {
      acc[buildingName] = [];
    }
    acc[buildingName].push(space);
    return acc;
  }, {});

  const toggleBuilding = (buildingName: string) => {
    setExpandedBuildings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(buildingName)) {
        newSet.delete(buildingName);
      } else {
        newSet.add(buildingName);
      }
      return newSet;
    });
  };

  if (!edificios || edificios.length === 0) {
    return (
      <FormSection title="Espacios para Reservar" icon={CalendarClock} description="Gestiona los espacios reservables de cada edificio del proyecto">
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="text-sm">No hay edificios registrados para este proyecto. Agrega edificios primero.</p>
        </div>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Espacios para Reservar"
      icon={CalendarClock}
      description="Gestiona los espacios reservables de cada edificio del proyecto"
      actions={
        <Dialog open={open} onOpenChange={handleDialogClose} modal={false}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Agregar Espacio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>
                  {editingSpace ? "Editar Espacio Reservable" : "Agregar Espacio Reservable"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="id_edificio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edificio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un edificio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {edificios?.map((edificio: any) => (
                              <SelectItem key={edificio.id} value={edificio.id.toString()}>
                                {edificio.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="id_tipo_espacio_reservable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Espacio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposEspacio?.map((tipo) => (
                              <SelectItem key={tipo.id} value={tipo.id.toString()}>
                                {tipo.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descripción del espacio"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="costo_por_hr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo por Hora</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duracion_reserva"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duración de Reserva</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona duración" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="30 minutes">30 minutos</SelectItem>
                              <SelectItem value="1 hour">1 hora</SelectItem>
                              <SelectItem value="1 hour 30 minutes">1 hora 30 minutos</SelectItem>
                              <SelectItem value="2 hours">2 horas</SelectItem>
                              <SelectItem value="2 hours 30 minutes">2 horas 30 minutos</SelectItem>
                              <SelectItem value="3 hours">3 horas</SelectItem>
                              <SelectItem value="4 hours">4 horas</SelectItem>
                              <SelectItem value="5 hours">5 horas</SelectItem>
                              <SelectItem value="6 hours">6 horas</SelectItem>
                              <SelectItem value="8 hours">8 horas</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="permitir_reservas_recurrentes"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Permitir reservas recurrentes</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="url_imagen"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <ImageUploadField 
                            label="Imagen del Espacio"
                            value={field.value}
                            onChange={field.onChange}
                            accept="image/*"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingSpace ? "Actualizar" : "Crear"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
      }
    >
      <div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando espacios...</p>
        ) : !espaciosReservables || espaciosReservables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay espacios reservables registrados. Agrega uno nuevo.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(spacesGroupedByBuilding || {}).map(([buildingName, spaces]: [string, any]) => (
              <Collapsible
                key={buildingName}
                open={expandedBuildings.has(buildingName)}
                onOpenChange={() => toggleBuilding(buildingName)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {buildingName}
                      <span className="text-muted-foreground font-normal">
                        ({spaces.length} {spaces.length === 1 ? 'espacio' : 'espacios'})
                      </span>
                    </h4>
                    <ChevronDown 
                      className={`w-4 h-4 transition-transform ${
                        expandedBuildings.has(buildingName) ? 'rotate-180' : ''
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-2">
                      {spaces.map((space: any) => (
                        <div key={space.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            {space.url_imagen ? (
                              <img
                                src={optimizedImage(space.url_imagen, { width: 160, height: 160, resize: "cover" })}
                                alt={space.tipos_espacio_reservables?.nombre}
                                loading="lazy"
                                className="h-16 w-16 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                <CalendarClock className="h-5 w-5" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="font-medium">
                                  {space.tipos_espacio_reservables?.nombre}
                                </h5>
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                                  ${parseFloat(space.costo_por_hr || 0).toFixed(2)}/hr
                                </span>
                              </div>
                              {space.descripcion && (
                                <p className="text-sm text-muted-foreground">{space.descripcion}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {space.duracion_reserva && (
                                  <span>Duración: {space.duracion_reserva}</span>
                                )}
                                {space.permitir_reservas_recurrentes && (
                                  <span className="text-primary">✓ Reservas recurrentes</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <IconTooltip label="Editar espacio">
                              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar espacio" onClick={(e) => handleEdit(space, e)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </IconTooltip>
                            <AlertDialog>
                              <IconTooltip label="Eliminar espacio">
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar espacio">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </IconTooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar espacio?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará el espacio reservable. ¿Deseas continuar?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(space.id)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </FormSection>
  );
};
