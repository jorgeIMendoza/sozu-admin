import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, RotateCcw, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonForm } from "@/components/admin/PersonForm";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { BankAccountsSection } from "@/components/admin/BankAccountsSection";

type Inmobiliaria = {
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

export default function Inmobiliarias() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Inmobiliaria | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Inmobiliaria | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [entityToRestore, setEntityToRestore] = useState<Inmobiliaria | null>(null);
  const [selectedEntityForBankAccounts, setSelectedEntityForBankAccounts] = useState<Inmobiliaria | null>(null);
  const [isBankAccountsDialogOpen, setIsBankAccountsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchInmobiliarias = async (activo: boolean) => {
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
      .eq('entidades_relacionadas.tipos_entidad.padre', 'neq.c')
      .eq('entidades_relacionadas.tipos_entidad.nombre', 'Inmobiliaria')
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
    })) as (Inmobiliaria & { 
      entidad_relacionada_id: number; 
      id_tipo_entidad: number;
    })[];
  };

  const { data: activeInmobiliarias = [], isLoading: loadingActive } = useQuery({
    queryKey: ['inmobiliarias', 'active'],
    queryFn: () => fetchInmobiliarias(true),
  });

  const { data: deletedInmobiliarias = [], isLoading: loadingDeleted } = useQuery({
    queryKey: ['inmobiliarias', 'deleted'],
    queryFn: () => fetchInmobiliarias(false),
  });

  const inmobiliarias = activeTab === 'active' ? activeInmobiliarias : deletedInmobiliarias;
  const filteredInmobiliarias = inmobiliarias.filter(inmob => 
    inmob.nombre_legal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inmob.nombre_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inmob.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { representativeId, ...cleanPersonData } = personData;
      
      const { data: personResult, error: personError } = await supabase
        .from('personas')
        .insert([{ ...cleanPersonData, tipo_persona: 'pm' }])
        .select()
        .single();
      
      if (personError) throw personError;
      
      // Get the Inmobiliaria entity type ID
      const { data: tipoEntidad, error: tipoError } = await supabase
        .from('tipos_entidad')
        .select('id')
        .eq('nombre', 'Inmobiliaria')
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
      queryClient.invalidateQueries({ queryKey: ['inmobiliarias'] });
      setIsNewDialogOpen(false);
      toast({
        title: "Éxito",
        description: "Inmobiliaria creada correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Error al crear la inmobiliaria: ${error.message}`,
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
                Inmobiliarias
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Gestiona la información de las inmobiliarias
              </p>
            </div>
            <Button 
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:scale-105 font-semibold px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Inmobiliaria
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="active">Activos ({activeInmobiliarias.length})</TabsTrigger>
              <TabsTrigger value="deleted">Eliminados ({deletedInmobiliarias.length})</TabsTrigger>
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
                {filteredInmobiliarias.map((inmobiliaria) => (
                  <Card key={inmobiliaria.id} className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingEntity(inmobiliaria)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {inmobiliaria.nombre_comercial || inmobiliaria.nombre_legal}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {inmobiliaria.numero_proyectos} proyecto{inmobiliaria.numero_proyectos !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">{inmobiliaria.email}</p>
                        {inmobiliaria.telefono && (
                          <p className="text-muted-foreground">{inmobiliaria.telefono}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="deleted" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInmobiliarias.map((inmobiliaria) => (
                  <Card key={inmobiliaria.id} className="border-border opacity-60">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Building className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {inmobiliaria.nombre_comercial || inmobiliaria.nombre_legal}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {inmobiliaria.numero_proyectos} proyecto{inmobiliaria.numero_proyectos !== 1 ? 's' : ''}
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
            <DialogTitle>Nueva Inmobiliaria</DialogTitle>
          </DialogHeader>
          <PersonForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            onCancel={() => setIsNewDialogOpen(false)}
            entityType="inmobiliaria"
            fixedEntityType={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}