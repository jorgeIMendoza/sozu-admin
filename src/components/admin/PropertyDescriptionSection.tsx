import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PropertyCharacteristicsSection } from "./PropertyCharacteristicsSection";
import { PropertyCharacteristicsSelectionSection } from "./PropertyCharacteristicsSelectionSection";

interface PropertyDescriptionSectionProps {
  form: any;
  selectedModelId?: string;
  propertyId?: number;
  onCharacteristicsChange?: (selectedIds: number[]) => void;
}

export const PropertyDescriptionSection = ({ form, selectedModelId, propertyId, onCharacteristicsChange }: PropertyDescriptionSectionProps) => {
  // Fetch model details when model is selected
  const { data: modelDetails } = useQuery({
    queryKey: ["model-details", selectedModelId],
    queryFn: async () => {
      if (!selectedModelId) return null;
      
      const { data, error } = await supabase
        .from("modelos")
        .select("*")
        .eq("id", parseInt(selectedModelId))
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedModelId,
  });

  return (
    <div className="space-y-6">
      {/* Descripción */}
      <Card>
        <CardHeader>
          <CardTitle>Descripción de la Propiedad</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe las características y amenidades de la propiedad..."
                    className="min-h-[100px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Configuración del Modelo */}
      {modelDetails && (
        <Card>
          <CardHeader>
            <CardTitle>
              Configuración del Modelo {modelDetails.nombre ? modelDetails.nombre : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <FormLabel>Número de Recámaras</FormLabel>
                <div className="p-3 border rounded-md bg-muted/50">
                  <Badge variant="outline">
                    {modelDetails.numero_recamaras || 0} recámaras
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <FormLabel>Número de Baños Completos</FormLabel>
                <div className="p-3 border rounded-md bg-muted/50">
                  <Badge variant="outline">
                    {modelDetails.numero_completo_banos || 0} baños completos
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <FormLabel>Número de Medios Baños</FormLabel>
                <div className="p-3 border rounded-md bg-muted/50">
                  <Badge variant="outline">
                    {modelDetails.numero_medio_bano || 0} medios baños
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Características */}
      {propertyId ? (
        <Card>
          <CardHeader>
            <CardTitle>Características</CardTitle>
          </CardHeader>
          <CardContent>
            <PropertyCharacteristicsSection propertyId={propertyId} />
          </CardContent>
        </Card>
      ) : (
        <PropertyCharacteristicsSelectionSection 
          onCharacteristicsChange={onCharacteristicsChange}
        />
      )}
    </div>
  );
};