/**
 * Modal "Expediente Desarrollo" del Portal Notaría — COMPONENTE DE PRESENTACIÓN.
 *
 * Documentos a nivel proyecto (Régimen de condominio, Certificado de habitabilidad,
 * Pagos de predial). El desarrollador carga, la notaría ve/descarga.
 * Toda la lógica vive en useExpedienteDesarrollo.ts + notaria-download.service.ts.
 */

import { useRef } from 'react';
import {
  Building2, Upload, Download, Loader2, FileText, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useExpedienteDesarrollo } from '@/hooks/useExpedienteDesarrollo';

interface ExpedienteDesarrolloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proyectoId: number | null;
  proyectoNombre: string;
  usuarioEmail: string | null;
}

const fmtFecha = (f: string | null) =>
  f ? new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function ExpedienteDesarrolloDialog({
  open,
  onOpenChange,
  proyectoId,
  proyectoNombre,
  usuarioEmail,
}: ExpedienteDesarrolloDialogProps) {
  const {
    grupos, totalDocs, isLoading, isError,
    upload, uploadingTipoId, uploadErrorByTipo,
    downloadAll, isDownloading, downloadProgress, downloadResult, downloadError,
  } = useExpedienteDesarrollo({ proyectoId, proyectoNombre, usuarioEmail, enabled: open });

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const progressPct = downloadProgress
    ? Math.round((downloadProgress.current / Math.max(downloadProgress.total, 1)) * 100)
    : 0;

  const handleFileSelected = (tipoId: number, file: File | undefined) => {
    if (!file) return;
    upload(tipoId, file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Expediente Desarrollo
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground mt-0.5">{proyectoNombre}</p>
            </div>
            {!isLoading && !isError && (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0',
                totalDocs > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-muted text-muted-foreground border border-border',
              )}>
                <FileText className="h-3 w-3" /> {totalDocs} documento{totalDocs !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos…
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex items-center gap-2 text-sm text-destructive py-6">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No se pudo cargar el expediente. Verifica tu conexión e intenta de nuevo.
            </div>
          )}

          {!isLoading && !isError && grupos.map(g => (
            <div key={g.tipoId} className="rounded-xl border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between">
                <span className="text-[13px] font-medium">{g.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {g.docs.length} documento{g.docs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {g.docs.length > 0 && (
                <div className="divide-y">
                  {g.docs.map(doc => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/20 transition-colors text-[12px]"
                    >
                      <span className="flex items-center gap-1.5 text-primary">
                        <FileText className="h-3.5 w-3.5" /> Ver documento
                      </span>
                      <span className="text-muted-foreground">{fmtFecha(doc.fechaCreacion)}</span>
                    </a>
                  ))}
                </div>
              )}

              <div className="px-3 py-2 border-t bg-background space-y-2">
                <input
                  ref={el => { fileInputRefs.current[g.tipoId] = el; }}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    handleFileSelected(g.tipoId, e.target.files?.[0]);
                    e.target.value = ''; // permite reintentar con el mismo archivo tras un error
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-[12px] h-8"
                  disabled={uploadingTipoId === g.tipoId}
                  onClick={() => fileInputRefs.current[g.tipoId]?.click()}
                >
                  {uploadingTipoId === g.tipoId
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…</>
                    : <><Upload className="h-3.5 w-3.5" /> Subir documento</>}
                </Button>
                {uploadErrorByTipo[g.tipoId] && (
                  <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{uploadErrorByTipo[g.tipoId]}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Progress bar */}
          {isDownloading && downloadProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Preparando expediente…</span>
                <span>{downloadProgress.current}/{downloadProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progressPct}%` }} />
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
                : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              <span>
                {downloadResult.includedCount} documento{downloadResult.includedCount !== 1 ? 's' : ''} descargado{downloadResult.includedCount !== 1 ? 's' : ''}.
                {downloadResult.failedFiles.length > 0 && ` ${downloadResult.failedFiles.length} no se pudo${downloadResult.failedFiles.length !== 1 ? 'ieron' : ''} descargar.`}
              </span>
            </div>
          )}

          {downloadError && !isDownloading && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[12px] text-destructive flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 shrink-0" /> {downloadError}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t">
          <Button
            className="w-full gap-2"
            disabled={isDownloading || isLoading || totalDocs === 0}
            onClick={downloadAll}
          >
            {isDownloading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando ZIP…</>
              : <><Download className="h-4 w-4" /> Descargar todos los documentos</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
