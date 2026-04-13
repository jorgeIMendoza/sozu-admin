import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  BitacoraEntry,
  BitacoraCategory,
  categoryLabels,
  eventTypeLabels,
  categoryEventTypes,
  resultOptions,
  addBitacoraEntry,
} from '@/data/cobranza/bitacoraData';

interface BitacoraEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onEntryAdded: (entry: BitacoraEntry) => void;
}

const executives = ['Luz Ochoa', 'Tomás Peterson'];

export function BitacoraEntryModal({ open, onOpenChange, accountId, onEntryAdded }: BitacoraEntryModalProps) {
  const [category, setCategory] = useState<string>('nota_interna');
  const [eventType, setEventType] = useState<string>('observacion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [executive, setExecutive] = useState(executives[0]);
  const [result, setResult] = useState('');

  const availableEventTypes = useMemo(() => categoryEventTypes[category as BitacoraCategory] || [], [category]);

  const isValid = title.trim() && description.trim();

  const resetForm = useCallback(() => {
    setCategory('nota_interna');
    setEventType('observacion');
    setTitle('');
    setDescription('');
    setExecutive(executives[0]);
    setResult('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    const entry: BitacoraEntry = {
      id: `bit-new-${Date.now()}`,
      accountId,
      category: category as BitacoraCategory,
      eventType: eventType as any,
      title: title.trim(),
      description: description.trim(),
      user: executive,
      date: new Date().toISOString(),
      origin: categoryLabels[category as BitacoraCategory] || category,
      result: result || undefined,
    };
    addBitacoraEntry(entry);
    onEntryAdded(entry);
    resetForm();
    onOpenChange(false);
  }, [accountId, category, eventType, title, description, executive, result, isValid, onEntryAdded, onOpenChange, resetForm]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  }, [onOpenChange, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Registrar evento en Bitácora</DialogTitle>
          <DialogDescription className="text-[13px]">Agrega una nueva entrada al historial de esta cuenta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Category */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Categoría *</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setEventType(categoryEventTypes[e.target.value as BitacoraCategory]?.[0] || ''); }}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]"
            >
              {Object.entries(categoryLabels).filter(([k]) => k !== 'sistema').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {/* Event type */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Tipo de evento *</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]"
            >
              {availableEventTypes.map(et => (
                <option key={et} value={et}>{eventTypeLabels[et] || et}</option>
              ))}
            </select>
          </div>
          {/* Title */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Título *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Seguimiento de saldo vencido"
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]"
            />
          </div>
          {/* Description */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Descripción *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalla lo ocurrido y el contexto relevante..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] resize-none"
            />
          </div>
          {/* Executive */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Ejecutivo *</label>
            <select
              value={executive}
              onChange={e => setExecutive(e.target.value)}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]"
            >
              {executives.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          {/* Result */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Resultado (opcional)</label>
            <select
              value={result}
              onChange={e => setResult(e.target.value)}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]"
            >
              <option value="">— Sin resultado —</option>
              {resultOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
