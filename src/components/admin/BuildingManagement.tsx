import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Eye, Edit, Trash2, Layers, FileImage } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewBuildingDialog } from "./NewBuildingDialog";
import { EditBuildingDialog } from "./EditBuildingDialog";
import { ConfigureLevelsDialog } from "./ConfigureLevelsDialog";
import { PlanoArquitectonicoUpload } from "./PlanoArquitectonicoUpload";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { useToast } from "@/hooks/use-toast";

interface BuildingManagementProps {
  projectId: number;
}

export const BuildingManagement = ({ projectId }: BuildingManagementProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [configureLevelsBuilding, setConfigureLevelsBuilding] = useState<any>(null);
  const { toast } = useToast();

  const { data: buildings, isLoading, refetch } = useQuery({
    queryKey: ["project-buildings-simple", projectId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edificios")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("nombre");
      
      if (error) {
        console.error("Error fetching buildings:", error);
        throw error;
      }
      
      console.log("Buildings fetched:", data);
      return (data || []).map((building) => ({
        ...building,
        numero_pisos:
          typeof building.numero_pisos === "string"
            ? building.numero_pisos.trim()
            : building.numero_pisos,
      }));
    },
    enabled: !!projectId && projectId > 0,
  });

  const handleBuildingAdded = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const handleDeleteBuilding = async (buildingId: number) => {
    try {
      const { error } = await supabase
        .from("edificios")
        .update({ activo: false })
        .eq("id", buildingId);

      if (error) throw error;

      toast({
        title: "Edificio eliminado",
        description: "El edificio se ha eliminado exitosamente.",
      });

      handleBuildingAdded();
    } catch (error) {
      console.error("Error deleting building:", error);
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el edificio.",
        variant: "destructive",
      });
    }
  };

  const DeleteBuildingDialog = ({ building }: { building: any }) => {
    return (
      <AlertDialog>
        <IconTooltip label="Eliminar edificio">
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Eliminar edificio"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
        </IconTooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar edificio?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el edificio "<strong>{building.nombre}</strong>"? 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteBuilding(building.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const BuildingModelsDialog = ({ buildingId, buildingName }: { buildingId: number, buildingName: string }) => {
    const { data: models, isLoading: modelsLoading } = useQuery({
      queryKey: ["building-models", buildingId],
      queryFn: async () => {
        // First get the edificios_modelos relationships
        const { data: edificiosModelos, error: emError } = await supabase
          .from("edificios_modelos")
          .select("id_modelo")
          .eq("id_edificio", buildingId)
          .eq("activo", true);
        
        if (emError) {
          console.error("Error fetching edificios_modelos:", emError);
          throw emError;
        }

        if (!edificiosModelos || edificiosModelos.length === 0) {
          return [];
        }

        // Get the modelo IDs
        const modeloIds = edificiosModelos.map(em => em.id_modelo);

        // Then get the modelos details
        const { data: models, error: modelsError } = await supabase
          .from("modelos")
          .select("id, nombre, descripcion")
          .in("id", modeloIds)
          .eq("activo", true);
        
        if (modelsError) {
          console.error("Error fetching models:", modelsError);
          throw modelsError;
        }
        
        console.log("Models for building", buildingId, ":", models);
        return models || [];
      },
      enabled: !!buildingId,
    });

    const [planoModeloId, setPlanoModeloId] = useState<number | null>(null);

    return (
      <Dialog>
        <IconTooltip label="Ver modelos">
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver modelos">
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </IconTooltip>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modelos de {buildingName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {modelsLoading ? (
              <p>Cargando modelos...</p>
            ) : models && models.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {models.length} modelo{models.length !== 1 ? 's' : ''} asignado{models.length !== 1 ? 's' : ''}
                </p>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {models.map((model: any) => (
                      <Card key={model.id}>
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm">{model.nombre}</h4>
                          {model.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {model.descripcion}
                            </p>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={() => setPlanoModeloId(model.id)}
                          >
                            <FileImage className="h-3.5 w-3.5 mr-1" />
                            Planos Arquitectónicos
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <p className="text-muted-foreground">No hay modelos asignados a este edificio</p>
            )}
          </div>

          {/* Nested dialog for architectural plans */}
          <Dialog open={!!planoModeloId} onOpenChange={(open) => { if (!open) setPlanoModeloId(null); }}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Planos Arquitectónicos</DialogTitle>
              </DialogHeader>
              {planoModeloId && (
                <PlanoArquitectonicoUpload
                  currentUrl={null}
                  onUrlChange={() => {}}
                  modeloId={planoModeloId}
                  proyectoId={undefined}
                />
              )}
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-3 mb-3">
          <NewBuildingDialog
            projectId={projectId}
            onBuildingAdded={handleBuildingAdded}
          />
        </div>
        <div className="text-xs text-muted-foreground">Cargando edificios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3 mb-3">
        <NewBuildingDialog
          projectId={projectId}
          onBuildingAdded={handleBuildingAdded}
        />
      </div>

      {buildings && buildings.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground mb-3">
            {buildings.length} edificio{buildings.length !== 1 ? 's' : ''} encontrado{buildings.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
          {buildings.map((building) => (
            <div key={building.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{building.nombre}</h4>
                  {(building.numero_pisos || building.fecha_lanzamiento) && (
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {building.numero_pisos && <span className="inline-flex items-center gap-1 tabular-nums"><Layers className="h-3 w-3" />{building.numero_pisos} niveles</span>}
                      {building.fecha_lanzamiento && <span className="tabular-nums">{new Date(building.fecha_lanzamiento).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* ORDER: Niveles, Ver Modelos, Editar, Eliminar */}
                {Number(building.numero_pisos) > 0 && (
                  <IconTooltip label="Configurar niveles">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Configurar niveles"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfigureLevelsBuilding(building); }}>
                      <Layers className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                )}
                <BuildingModelsDialog buildingId={building.id} buildingName={building.nombre} />
                <EditBuildingDialog building={building} projectId={projectId} onBuildingUpdated={handleBuildingAdded} />
                <DeleteBuildingDialog building={building} />
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay edificios creados para este proyecto</p>
            <p className="text-sm text-muted-foreground mt-1">Agrega edificios para comenzar</p>
          </CardContent>
        </Card>
      )}

      {configureLevelsBuilding && (
        <ConfigureLevelsDialog
          open={!!configureLevelsBuilding}
          onOpenChange={(open) => { if (!open) setConfigureLevelsBuilding(null); }}
          building={configureLevelsBuilding}
        />
      )}
    </div>
  );
};