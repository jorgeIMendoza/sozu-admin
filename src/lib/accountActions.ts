import {
  Eye, FileDown, Pencil, CreditCard, ShoppingBag, Ban,
} from 'lucide-react';
import type { Account } from '@/types/cobranza';

export type AccountActionId =
  | 'view'
  | 'downloadStatement'
  | 'edit'
  | 'addPayment'
  | 'downloadOffer'
  | 'cancel';

export interface AccountAction {
  id: AccountActionId;
  label: string;
  icon: React.ElementType;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function getAccountActions(account: Account): AccountAction[] {
  const isCancelled = account.priority === 'gray' && account.suggestedAction === 'Cuenta cancelada';

  return [
    {
      id: 'view',
      label: 'Ver expediente',
      icon: Eye,
    },
    {
      id: 'downloadStatement',
      label: 'Descargar Estado de Cuenta',
      icon: FileDown,
    },
    {
      id: 'edit',
      label: 'Editar Cuenta',
      icon: Pencil,
      disabled: isCancelled,
      disabledReason: 'Cuenta cancelada',
    },
    {
      id: 'addPayment',
      label: 'Agregar Pago Manual',
      icon: CreditCard,
      disabled: isCancelled,
      disabledReason: 'Cuenta cancelada',
    },
    {
      id: 'downloadOffer',
      label: 'Descargar Oferta Comercial',
      icon: ShoppingBag,
    },
    {
      id: 'cancel',
      label: 'Cancelar Cuenta',
      icon: Ban,
      destructive: true,
      disabled: isCancelled,
      disabledReason: 'Ya cancelada',
    },
  ];
}
