import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Multa {
  id: number;
  monto: number;
  descripcion: string;
  fecha_creacion: string;
}

interface EditMultaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  multa: Multa | null;
  cuentaId: number;
}

export function EditMultaDialog({ open, onOpenChange, multa, cuentaId }: EditMultaDialogProps) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (multa) {
      setMonto(multa.monto.toString());
      setDescripcion(multa.descripcion);
    }
  }, [multa]);

  const updateMultaMutation = useMutation({
    mutationFn: async ({ id, monto, descripcion }: { id: number; monto: number; descripcion: string }) => {
      const { error } = await supabase
        .from('multas')
        .update({ monto, descripcion })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Multa actualizada",
        description: "La multa ha sido actualizada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["acuerdos_pago", cuentaId] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la multa",
        variant: "destructive",
      });
      console.error('Error updating multa:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!multa) return;

    const montoNumber = parseFloat(monto);
    if (isNaN(montoNumber) || montoNumber <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser un número válido mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (!descripcion.trim()) {
      toast({
        title: "Error",
        description: "La descripción es requerida",
        variant: "destructive",
      });
      return;
    }

    updateMultaMutation.mutate({ 
      id: multa.id, 
      monto: montoNumber, 
      descripcion: descripcion.trim() 
    });
  };

  const handleClose = () => {
    setMonto("");
    setDescripcion("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Multa</DialogTitle>
          <DialogDescription>
            Modifique los detalles de la multa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monto" className="text-right">
                Monto *
              </Label>
              <div className="col-span-3">
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="descripcion" className="text-right pt-2">
                Descripción *
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="descripcion"
                  placeholder="Motivo de la multa..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={updateMultaMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMultaMutation.isPending}>
              {updateMultaMutation.isPending ? "Actualizando..." : "Actualizar Multa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}