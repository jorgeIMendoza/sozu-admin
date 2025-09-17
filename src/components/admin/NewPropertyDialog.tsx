import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ProjectModelSelectionSection } from "./ProjectModelSelectionSection";
import { PropertyBasicDataSection } from "./PropertyBasicDataSection";
import { PropertyClassificationSection } from "./PropertyClassificationSection";
import { PropertyDescriptionSection } from "./PropertyDescriptionSection";

const formSchema = z.object({
  id_proyecto: z.string().min(1, "El proyecto es requerido"),
  id_edificio: z.string().min(1, "El edificio es requerido"),
  id_modelo: z.string().min(1, "El modelo es requerido"),
  numero_propiedad: z.string().min(1, "El número de propiedad es requerido"),
  numero_piso: z.string().min(1, "El número de piso es requerido"),
  m2_reales: z.string().min(1, "Los metros cuadrados son requeridos"),
  m2_escriturables: z.string().min(1, "Los metros cuadrados escriturables son requeridos"),
  precio_lista: z.string().min(1, "El precio de lista es requerido"),
  monto_apartado: z.string().optional(),
  id_tipo_transaccion: z.string().min(1, "El tipo de transacción es requerido"),
  id_tipo_propiedad: z.string().min(1, "El tipo de propiedad es requerido"),
  id_estatus_disponibilidad: z.string().min(1, "El estatus de disponibilidad es requerido"),
  id_vista: z.string().min(1, "La vista es requerida"),
  id_entidad_relacionada_dueno: z.string().min(1, "El propietario es requerido").refine((val) => val !== "no-owners", {
    message: "Se deben asignar Entidades Legales (Dueños vendedor o Aportante) al proyecto"
  }),
  descripcion: z.string().optional(),
});

interface NewPropertyDialogProps {
  onPropertyAdded: () => void;
}

export const NewPropertyDialog = ({ onPropertyAdded }: NewPropertyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id_proyecto: "",
      id_edificio: "",
      id_modelo: "",
      numero_propiedad: "",
      numero_piso: "",
      m2_reales: "",
      m2_escriturables: "",
      precio_lista: "",
      monto_apartado: "",
      id_tipo_transaccion: "",
      id_tipo_propiedad: "",
      id_estatus_disponibilidad: "",
      id_vista: "",
      id_entidad_relacionada_dueno: "",
      descripcion: "",
    },
  });

  // Query para obtener la CLABE del propietario seleccionado
  const { data: ownerClabe, isLoading: isLoadingClabe, error: clabeError } = useQuery({
    queryKey: ["owner-clabe", selectedOwnerId],
    queryFn: async () => {
      if (!selectedOwnerId) return null;
      
      try {
        const { data, error } = await supabase
          .rpc('crear_referencia_bancaria', {
            id_er_dueno: parseInt(selectedOwnerId)
          });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error("Error getting CLABE:", error);
        throw error;
      }
    },
    enabled: !!selectedOwnerId && selectedOwnerId !== "no-owners",
    retry: 1
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const propertyData = {
        numero_propiedad: values.numero_propiedad,
        numero_piso: parseInt(values.numero_piso),
        m2_reales: parseFloat(values.m2_reales),
        m2_escriturables: parseFloat(values.m2_escriturables),
        precio_lista: parseFloat(values.precio_lista),
        monto_apartado: values.monto_apartado ? parseFloat(values.monto_apartado) : null,
        id_edificio_modelo: parseInt(values.id_modelo),
        id_tipo_transaccion: parseInt(values.id_tipo_transaccion),
        id_tipo_propiedad: parseInt(values.id_tipo_propiedad),
        id_estatus_disponibilidad: parseInt(values.id_estatus_disponibilidad),
        id_vista: parseInt(values.id_vista),
        id_entidad_relacionada_dueno: parseInt(values.id_entidad_relacionada_dueno),
        descripcion: values.descripcion || null,
        es_aprobado: false,
        activo: true,
      };

      const { data, error } = await supabase
        .from("propiedades")
        .insert(propertyData)
        .select()
        .single();

      if (error) throw error;

      setPropertyId(data?.id || null);
      onPropertyAdded();

      toast({
        title: "Propiedad creada",
        description: "La propiedad se ha creado exitosamente",
      });

      // Reset form and close modal
      form.reset();
      setSelectedProjectId("");
      setSelectedBuildingId("");
      setSelectedOwnerId("");
      setOpen(false);
    } catch (error) {
      console.error("Error creating property:", error);
      toast({
        title: "Error",
        description: "Hubo un error al crear la propiedad.",
        variant: "destructive",
      });
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setPropertyId(null);
      setSelectedProjectId("");
      setSelectedBuildingId("");
      setSelectedOwnerId("");
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Propiedad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Propiedad</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Selección de Proyecto y Modelo - siempre visible */}
            <ProjectModelSelectionSection
              form={form}
              selectedProjectId={selectedProjectId}
              selectedBuildingId={selectedBuildingId}
              selectedOwnerId={selectedOwnerId}
              setSelectedProjectId={setSelectedProjectId}
              setSelectedBuildingId={setSelectedBuildingId}
              setSelectedOwnerId={setSelectedOwnerId}
              ownerClabe={ownerClabe}
              isLoadingClabe={isLoadingClabe}
              clabeError={clabeError}
            />
            
            {/* Tabs aparecen cuando se selecciona propietario */}
            {selectedOwnerId && selectedOwnerId !== "no-owners" && (
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">Características Generales</TabsTrigger>
                  <TabsTrigger value="descripcion">Descripción</TabsTrigger>
                  <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-6">
                  <PropertyBasicDataSection form={form} />
                  <PropertyClassificationSection form={form} />
                </TabsContent>
                
                <TabsContent value="descripcion" className="space-y-6">
                  <PropertyDescriptionSection 
                    form={form} 
                    selectedModelId={form.watch("id_modelo")}
                  />
                </TabsContent>
                
                <TabsContent value="multimedia" className="space-y-6">
                  <div className="text-center py-8 text-muted-foreground">
                    La multimedia se podrá gestionar una vez que la propiedad sea creada.
                  </div>
                </TabsContent>
                
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Creando..." : "Crear Propiedad"}
                  </Button>
                </div>
              </Tabs>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};