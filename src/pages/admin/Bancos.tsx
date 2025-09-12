import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, RotateCcw, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonForm } from "@/components/admin/PersonForm";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { BankAccountsSection } from "@/components/admin/BankAccountsSection";

type Banco = {
  id: number;
  nombre_legal: string;
  nombre_comercial?: string;
  email: string;
  telefono?: string;
  rfc?: string;
  activo: boolean;
  id_entidad_relacionada_rep_leg?: number;
  representante_legal_nombre?: string;
  numero_proyectos: number;
  entidad_relacionada_id: number;
  id_tipo_entidad: number;
  url_logo?: string;
};

export default function Bancos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Banco | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Banco | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [entityToRestore, setEntityToRestore] = useState<Banco | null>(null);
  const [selectedEntityForBankAccounts, setSelectedEntityForBankAccounts] = useState<Banco | null>(null);
  const [isBankAccountsDialogOpen, setIsBankAccountsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const itemsPerPage = 10;

  const fetchBancos = async (activo: boolean) => {
    const { data, error } = await supabase
      .from('personas')
      .select(`
        id,
        nombre_legal,
        nombre_comercial,
        email,
        telefono,
        rfc,
        activo,
        url_logo,
        id_entidad_relacionada_rep_leg,
        entidades_relacionadas!entidades_relacionadas_id_persona_fkey!inner (
          id,
          id_tipo_entidad,
          tipos_entidad!inner (
            id,
            nombre,
            padre
          )
        ),
        representante_legal:entidades_relacionadas!fk_personas_entidad_relacionada_rep_leg (
          id,
          personas!entidades_relacionadas_id_persona_fkey (
            id,
            nombre_legal
          )
        )
      `)
      .eq('activo', activo)
      .eq('tipo_persona', 'pm')
      .eq('entidades_relacionadas.activo', true)
      .neq('entidades_relacionadas.tipos_entidad.padre', 'c')
      .eq('entidades_relacionadas.tipos_entidad.nombre', 'Banco')
      .order('nombre_legal', { ascending: true });
    
    if (error) throw error;
    
    // Get project counts for each banco
    const bancoIds = (data || []).map(item => item.entidades_relacionadas[0]?.id).filter(Boolean);
    let projectCounts: { [key: number]: number } = {};
    
    if (bancoIds.length > 0) {
      const { data: projectData, error: projectError } = await supabase
        .from('entidades_relacionadas')
        .select('id, id_proyecto')
        .in('id', bancoIds)
        .not('id_proyecto', 'is', null)
        .eq('activo', true);
      
      if (!projectError && projectData) {
        projectCounts = projectData.reduce((acc, item) => {
          acc[item.id] = (acc[item.id] || 0) + 1;
          return acc;
        }, {} as { [key: number]: number });
      }
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      entidad_relacionada_id: item.entidades_relacionadas[0]?.id,
      id_tipo_entidad: item.entidades_relacionadas[0]?.id_tipo_entidad,
      nombre_legal: item.nombre_legal,
      nombre_comercial: item.nombre_comercial,
      email: item.email,
      telefono: item.telefono,
      rfc: item.rfc,
      activo: item.activo,
      id_entidad_relacionada_rep_leg: item.id_entidad_relacionada_rep_leg,
      representante_legal_nombre: item.representante_legal?.personas?.nombre_legal,
      numero_proyectos: projectCounts[item.entidades_relacionadas[0]?.id] || 0,
      url_logo: item.url_logo,
    })) as Banco[];
  };

  const { data: activeBancos = [], isLoading: loadingActive } = useQuery({
    queryKey: ['bancos', 'active'],
    queryFn: () => fetchBancos(true),
  });

  const { data: deletedBancos = [], isLoading: loadingDeleted } = useQuery({
    queryKey: ['bancos', 'deleted'],
    queryFn: () => fetchBancos(false),
  });

  const bancos = activeTab === 'active' ? activeBancos : deletedBancos;
  const filteredBancos = bancos.filter(banco => 
    banco.nombre_legal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    banco.nombre_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    banco.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredBancos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBancos = filteredBancos.slice(startIndex, endIndex);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { representativeId, ...cleanPersonData } = personData;
      
      const { data: personResult, error: personError } = await supabase
        .from('personas')
        .insert([{ ...cleanPersonData, tipo_persona: 'pm' }])
        .select()
        .single();
      
      if (personError) throw personError;
      
      // Get the Banco entity type ID
      const { data: tipoEntidad, error: tipoError } = await supabase
        .from('tipos_entidad')
        .select('id')
        .eq('nombre', 'Banco')
        .single();
      
      if (tipoError) throw tipoError;
      
      const { error: entidadError } = await supabase
        .from('entidades_relacionadas')
        .insert([{
          id_persona: personResult.id,
          id_tipo_entidad: tipoEntidad.id,
          activo: true
        }]);
      
      if (entidadError) throw entidadError;
      
      if (representativeId) {
        const { error: updateError } = await supabase
          .from('personas')
          .update({ id_entidad_relacionada_rep_leg: representativeId })
          .eq('id', personResult.id);
          
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      setIsNewDialogOpen(false);
      toast({
        title: "Éxito",
        description: "Banco creado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al crear el banco: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { representativeId, ...cleanPersonData } = personData;
      
      const { error: updateError } = await supabase
        .from('personas')
        .update(cleanPersonData)
        .eq('id', editingEntity?.id);
      
      if (updateError) throw updateError;
      
      if (representativeId !== undefined) {
        const { error: repError } = await supabase
          .from('personas')
          .update({ id_entidad_relacionada_rep_leg: representativeId || null })
          .eq('id', editingEntity?.id);
          
        if (repError) throw repError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      setIsEditDialogOpen(false);
      setEditingEntity(null);
      toast({
        title: "Éxito",
        description: "Banco actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al actualizar el banco: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('personas')
        .update({ activo: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      setDeleteDialogOpen(false);
      setEntityToDelete(null);
      toast({
        title: "Éxito",
        description: "Banco eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al eliminar el banco: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('personas')
        .update({ activo: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      setRestoreDialogOpen(false);
      setEntityToRestore(null);
      toast({
        title: "Éxito",
        description: "Banco restaurado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al restaurar el banco: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (banco: Banco) => {
    setEditingEntity(banco);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (banco: Banco) => {
    setEntityToDelete(banco);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (entityToDelete) {
      deleteMutation.mutate(entityToDelete.id);
    }
  };

  const handleRestore = (banco: Banco) => {
    setEntityToRestore(banco);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (entityToRestore) {
      restoreMutation.mutate(entityToRestore.id);
    }
  };

  function renderTable() {
    if (loadingActive || loadingDeleted) {
      return (
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="text-lg mb-2">Cargando...</div>
            <div className="text-muted-foreground">Obteniendo bancos</div>
          </div>
        </div>
      );
    }

    if (paginatedBancos.length === 0) {
      return (
        <div className="text-center py-8">
          <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="text-lg font-medium mb-2">
            {searchTerm ? "No se encontraron resultados" : "No hay bancos"}
          </div>
          <p className="text-muted-foreground">
            {searchTerm 
              ? "Intenta con otros términos de búsqueda" 
              : "Comienza agregando tu primer banco"
            }
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Razón Social</TableHead>
              <TableHead className="font-semibold">Nombre Comercial</TableHead>
              <TableHead className="font-semibold">RFC</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Teléfono</TableHead>
              <TableHead className="font-semibold">Representante Legal</TableHead>
              <TableHead className="font-semibold">Proyectos</TableHead>
              <TableHead className="text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBancos.map((banco) => (
              <TableRow 
                key={banco.id} 
                className={`hover:bg-muted/30 transition-colors ${!banco.activo ? 'opacity-60' : ''}`}
              >
                <TableCell className="font-medium">
                  {banco.nombre_legal}
                </TableCell>
                <TableCell>{banco.nombre_comercial || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{banco.rfc || '-'}</TableCell>
                <TableCell>{banco.email}</TableCell>
                <TableCell>{banco.telefono || '-'}</TableCell>
                <TableCell>{banco.representante_legal_nombre || '-'}</TableCell>
                <TableCell>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {banco.numero_proyectos}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    {banco.activo ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(banco)}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(banco)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(banco)}
                        className="hover:bg-green-50 hover:text-green-600"
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
    );
  }

  function renderPagination() {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-6 flex justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                }}
                className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(pageNum);
                    }}
                    isActive={currentPage === pageNum}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            <PaginationItem>
              <PaginationNext 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                }}
                className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Bancos
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Gestiona la información de los bancos
              </p>
            </div>
            <Button 
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:scale-105 font-semibold px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Banco
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs defaultValue="active" value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="active">Activos ({activeBancos.length})</TabsTrigger>
              <TabsTrigger value="deleted">Eliminados ({deletedBancos.length})</TabsTrigger>
            </TabsList>
            
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, RFC..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 border-border focus:ring-primary/20"
                />
              </div>
            </div>

            <TabsContent value="active" className="mt-6">
              {renderTable()}
              {renderPagination()}
            </TabsContent>

            <TabsContent value="deleted" className="mt-6">
              {renderTable()}
              {renderPagination()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Banco</DialogTitle>
          </DialogHeader>
          <PersonForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            onCancel={() => setIsNewDialogOpen(false)}
            entityType="banco"
            fixedEntityType={true}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Banco</DialogTitle>
          </DialogHeader>
          <PersonForm
            initialData={{
              ...editingEntity,
              representativeId: editingEntity?.id_entidad_relacionada_rep_leg
            }}
            onSubmit={(data) => updateMutation.mutate(data)}
            isLoading={updateMutation.isPending}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingEntity(null);
            }}
            entityType="banco"
            fixedEntityType={true}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Banco"
        description={`¿Estás seguro de que deseas eliminar el banco "${entityToDelete?.nombre_comercial || entityToDelete?.nombre_legal}"? Esta acción se puede revertir.`}
        isLoading={deleteMutation.isPending}
      />

      <DeleteConfirmationDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        onConfirm={handleConfirmRestore}
        title="Restaurar Banco"
        description={`¿Estás seguro de que deseas restaurar el banco "${entityToRestore?.nombre_comercial || entityToRestore?.nombre_legal}"?`}
        isLoading={restoreMutation.isPending}
        actionType="restore"
      />
    </div>
  );
}