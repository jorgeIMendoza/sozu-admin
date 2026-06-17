import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Edit, Trash2, Upload, Plus, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BulkUploadEstacionamientosDialog } from "@/components/admin/BulkUploadEstacionamientosDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditEstacionamientoDialog } from "@/components/admin/EditEstacionamientoDialog";
import { Combobox } from "@/components/ui/combobox";
import { highlightText } from "@/lib/highlightText";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { NoProjectAccess } from "@/components/admin/NoProjectAccess";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface Estacionamiento {
  id: number;
  nombre: string;
  m2: number;
  ubicacion: string;
  es_incluido: boolean;
  activo: boolean;
  tipo_nombre: string;
  proyecto_nombre: string;
  proyecto_id: number | null;
  id_propiedad: number | null;
  id_producto: number | null;
  numero_propiedad: string;
  id_tipo: number | null;
  precio_m2: number | null;
  precio_final: number | null;
  cuenta_cobranza_id: number | null;
}

// Folio de cuenta de cobranza de producto (bodega/estacionamiento) → CCP-000001
const formatCuentaProducto = (id: number): string => `CCP-${String(id).padStart(6, '0')}`;

// Helper para formatear moneda
const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Componente para mostrar precio final con badge
const PrecioFinalBadge = ({ value }: { value: number | null }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground">N/A</span>;
  
  const formattedValue = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  if (value === 0) {
    return (
      <div className="flex items-center gap-1">
        <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
          {formattedValue}
        </Badge>
        <span className="text-xs text-muted-foreground italic">(incluido con el depa)</span>
      </div>
    );
  }
  
  return (
    <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
      {formattedValue}
    </Badge>
  );
};

const Estacionamientos = () => {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("activos");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [proyectoFilter, setProyectoFilter] = useState("");
  const [cuentaFilter, setCuentaFilter] = useState("all"); // all | con | sin
  const [editingEstacionamiento, setEditingEstacionamiento] = useState<Estacionamiento | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination states
  const [currentPageActive, setCurrentPageActive] = useState(1);
  const [currentPageDeleted, setCurrentPageDeleted] = useState(1);
  const itemsPerPage = 50;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { registrarEliminacion, registrarRestauracion } = useActivityLogger();
  
  // Project access control
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: isLoadingAccess, hasNoAccess } = useProjectAccess();
  
  // Page permissions
  const { canCreate, canUpdate, canDelete, canApprove, isSuperAdmin } = usePagePermissions('/admin/estacionamientos');

  // Query para obtener estacionamientos activos
  const { data: activeData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['estacionamientos', 'active', currentPageActive, searchTerm, proyectoFilter, cuentaFilter, accessibleProjectIds, hasUnrestrictedAccess],
    queryFn: async () => {
      let query = supabase
        .from('estacionamientos')
        .select(`
          *,
          tipos_estacionamiento!estacionamientos_id_tipo_fkey(nombre),
          propiedades!estacionamientos_id_propiedad_fkey(
            numero_propiedad
          ),
          productos_servicios!estacionamientos_id_producto_fkey(
            precio_lista,
            id_proyecto,
            proyectos!productos_servicios_id_proyecto_fkey(id, nombre)
          )
        `, { count: 'exact' })
        .eq('activo', true)
        .order('id', { ascending: false });

      const { data: allData, error } = await query.range(0, 2000);
      
      if (error) throw error;

      // Cuenta de cobranza del producto: oferta activa que coincide en (propiedad + producto)
      // → cuenta_cobranza activa de esa oferta. id_producto es genérico, por eso se requiere ambos.
      const propIds = [...new Set(allData.map((i: any) => i.id_propiedad).filter(Boolean))];
      const prodIds = [...new Set(allData.map((i: any) => i.id_producto).filter(Boolean))];
      const cuentaByPair: Record<string, number> = {};
      if (propIds.length > 0 && prodIds.length > 0) {
        const { data: ofertasData } = await supabase
          .from('ofertas')
          .select('id, id_propiedad, id_producto')
          .in('id_propiedad', propIds)
          .in('id_producto', prodIds)
          .eq('activo', true)
          .range(0, 5000);
        const ofertaIds = (ofertasData || []).map((o: any) => o.id);
        let cuentaByOferta: Record<number, number> = {};
        if (ofertaIds.length > 0) {
          const { data: cuentasData } = await supabase
            .from('cuentas_cobranza')
            .select('id, id_oferta')
            .in('id_oferta', ofertaIds)
            .eq('activo', true)
            .range(0, 5000);
          for (const c of cuentasData || []) cuentaByOferta[c.id_oferta] = c.id;
        }
        for (const o of ofertasData || []) {
          if (cuentaByOferta[o.id]) cuentaByPair[`${o.id_propiedad}-${o.id_producto}`] = cuentaByOferta[o.id];
        }
      }

      const enrichedData = allData.map((item: any) => {
        // Proyecto se obtiene desde el producto (id_producto → productos_servicios.id_proyecto),
        // no desde la propiedad: un estacionamiento puede no tener propiedad asignada y aun así pertenecer a un proyecto.
        const precioM2 = item.productos_servicios?.precio_lista ?? null;
        const precioFinal = precioM2 !== null ? Number(item.m2 || 0) * Number(precioM2) : null;
        return {
          id: item.id,
          nombre: item.nombre,
          m2: item.m2,
          ubicacion: item.ubicacion,
          es_incluido: item.es_incluido,
          activo: item.activo,
          tipo_nombre: item.tipos_estacionamiento?.nombre || 'N/A',
          proyecto_nombre: item.productos_servicios?.proyectos?.nombre || 'N/A',
          proyecto_id: item.productos_servicios?.id_proyecto || item.productos_servicios?.proyectos?.id || null,
          id_propiedad: item.id_propiedad ?? null,
          id_producto: item.id_producto ?? null,
          numero_propiedad: item.propiedades?.numero_propiedad || 'N/A',
          id_tipo: item.id_tipo,
          precio_m2: precioM2,
          precio_final: precioFinal,
          cuenta_cobranza_id: cuentaByPair[`${item.id_propiedad}-${item.id_producto}`] ?? null
        };
      });

      // Filter by project access
      let filteredData = enrichedData;
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        filteredData = filteredData.filter(item => 
          item.proyecto_id && accessibleProjectIds.includes(item.proyecto_id)
        );
      } else if (!hasUnrestrictedAccess && accessibleProjectIds.length === 0) {
        filteredData = [];
      }

      if (searchTerm) {
        filteredData = filteredData.filter(item => {
          const matchesNombre = item.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesNumero = item.numero_propiedad?.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesNombre || matchesNumero;
        });
      }

      if (proyectoFilter && proyectoFilter !== "all") {
        filteredData = filteredData.filter(item => item.proyecto_nombre === proyectoFilter);
      }

      if (cuentaFilter === "con") {
        filteredData = filteredData.filter(item => item.cuenta_cobranza_id);
      } else if (cuentaFilter === "sin") {
        filteredData = filteredData.filter(item => !item.cuenta_cobranza_id);
      }

      const from = (currentPageActive - 1) * itemsPerPage;
      const to = from + itemsPerPage;
      const paginatedData = filteredData.slice(from, to);

      return {
        items: paginatedData,
        count: filteredData.length
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isLoadingAccess,
  });

  // Query para obtener estacionamientos eliminados
  const { data: deletedData, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ['estacionamientos', 'deleted', currentPageDeleted, searchTerm, proyectoFilter, cuentaFilter, accessibleProjectIds, hasUnrestrictedAccess],
    queryFn: async () => {
      let query = supabase
        .from('estacionamientos')
        .select(`
          *,
          tipos_estacionamiento!estacionamientos_id_tipo_fkey(nombre),
          propiedades!estacionamientos_id_propiedad_fkey(
            numero_propiedad
          ),
          productos_servicios!estacionamientos_id_producto_fkey(
            precio_lista,
            id_proyecto,
            proyectos!productos_servicios_id_proyecto_fkey(id, nombre)
          )
        `, { count: 'exact' })
        .eq('activo', false)
        .order('id', { ascending: false });

      const { data: allData, error } = await query.range(0, 2000);
      if (error) throw error;

      // Cuenta de cobranza del producto (ver query de activos).
      const propIds = [...new Set(allData.map((i: any) => i.id_propiedad).filter(Boolean))];
      const prodIds = [...new Set(allData.map((i: any) => i.id_producto).filter(Boolean))];
      const cuentaByPair: Record<string, number> = {};
      if (propIds.length > 0 && prodIds.length > 0) {
        const { data: ofertasData } = await supabase
          .from('ofertas')
          .select('id, id_propiedad, id_producto')
          .in('id_propiedad', propIds)
          .in('id_producto', prodIds)
          .eq('activo', true)
          .range(0, 5000);
        const ofertaIds = (ofertasData || []).map((o: any) => o.id);
        let cuentaByOferta: Record<number, number> = {};
        if (ofertaIds.length > 0) {
          const { data: cuentasData } = await supabase
            .from('cuentas_cobranza')
            .select('id, id_oferta')
            .in('id_oferta', ofertaIds)
            .eq('activo', true)
            .range(0, 5000);
          for (const c of cuentasData || []) cuentaByOferta[c.id_oferta] = c.id;
        }
        for (const o of ofertasData || []) {
          if (cuentaByOferta[o.id]) cuentaByPair[`${o.id_propiedad}-${o.id_producto}`] = cuentaByOferta[o.id];
        }
      }

      const enrichedData = allData.map((item: any) => {
        // Proyecto desde el producto, no desde la propiedad (ver query de activos).
        const precioM2 = item.productos_servicios?.precio_lista ?? null;
        const precioFinal = precioM2 !== null ? Number(item.m2 || 0) * Number(precioM2) : null;
        return {
          id: item.id, nombre: item.nombre, m2: item.m2, ubicacion: item.ubicacion,
          es_incluido: item.es_incluido, activo: item.activo,
          tipo_nombre: item.tipos_estacionamiento?.nombre || 'N/A',
          proyecto_nombre: item.productos_servicios?.proyectos?.nombre || 'N/A',
          proyecto_id: item.productos_servicios?.id_proyecto || item.productos_servicios?.proyectos?.id || null,
          id_propiedad: item.id_propiedad ?? null,
          id_producto: item.id_producto ?? null,
          numero_propiedad: item.propiedades?.numero_propiedad || 'N/A',
          id_tipo: item.id_tipo,
          precio_m2: precioM2,
          precio_final: precioFinal,
          cuenta_cobranza_id: cuentaByPair[`${item.id_propiedad}-${item.id_producto}`] ?? null
        };
      });

      // Filter by project access first
      let filteredData = enrichedData;
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        filteredData = filteredData.filter(item => item.proyecto_id && accessibleProjectIds.includes(item.proyecto_id));
      } else if (!hasUnrestrictedAccess && accessibleProjectIds.length === 0) {
        filteredData = [];
      }

      if (searchTerm) {
        filteredData = filteredData.filter(item => 
          item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.numero_propiedad?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (proyectoFilter && proyectoFilter !== "all") {
        filteredData = filteredData.filter(item => item.proyecto_nombre === proyectoFilter);
      }

      if (cuentaFilter === "con") {
        filteredData = filteredData.filter(item => item.cuenta_cobranza_id);
      } else if (cuentaFilter === "sin") {
        filteredData = filteredData.filter(item => !item.cuenta_cobranza_id);
      }

      const from = (currentPageDeleted - 1) * itemsPerPage;
      const paginatedData = filteredData.slice(from, from + itemsPerPage);

      return { items: paginatedData, count: filteredData.length };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isLoadingAccess,
  });

  const filteredEstacionamientos = activeTab === 'activos' ? activeData?.items || [] : deletedData?.items || [];
  const currentCount = activeTab === 'activos' ? activeData?.count || 0 : deletedData?.count || 0;
  const totalPages = Math.ceil(currentCount / itemsPerPage);
  const currentPage = activeTab === 'activos' ? currentPageActive : currentPageDeleted;
  const setCurrentPage = (page: number) => {
    if (activeTab === 'activos') {
      setCurrentPageActive(page);
    } else {
      setCurrentPageDeleted(page);
    }
  };
  const isLoading = isLoadingActive || isLoadingDeleted;

  // Totals for tabs
  const activosCount = activeData?.count || 0;
  const eliminadosCount = deletedData?.count || 0;

  // Query para obtener proyectos para el filtro (filtered by access)
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-filter', accessibleProjectIds],
    queryFn: async () => {
      let query = supabase
        .from('proyectos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      
      // Filter by accessible projects if user doesn't have unrestricted access
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        query = query.in('id', accessibleProjectIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    enabled: hasUnrestrictedAccess || accessibleProjectIds.length > 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Maintain focus on search input after re-render
  useEffect(() => {
    if (inputValue && searchInputRef.current && !isLoading) {
      searchInputRef.current.focus();
    }
  }, [isLoading, inputValue]);

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
      registrarEliminacion('estacionamiento', { id: estacionamientoId });

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

  const handleUpdate = async (id: number, data: Partial<Estacionamiento>) => {
    try {
      // Exclude readonly fields
      const { id: _, proyecto_nombre, numero_propiedad, tipo_nombre, activo, precio_m2, precio_final, ...updateData } = data;
      
      const { error } = await supabase
        .from('estacionamientos')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Estacionamiento actualizado",
        description: "Los cambios se han guardado correctamente.",
      });

      queryClient.invalidateQueries({ queryKey: ['estacionamientos'] });
      setEditingEstacionamiento(null);
    } catch (error) {
      console.error('Error updating estacionamiento:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estacionamiento.",
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
      registrarRestauracion('estacionamiento',
        { id: estacionamientoId, activo: false },
        { id: estacionamientoId, activo: true }
      );

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

  // Filtrado optimizado del lado del servidor con paginación

  if (isLoading || isLoadingAccess) {
    return <div className="flex justify-center items-center h-64">Cargando...</div>;
  }

  // Show no access message if user has no projects assigned
  if (hasNoAccess) {
    return <NoProjectAccess />
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
                  ref={searchInputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Proyecto</label>
              <Combobox
                value={proyectoFilter || "all"}
                onValueChange={setProyectoFilter}
                options={[
                  { value: "all", label: "Todos los proyectos" },
                  ...proyectos.map((proyecto) => ({
                    value: proyecto.nombre,
                    label: proyecto.nombre,
                  })),
                ]}
                placeholder="Seleccionar proyecto"
                searchPlaceholder="Buscar proyecto..."
                emptyText="No se encontró el proyecto"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta de cobranza</label>
              <Select value={cuentaFilter} onValueChange={setCuentaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="con">Con cuenta de cobranza</SelectItem>
                  <SelectItem value="sin">Sin cuenta de cobranza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activos">Estacionamientos Activos ({activosCount})</TabsTrigger>
          <TabsTrigger value="eliminados">Estacionamientos Eliminados ({eliminadosCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-4">
          <Card>
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
                      <TableHead>Precio por M2</TableHead>
                      <TableHead>Precio Final</TableHead>
                      <TableHead>Cuenta de Cobranza</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstacionamientos.map((estacionamiento) => (
                      <TableRow key={estacionamiento.id}>
                        <TableCell>{estacionamiento.proyecto_nombre}</TableCell>
                        <TableCell>{highlightText(estacionamiento.numero_propiedad || "", searchTerm)}</TableCell>
                        <TableCell>{highlightText(estacionamiento.nombre, searchTerm)}</TableCell>
                        <TableCell>{estacionamiento.tipo_nombre}</TableCell>
                        <TableCell>{estacionamiento.m2} m²</TableCell>
                        <TableCell>{formatCurrency(estacionamiento.precio_m2)}</TableCell>
                        <TableCell><PrecioFinalBadge value={estacionamiento.precio_final} /></TableCell>
                        <TableCell>
                          {estacionamiento.cuenta_cobranza_id ? (
                            <Link
                              to={`/admin/cuentas-cobranza/${estacionamiento.cuenta_cobranza_id}/detalle`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {formatCuentaProducto(estacionamiento.cuenta_cobranza_id)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{estacionamiento.ubicacion || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingEstacionamiento(estacionamiento)}
                            >
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

              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                      className="cursor-pointer"
                    />
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationNext 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className="cursor-pointer"
                    />
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eliminados" className="space-y-4">
          <Card>
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
                      <TableHead>Precio por M2</TableHead>
                      <TableHead>Precio Final</TableHead>
                      <TableHead>Cuenta de Cobranza</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstacionamientos.map((estacionamiento) => (
                      <TableRow key={estacionamiento.id}>
                        <TableCell>{estacionamiento.proyecto_nombre}</TableCell>
                        <TableCell>{highlightText(estacionamiento.numero_propiedad || "", searchTerm)}</TableCell>
                        <TableCell>{highlightText(estacionamiento.nombre, searchTerm)}</TableCell>
                        <TableCell>{estacionamiento.tipo_nombre}</TableCell>
                        <TableCell>{estacionamiento.m2} m²</TableCell>
                        <TableCell>{formatCurrency(estacionamiento.precio_m2)}</TableCell>
                        <TableCell>{formatCurrency(estacionamiento.precio_final)}</TableCell>
                        <TableCell>
                          {estacionamiento.cuenta_cobranza_id ? (
                            <Link
                              to={`/admin/cuentas-cobranza/${estacionamiento.cuenta_cobranza_id}/detalle`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {formatCuentaProducto(estacionamiento.cuenta_cobranza_id)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{estacionamiento.ubicacion || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Undo2 className="h-4 w-4" />
                                  Restaurar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Restaurar estacionamiento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción reactivará el estacionamiento.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleRestore(estacionamiento.id)}
                                    className="bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Restaurar
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

              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                      className="cursor-pointer"
                    />
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationNext 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className="cursor-pointer"
                    />
                  </PaginationContent>
                </Pagination>
              )}
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
      
      <EditEstacionamientoDialog
        estacionamiento={editingEstacionamiento}
        open={!!editingEstacionamiento}
        onClose={() => setEditingEstacionamiento(null)}
        onSave={handleUpdate}
      />
    </div>
  );
};

export default Estacionamientos;