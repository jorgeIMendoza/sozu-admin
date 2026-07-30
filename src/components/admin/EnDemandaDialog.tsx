import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface EnDemandaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaCobranzaId: number;
  propiedadId?: number;
}

// Códigos SQLSTATE devueltos por public.crear_expediente_demanda (overload 3-param)
const RPC_ERROR_MESSAGES: Record<string, string> = {
  P0001: "Tu sesión no está activa. Recarga la página e inicia sesión nuevamente.",
  P0002: "Tu usuario no está registrado en el sistema.",
  P0003: "No tienes permiso para crear expedientes jurídicos.",
  P0004: "Faltan datos requeridos para crear el expediente.",
  P0005: "El estatus inicial del expediente no es válido.",
  P0007: "La cuenta no es la cuenta principal de esta propiedad o no está activa.",
  P0008: "Esta cuenta ya tiene un expediente activo. No se puede crear uno nuevo.",
};

export function EnDemandaDialog({
  isOpen,
  onClose,
  cuentaCobranzaId,
}: EnDemandaDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('crear_expediente_demanda', {
        p_id_cuenta_cobranza: cuentaCobranzaId,
        p_estatus_demanda:    'NOTIFICADO',
        p_observaciones:      null,
      });

      if (error) {
        console.error('crear_expediente_demanda network/rpc error:', error);
        toast({
          title: "Error",
          description: "No se pudo crear el expediente jurídico.",
          variant: "destructive",
        });
        return;
      }

      if (!data?.success) {
        const code = data?.code as string | undefined;
        console.error('crear_expediente_demanda returned failure:', data);
        toast({
          title: "No se pudo crear el expediente",
          description: RPC_ERROR_MESSAGES[code ?? ''] ?? data?.error ?? "Error inesperado al crear el expediente jurídico.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Propiedad en demanda",
        description: "La cuenta ha sido bloqueada y la propiedad marcada como 'En demanda'. Permanecerá restringida mientras el expediente jurídico esté activo.",
      });

      queryClient.invalidateQueries({ queryKey: ["cuenta_detalle", cuentaCobranzaId] });
      queryClient.invalidateQueries({ queryKey: ["propiedades"] });
      queryClient.invalidateQueries({ queryKey: ["demandas-rows"] });
      queryClient.invalidateQueries({ queryKey: ["app-juridico-demandas"] });
      onClose();
    } catch (error) {
      console.error('Error setting property as En demanda:', error);
      toast({
        title: "Error",
        description: "No se pudo marcar la propiedad como 'En demanda'",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Marcar como En Demanda
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-4">
            <p className="font-medium text-foreground">
              Esta acción tiene las siguientes consecuencias:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>La cuenta de cobranza quedará <span className="font-semibold text-amber-600">bloqueada</span> para cualquier modificación</li>
              <li>La propiedad <span className="font-semibold text-amber-600">no podrá reasignarse</span> a otra persona</li>
              <li>Este estado permanecerá mientras el expediente jurídico esté activo</li>
            </ul>
            <p className="text-sm mt-4">
              ¿Está seguro de que desea continuar?
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? "Procesando..." : "Confirmar En Demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
