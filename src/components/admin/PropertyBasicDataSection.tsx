import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PropertyBasicDataSectionProps {
  form: any;
}

export const PropertyBasicDataSection = ({ form }: PropertyBasicDataSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos Básicos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="numero_propiedad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de la Propiedad *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: A-101" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="numero_piso"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Piso *</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ej: 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="m2_reales"
          render={({ field }) => (
            <FormItem>
              <FormLabel>M² Reales *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="Ej: 85.50" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="m2_escriturables"
          render={({ field }) => (
            <FormItem>
              <FormLabel>M² Escriturables *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="Ej: 80.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="precio_lista"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Precio de Lista *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="Ej: 2500000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="monto_apartado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto Apartado (Opcional)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="Ej: 50000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};