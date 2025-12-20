import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Download, Loader2, Info, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface FiltroConfig {
  nombre: string;
  label: string;
  tipo: 'select' | 'multiselect' | 'date' | 'text';
  tabla?: string;
  campo_valor?: string;
  campo_label?: string;
  opciones?: string[];
  requerido?: boolean;
}

interface Reporte {
  id: number;
  nombre: string;
  descripcion: string | null;
  filtros_configuracion: FiltroConfig[];
  nombre_archivo: string;
}

export default function ReportesFinanzas() {
  const { toast } = useToast();
  const { canRead, canExport, isSuperAdmin, isLoading: permissionsLoading } = usePagePermissions('/admin/reportes/finanzas');
  const { registrarExportacion } = useActivityLogger();

  const [selectedReporteId, setSelectedReporteId] = useState<string>("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Fetch available reports for this submenu
  const { data: reportes = [], isLoading } = useQuery({
    queryKey: ['reportes-finanzas'],
    queryFn: async () => {
      const { data: submenu } = await supabase
        .from('submenus')
        .select('id')
        .eq('vista_front_end', '/admin/reportes/finanzas')
        .single();

      if (!submenu) return [];

      const { data, error } = await supabase
        .from('reportes')
        .select('id, nombre, descripcion, filtros_configuracion, nombre_archivo')
        .eq('id_submenu', submenu.id)
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        filtros_configuracion: (r.filtros_configuracion || []) as unknown as FiltroConfig[]
      })) as Reporte[];
    },
  });

  const selectedReporte = reportes.find(r => r.id.toString() === selectedReporteId);

  // Fetch options for select filters
  const { data: filterOptions = {} } = useQuery({
    queryKey: ['filter-options-finanzas', selectedReporteId],
    queryFn: async () => {
      if (!selectedReporte) return {};

      const options: Record<string, { value: string; label: string }[]> = {};

      for (const filtro of selectedReporte.filtros_configuracion) {
        if (filtro.tipo === 'select' && filtro.tabla) {
          const { data } = await supabase
            .from(filtro.tabla as 'proyectos' | 'estatus_disponibilidad')
            .select('*')
            .eq('activo', true);

          options[filtro.nombre] = ((data as unknown as Record<string, unknown>[]) || []).map((item) => ({
            value: String(item[filtro.campo_valor || 'id']),
            label: String(item[filtro.campo_label || 'nombre']),
          }));
        } else if (filtro.tipo === 'select' && filtro.opciones) {
          options[filtro.nombre] = filtro.opciones.map(opt => ({ value: opt, label: opt }));
        }
      }

      return options;
    },
    enabled: !!selectedReporte,
  });

  const handleExport = async () => {
    if (!selectedReporte) return;

    setIsExporting(true);
    try {
      const response = await supabase.functions.invoke('exportar-reporte', {
        body: {
          id_reporte: selectedReporte.id,
          filtros,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReporte.nombre_archivo}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await registrarExportacion('reportes_finanzas', {
        id_reporte: selectedReporte.id,
        nombre_reporte: selectedReporte.nombre,
        filtros_aplicados: filtros,
      });

      toast({ title: "Éxito", description: "Reporte exportado correctamente" });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No tienes permisos para ver esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Reportes de Finanzas
          </h1>
          <p className="text-muted-foreground">Selecciona un reporte y aplica filtros para exportar</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Generar Reporte
          </CardTitle>
          <CardDescription>
            Selecciona el reporte financiero que deseas generar y configura los filtros opcionales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Selector */}
          <div className="space-y-2">
            <Label>Seleccionar Reporte</Label>
            <Select
              value={selectedReporteId}
              onValueChange={(value) => {
                setSelectedReporteId(value);
                setFiltros({});
              }}
            >
              <SelectTrigger className="w-full md:w-96">
                <SelectValue placeholder="Selecciona un reporte..." />
              </SelectTrigger>
              <SelectContent>
                {reportes.map((reporte) => (
                  <SelectItem key={reporte.id} value={reporte.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{reporte.nombre}</span>
                      {reporte.descripcion && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{reporte.descripcion}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Filters */}
          {selectedReporte && selectedReporte.filtros_configuracion.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Filtros</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedReporte.filtros_configuracion.map((filtro) => (
                  <div key={filtro.nombre} className="space-y-2">
                    <Label htmlFor={filtro.nombre}>
                      {filtro.label}
                      {filtro.requerido && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    
                    {filtro.tipo === 'select' ? (
                      <Select
                        value={filtros[filtro.nombre] || ""}
                        onValueChange={(value) => setFiltros({ ...filtros, [filtro.nombre]: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Seleccionar ${filtro.label.toLowerCase()}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todos</SelectItem>
                          {(filterOptions[filtro.nombre] || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : filtro.tipo === 'date' ? (
                      <Input
                        type="date"
                        id={filtro.nombre}
                        value={filtros[filtro.nombre] || ""}
                        onChange={(e) => setFiltros({ ...filtros, [filtro.nombre]: e.target.value })}
                      />
                    ) : (
                      <Input
                        type="text"
                        id={filtro.nombre}
                        value={filtros[filtro.nombre] || ""}
                        onChange={(e) => setFiltros({ ...filtros, [filtro.nombre]: e.target.value })}
                        placeholder={`Ingresa ${filtro.label.toLowerCase()}...`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Button */}
          {selectedReporte && (canExport || isSuperAdmin) && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Exportar a Excel
              </Button>
            </div>
          )}

          {reportes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay reportes de finanzas configurados</p>
              <p className="text-sm">Contacta al administrador para agregar reportes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
