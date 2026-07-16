import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rolesToAdd: number;
  onConfirm: () => void;
}

export default function SyncCommissionsDialog({
  open, onOpenChange, rolesToAdd, onConfirm,
}: Props) {
  const noChanges = rolesToAdd === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Sincronizar roles y comisiones
          </DialogTitle>
          <DialogDescription>
            Esta acción actualizará los roles desde <strong>Roles y Sueldos</strong>, agregando
            al Motor de Comisiones las combinaciones canal×puesto que aún no existan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Roles nuevos a agregar</span>
            <Badge variant="outline">{rolesToAdd}</Badge>
          </div>

          {noChanges && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border px-3 py-4 justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No hay roles nuevos por agregar; todo está sincronizado.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={noChanges}>
            Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
