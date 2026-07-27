import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTiposAsunto } from '../queries/useTiposAsunto';
import { useCrearExpedienteYBloquearCobranza } from '../hooks/useCrearExpedienteYBloquearCobranza';
import { JuridicoServiceError, normalizeJuridicoError, OrigenExpediente, PosicionSozu } from '../services/crearExpedienteYBloquearCobranza';
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
  if (e.code === 'JUR-0025') return 'Ya existe un expediente ACTIVO para esta propiedad. Ciérralo antes de crear uno nuevo.';
  if (e.code === 'JUR-0027') return 'Tu rol no tiene permisos para crear expedientes jurídicos.';
  if (e.code === 'JUR-0028') return 'La cuenta de cobranza no es válida, está inactiva o no es la cuenta principal de la propiedad.';
  if (e.code === 'JUR-0022') return 'Selecciona un origen válido.';
  if (e.code === 'JUR-0023') return 'Selecciona una posición SOZU válida.';
  if (e.code === 'JUR-0024') return 'El tipo de asunto seleccionado no existe o está inactivo.';
  return e.message;
}

interface RowContext {
  accountId: number;
  accountCode: string;
  proyectoId: number | null;
  proyectoNombre: string;
  unitCode: string;
  clienteName: string;
}

interface CrearExpedienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RowContext;
}

export function CrearExpedienteDialog({ open, onOpenChange, row }: CrearExpedienteDialogProps) {
  const [idTipoAsunto, setIdTipoAsunto] = useState('');
  const [origen, setOrigen] = useState<OrigenExpediente | ''>('');
  const [posicionSozu, setPosicionSozu] = useState<PosicionSozu | ''>('');
  const [creado, setCreado] = useState<{ idAsunto: string; folioExpediente: string; folioAsunto: string } | null>(null);
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);

  const { toast } = useToast();
  const { data: tiposAsunto = [], isLoading: loadingTipos } = useTiposAsunto();
  const crearExpediente = useCrearExpedienteYBloquearCobranza();

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
    if (!row.proyectoId || !idTipoAsunto || !origen || !posicionSozu) return;
    try {
      const result = await crearExpediente.mutateAsync({
        idCuentaCobranza: row.accountId,
        idProyecto: row.proyectoId,
        idTipoAsunto,
        origen,
        posicionSozu,
      });
      toast({
        title: 'Expediente creado',
        description: `Folio ${result.folioExpediente} / Asunto ${result.folioAsunto}. La propiedad quedó bloqueada para cobranza.`,
      });
      setCreado({
        idAsunto: result.idAsunto,
        folioExpediente: result.folioExpediente,
        folioAsunto: result.folioAsunto,
      });
      setEtapaDialogOpen(true);
    } catch (err) {
      const e = err instanceof JuridicoServiceError ? err : normalizeJuridicoError(err);
      toast({ title: 'No se pudo crear el expediente', description: mensajeJuridicoError(e), variant: 'destructive' });
    }
  };

  // Fase 2 del flujo: ya se creó el expediente, se pide la etapa inicial (T2).
  if (creado) {
    return (
      <CambiarEtapaDialog
        open={etapaDialogOpen}
        onOpenChange={(v) => {
          setEtapaDialogOpen(v);
          if (!v) handleClose();
        }}
        idAsunto={creado.idAsunto}
        idTipoAsunto={idTipoAsunto}
        etapaActualId={null}
        etapaEsTerminal={false}
        requerido
        onCambiada={handleClose}
      />
    );
  }

  const faltaProyecto = !row.proyectoId;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear expediente jurídico</DialogTitle>
          <DialogDescription>
            Crea el expediente y asunto inicial en el nuevo esquema (Fase 2) y bloquea la
            cuenta de cobranza asociada.
          </DialogDescription>
        </DialogHeader>

        {faltaProyecto ? (
          <p className="text-sm text-destructive py-4">
            No se pudo determinar el proyecto de esta propiedad. No es posible crear el
            expediente desde aquí.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Cuenta</div>
                <div className="font-medium">{row.accountCode}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Proyecto</div>
                <div className="font-medium">{row.proyectoNombre}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Unidad</div>
                <div className="font-medium">{row.unitCode}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cliente</div>
                <div className="font-medium">{row.clienteName}</div>
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
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={crearExpediente.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={faltaProyecto || !idTipoAsunto || !origen || !posicionSozu || crearExpediente.isPending}
          >
            {crearExpediente.isPending ? 'Creando...' : 'Crear expediente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
