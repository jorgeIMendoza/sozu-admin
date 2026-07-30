import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTiposAsunto } from '../queries/useTiposAsunto';
import { useCrearAsunto } from '../hooks/useCrearAsunto';
import { JuridicoServiceError, normalizeJuridicoError, OrigenExpediente, PosicionSozu } from '../services/crearAsunto';
import { CambiarEtapaDialog } from './CambiarEtapaDialog';

const ORIGEN_OPTIONS: { value: OrigenExpediente; label: string }[] = [
  { value: 'SOZU_ACTORA', label: 'SOZU como actora' },
  { value: 'COMPRADOR_ACTOR', label: 'Comprador como actor' },
  { value: 'PROFECO', label: 'Queja ante PROFECO' },
];

const POSICION_OPTIONS: { value: PosicionSozu; label: string }[] = [
  { value: 'ACTOR', label: 'Actor' },
  { value: 'DEMANDADO', label: 'Demandado' },
  { value: 'PROMOVENTE', label: 'Promovente' },
  { value: 'PROVEEDOR', label: 'Proveedor' },
];

function mensajeJuridicoError(e: JuridicoServiceError): string {
  if (e.code === 'JUR-0029') return 'El expediente no existe.';
  if (e.code === 'JUR-0030') return 'El expediente ya no está activo — no se pueden agregar más asuntos.';
  if (e.code === 'JUR-0027') return 'Tu rol no tiene permisos para agregar asuntos.';
  if (e.code === 'JUR-0022') return 'Selecciona un origen válido.';
  if (e.code === 'JUR-0023') return 'Selecciona una posición SOZU válida.';
  if (e.code === 'JUR-0024') return 'El tipo de asunto seleccionado no existe o está inactivo.';
  return e.message;
}

interface ExpedienteContext {
  idExpediente: string;
  folioExpediente: string;
  unitCode: string;
  clienteName: string;
}

interface CrearAsuntoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expediente: ExpedienteContext;
  /** Se dispara con el idAsunto recién creado, después de asignarle etapa inicial. */
  onCreada?: (idAsunto: string) => void;
}

/**
 * T4 — agrega un asunto adicional a un expediente jurídico ACTIVO existente
 * (multiasunto por propiedad). No crea expediente ni bloquea cobranza — para eso ver
 * CrearExpedienteDialog.tsx. Mismo patrón visual y de encadenamiento a etapa inicial.
 */
export function CrearAsuntoDialog({ open, onOpenChange, expediente, onCreada }: CrearAsuntoDialogProps) {
  const [idTipoAsunto, setIdTipoAsunto] = useState('');
  const [origen, setOrigen] = useState<OrigenExpediente | ''>('');
  const [posicionSozu, setPosicionSozu] = useState<PosicionSozu | ''>('');
  const [creado, setCreado] = useState<{ idAsunto: string; folioAsunto: string } | null>(null);
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);

  const { toast } = useToast();
  const { data: tiposAsunto = [], isLoading: loadingTipos } = useTiposAsunto();
  const crearAsunto = useCrearAsunto();

  const resetForm = () => {
    setIdTipoAsunto('');
    setOrigen('');
    setPosicionSozu('');
    setCreado(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!idTipoAsunto || !origen || !posicionSozu) return;
    try {
      const result = await crearAsunto.mutateAsync({
        idExpediente: expediente.idExpediente,
        idTipoAsunto,
        origen,
        posicionSozu,
      });
      toast({
        title: 'Asunto creado',
        description: `Asunto ${result.folioAsunto} agregado al expediente ${result.folioExpediente}.`,
      });
      setCreado({ idAsunto: result.idAsunto, folioAsunto: result.folioAsunto });
      setEtapaDialogOpen(true);
    } catch (err) {
      const e = err instanceof JuridicoServiceError ? err : normalizeJuridicoError(err);
      toast({ title: 'No se pudo crear el asunto', description: mensajeJuridicoError(e), variant: 'destructive' });
    }
  };

  // Fase 2 del flujo: ya se creó el asunto, se pide la etapa inicial (T2) — mismo
  // encadenamiento que CrearExpedienteDialog usa para el asunto inicial de T3.
  if (creado) {
    return (
      <CambiarEtapaDialog
        open={etapaDialogOpen}
        onOpenChange={(v) => {
          setEtapaDialogOpen(v);
          if (!v) { onCreada?.(creado.idAsunto); handleClose(); }
        }}
        idAsunto={creado.idAsunto}
        idTipoAsunto={idTipoAsunto}
        etapaActualId={null}
        etapaEsTerminal={false}
        requerido
        onCambiada={() => { onCreada?.(creado.idAsunto); handleClose(); }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar asunto al expediente</DialogTitle>
          <DialogDescription>
            Crea un asunto adicional dentro del expediente {expediente.folioExpediente} ya
            existente — no crea un expediente nuevo ni vuelve a bloquear la cobranza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Expediente</div>
              <div className="font-medium">{expediente.folioExpediente}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Unidad</div>
              <div className="font-medium">{expediente.unitCode}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Cliente</div>
              <div className="font-medium">{expediente.clienteName}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de asunto</label>
            <Select value={idTipoAsunto} onValueChange={setIdTipoAsunto} disabled={loadingTipos}>
              <SelectTrigger>
                <SelectValue placeholder={loadingTipos ? 'Cargando...' : 'Seleccionar tipo de asunto...'} />
              </SelectTrigger>
              <SelectContent>
                {tiposAsunto.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Origen</label>
            <Select value={origen} onValueChange={(v) => setOrigen(v as OrigenExpediente)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar origen..." />
              </SelectTrigger>
              <SelectContent>
                {ORIGEN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Posición SOZU</label>
            <Select value={posicionSozu} onValueChange={(v) => setPosicionSozu(v as PosicionSozu)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar posición..." />
              </SelectTrigger>
              <SelectContent>
                {POSICION_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={crearAsunto.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!idTipoAsunto || !origen || !posicionSozu || crearAsunto.isPending}
          >
            {crearAsunto.isPending ? 'Creando...' : 'Crear asunto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
