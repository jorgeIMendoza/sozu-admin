import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AccountFormTabs, mapAccountToFormData, type AccountFormData } from './AccountFormTabs';
import { ModificationReasonModal, type ModificationReason } from './ModificationReasonModal';
import { toast } from 'sonner';
import type { Account } from '@/types/cobranza';
import { chargeTypeLabels } from '@/types/cobranza';
import { projects, mockLegalEntities } from '@/data/mockData';

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
}

const criticalFieldKeys = [
  'finalPrice', 'listPrice', 'downPayment', 'paymentDay', 'clabe', 'buyerRfc',
  'chargeType', 'legalEntityId', 'initialAmount', 'purchaseDate', 'projectId',
];

const fieldLabels: Record<string, string> = {
  projectId: 'Proyecto', building: 'Edificio', unitNumber: 'Unidad', chargeType: 'Tipo de cobro',
  listPrice: 'Precio de lista', finalPrice: 'Precio final', purchaseDate: 'Fecha de compra',
  legalEntityId: 'Entidad Legal', buyerName: 'Comprador', buyerRfc: 'RFC comprador',
  buyerEmail: 'Email comprador', buyerPhone: 'Teléfono comprador',
  clabe: 'CLABE', bank: 'Banco', paymentDay: 'Día de pago', paymentPlan: 'Plan de pagos',
  downPayment: 'Enganche', monthlyPayments: 'Mensualidades', frequency: 'Frecuencia',
  firstDueDate: 'Primer vencimiento', assignedExecutive: 'Ejecutivo asignado',
  initialAmount: 'Monto apartado', initialOrigin: 'Origen del pago',
};

function resolveDisplayValue(key: string, value: string): string {
  if (key === 'projectId') return projects.find(p => p.id === value)?.name || value;
  if (key === 'legalEntityId') return mockLegalEntities.find(l => l.id === value)?.name || value;
  if (key === 'chargeType') return chargeTypeLabels[value as keyof typeof chargeTypeLabels] || value;
  if (key === 'paymentDay') return value ? `Día ${value}` : '';
  return value;
}

export function EditAccountModal({ open, onOpenChange, account }: EditAccountModalProps) {
  const originalData = useMemo(() => mapAccountToFormData(account), [account]);
  const [formData, setFormData] = useState<AccountFormData>(() => mapAccountToFormData(account));
  const [showReason, setShowReason] = useState(false);

  const changes = useMemo(() => {
    const result: { field: string; oldValue: string; newValue: string }[] = [];
    for (const key of Object.keys(originalData) as (keyof AccountFormData)[]) {
      if (key === 'installments' || key === 'documents') continue;
      const oldVal = String(originalData[key] ?? '');
      const newVal = String(formData[key] ?? '');
      if (oldVal !== newVal && fieldLabels[key]) {
        result.push({
          field: fieldLabels[key],
          oldValue: resolveDisplayValue(key, oldVal),
          newValue: resolveDisplayValue(key, newVal),
        });
      }
    }
    return result;
  }, [formData, originalData]);

  const handleSaveClick = () => {
    if (changes.length === 0) {
      toast.info('Sin cambios', { description: 'No se detectaron modificaciones.' });
      return;
    }
    setShowReason(true);
  };

  const handleConfirmSave = (reason: ModificationReason) => {
    setShowReason(false);
    toast.success('Cuenta actualizada', {
      description: `${account.accountId} · ${changes.length} campo(s) modificado(s). Registrado en Bitácora.`,
    });
    onOpenChange(false);
  };

  const proj = projects.find(p => p.id === formData.projectId);
  const le = mockLegalEntities.find(l => l.id === formData.legalEntityId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="text-base">Editar Cuenta de Cobranza</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {account.client.name} · {account.accountId}
            </DialogDescription>
          </DialogHeader>

          {/* Persistent summary */}
          <div className="px-6 py-2 border-b border-border bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 flex-wrap">
            <span className="font-mono text-foreground">{account.accountId}</span>
            {proj && <span>{proj.name}</span>}
            <span>{account.unitNumber}</span>
            {le && <span>{le.name}</span>}
            <span>{chargeTypeLabels[account.chargeType]}</span>
            <span>Ejec: {formData.assignedExecutive}</span>
            {changes.length > 0 && (
              <span className="ml-auto text-warning font-medium">{changes.length} campo(s) modificado(s)</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AccountFormTabs data={formData} onChange={setFormData} mode="edit" criticalFields={criticalFieldKeys} />
          </div>

          <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-background">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveClick}>Guardar cambios</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModificationReasonModal
        open={showReason}
        onOpenChange={setShowReason}
        changes={changes}
        onConfirm={handleConfirmSave}
      />
    </>
  );
}
