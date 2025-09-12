import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, RotateCcw, Building2 } from "lucide-react";
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

type Desarrollador = {
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
};

export default function Desarrolladores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Desarrollador | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Desarrollador | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [entityToRestore, setEntityToRestore] = useState<Desarrollador | null>(null);
  const [selectedEntityForBankAccounts, setSelectedEntityForBankAccounts] = useState<Desarrollador | null>(null);
  const [isBankAccountsDialogOpen, setIsBankAccountsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const itemsPerPage = 25;

  const fetchDesarrolladores = async (activo: boolean) => {
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
      .eq('entidades_relacionadas.tipos_entidad.nombre', 'Desarrollador')
      .order('nombre_legal', { ascending: true });
    
    if (error) throw error;
    
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
      numero_proyectos: 0, // We'll fetch this separately if needed
    })) as (Desarrollador & { 
      entidad_relacionada_id: number; 
      id_tipo_entidad: number;
    })[];
  };

  const { data: activeDesarrolladores = [], isLoading: loadingActive } = useQuery({
    queryKey: ['desarrolladores', 'active'],
    queryFn: () => fetchDesarrolladores(true),
  });

  const { data: deletedDesarrolladores = [], isLoading: loadingDeleted } = useQuery({
    queryKey: ['desarrolladores', 'deleted'],
    queryFn: () => fetchDesarrolladores(false),
  });

  const desarrolladores = activeTab === 'active' ? activeDesarrolladores : deletedDesarrolladores;
  const filteredDesarrolladores = desarrolladores.filter(dev => 
    dev.nombre_legal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.nombre_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredDesarrolladores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDesarrolladores = filteredDesarrolladores.slice(startIndex, endIndex);

  // Reset to first page when changing tabs or search
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
      
      // Get the Desarrollador entity type ID
      const { data: tipoEntidad, error: tipoError } = await supabase
        .from('tipos_entidad')
        .select('id')
        .eq('nombre', 'Desarrollador')
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
      queryClient.invalidateQueries({ queryKey: ['desarrolladores'] });
      setIsNewDialogOpen(false);
      toast({
        title: "Éxito",
        description: "Desarrollador creado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al crear el desarrollador: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Desarrolladores
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Gestiona la información de los desarrolladores
              </p>
            </div>
            <Button 
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:scale-105 font-semibold px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Desarrollador
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="active">Activos ({activeDesarrolladores.length})</TabsTrigger>
              <TabsTrigger value="deleted">Eliminados ({deletedDesarrolladores.length})</TabsTrigger>
            </TabsList>
            
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, RFC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border focus:ring-primary/20"
                />
              </div>
            </div>

            <TabsContent value="active" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDesarrolladores.map((desarrollador) => (
                  <Card key={desarrollador.id} className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingEntity(desarrollador)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {desarrollador.nombre_comercial || desarrollador.nombre_legal}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {desarrollador.numero_proyectos} proyecto{desarrollador.numero_proyectos !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">{desarrollador.email}</p>
                        {desarrollador.telefono && (
                          <p className="text-muted-foreground">{desarrollador.telefono}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="deleted" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDesarrolladores.map((desarrollador) => (
                  <Card key={desarrollador.id} className="border-border opacity-60">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {desarrollador.nombre_comercial || desarrollador.nombre_legal}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {desarrollador.numero_proyectos} proyecto{desarrollador.numero_proyectos !== 1 ? 's' : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Desarrollador</DialogTitle>
          </DialogHeader>
          <PersonForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            onCancel={() => setIsNewDialogOpen(false)}
            entityType="desarrollador"
            fixedEntityType={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );

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

  function renderTable() {
    if (paginatedDesarrolladores.length === 0 && filteredDesarrolladores.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">
            {activeTab === 'active' ? 'No hay desarrolladores activos' : 'No hay desarrolladores eliminados'}
          </div>
          <p className="text-muted-foreground/80 mb-4">
            {activeTab === 'active' ? 'Agrega tu primer desarrollador para comenzar' : 'Los desarrolladores eliminados aparecerán aquí'}
          </p>
          {activeTab === 'active' && (
            <Button 
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Desarrollador
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground">Razón Social</TableHead>
              <TableHead className="font-semibold text-foreground">Nombre Comercial</TableHead>
              <TableHead className="font-semibold text-foreground">RFC</TableHead>
              <TableHead className="font-semibold text-foreground">Email</TableHead>
              <TableHead className="font-semibold text-foreground">Teléfono</TableHead>
              <TableHead className="font-semibold text-foreground">Representante Legal</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDesarrolladores.map((desarrollador) => (
              <TableRow key={desarrollador.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-foreground">
                  {desarrollador.nombre_legal}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {desarrollador.nombre_comercial || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {desarrollador.rfc || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {desarrollador.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {desarrollador.telefono || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {desarrollador.representante_legal_nombre || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {activeTab === 'active' ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingEntity(desarrollador)}
                          className="hover:bg-primary/10 hover:border-primary transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
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
}