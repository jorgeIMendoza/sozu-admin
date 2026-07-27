import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExportOptions {
  data: Record<string, unknown>[];
  filename: string;
  columnas_visibles?: { key: string; label: string }[];
}

export const useExportToExcel = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportToExcel = async ({ data, filename, columnas_visibles }: ExportOptions) => {
    if (data.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar con los filtros actuales.",
        variant: "destructive",
      });
      return false;
    }

    setIsExporting(true);
    try {
      const response = await supabase.functions.invoke('exportar-reporte', {
        body: {
          data_directa: data,
          nombre_archivo: filename,
          columnas_visibles,
        }
      });

      if (response.error) throw response.error;

      // Descargar el .xlsx (la Edge Function ahora devuelve OOXML, no CSV).
      // supabase-js decodifica por Content-Type: si es el MIME xlsx llega como
      // Blob; en otros casos envolvemos el buffer con el MIME correcto.
      const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: XLSX_MIME });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Exportación exitosa",
        description: `Se exportaron ${data.length} registros correctamente.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportToExcel, isExporting };
};
