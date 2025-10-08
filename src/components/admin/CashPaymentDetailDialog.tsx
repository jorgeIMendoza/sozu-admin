import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CashPaymentDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cashLimit: number;
  cashPaid: number;
  cashRemaining: number;
  cashPercentage: number;
}

export function CashPaymentDetailDialog({
  isOpen,
  onClose,
  cashLimit,
  cashPaid,
  cashRemaining,
  cashPercentage
}: CashPaymentDetailDialogProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Detalle de Pagos en Efectivo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Límite de efectivo:</span>
              <span className="font-semibold text-lg">{formatCurrency(cashLimit)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pagado en efectivo:</span>
              <span className="font-semibold text-lg text-blue-600">{formatCurrency(cashPaid)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Aún permitido:</span>
              <span className="font-semibold text-lg text-green-600">{formatCurrency(cashRemaining)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Porcentaje utilizado:</span>
              <span className={`font-semibold ${
                cashPercentage >= 85 ? 'text-red-600' :
                cashPercentage >= 75 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {cashPercentage.toFixed(2)}%
              </span>
            </div>
            <Progress 
              value={cashPercentage} 
              className="h-3"
            />
            {cashPercentage >= 85 && (
              <p className="text-sm text-red-600 font-medium">
                ⚠️ Límite de efectivo casi alcanzado
              </p>
            )}
            {cashPercentage >= 75 && cashPercentage < 85 && (
              <p className="text-sm text-yellow-600 font-medium">
                ⚠️ Acercándose al límite de efectivo
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
