import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NewAmenityDialogProps {
  onAmenityCreated?: () => void;
}

export function NewAmenityDialog({ onAmenityCreated }: NewAmenityDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amenityName, setAmenityName] = useState("");

  const createAmenityMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('amenidades')
        .insert([{
          nombre: name,
          habilitar_asignar: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenidades'] });
      setAmenityName("");
      setOpen(false);
      onAmenityCreated?.();
      toast({ title: "Amenidad creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear amenidad", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amenityName.trim()) {
      toast({ title: "Por favor ingresa un nombre para la amenidad", variant: "destructive" });
      return;
    }
    createAmenityMutation.mutate(amenityName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Amenidad
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nueva Amenidad</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amenity-name">Nombre de la Amenidad</Label>
            <Input
              id="amenity-name"
              type="text"
              value={amenityName}
              onChange={(e) => setAmenityName(e.target.value)}
              placeholder="Ej. Piscina, Gimnasio, etc."
            />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createAmenityMutation.isPending}>
              {createAmenityMutation.isPending ? "Creando..." : "Crear Amenidad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}