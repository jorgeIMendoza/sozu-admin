import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export default function Vistas() {
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVista, setSelectedVista] = useState<Vista | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchVistas();
  }, []);

  const fetchVistas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vistas')
        .select('*')
        .eq('activo', true)
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
          activo: true
        }])
        .select()
        .single();

      if (error) throw error;

      setVistas(prev => [...prev, data]);
      setIsCreateDialogOpen(false);
      setFormData({ nombre: "" });
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
      const { data, error } = await supabase
        .from('vistas')
        .update({
          nombre: formData.nombre.trim(),
        })
        .eq('id', selectedVista.id)
        .select()
        .single();

      if (error) throw error;

      setVistas(prev => prev.map(vista => 
        vista.id === selectedVista.id ? data : vista
      ));
      setIsEditDialogOpen(false);
      setSelectedVista(null);
      setFormData({ nombre: "" });
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

      setVistas(prev => prev.filter(vista => vista.id !== selectedVista.id));
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

  const openEditDialog = (vista: Vista) => {
    setSelectedVista(vista);
    setFormData({ nombre: vista.nombre });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (vista: Vista) => {
    setSelectedVista(vista);
    setIsDeleteDialogOpen(true);
  };

  const filteredVistas = vistas.filter(vista =>
    vista.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setFormData({ nombre: "" });
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Vistas ({filteredVistas.length})
          </CardTitle>
          <CardDescription>
            Lista de todas las vistas disponibles en el sistema
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
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVistas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No se encontraron vistas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVistas.map((vista) => (
                    <TableRow key={vista.id}>
                      <TableCell className="font-medium">{vista.id}</TableCell>
                      <TableCell>{vista.nombre}</TableCell>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedVista(null);
                setFormData({ nombre: "" });
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
        description={`¿Estás seguro de que deseas eliminar la vista "${selectedVista?.nombre}"? Esta acción no se puede deshacer.`}
        isLoading={isSubmitting}
      />
    </div>
  );
}