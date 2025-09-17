import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectModelSelectionSectionProps {
  form: any;
  selectedProjectId: string;
  selectedBuildingId: string;
  selectedOwnerId: string;
  setSelectedProjectId: (value: string) => void;
  setSelectedBuildingId: (value: string) => void;
  setSelectedOwnerId: (value: string) => void;
  ownerClabe?: string;
  isLoadingClabe?: boolean;
  clabeError?: any;
}

export const ProjectModelSelectionSection = ({
  form,
  selectedProjectId,
  selectedBuildingId,
  selectedOwnerId,
  setSelectedProjectId,
  setSelectedBuildingId,
  setSelectedOwnerId,
  ownerClabe,
  isLoadingClabe,
  clabeError
}: ProjectModelSelectionSectionProps) => {
  // Query para obtener proyectos
  const { data: proyectos } = useQuery({
    queryKey: ["proyectos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Query para obtener edificios
  const { data: edificios } = useQuery({
    queryKey: ["edificios", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      
      const { data, error } = await supabase
        .from("edificios")
        .select("id, nombre")
        .eq("id_proyecto", parseInt(selectedProjectId))
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProjectId,
  });

  // Query para obtener modelos
  const { data: modelos } = useQuery({
    queryKey: ["modelos", selectedBuildingId],
    queryFn: async () => {
      if (!selectedBuildingId) return [];
      
      const { data, error } = await supabase
        .from("edificios_modelos")
        .select(`
          id,
          modelos!fk_edificios_modelos_modelo (
            id,
            nombre
          )
        `)
        .eq("id_edificio", parseInt(selectedBuildingId))
        .eq("activo", true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBuildingId,
  });

  // Query para obtener propietarios
  const { data: propietarios } = useQuery({
    queryKey: ["propietarios", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      
      const { data, error } = await supabase
        .from("entidades_relacionadas")
        .select(`
          id,
          personas!entidades_relacionadas_id_persona_fkey(id, nombre_legal)
        `)
        .eq("id_proyecto", parseInt(selectedProjectId))
        .in("id_tipo_entidad", [4, 15]) // Dueño vendedor or Aportante
        .eq("activo", true)
        .order("personas(nombre_legal)");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProjectId,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Selección de Proyecto y Modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="id_proyecto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proyecto *</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProjectId(value);
                    // Reset all subsequent fields when project changes
                    setSelectedBuildingId("");
                    setSelectedOwnerId("");
                    form.setValue("id_edificio", "");
                    form.setValue("id_modelo", "");
                    form.setValue("id_entidad_relacionada_dueno", "");
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proyecto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {proyectos?.map((proyecto) => (
                      <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                        {proyecto.nombre}
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
            name="id_edificio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Edificio *</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedBuildingId(value);
                    // Reset subsequent fields when building changes
                    setSelectedOwnerId("");
                    form.setValue("id_modelo", "");
                    form.setValue("id_entidad_relacionada_dueno", "");
                  }}
                  value={field.value}
                  disabled={!selectedProjectId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedProjectId ? "Selecciona un proyecto primero" : "Selecciona un edificio"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {edificios?.map((edificio) => (
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
            name="id_modelo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo *</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Reset subsequent fields when model changes
                    setSelectedOwnerId("");
                    form.setValue("id_entidad_relacionada_dueno", "");
                  }} 
                  value={field.value}
                  disabled={!selectedBuildingId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedBuildingId ? "Selecciona un edificio primero" : "Selecciona un modelo"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelos?.map((em) => (
                      <SelectItem key={em.modelos?.id} value={em.modelos?.id.toString()}>
                        {em.modelos?.nombre}
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
            name="id_entidad_relacionada_dueno"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Propietario *</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedOwnerId(value);
                  }}
                  value={field.value}
                  disabled={!selectedProjectId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedProjectId ? "Selecciona un proyecto primero" : propietarios?.length === 0 ? "No hay propietarios disponibles" : "Selecciona el propietario"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {propietarios?.length === 0 ? (
                      <SelectItem value="no-owners" disabled>
                        No hay propietarios disponibles
                      </SelectItem>
                    ) : (
                      propietarios?.map((propietario) => (
                        <SelectItem key={propietario.id} value={propietario.id.toString()}>
                          {propietario.personas?.nombre_legal}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* CLABE STP Display */}
          {selectedOwnerId && selectedOwnerId !== "no-owners" && (
            <div className="space-y-2">
              <FormLabel>CLABE STP</FormLabel>
              <div className="p-3 border rounded-md bg-muted/50">
                {isLoadingClabe ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm text-muted-foreground">Generando CLABE...</span>
                  </div>
                ) : clabeError ? (
                  <Badge variant="destructive">Error al generar CLABE</Badge>
                ) : ownerClabe ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ownerClabe}</Badge>
                    <span className="text-sm text-muted-foreground">(Solo lectura)</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin CLABE asignada</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};