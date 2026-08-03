/**
 * Modal de expediente del Portal Notaría — COMPONENTE DE PRESENTACIÓN.
 *
 * Este componente NO contiene lógica de negocio.
 * No agrupa documentos, no selecciona el doc más reciente, no genera ZIPs,
 * no construye resúmenes, no resuelve URLs ni consulta Storage.
 *
 * Toda la lógica vive en:
 *   - useNotariaExpediente.ts  (datos, completitud, descarga, auditoría)
 *   - notaria-download.service.ts  (ZIP, resolución de URLs)
 *   - expediente-obligatorios.ts  (grupos PF/PM, rep legal, cónyuge, doc vigente)
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Download, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotariaExpediente } from '@/hooks/useNotariaExpediente';
import { DocumentosObligatorios } from '@/components/admin/expediente/DocumentosObligatorios';
import { CompradorDetalleSheet } from '@/components/admin/legal-flow/CompradorDetalleSheet';
import type { CompradorResumen } from '@/components/admin/legal-flow/CompradorDetalleSheet';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface NotariaExpedienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuentaCobranza: number | null;
  notarioId: number | null;
  proyecto: string;
  unidad: string;
  cuentaCode: string;
  usuarioEmail: string | null;
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

export function NotariaExpedienteModal({
  open,
  onOpenChange,
  idCuentaCobranza,
  notarioId,
  proyecto,
  unidad,
  cuentaCode,
  usuarioEmail,
}: NotariaExpedienteModalProps) {
  const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const {
    compradores,
    isLoading,
    isError,
    isCompleto,
    docsCompletos,
    docsTotal,
    downloadableCount,
    download,
    isDownloading,
    downloadProgress,
    downloadResult,
    downloadError,
  } = useNotariaExpediente({
    idCuentaCobranza,
    notarioId,
    proyecto,
    unidad,
    usuarioEmail,
    fechaGeneracion,
    enabled: open,
  });

  // State for nested CompradorDetalleSheet (read-only)
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detallePersonaId, setDetallePersonaId] = useState<number | null>(null);

  const compradorResumenes: CompradorResumen[] = compradores.map(c => ({
    idPersona: c.idPersona,
    nombre: c.nombre,
  }));

  const handleVerComprador = (personaId: number) => {
    setDetallePersonaId(personaId);
    setDetalleOpen(true);
  };

  const progressPct = downloadProgress
    ? Math.round((downloadProgress.current / Math.max(downloadProgress.total, 1)) * 100)
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-[16px] font-semibold">
                  Expediente de escrituración
                </DialogTitle>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {cuentaCode} · {proyecto} · {unidad}
                </p>
              </div>
              {!isLoading && compradores.length > 0 && (
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0',
                  isCompleto
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200',
                )}>
                  {isCompleto
                    ? <><CheckCircle2 className="h-3 w-3" /> Completo</>
                    : <><Clock className="h-3 w-3" /> {docsCompletos}/{docsTotal} grupos</>
                  }
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            {isLoading && (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando expediente…
              </div>
            )}

            {isError && !isLoading && (
              <div className="flex items-center gap-2 text-sm text-destructive py-6">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No se pudo cargar el expediente. Verifica tu conexión e intenta de nuevo.
              </div>
            )}

            {!isLoading && !isError && compradores.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No se encontraron compradores para esta cuenta.
              </p>
            )}

            {!isLoading && compradores.length > 0 && (
              <div className="space-y-3">
                {/* Fuente única del expediente (PF/PM, rep legal, cónyuge, histórico). */}
                <DocumentosObligatorios cuentaId={idCuentaCobranza} portal="notaria" titulo="Documentos del expediente" />

                <div className="flex flex-wrap gap-1.5">
                  {compradores.map((comprador) => (
                    <Button
                      key={comprador.idPersona}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleVerComprador(comprador.idPersona)}
                    >
                      Ver detalle · {comprador.nombre}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Download section */}
            {!isLoading && compradores.length > 0 && (
              <div className="pt-2 space-y-3 border-t">
                {!isCompleto && downloadableCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[12px] text-amber-700">
                      El expediente no está completo. Se descargarán los {downloadableCount} documento(s) validados disponibles.
                    </p>
                  </div>
                )}
                {downloadableCount === 0 && !isDownloading && (
                  <p className="text-[12px] text-muted-foreground text-center py-1">
                    No hay documentos validados disponibles para descargar.
                  </p>
                )}

                {/* Progress bar */}
                {isDownloading && downloadProgress && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Preparando archivo…</span>
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
                    downloadResult.failedFiles.length > 0
                      ? 'bg-amber-50 border border-amber-200/60 text-amber-700'
                      : 'bg-emerald-50 border border-emerald-200/60 text-emerald-700',
                  )}>
                    {downloadResult.failedFiles.length > 0
                      ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    }
                    <span>
                      {downloadResult.includedCount} archivo(s) descargado(s).
                      {downloadResult.failedFiles.length > 0 && ` ${downloadResult.failedFiles.length} archivo(s) fallaron.`}
                      {downloadResult.skippedCount > 0 && ` ${downloadResult.skippedCount} sin documento validado.`}
                    </span>
                  </div>
                )}

                {downloadError && !isDownloading && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[12px] text-destructive flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    {downloadError}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  disabled={isDownloading || isLoading || downloadableCount === 0}
                  onClick={download}
                >
                  {isDownloading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando ZIP…</>
                    : isCompleto
                      ? <><Download className="h-4 w-4" /> Descargar expediente completo</>
                      : <><Download className="h-4 w-4" /> Descargar documentos disponibles</>
                  }
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested sheet — read-only (notaría no puede editar ni validar) */}
      {idCuentaCobranza && compradorResumenes.length > 0 && (
        <CompradorDetalleSheet
          open={detalleOpen}
          onOpenChange={setDetalleOpen}
          idCuentaCobranza={idCuentaCobranza}
          compradores={compradorResumenes}
          initialPersonaId={detallePersonaId}
          readOnly
        />
      )}
    </>
  );
}
