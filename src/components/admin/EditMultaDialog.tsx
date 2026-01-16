import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface EditMultaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  multa: {
    id: number;
    monto: number;
    montoOriginal?: number;
    descripcion: string;
    pagosAplicados?: number;
  } | null;
  cuentaId: number;
}

export function EditMultaDialog({ open, onOpenChange, multa, cuentaId }: EditMultaDialogProps) {
  const [monto, setMonto] = useState(0); // Store as cents
  const [descripcion, setDescripcion] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pagosAplicados = multa?.pagosAplicados || 0;
  const montoOriginal = multa?.montoOriginal || multa?.monto || 0;
  const montoMinimo = pagosAplicados; // Can't set amount below what's already paid

  useEffect(() => {
    if (multa && open) {
      // Convert to cents for CurrencyInput
      setMonto(Math.round(montoOriginal * 100));
      setDescripcion(multa.descripcion || "");
    }
  }, [multa, open, montoOriginal]);

  const updateMultaMutation = useMutation({
    mutationFn: async ({ monto, descripcion }: { monto: number; descripcion: string }) => {
      if (!multa) throw new Error("No multa selected");

      const { error } = await supabase
        .from('multas')
        .update({
          monto,
          descripcion,
          es_pagada: monto <= pagosAplicados // Mark as paid if amount equals or is less than payments
        } as any)
        .eq('id', multa.id);
      
      if (error) throw error;
      return { monto, descripcion };
    },
    onSuccess: async () => {
      toast({
        title: "Multa actualizada",
        description: "La multa ha sido actualizada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["cuenta_detalle", cuentaId] });
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
    
    const montoDecimal = monto / 100; // Convert from cents
    
    if (montoDecimal <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (montoDecimal < montoMinimo) {
      toast({
        title: "Error",
        description: `El monto no puede ser menor a los pagos ya aplicados: $${montoMinimo.toLocaleString()}`,
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
      monto: montoDecimal, 
      descripcion: descripcion.trim()
    });
  };

  const handleClose = () => {
    setMonto(0);
    setDescripcion("");
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
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
            {pagosAplicados > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta multa tiene pagos aplicados por {formatCurrency(pagosAplicados)}. 
                  El nuevo monto no puede ser menor a esta cantidad.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monto" className="text-right">
                Monto *
              </Label>
              <div className="col-span-3">
                <CurrencyInput
                  id="monto"
                  value={monto}
                  onChange={setMonto}
                  required
                />
                {montoMinimo > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Monto mínimo: {formatCurrency(montoMinimo)}
                  </p>
                )}
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
              {updateMultaMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
