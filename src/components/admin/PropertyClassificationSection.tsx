import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PropertyClassificationSectionProps {
  form: any;
}

export const PropertyClassificationSection = ({ form }: PropertyClassificationSectionProps) => {
  // Query para obtener tipos de transacción
  const { data: tiposTransaccion } = useQuery({
    queryKey: ["tipos-transaccion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_transaccion")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Query para obtener tipos de propiedad
  const { data: tiposPropiedad } = useQuery({
    queryKey: ["tipos-propiedad"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_propiedad")
        .select("*")
        .eq("activo", true)
        .lte("id", 10)
        .order("nombre");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Query para obtener estatus de disponibilidad
  const { data: estatusDisponibilidad } = useQuery({
    queryKey: ["estatus-disponibilidad"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estatus_disponibilidad")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data || [];
    },
  });


  return (
    <Card>
      <CardHeader>
        <CardTitle>Clasificaciones</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="id_tipo_transaccion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Transacción *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tiposTransaccion?.map((tipo) => (
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
          name="id_tipo_propiedad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Propiedad *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tiposPropiedad?.map((tipo) => (
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
          name="id_estatus_disponibilidad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Disponibilidad *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la disponibilidad" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {estatusDisponibilidad?.map((estatus) => (
                    <SelectItem key={estatus.id} value={estatus.id.toString()}>
                      {estatus.nombre}
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
  );
};