import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Vista {
  id: number;
  nombre: string;
  url?: string | null;
  id_proyecto?: number | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface Proyecto {
  id: number;
  nombre: string;
}

export default function Vistas() {
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProyectoFilter, setSelectedProyectoFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("activos");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [selectedVista, setSelectedVista] = useState<Vista | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    nombre: "",
    url: "",
    id_proyecto: ""
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchVistas();
    fetchProyectos();
  }, []);

  const fetchProyectos = async () => {
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setProyectos(data || []);
    } catch (error) {
      console.error('Error fetching proyectos:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los proyectos",
      });
    }
  };

  const fetchVistas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vistas')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setVistas(data || []);
    } catch (error) {
      console.error('Error fetching vistas:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las vistas",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVista = async () => {
    if (!formData.nombre.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre es requerido",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const { data, error } = await supabase
        .from('vistas')
        .insert([{
          nombre: formData.nombre.trim(),
          url: formData.url || null,
          id_proyecto: formData.id_proyecto ? parseInt(formData.id_proyecto) : null,
          activo: true
        }])
        .select()
        .single();

      if (error) throw error;

      setVistas(prev => [...prev, data]);
      setIsCreateDialogOpen(false);
      setFormData({ nombre: "", url: "", id_proyecto: "" });
      toast({
        title: "Éxito",
        description: "Vista creada correctamente",
      });
    } catch (error) {
      console.error('Error creating vista:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear la vista",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVista = async () => {
    if (!selectedVista || !formData.nombre.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre es requerido",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const updateData: any = {
        nombre: formData.nombre.trim(),
        id_proyecto: formData.id_proyecto ? parseInt(formData.id_proyecto) : null,
      };

      // Only update URL if there's a change
      if (formData.url !== selectedVista.url) {
        updateData.url = formData.url || null;
      }

      const { data, error } = await supabase
        .from('vistas')
        .update(updateData)
        .eq('id', selectedVista.id)
        .select()
        .single();

      if (error) throw error;

      setVistas(prev => prev.map(vista => 
        vista.id === selectedVista.id ? data : vista
      ));
      setIsEditDialogOpen(false);
      setSelectedVista(null);
      setFormData({ nombre: "", url: "", id_proyecto: "" });
      toast({
        title: "Éxito",
        description: "Vista actualizada correctamente",
      });
    } catch (error) {
      console.error('Error updating vista:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la vista",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVista = async () => {
    if (!selectedVista) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('vistas')
        .update({ activo: false })
        .eq('id', selectedVista.id);

      if (error) throw error;

      setVistas(prev => prev.map(vista => 
        vista.id === selectedVista.id ? { ...vista, activo: false } : vista
      ));
      setIsDeleteDialogOpen(false);
      setSelectedVista(null);
      toast({
        title: "Éxito",
        description: "Vista eliminada correctamente",
      });
    } catch (error) {
      console.error('Error deleting vista:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la vista",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreVista = async () => {
    if (!selectedVista) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('vistas')
        .update({ activo: true })
        .eq('id', selectedVista.id);

      if (error) throw error;

      setVistas(prev => prev.map(vista => 
        vista.id === selectedVista.id ? { ...vista, activo: true } : vista
      ));
      setIsRestoreDialogOpen(false);
      setSelectedVista(null);
      toast({
        title: "Éxito",
        description: "Vista restaurada correctamente",
      });
    } catch (error) {
      console.error('Error restoring vista:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo restaurar la vista",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (vista: Vista) => {
    setSelectedVista(vista);
    setFormData({ 
      nombre: vista.nombre,
      url: vista.url || "",
      id_proyecto: vista.id_proyecto?.toString() || ""
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (vista: Vista) => {
    setSelectedVista(vista);
    setIsDeleteDialogOpen(true);
  };

  const openRestoreDialog = (vista: Vista) => {
    setSelectedVista(vista);
    setIsRestoreDialogOpen(true);
  };

  const toggleProject = (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const filteredVistas = vistas.filter(vista => {
    const matchesSearch = vista.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "activos" ? vista.activo : !vista.activo;
    const matchesProyecto = selectedProyectoFilter === "all" || 
      (selectedProyectoFilter === "sin-proyecto" ? !vista.id_proyecto : vista.id_proyecto?.toString() === selectedProyectoFilter);
    return matchesSearch && matchesTab && matchesProyecto;
  });

  // Group vistas by project
  const vistasByProject = filteredVistas.reduce((acc, vista) => {
    const projectId = vista.id_proyecto || 0; // 0 for vistas without project
    if (!acc[projectId]) {
      acc[projectId] = [];
    }
    acc[projectId].push(vista);
    return acc;
  }, {} as Record<number, Vista[]>);

  const getProyectoNombre = (id?: number | null) => {
    if (!id) return "Sin Proyecto";
    return proyectos.find(p => p.id === id)?.nombre || "Proyecto Desconocido";
  };

  // Count active and deleted vistas
  const activosCount = vistas.filter(v => v.activo).length;
  const eliminadosCount = vistas.filter(v => !v.activo).length;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando vistas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Vistas</h1>
          <p className="text-muted-foreground">
            Administra las vistas disponibles para las propiedades
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Vista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Vista</DialogTitle>
              <DialogDescription>
                Ingresa los datos de la nueva vista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Vista al mar, Vista a la montaña"
                />
              </div>

              <div>
                <Label htmlFor="id_proyecto">Proyecto</Label>
                <Select
                  value={formData.id_proyecto}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, id_proyecto: value }))}
                >
                  <SelectTrigger id="id_proyecto">
                    <SelectValue placeholder="Selecciona un proyecto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin proyecto</SelectItem>
                    {proyectos.map((proyecto) => (
                      <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                        {proyecto.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <ImageUploadField
                  label="Imagen de la Vista"
                  value={formData.url}
                  onChange={(url) => setFormData(prev => ({ ...prev, url }))}
                  accept="image/*"
                />
              </div>
            </div>
            <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setFormData({ nombre: "", url: "", id_proyecto: "" });
                  }}
                  disabled={isSubmitting}
                >
                Cancelar
              </Button>
              <Button onClick={handleCreateVista} disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear Vista"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activos">
            Vistas Activas ({activosCount})
          </TabsTrigger>
          <TabsTrigger value="eliminados">
            Vistas Eliminadas ({eliminadosCount})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Eye className="h-6 w-6" />
                <CardTitle className="text-2xl">
                  Vistas {activeTab === "activos" ? "Activas" : "Eliminadas"}
                </CardTitle>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {filteredVistas.length} {filteredVistas.length === 1 ? 'vista' : 'vistas'}
                </Badge>
              </div>
              <CardDescription>
                {activeTab === "activos" 
                  ? "Lista de todas las vistas activas en el sistema"
                  : "Lista de todas las vistas eliminadas en el sistema"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vistas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={selectedProyectoFilter}
                  onValueChange={setSelectedProyectoFilter}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Filtrar por proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proyectos</SelectItem>
                    <SelectItem value="sin-proyecto">Sin proyecto</SelectItem>
                    {proyectos.map((proyecto) => (
                      <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                        {proyecto.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {Object.keys(vistasByProject).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No se encontraron vistas
                  </div>
                ) : (
                  Object.entries(vistasByProject).map(([projectId, projectVistas]) => {
                    const numProjectId = parseInt(projectId);
                    const isExpanded = expandedProjects.has(numProjectId);
                    const projectName = getProyectoNombre(numProjectId === 0 ? null : numProjectId);

                    return (
                      <Collapsible
                        key={projectId}
                        open={isExpanded}
                        onOpenChange={() => toggleProject(numProjectId)}
                      >
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                  <CardTitle className="text-lg">{projectName}</CardTitle>
                                  <Badge variant="secondary">{projectVistas.length}</Badge>
                                </div>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent>
                              <div className="rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>ID</TableHead>
                                      <TableHead>Nombre</TableHead>
                                      <TableHead>Imagen</TableHead>
                                      <TableHead>Estado</TableHead>
                                      <TableHead>Fecha Creación</TableHead>
                                      <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {projectVistas.map((vista) => (
                                      <TableRow key={vista.id}>
                                        <TableCell className="font-medium">{vista.id}</TableCell>
                                        <TableCell>{vista.nombre}</TableCell>
                                        <TableCell>
                                          {vista.url ? (
                                            <img 
                                              src={vista.url} 
                                              alt={vista.nombre}
                                              className="w-10 h-10 object-cover rounded-md"
                                              onError={(e) => {
                                                e.currentTarget.src = '/placeholder.svg';
                                              }}
                                            />
                                          ) : (
                                            <span className="text-muted-foreground text-sm">Sin imagen</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={vista.activo ? "default" : "secondary"}>
                                            {vista.activo ? "Activo" : "Inactivo"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {new Date(vista.fecha_creacion).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end space-x-2">
                                            {activeTab === "activos" ? (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => openEditDialog(vista)}
                                                >
                                                  <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => openDeleteDialog(vista)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </>
                                            ) : (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openRestoreDialog(vista)}
                                              >
                                                <RotateCcw className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vista</DialogTitle>
            <DialogDescription>
              Modifica los datos de la vista
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input
                id="edit-nombre"
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Vista al mar, Vista a la montaña"
              />
            </div>

            <div>
              <Label htmlFor="edit-id_proyecto">Proyecto</Label>
              <Select
                value={formData.id_proyecto}
                onValueChange={(value) => setFormData(prev => ({ ...prev, id_proyecto: value }))}
              >
                <SelectTrigger id="edit-id_proyecto">
                  <SelectValue placeholder="Selecciona un proyecto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin proyecto</SelectItem>
                  {proyectos.map((proyecto) => (
                    <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                      {proyecto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <ImageUploadField
                label="Imagen de la Vista"
                value={formData.url}
                onChange={(url) => setFormData(prev => ({ ...prev, url }))}
                accept="image/*"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedVista(null);
                setFormData({ nombre: "", url: "", id_proyecto: "" });
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditVista} disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteVista}
        title="Eliminar Vista"
        description={`¿Estás seguro de que deseas eliminar la vista "${selectedVista?.nombre}"? Esta acción se puede deshacer desde la pestaña de eliminados.`}
        isLoading={isSubmitting}
      />

      {/* Restore Dialog */}
      <DeleteConfirmationDialog
        open={isRestoreDialogOpen}
        onOpenChange={setIsRestoreDialogOpen}
        onConfirm={handleRestoreVista}
        title="Restaurar Vista"
        description={`¿Estás seguro de que deseas restaurar la vista "${selectedVista?.nombre}"?`}
        isLoading={isSubmitting}
        actionType="restore"
      />
    </div>
  );
}