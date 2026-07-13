import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { PagoImpacto } from '@/hooks/useEliminarPago';

// Diálogo de eliminación de pago (soft delete). Pide un motivo obligatorio (auditoría) y
// bloquea la eliminación si el pago tiene factura de mantenimiento timbrada. El impacto
// (abonos que dejan de aplicarse / facturas) se precarga antes de abrir.
export function EliminarPagoDialog({
  open, onOpenChange, onConfirm, isLoading, impacto, encabezado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void;
  isLoading: boolean;
  impacto: PagoImpacto | null;
  // Texto del pago afectado, ej. "pago de $1,000.00 de Juan Pérez (CC-001480)".
  encabezado?: string;
}) {
  const [motivo, setMotivo] = useState('');

  // Limpiar motivo cada vez que se abre.
  useEffect(() => {
    if (open) setMotivo('');
  }, [open]);

  const cargando = impacto === null;
  const bloqueadoPorFactura = !!impacto && impacto.facturas > 0;
  const motivoValido = motivo.trim().length >= 3;
  const puedeConfirmar = !isLoading && !cargando && !bloqueadoPorFactura && motivoValido;

  const abonosTxt = impacto
    ? impacto.aplicaciones === 1
      ? '1 abono dejará de aplicarse'
      : `${impacto.aplicaciones} abonos dejarán de aplicarse`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar pago</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">
            {encabezado ? `Vas a eliminar el ${encabezado}.` : 'Vas a eliminar este pago.'}{' '}
            El pago se marcará como eliminado y dejará de contar en los saldos y reportes;
            los acuerdos afectados se recalculan automáticamente. El historial (validaciones,
            CEP) se conserva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Impacto / estado de carga */}
          {cargando ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Revisando registros asociados…
            </div>
          ) : bloqueadoPorFactura ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-900/50 dark:bg-red-950/30">
              <Ban className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} />
              <p className="text-[13px] leading-relaxed text-red-800 dark:text-red-200">
                Este pago tiene {impacto.facturas === 1 ? 'una factura de mantenimiento timbrada' : `${impacto.facturas} facturas de mantenimiento timbradas`} asociada{impacto.facturas === 1 ? '' : 's'}.
                Cancela {impacto.facturas === 1 ? 'la factura (CFDI)' : 'las facturas (CFDI)'} antes de eliminar el pago.
              </p>
            </div>
          ) : (
            abonosTxt && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
                  {abonosTxt}. La eliminación queda registrada (quién, cuándo y motivo).
                </p>
              </div>
            )
          )}

          {/* Motivo obligatorio */}
          {!bloqueadoPorFactura && (
            <div className="space-y-1.5">
              <Label htmlFor="motivo-eliminar-pago" className="text-[12px] font-medium">
                Motivo de la eliminación <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="motivo-eliminar-pago"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. pago duplicado, monto incorrecto, registrado en la cuenta equivocada…"
                rows={3}
                disabled={isLoading || cargando}
                className="resize-none text-[13px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo.trim())}
            disabled={!puedeConfirmar}
          >
            {isLoading ? (<><Loader2 className="size-4 animate-spin" /> Eliminando…</>) : 'Eliminar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
