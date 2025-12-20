import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Edit, Trash2, FileText, Check, X, PlayCircle, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface Reporte {
  id: number;
  nombre: string;
  descripcion: string | null;
  query_sql: string;
  filtros_configuracion: unknown[];
  nombre_archivo: string;
  id_submenu: number | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface Submenu {
  id: number;
  nombre: string;
  vista_front_end: string;
}

interface FiltroConfig {
  nombre: string;
  label: string;
  tipo: 'select' | 'multiselect' | 'date' | 'text';
  tabla?: string;
  campo_valor?: string;
  campo_label?: string;
}

export default function ConfiguracionReportes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canRead, canCreate, canUpdate, canDelete, isSuperAdmin, isLoading: permissionsLoading } = usePagePermissions('/admin/configuracion-reportes');
  const { registrarCreacion, registrarActualizacion, registrarEliminacion } = useActivityLogger();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReporte, setEditingReporte] = useState<Reporte | null>(null);
  
  // Query validation state
  const [isValidatingQuery, setIsValidatingQuery] = useState(false);
  const [queryValidation, setQueryValidation] = useState<{ valid: boolean; message: string; rowCount?: number } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    query_sql: "",
    filtros_configuracion: "[]",
    nombre_archivo: "",
    id_submenu: "",
    activo: true,
  });

  // Fetch reports
  const { data: reportes = [], isLoading } = useQuery({
    queryKey: ['reportes-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reportes')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      return data as Reporte[];
    },
  });

  // Fetch submenus for dropdown (only reportes submenus)
  const { data: submenus = [] } = useQuery({
    queryKey: ['submenus-reportes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submenus')
        .select('id, nombre, vista_front_end')
        .like('vista_front_end', '/admin/reportes/%')
        .eq('activo', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Submenu[];
    },
  });

  const filteredReportes = reportes.filter(reporte =>
    reporte.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reporte.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      query_sql: "",
      filtros_configuracion: "[]",
      nombre_archivo: "",
      id_submenu: "",
      activo: true,
    });
    setEditingReporte(null);
    setQueryValidation(null);
  };

  const openDialog = (reporte?: Reporte) => {
    if (reporte) {
      setEditingReporte(reporte);
      setFormData({
        nombre: reporte.nombre,
        descripcion: reporte.descripcion || "",
        query_sql: reporte.query_sql,
        filtros_configuracion: JSON.stringify(reporte.filtros_configuracion, null, 2),
        nombre_archivo: reporte.nombre_archivo,
        id_submenu: reporte.id_submenu?.toString() || "",
        activo: reporte.activo,
      });
      // Si ya existe el reporte, asumimos que el query es válido
      setQueryValidation({ valid: true, message: "Query existente" });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  // Función para validar el query SQL
  const validateQuery = async () => {
    if (!formData.query_sql.trim()) {
      setQueryValidation({ valid: false, message: "El query no puede estar vacío" });
      return;
    }

    setIsValidatingQuery(true);
    setQueryValidation(null);

    try {
      // Limpiar los placeholders de filtros para la validación
      let cleanQuery = formData.query_sql;
      // Remover placeholders como {{AND id = :id_filtro}}
      cleanQuery = cleanQuery.replace(/\{\{[^}]+\}\}/g, '');
      // Agregar LIMIT 1 para validación rápida
      if (!cleanQuery.toLowerCase().includes('limit')) {
        cleanQuery = cleanQuery.trim().replace(/;?\s*$/, '') + ' LIMIT 1';
      }

      const { data, error } = await supabase.rpc('execute_safe_query', {
        query_text: cleanQuery,
        max_rows: 1
      });

      if (error) {
        setQueryValidation({ 
          valid: false, 
          message: error.message || "Error al ejecutar el query"
        });
      } else {
        setQueryValidation({ 
          valid: true, 
          message: "Query válido",
          rowCount: Array.isArray(data) ? data.length : 0
        });
      }
    } catch (error: any) {
      setQueryValidation({ 
        valid: false, 
        message: error.message || "Error desconocido al validar"
      });
    } finally {
      setIsValidatingQuery(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate JSON
      let parsedFiltros;
      try {
        parsedFiltros = JSON.parse(formData.filtros_configuracion);
      } catch {
        toast({
          title: "Error",
          description: "El campo de filtros debe ser un JSON válido",
          variant: "destructive",
        });
        return;
      }

      const dataToSave = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        query_sql: formData.query_sql,
        filtros_configuracion: parsedFiltros,
        nombre_archivo: formData.nombre_archivo,
        id_submenu: formData.id_submenu ? parseInt(formData.id_submenu) : null,
        activo: formData.activo,
      };

      if (editingReporte) {
        const { error } = await supabase
          .from('reportes')
          .update(dataToSave)
          .eq('id', editingReporte.id);

        if (error) throw error;

        await registrarActualizacion('reportes', null, { 
          id_reporte: editingReporte.id, 
          nombre: formData.nombre 
        }, 'actualizar_reporte');

        toast({ title: "Éxito", description: "Reporte actualizado correctamente" });
      } else {
        const { data, error } = await supabase
          .from('reportes')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;

        await registrarCreacion('reportes', { 
          id_reporte: data.id, 
          nombre: formData.nombre 
        }, 'crear_reporte');

        toast({ title: "Éxito", description: "Reporte creado correctamente" });
      }

      queryClient.invalidateQueries({ queryKey: ['reportes-config'] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el reporte",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (reporte: Reporte) => {
    try {
      const { error } = await supabase
        .from('reportes')
        .update({ activo: false })
        .eq('id', reporte.id);

      if (error) throw error;

      await registrarEliminacion('reportes', { 
        id_reporte: reporte.id, 
        nombre: reporte.nombre 
      }, 'eliminar_reporte');

      toast({ title: "Éxito", description: "Reporte eliminado correctamente" });
      queryClient.invalidateQueries({ queryKey: ['reportes-config'] });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el reporte",
        variant: "destructive",
      });
    }
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <h1 className="text-2xl font-bold">Configuración de Reportes</h1>
        {(canCreate || isSuperAdmin) && (
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Reporte
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reportes Configurados</CardTitle>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar reportes..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Submenú</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReportes.map((reporte) => (
                <TableRow key={reporte.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {reporte.nombre}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {reporte.descripcion || "-"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {reporte.nombre_archivo}.csv
                    </code>
                  </TableCell>
                  <TableCell>
                    {submenus.find(s => s.id === reporte.id_submenu)?.nombre || "-"}
                  </TableCell>
                  <TableCell>
                    {reporte.activo ? (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" /> Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" /> Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(canUpdate || isSuperAdmin) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(reporte)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(canDelete || isSuperAdmin) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar reporte?</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de que deseas eliminar el reporte "{reporte.nombre}"?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(reporte)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredReportes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay reportes configurados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog for Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReporte ? "Editar Reporte" : "Nuevo Reporte"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Inventario de Propiedades"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre_archivo">Nombre del Archivo *</Label>
                <Input
                  id="nombre_archivo"
                  value={formData.nombre_archivo}
                  onChange={(e) => setFormData({ ...formData, nombre_archivo: e.target.value })}
                  placeholder="inventario_propiedades"
                />
                <p className="text-xs text-muted-foreground">Sin extensión, se añadirá .csv automáticamente</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del reporte..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="query_sql">Query SQL *</Label>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={validateQuery}
                  disabled={isValidatingQuery || !formData.query_sql.trim()}
                  className="gap-2"
                >
                  {isValidatingQuery ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Validar Query
                </Button>
              </div>
              <Textarea
                id="query_sql"
                value={formData.query_sql}
                onChange={(e) => {
                  setFormData({ ...formData, query_sql: e.target.value });
                  setQueryValidation(null); // Resetear validación al cambiar
                }}
                placeholder="SELECT * FROM tabla WHERE activo = true {{AND id = :id_filtro}}"
                className={`font-mono text-sm min-h-[200px] ${
                  queryValidation?.valid === false ? 'border-destructive' : 
                  queryValidation?.valid === true ? 'border-green-500' : ''
                }`}
              />
              {queryValidation && (
                <div className={`flex items-center gap-2 text-sm ${
                  queryValidation.valid ? 'text-green-600' : 'text-destructive'
                }`}>
                  {queryValidation.valid ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {queryValidation.message}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Usa {"{{AND condicion = :nombre_filtro}}"} para filtros dinámicos
              </p>
            </div>

            {/* Sección de Filtros Mejorada */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Configuración de Filtros</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>Define los filtros que aparecerán en el formulario de generación del reporte.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ayuda" className="border rounded-lg">
                  <AccordionTrigger className="px-4 text-sm text-muted-foreground hover:no-underline">
                    ¿Cómo configurar los filtros?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 text-sm">
                      <p>Los filtros se definen como un arreglo JSON. Cada filtro tiene estas propiedades:</p>
                      <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-2">
                        <p><strong>nombre:</strong> Nombre del parámetro (debe coincidir con el placeholder en el query)</p>
                        <p><strong>label:</strong> Etiqueta que se mostrará al usuario</p>
                        <p><strong>tipo:</strong> "select", "multiselect", "date" o "text"</p>
                        <p><strong>tabla:</strong> (Solo para select) Tabla de donde obtener opciones</p>
                        <p><strong>campo_valor:</strong> (Opcional) Campo para el valor (default: id)</p>
                        <p><strong>campo_label:</strong> (Opcional) Campo para mostrar (default: nombre)</p>
                      </div>
                      <p className="font-medium">Ejemplo:</p>
                      <pre className="bg-muted p-3 rounded-md font-mono text-xs overflow-x-auto">
{`[
  {
    "nombre": "id_proyecto",
    "label": "Proyecto",
    "tipo": "select",
    "tabla": "proyectos"
  },
  {
    "nombre": "fecha_desde",
    "label": "Fecha desde",
    "tipo": "date"
  }
]`}
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Textarea
                id="filtros"
                value={formData.filtros_configuracion}
                onChange={(e) => setFormData({ ...formData, filtros_configuracion: e.target.value })}
                placeholder='[]'
                className="font-mono text-sm min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="submenu">Submenú</Label>
                <Select
                  value={formData.id_submenu}
                  onValueChange={(value) => setFormData({ ...formData, id_submenu: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar submenú..." />
                  </SelectTrigger>
                  <SelectContent>
                    {submenus.map((submenu) => (
                      <SelectItem key={submenu.id} value={submenu.id.toString()}>
                        {submenu.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                />
                <Label htmlFor="activo">Activo</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      onClick={handleSave} 
                      disabled={!formData.nombre || !formData.query_sql || !formData.nombre_archivo || queryValidation?.valid !== true}
                    >
                      {editingReporte ? "Guardar Cambios" : "Crear Reporte"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {queryValidation?.valid !== true && (
                  <TooltipContent>
                    <p>Debes validar el query SQL antes de guardar</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
