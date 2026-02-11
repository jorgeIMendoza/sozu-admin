import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstadoCuentaMantenimientoEdgeFunctionData {
  id_cuenta: number;
}

export class EstadoCuentaMantenimientoEdgeFunctionService {
  async generateEstadoCuenta(data: EstadoCuentaMantenimientoEdgeFunctionData): Promise<string | null> {
    try {
      console.log('Calling generar-estado-cuenta-mantenimiento Edge Function with id_cuenta:', data.id_cuenta);

      const { data: response, error } = await supabase.functions.invoke('generar-estado-cuenta-mantenimiento', {
        body: { id_cuenta: data.id_cuenta }
      });

      if (error) {
        console.error('Error calling Edge Function:', error);
        toast.error('Error al generar el estado de cuenta de mantenimiento');
        throw error;
      }

      if (!response?.success || !response?.url_estado_cuenta) {
        console.error('Invalid response from Edge Function:', response);
        toast.error(response?.error || 'Error al generar el estado de cuenta de mantenimiento');
        return null;
      }

      console.log('Estado de cuenta mantenimiento generated successfully:', response.url_estado_cuenta);

      // Download the PDF automatically
      const pdfResponse = await fetch(response.url_estado_cuenta);
      const blob = await pdfResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.fileName || `estado_cuenta_mantenimiento_${data.id_cuenta}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return response.url_estado_cuenta;
    } catch (error) {
      console.error('Error generating estado de cuenta mantenimiento:', error);
      throw error;
    }
  }
}

export const estadoCuentaMantenimientoEdgeFunctionService = new EstadoCuentaMantenimientoEdgeFunctionService();
