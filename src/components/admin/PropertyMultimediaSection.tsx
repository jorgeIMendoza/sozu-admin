import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PropertyMultimediaSectionProps {
  form: any;
  propertyId?: number;
}

export const PropertyMultimediaSection = ({ form, propertyId }: PropertyMultimediaSectionProps) => {
  // Query para obtener las vistas disponibles
  const { data: vistas, isLoading: loadingVistas } = useQuery({
    queryKey: ["vistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistas")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Imagen de Portada */}
      <Card>
        <CardHeader>
          <CardTitle>Imagen de Portada</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="url_imagen_portada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL de Imagen de Portada</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://ejemplo.com/imagen.jpg"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
                <p className="text-sm text-muted-foreground">
                  {propertyId 
                    ? "Puedes actualizar la imagen de portada de la propiedad"
                    : "La imagen de portada se puede configurar después de crear la propiedad"
                  }
                </p>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Videos de YouTube */}
      <Card>
        <CardHeader>
          <CardTitle>Videos de YouTube</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {propertyId 
              ? "Los videos de YouTube se pueden gestionar desde la vista de edición de propiedad"
              : "Los videos de YouTube se podrán agregar una vez que la propiedad sea creada"
            }
          </div>
        </CardContent>
      </Card>

      {/* Vistas de la Propiedad */}
      <Card>
        <CardHeader>
          <CardTitle>Vista de la Propiedad</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="id_vista"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vista *</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={loadingVistas}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una vista" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vistas?.map((vista) => (
                      <SelectItem key={vista.id} value={vista.id.toString()}>
                        {vista.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Imágenes y Videos */}
      <Card>
        <CardHeader>
          <CardTitle>Imágenes y Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {propertyId 
              ? "Las imágenes y videos se pueden gestionar desde la vista de edición de propiedad"
              : "Las imágenes y videos se podrán subir una vez que la propiedad sea creada"
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};