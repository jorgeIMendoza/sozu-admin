import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderOpen, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserProjectAccessDialogProps {
  userId: string;
  userName: string;
  userEmail: string;
}

interface Proyecto {
  id: number;
  nombre: string;
}

interface ProyectoAcceso {
  proyecto_id: number;
}

export function UserProjectAccessDialog({ userId, userName, userEmail }: UserProjectAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all active projects
  const { data: proyectos, isLoading: loadingProyectos } = useQuery({
    queryKey: ['proyectos-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Proyecto[];
    },
    enabled: open,
  });

  // Fetch user's current project access
  const { data: userAccess, isLoading: loadingAccess } = useQuery({
    queryKey: ['user-project-access', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proyectos_acceso')
        .select('proyecto_id')
        .eq('usuario_id', userId)
        .eq('activo', true);
      
      if (error) throw error;
      return data as ProyectoAcceso[];
    },
    enabled: open,
  });

  // Update selected projects when data loads
  useEffect(() => {
    if (userAccess) {
      setSelectedProjects(userAccess.map(a => a.proyecto_id));
    }
  }, [userAccess]);

  // Mutation to save access
  const saveAccessMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      // First, deactivate all current access
      const { error: deactivateError } = await supabase
        .from('proyectos_acceso')
        .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
        .eq('usuario_id', userId);
      
      if (deactivateError) throw deactivateError;

      // Then, upsert the new access
      if (projectIds.length > 0) {
        const accessRecords = projectIds.map(projectId => ({
          usuario_id: userId,
          proyecto_id: projectId,
          activo: true,
          fecha_actualizacion: new Date().toISOString(),
        }));

        // For each project, try to update existing or insert new
        for (const record of accessRecords) {
          const { data: existing } = await supabase
            .from('proyectos_acceso')
            .select('usuario_id')
            .eq('usuario_id', userId)
            .eq('proyecto_id', record.proyecto_id)
            .single();

          if (existing) {
            const { error } = await supabase
              .from('proyectos_acceso')
              .update({ activo: true, fecha_actualizacion: new Date().toISOString() })
              .eq('usuario_id', userId)
              .eq('proyecto_id', record.proyecto_id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('proyectos_acceso')
              .insert(record);
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Accesos actualizados correctamente');
      queryClient.invalidateQueries({ queryKey: ['user-project-access', userId] });
      setOpen(false);
    },
    onError: (error) => {
      console.error('Error saving access:', error);
      toast.error('Error al guardar los accesos');
    },
  });

  const handleProjectToggle = (projectId: number) => {
    setSelectedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSelectAll = () => {
    if (proyectos) {
      setSelectedProjects(proyectos.map(p => p.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedProjects([]);
  };

  const handleSave = () => {
    saveAccessMutation.mutate(selectedProjects);
  };

  const isLoading = loadingProyectos || loadingAccess;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Gestionar acceso a proyectos">
          <FolderOpen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acceso a Proyectos</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {userName} ({userEmail})
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Seleccionar todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Quitar todos
              </Button>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-3">
              <div className="space-y-3">
                {proyectos?.map((proyecto) => (
                  <div key={proyecto.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`project-${proyecto.id}`}
                      checked={selectedProjects.includes(proyecto.id)}
                      onCheckedChange={() => handleProjectToggle(proyecto.id)}
                    />
                    <Label 
                      htmlFor={`project-${proyecto.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {proyecto.nombre}
                    </Label>
                  </div>
                ))}
                {proyectos?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay proyectos disponibles
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedProjects.length} proyecto(s) seleccionado(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saveAccessMutation.isPending}
                >
                  {saveAccessMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
