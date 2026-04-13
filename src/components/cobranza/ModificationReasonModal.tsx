import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { executives } from '@/data/cobranza/mockData';

export interface ModificationReason {
  type: string;
  observations: string;
  executive: string;
  timestamp: string;
}

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface ModificationReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: FieldChange[];
  onConfirm: (reason: ModificationReason) => void;
}

const modificationTypes = [
  'Corrección operativa',
  'Regularización',
  'Actualización de datos del cliente',
  'Ajuste de plan de pagos',
  'Actualización bancaria',
  'Corrección documental',
  'Otro',
];

export function ModificationReasonModal({ open, onOpenChange, changes, onConfirm }: ModificationReasonModalProps) {
  const [type, setType] = useState('');
  const [observations, setObservations] = useState('');
  const [executive, setExecutive] = useState('');

  const isValid = type && observations.length >= 10 && executive;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      type,
      observations,
      executive,
      timestamp: new Date().toISOString(),
    });
    setType('');
    setObservations('');
    setExecutive('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.75} />
            Motivo de modificación
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Toda modificación requiere justificación y quedará registrada en Bitácora.
          </DialogDescription>
        </DialogHeader>

        {changes.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-[140px] overflow-y-auto">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Campos modificados</p>
            <div className="space-y-1.5">
              {changes.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="font-medium text-foreground min-w-[120px]">{c.field}</span>
                  <span className="text-danger line-through">{c.oldValue || '—'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-success font-medium">{c.newValue || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de modificación *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
              <SelectContent>
                {modificationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observaciones detalladas * <span className="text-muted-foreground">(mín. 10 caracteres)</span></Label>
            <Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} className="text-sm resize-none" placeholder="Describa el motivo del cambio..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ejecutivo responsable *</Label>
            <Select value={executive} onValueChange={setExecutive}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar ejecutivo..." /></SelectTrigger>
              <SelectContent>
                {executives.map(ex => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!isValid}>Confirmar y guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
