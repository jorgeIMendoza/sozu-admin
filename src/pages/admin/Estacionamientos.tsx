import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Edit, Trash2, Upload, Plus, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BulkUploadEstacionamientosDialog } from "@/components/admin/BulkUploadEstacionamientosDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Estacionamiento {
  id: number;
  nombre: string;
  m2: number;
  ubicacion: string;
  es_incluido: boolean;
  activo: boolean;
  tipo_nombre: string;
  proyecto_nombre: string;
  numero_propiedad: string;
}

const Estacionamientos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("activos");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [proyectoFilter, setProyectoFilter] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query para obtener estacionamientos
  const { data: estacionamientos = [], isLoading } = useQuery({
    queryKey: ['estacionamientos', activeTab, searchTerm, proyectoFilter],
    queryFn: async () => {
      let query = supabase
        .from('estacionamientos')
        .select(`
          *,
          tipos_estacionamiento!inner(nombre),
          propiedades!inner(
            numero_propiedad,
            entidades_relacionadas!inner(
              proyectos!inner(nombre)
            )
          )
        `)
        .eq('activo', activeTab === 'activos');

      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,propiedades.numero_propiedad.ilike.%${searchTerm}%`);
      }

      if (proyectoFilter) {
        query = query.eq('propiedades.entidades_relacionadas.proyectos.nombre', proyectoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        m2: item.m2,
        ubicacion: item.ubicacion,
        es_incluido: item.es_incluido,
        activo: item.activo,
        tipo_nombre: item.tipos_estacionamiento?.nombre || 'N/A',
        proyecto_nombre: item.propiedades?.entidades_relacionadas?.proyectos?.nombre || 'N/A',
        numero_propiedad: item.propiedades?.numero_propiedad || 'N/A'
      }));
    },
  });

  // Query para obtener proyectos para el filtro
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proyectos')
        .select('nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (estacionamientoId: number) => {
    try {
      const { error } = await supabase
        .from('estacionamientos')
        .update({ activo: false })
        .eq('id', estacionamientoId);

      if (error) throw error;

      toast({
        title: "Estacionamiento eliminado",
        description: "El estacionamiento se ha marcado como inactivo.",
      });

      queryClient.invalidateQueries({ queryKey: ['estacionamientos'] });
    } catch (error) {
      console.error('Error deleting estacionamiento:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el estacionamiento.",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async (estacionamientoId: number) => {
    try {
      const { error } = await supabase
        .from('estacionamientos')
        .update({ activo: true })
        .eq('id', estacionamientoId);

      if (error) throw error;

      toast({
        title: "Estacionamiento restaurado",
        description: "El estacionamiento se ha reactivado.",
      });

      queryClient.invalidateQueries({ queryKey: ['estacionamientos'] });
    } catch (error) {
      console.error('Error restoring estacionamiento:', error);
      toast({
        title: "Error",
        description: "No se pudo restaurar el estacionamiento.",
        variant: "destructive",
      });
    }
  };

  const filteredEstacionamientos = estacionamientos.filter((estacionamiento) => {
    const matchesSearch = searchTerm === "" || 
      estacionamiento.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estacionamiento.numero_propiedad.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProyecto = proyectoFilter === "" || 
      estacionamiento.proyecto_nombre === proyectoFilter;

    return matchesSearch && matchesProyecto;
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Estacionamientos</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setBulkUploadOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Carga Masiva
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre o número de departamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Proyecto</label>
              <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proyectos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los proyectos</SelectItem>
                  {proyectos.map((proyecto) => (
                    <SelectItem key={proyecto.nombre} value={proyecto.nombre}>
                      {proyecto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="eliminados">Eliminados</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estacionamientos Activos ({filteredEstacionamientos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Número Departamento</TableHead>
                      <TableHead>Nombre Estacionamiento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>M2</TableHead>
                      <TableHead>Incluido</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstacionamientos.map((estacionamiento) => (
                      <TableRow key={estacionamiento.id}>
                        <TableCell>{estacionamiento.proyecto_nombre}</TableCell>
                        <TableCell>{estacionamiento.numero_propiedad}</TableCell>
                        <TableCell>{estacionamiento.nombre}</TableCell>
                        <TableCell>{estacionamiento.tipo_nombre}</TableCell>
                        <TableCell>{estacionamiento.m2} m²</TableCell>
                        <TableCell>
                          <Badge variant={estacionamiento.es_incluido ? "default" : "secondary"}>
                            {estacionamiento.es_incluido ? "Sí" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{estacionamiento.ubicacion || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar estacionamiento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción marcará el estacionamiento como inactivo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(estacionamiento.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eliminados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estacionamientos Eliminados ({filteredEstacionamientos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Número Departamento</TableHead>
                      <TableHead>Nombre Estacionamiento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>M2</TableHead>
                      <TableHead>Incluido</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstacionamientos.map((estacionamiento) => (
                      <TableRow key={estacionamiento.id}>
                        <TableCell>{estacionamiento.proyecto_nombre}</TableCell>
                        <TableCell>{estacionamiento.numero_propiedad}</TableCell>
                        <TableCell>{estacionamiento.nombre}</TableCell>
                        <TableCell>{estacionamiento.tipo_nombre}</TableCell>
                        <TableCell>{estacionamiento.m2} m²</TableCell>
                        <TableCell>
                          <Badge variant={estacionamiento.es_incluido ? "default" : "secondary"}>
                            {estacionamiento.es_incluido ? "Sí" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{estacionamiento.ubicacion || "N/A"}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleRestore(estacionamiento.id)}
                            className="gap-2"
                          >
                            <Undo2 className="h-4 w-4" />
                            Restaurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BulkUploadEstacionamientosDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['estacionamientos'] });
          setBulkUploadOpen(false);
        }}
      />
    </div>
  );
};

export default Estacionamientos;