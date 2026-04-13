import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArchiveReason, archiveReasonLabels } from '@/data/cobranza/conciliacionData';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  onArchive: (reason: ArchiveReason, comment: string) => void;
}

export function ArchiveConciliacionModal({ open, onOpenChange, caseId, onArchive }: Props) {
  const [reason, setReason] = useState<ArchiveReason>('duplicado');
  const [comment, setComment] = useState('');

  const handleSubmit = useCallback(() => {
    if (!comment.trim()) return;
    onArchive(reason, comment.trim());
    setReason('duplicado');
    setComment('');
    onOpenChange(false);
  }, [reason, comment, onArchive, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Archivar caso {caseId}</DialogTitle>
          <DialogDescription className="text-[13px]">Esta acción moverá el caso a histórico. Deberá indicar un motivo obligatorio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Motivo de archivado *</label>
            <select value={reason} onChange={e => setReason(e.target.value as ArchiveReason)}
              className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]">
              {Object.entries(archiveReasonLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1 block">Comentario *</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Describa por qué se archiva este caso..."
              rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={!comment.trim()}>Archivar caso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
