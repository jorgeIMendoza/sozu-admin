/**
 * Modal de comprobantes de pago del Portal Notaría — COMPONENTE DE PRESENTACIÓN.
 *
 * Este componente NO contiene lógica de negocio.
 * No realiza queries, no genera ZIPs, no resuelve URLs, no audita.
 *
 * Toda la lógica vive en:
 *   - useNotariaPagos.ts       (waterfall de cuentas/pagos, descarga, auditoría)
 *   - notaria-download.service.ts  (ZIP, resolución de URLs, deduplicación)
 *
 * Estados del botón de descarga:
 *   A) conComprobante > 0         → "Descargar comprobantes de pago" (activo)
 *   B) totalPagos > 0 &&
 *      conComprobante === 0       → deshabilitado + mensaje informativo
 *   C) totalPagos === 0           → deshabilitado + "No se encontraron pagos"
 */

import { CheckCircle2, Download, Loader2, AlertTriangle, XCircle, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotariaPagos } from '@/hooks/useNotariaPagos';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface NotariaPagosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuentaCobranza: number | null;
  notarioId: number | null;
  proyecto: string;
  unidad: string;
  cuentaCode: string;
  notariaNombre: string | null;
  usuarioEmail: string | null;
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  principal: 'Unidad principal',
  bodega: 'Bodega',
  estacionamiento: 'Estacionamiento',
};

const fmtMonto = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// ─── Modal ─────────────────────────────────────────────────────────────────────

export function NotariaPagosModal({
  open,
  onOpenChange,
  idCuentaCobranza,
  notarioId,
  proyecto,
  unidad,
  cuentaCode,
  notariaNombre,
  usuarioEmail,
}: NotariaPagosModalProps) {
  const {
    cuentas,
    isLoading,
    isError,
    totalPagos,
    conComprobante,
    sinComprobante,
    invalidUrlsCount,
    download,
    isDownloading,
    downloadProgress,
    downloadResult,
    downloadError,
  } = useNotariaPagos({
    idCuentaCobranza,
    notarioId,
    proyecto,
    unidad,
    notariaNombre,
    usuarioEmail,
    enabled: open,
  });

  const progressPct = downloadProgress
    ? Math.round((downloadProgress.current / Math.max(downloadProgress.total, 1)) * 100)
    : 0;

  const hasData = !isLoading && !isError && cuentas.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold">
                Comprobantes de pago
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {cuentaCode} · {proyecto} · {unidad}
              </p>
            </div>
            {hasData && (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0',
                conComprobante > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-muted text-muted-foreground border border-border',
              )}>
                <Receipt className="h-3 w-3" />
                {conComprobante}/{totalPagos} pagos
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando pagos…
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex items-center gap-2 text-sm text-destructive py-6">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No se pudo cargar la información de pagos. Verifica tu conexión e intenta de nuevo.
            </div>
          )}

          {/* No pagos */}
          {!isLoading && !isError && totalPagos === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No se encontraron pagos registrados para esta unidad.
            </p>
          )}

          {/* Cuentas table */}
          {hasData && totalPagos > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Cuenta</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Pagos</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Con comprobante</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Sin comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cuentas.map(c => (
                    <tr key={c.cuentaId} className="bg-background hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <span className="font-medium">{TIPO_LABEL[c.tipo] ?? c.tipo}</span>
                        <span className="text-muted-foreground ml-1.5">CC-{String(c.cuentaId).padStart(6, '0')}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.totalPagos}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={c.conComprobante > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                          {c.conComprobante}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.sinComprobante > 0
                          ? <span className="text-amber-600">{c.sinComprobante}</span>
                          : <span className="text-muted-foreground">0</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                {cuentas.length > 1 && (
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td className="px-3 py-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{totalPagos}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">{conComprobante}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-600">{sinComprobante > 0 ? sinComprobante : <span className="text-muted-foreground">0</span>}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Info notices */}
          {hasData && totalPagos > 0 && (
            <div className="space-y-2">
              {sinComprobante > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-amber-700">
                    {sinComprobante} pago{sinComprobante !== 1 ? 's' : ''} sin comprobante adjunto. Se incluirán en RESUMEN_PAGOS.txt dentro del ZIP.
                  </p>
                </div>
              )}
              {invalidUrlsCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-amber-700">
                    {invalidUrlsCount} URL{invalidUrlsCount !== 1 ? 's' : ''} con formato inválido. {invalidUrlsCount !== 1 ? 'Esos archivos serán' : 'Ese archivo será'} omitido{invalidUrlsCount !== 1 ? 's' : ''} del ZIP.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground px-0.5">
                Los comprobantes de unidad principal, bodega y estacionamiento conforman una sola operación de escrituración.
              </p>
            </div>
          )}

          {/* Progress bar */}
          {isDownloading && downloadProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Preparando comprobantes…</span>
                <span>{downloadProgress.current}/{downloadProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Result feedback */}
          {downloadResult && !isDownloading && (
            <div className={cn(
              'rounded-lg px-3 py-2 text-[12px] flex items-start gap-2',
              downloadResult.failedFiles.length > 0 || downloadResult.invalidUrlsCount > 0
                ? 'bg-amber-50 border border-amber-200/60 text-amber-700'
                : 'bg-emerald-50 border border-emerald-200/60 text-emerald-700',
            )}>
              {downloadResult.failedFiles.length > 0 || downloadResult.invalidUrlsCount > 0
                ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              }
              <span>
                {downloadResult.includedCount} comprobante{downloadResult.includedCount !== 1 ? 's' : ''} descargado{downloadResult.includedCount !== 1 ? 's' : ''}.
                {downloadResult.skippedCount > 0 && ` ${downloadResult.skippedCount} pago${downloadResult.skippedCount !== 1 ? 's' : ''} sin comprobante.`}
                {downloadResult.failedFiles.length > 0 && ` ${downloadResult.failedFiles.length} archivo${downloadResult.failedFiles.length !== 1 ? 's' : ''} no se pudo${downloadResult.failedFiles.length !== 1 ? 'ieron' : ''} descargar.`}
                {downloadResult.duplicatesSkipped > 0 && ` ${downloadResult.duplicatesSkipped} duplicado${downloadResult.duplicatesSkipped !== 1 ? 's' : ''} omitido${downloadResult.duplicatesSkipped !== 1 ? 's' : ''}.`}
              </span>
            </div>
          )}

          {/* Download error */}
          {downloadError && !isDownloading && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[12px] text-destructive flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {downloadError}
            </div>
          )}

          {/* Download button — 3 states */}
          <div className="pt-1 border-t">
            {/* State C: no pagos at all */}
            {!isLoading && !isError && totalPagos === 0 && (
              <Button className="w-full gap-2" disabled>
                <Download className="h-4 w-4" /> No se encontraron pagos
              </Button>
            )}

            {/* State B: pagos pero sin comprobantes */}
            {!isLoading && totalPagos > 0 && conComprobante === 0 && (
              <>
                <Button className="w-full gap-2" disabled>
                  <Download className="h-4 w-4" /> Sin comprobantes disponibles
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Los {fmtMonto(0)?.length > 0 ? totalPagos : totalPagos} pago{totalPagos !== 1 ? 's' : ''} registrado{totalPagos !== 1 ? 's' : ''} no tienen comprobante adjunto.
                </p>
              </>
            )}

            {/* State A: hay comprobantes */}
            {(isLoading || conComprobante > 0) && (
              <Button
                className="w-full gap-2"
                disabled={isDownloading || isLoading || conComprobante === 0}
                onClick={download}
              >
                {isDownloading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando ZIP…</>
                  : <><Download className="h-4 w-4" /> Descargar comprobantes de pago</>
                }
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
