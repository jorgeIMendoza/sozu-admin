import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEtapasPorTipoAsunto } from '../queries/useEtapasPorTipoAsunto';
import { useCambiarEtapaAsunto } from '../hooks/useCambiarEtapaAsunto';
import { JuridicoServiceError, normalizeJuridicoError } from '../services/errors';

function mensajeJuridicoError(e: JuridicoServiceError): string {
  if (e.code === 'JUR-0017') return 'La etapa seleccionada no existe o está inactiva.';
  if (e.code === 'JUR-0018') return 'Esa etapa no corresponde al tipo de asunto de este expediente.';
  if (e.code === 'JUR-0019') return 'El asunto ya se encuentra en esa etapa.';
  if (e.code === 'JUR-0020') return 'Esta etapa es terminal — el asunto no puede transicionar más.';
  return e.message;
}

interface CambiarEtapaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idAsunto: string;
  idTipoAsunto: string;
  etapaActualId: string | null;
  etapaEsTerminal: boolean;
  /** Si true, omite el botón "Omitir por ahora" (flujo obligatorio post-creación). */
  requerido?: boolean;
  onCambiada?: () => void;
}

export function CambiarEtapaDialog({
  open,
  onOpenChange,
  idAsunto,
  idTipoAsunto,
  etapaActualId,
  etapaEsTerminal,
  requerido = false,
  onCambiada,
}: CambiarEtapaDialogProps) {
  const [idEtapaNueva, setIdEtapaNueva] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const { toast } = useToast();
  const { data: etapas = [], isLoading: loadingEtapas } = useEtapasPorTipoAsunto(idTipoAsunto);
  const cambiarEtapa = useCambiarEtapaAsunto();

  const opciones = etapas.filter((e) => e.id !== etapaActualId);

  const handleSubmit = async () => {
    if (!idEtapaNueva || !descripcion.trim()) return;
    try {
      await cambiarEtapa.mutateAsync({ idAsunto, idEtapaNueva, descripcion: descripcion.trim() });
      toast({ title: 'Etapa actualizada', description: 'El asunto cambió de etapa correctamente.' });
      setIdEtapaNueva('');
      setDescripcion('');
      onCambiada?.();
      onOpenChange(false);
    } catch (err) {
      const e = err instanceof JuridicoServiceError ? err : normalizeJuridicoError(err);
      toast({ title: 'No se pudo cambiar la etapa', description: mensajeJuridicoError(e), variant: 'destructive' });
    }
  };

  if (etapaEsTerminal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etapa terminal</DialogTitle>
            <DialogDescription>
              Este asunto ya está en una etapa terminal — no puede transicionar a otra etapa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{requerido ? 'Asignar etapa inicial' : 'Cambiar etapa'}</DialogTitle>
          <DialogDescription>
            {requerido
              ? 'El expediente se creó sin etapa asignada. Selecciona la etapa inicial del proceso.'
              : 'Selecciona la nueva etapa del asunto y describe el motivo del cambio.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Etapa</label>
            <Select value={idEtapaNueva} onValueChange={setIdEtapaNueva} disabled={loadingEtapas}>
              <SelectTrigger>
                <SelectValue placeholder={loadingEtapas ? 'Cargando...' : 'Seleccionar etapa...'} />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción del cambio</label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Ej. Se presentó la demanda ante el juzgado."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!requerido && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cambiarEtapa.isPending}>
              Cancelar
            </Button>
          )}
          {requerido && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cambiarEtapa.isPending}>
              Omitir por ahora
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!idEtapaNueva || !descripcion.trim() || cambiarEtapa.isPending}
          >
            {cambiarEtapa.isPending ? 'Guardando...' : 'Guardar etapa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
