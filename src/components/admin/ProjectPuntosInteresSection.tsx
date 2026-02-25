import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MapPin } from "lucide-react";

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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Puntos de Interés</h3>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Nombre</label>
          <Input placeholder="Ej: Playa Diamante" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="w-32">
          <label className="text-sm font-medium mb-1 block">Distancia (km)</label>
          <Input type="number" step="0.01" placeholder="1.5" value={distancia} onChange={e => setDistancia(e.target.value)} />
        </div>
        <Button type="button" onClick={handleAdd} disabled={isAdding} size="sm" className="mb-0.5">
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {puntos.length > 0 ? (
        <div className="space-y-2">
          {puntos.map((punto: any) => (
            <div key={punto.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{punto.nombre}</p>
                  <p className="text-xs text-muted-foreground">{punto.distancia_km < 1 ? `${(punto.distancia_km * 1000).toFixed(0)} m` : `${punto.distancia_km} km`}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(punto.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          No hay puntos de interés registrados
        </div>
      )}
    </div>
  );
};
