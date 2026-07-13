import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin } from "lucide-react";
import { FormSection } from "@/components/admin/project-form/FormSection";
import { IconTooltip } from "@/components/admin/project-form/IconTooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProjectPuntosInteresSectionProps {
  projectId: number;
}

export const ProjectPuntosInteresSection = ({ projectId }: ProjectPuntosInteresSectionProps) => {
  const [nombre, setNombre] = useState("");
  const [distancia, setDistancia] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: puntos = [], isLoading } = useQuery({
    queryKey: ["puntos-interes", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("puntos_interes_proyecto")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAdd = async () => {
    if (!nombre.trim() || !distancia.trim()) {
      toast({ title: "Error", description: "Nombre y distancia son requeridos.", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      const { error } = await (supabase as any)
        .from("puntos_interes_proyecto")
        .insert({ id_proyecto: projectId, nombre: nombre.trim(), distancia_km: parseFloat(distancia) });
      if (error) throw error;
      toast({ title: "Punto agregado", description: "El punto de interés se agregó correctamente." });
      setNombre("");
      setDistancia("");
      queryClient.invalidateQueries({ queryKey: ["puntos-interes", projectId] });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo agregar el punto de interés.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await (supabase as any)
        .from("puntos_interes_proyecto")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Eliminado", description: "El punto de interés fue eliminado." });
      queryClient.invalidateQueries({ queryKey: ["puntos-interes", projectId] });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-4">Cargando puntos de interés...</div>;

  return (
    <FormSection title={`Puntos de Interés (${puntos.length})`} icon={MapPin}>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">Nombre</label>
          <Input placeholder="Ej: Playa Diamante" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="w-full space-y-1.5 sm:w-36">
          <label className="text-sm font-medium">Distancia (km)</label>
          <Input type="number" step="0.01" placeholder="1.5" value={distancia} onChange={e => setDistancia(e.target.value)} />
        </div>
        <Button type="button" onClick={handleAdd} disabled={isAdding} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {puntos.length > 0 ? (
        <div className="space-y-2">
          {puntos.map((punto: any) => (
            <div key={punto.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{punto.nombre}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{punto.distancia_km < 1 ? `${(punto.distancia_km * 1000).toFixed(0)} m` : `${punto.distancia_km} km`}</p>
                </div>
              </div>
              <AlertDialog>
                <IconTooltip label="Eliminar punto">
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar punto">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </IconTooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar punto de interés?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará "{punto.nombre}" de este proyecto.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(punto.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="text-sm">No hay puntos de interés registrados</p>
        </div>
      )}
    </FormSection>
  );
};
