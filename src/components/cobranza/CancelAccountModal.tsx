import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Account } from '@/types/cobranza';

interface CancelAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
}

export function CancelAccountModal({ open, onOpenChange, account }: CancelAccountModalProps) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = reason && detail.trim().length >= 10;

  const handleConfirm = () => {
    if (!canSubmit) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Cuenta cancelada', {
        description: `${account.accountId} · Evento registrado en bitácora.`,
      });
      setReason('');
      setDetail('');
      onOpenChange(false);
    }, 800);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" strokeWidth={2} />
            </div>
            <AlertDialogTitle className="text-base">Cancelar Cuenta</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs">
            Esta acción cancelará la cuenta <span className="font-semibold text-foreground">{account.accountId}</span> de <span className="font-semibold text-foreground">{account.client.name}</span>. Se registrará en bitácora y no podrá revertirse fácilmente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo de cancelación *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar motivo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rescision_cliente">Rescisión por cliente</SelectItem>
                <SelectItem value="rescision_desarrollador">Rescisión por desarrollador</SelectItem>
                <SelectItem value="incumplimiento_pago">Incumplimiento de pago</SelectItem>
                <SelectItem value="fraude">Fraude / PLD</SelectItem>
                <SelectItem value="mutuo_acuerdo">Mutuo acuerdo</SelectItem>
                <SelectItem value="error_administrativo">Error administrativo</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Justificación detallada * <span className="text-muted-foreground">(mín. 10 caracteres)</span></Label>
            <Textarea value={detail} onChange={e => setDetail(e.target.value)} placeholder="Describe el motivo de la cancelación..." className="text-sm min-h-[80px] resize-none" />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="text-sm">Volver</AlertDialogCancel>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={!canSubmit || saving}>
            {saving ? 'Procesando...' : 'Confirmar cancelación'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
