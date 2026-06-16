import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Channel, Scenario } from '@/lib/portal-estructura-comisiones/types/simulator';

export interface SyncDiffRow {
  channelId: string;
  channelName: string;
  active: boolean;
  field: 'Ext %' | 'Mínimo %' | 'Máximo %';
  current: number;
  next: number;
  manuallyModified: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scenario: Scenario;
  channels: Channel[];
  rolesToAdd: number;
  onConfirm: (replaceManual: boolean) => void;
}

export default function SyncCommissionsDialog({
  open, onOpenChange, scenario, channels, rolesToAdd, onConfirm,
}: Props) {
  const { rows, hasManual, inactiveChanges } = useMemo(() => {
    const r: SyncDiffRow[] = [];
    let hasManual = false;
    let inactiveChanges = 0;
    channels.forEach(ch => {
      const override = scenario.channelExternalPcts[ch.id];
      const currentExt = override ?? ch.externalCommissionPct;
      const nextExt = ch.externalCommissionPct;
      const manuallyModified = override !== undefined && override !== ch.externalCommissionPct;
      if (currentExt !== nextExt) {
        if (!ch.active) inactiveChanges++;
        else {
          r.push({
            channelId: ch.id,
            channelName: ch.name,
            active: ch.active,
            field: 'Ext %',
            current: currentExt,
            next: nextExt,
            manuallyModified,
          });
          if (manuallyModified) hasManual = true;
        }
      }
    });
    return { rows: r, hasManual, inactiveChanges };
  }, [scenario, channels]);

  const noChanges = rows.length === 0 && rolesToAdd === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Sincronizar roles y comisiones
          </DialogTitle>
          <DialogDescription>
            Esta acción actualizará los roles desde <strong>Roles y Sueldos</strong> y también
            sincronizará los porcentajes de comisión desde <strong>Canales de Venta</strong> para
            el escenario <strong>{scenario.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Roles nuevos a agregar al escenario</span>
            <Badge variant="outline">{rolesToAdd}</Badge>
          </div>

          {inactiveChanges > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {inactiveChanges} canal(es) inactivo(s) tienen cambios pendientes que no se aplicarán.
              </span>
            </div>
          )}

          {hasManual && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Existen valores modificados manualmente en este escenario. Confirma si deseas
                reemplazarlos con los valores de Canales de Venta.
              </span>
            </div>
          )}

          {rows.length > 0 ? (
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Canal</th>
                    <th className="text-left px-3 py-2">Campo</th>
                    <th className="text-right px-3 py-2">Valor actual</th>
                    <th className="text-right px-3 py-2">Valor nuevo</th>
                    <th className="text-left px-3 py-2">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {row.channelName}
                        {row.manuallyModified && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-600">manual</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.field}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.current}%</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{row.next}%</td>
                      <td className="px-3 py-2 text-muted-foreground">Canales de Venta</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border px-3 py-4 justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {noChanges
                ? 'No hay cambios pendientes; todo está sincronizado.'
                : 'Sin cambios en porcentajes de comisión.'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {hasManual ? (
            <>
              <Button variant="outline" onClick={() => onConfirm(false)}>
                Mantener valores actuales
              </Button>
              <Button onClick={() => onConfirm(true)}>
                Reemplazar con valores de Canales
              </Button>
            </>
          ) : (
            <Button onClick={() => onConfirm(true)} disabled={noChanges}>
              Sincronizar y actualizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
