import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DocStatusBadge, formatDate } from '@/components/cobranza/StatusBadges';
import {
  X, Download, Replace, Maximize2, ZoomIn, ZoomOut, RotateCw,
  FileText, Image as ImageIcon, File, FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentStatus } from '@/types/cobranza';

interface DocumentPreviewPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fileUrl?: string;
  fileType: string; // extension: pdf, jpg, png, docx, xlsx, etc.
  fileName: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
  status: DocumentStatus;
  critical?: boolean;
  notes?: string;
  onDownload?: () => void;
  onReplace?: () => void;
}

const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
const pdfExtensions = ['pdf'];

function getFileCategory(ext: string): 'pdf' | 'image' | 'office' | 'unknown' {
  const lower = ext.toLowerCase();
  if (pdfExtensions.includes(lower)) return 'pdf';
  if (imageExtensions.includes(lower)) return 'image';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(lower)) return 'office';
  return 'unknown';
}

function getFileIcon(ext: string) {
  const cat = getFileCategory(ext);
  if (cat === 'pdf') return FileText;
  if (cat === 'image') return ImageIcon;
  if (cat === 'office') return FileSpreadsheet;
  return File;
}

// Generate a realistic demo URL for preview purposes
function getDemoPreviewUrl(fileName: string, ext: string): string {
  const cat = getFileCategory(ext);
  if (cat === 'pdf') return '/placeholder.svg'; // Will use placeholder
  if (cat === 'image') return '/placeholder.svg';
  return '';
}

export function DocumentPreviewPanel({
  open, onOpenChange, fileUrl, fileType, fileName,
  uploadedAt, uploadedBy, status, critical, notes,
  onDownload, onReplace,
}: DocumentPreviewPanelProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const ext = fileType.toLowerCase().replace('.', '');
  const category = getFileCategory(ext);
  const FileIcon = getFileIcon(ext);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const resetView = () => { setZoom(100); setRotation(0); };

  const previewUrl = fileUrl || getDemoPreviewUrl(fileName, ext);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetView(); onOpenChange(v); }}>
      <DialogContent className={cn(
        'p-0 gap-0 overflow-hidden flex flex-col',
        fullscreen ? 'sm:max-w-[95vw] h-[95vh]' : 'sm:max-w-3xl h-[80vh]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              category === 'pdf' ? 'bg-danger-bg' : category === 'image' ? 'bg-info-bg' : 'bg-muted')}>
              <FileIcon className={cn('w-4.5 h-4.5',
                category === 'pdf' ? 'text-danger' : category === 'image' ? 'text-info' : 'text-muted-foreground')} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-foreground truncate">{fileName}</p>
                {critical && <span className="text-[10px] text-danger font-semibold uppercase bg-danger-bg px-1.5 py-0.5 rounded">Crítico</span>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="uppercase font-mono">.{ext}</span>
                {uploadedAt && <span>· {formatDate(uploadedAt)}</span>}
                {uploadedBy && <span>· {uploadedBy}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DocStatusBadge status={status} />
            {onDownload && (
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={onDownload}>
                <Download className="w-3 h-3 mr-1" strokeWidth={1.75} />Descargar
              </Button>
            )}
            {onReplace && (
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={onReplace}>
                <Replace className="w-3 h-3 mr-1" strokeWidth={1.75} />Reemplazar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Reducir' : 'Pantalla completa'}>
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        {/* Toolbar for image/pdf */}
        {(category === 'pdf' || category === 'image') && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Button>
            <span className="text-[12px] text-muted-foreground font-mono w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 300}>
              <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Button>
            {category === 'image' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-2" onClick={handleRotate} title="Rotar">
                <RotateCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              </Button>
            )}
            <button onClick={resetView} className="text-[11px] text-muted-foreground hover:text-foreground ml-2 transition-colors">
              Restablecer
            </button>
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4">
          {category === 'pdf' && (
            <div className="w-full h-full flex flex-col items-center justify-center" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              {/* Real PDF embed - in production this would use the actual URL */}
              <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="bg-card px-6 py-8 space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <FileText className="w-8 h-8 text-danger/70" strokeWidth={1.25} />
                    <div>
                      <p className="text-[16px] font-semibold text-foreground">{fileName}</p>
                      <p className="text-[12px] text-muted-foreground">Documento PDF · Vista previa del sistema</p>
                    </div>
                  </div>
                  {/* Simulated PDF content */}
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-11/12" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-9/12" />
                    <div className="h-6" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-10/12" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-7/12" />
                    <div className="h-6" />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-8 bg-muted/70 rounded" />
                      <div className="h-8 bg-muted/70 rounded" />
                      <div className="h-8 bg-muted/70 rounded" />
                      <div className="h-8 bg-muted/50 rounded" />
                      <div className="h-8 bg-muted/50 rounded" />
                      <div className="h-8 bg-muted/50 rounded" />
                    </div>
                    <div className="h-6" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-8/12" />
                  </div>
                  <div className="pt-6 border-t border-border mt-6">
                    <p className="text-[11px] text-muted-foreground text-center">
                      En producción, este espacio muestra el documento PDF completo con navegación de páginas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {category === 'image' && (
            <div className="flex items-center justify-center" style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}>
              {/* Simulated image preview */}
              <div className="w-[400px] h-[300px] bg-gradient-to-br from-muted to-muted/50 rounded-lg border border-border flex flex-col items-center justify-center shadow-sm">
                <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-3" strokeWidth={1} />
                <p className="text-[14px] font-medium text-foreground">{fileName}</p>
                <p className="text-[12px] text-muted-foreground mt-1">Vista previa de imagen</p>
                <p className="text-[11px] text-muted-foreground/60 mt-3">
                  En producción, aquí se muestra la imagen real del documento.
                </p>
              </div>
            </div>
          )}

          {(category === 'office' || category === 'unknown') && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileIcon className="w-8 h-8 text-muted-foreground/50" strokeWidth={1.25} />
              </div>
              <p className="text-[15px] font-semibold text-foreground mb-1">{fileName}</p>
              <p className="text-[13px] text-muted-foreground mb-1">
                Tipo: <span className="font-mono uppercase">.{ext}</span>
              </p>
              {uploadedAt && <p className="text-[12px] text-muted-foreground">Cargado: {formatDate(uploadedAt)}</p>}
              <p className="text-[13px] text-muted-foreground mt-4 max-w-sm">
                Vista previa no disponible para este tipo de archivo. Descargue el documento para revisarlo.
              </p>
              <div className="flex items-center gap-2 mt-4">
                {onDownload && (
                  <Button size="sm" onClick={onDownload}>
                    <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Descargar archivo
                  </Button>
                )}
                {onReplace && (
                  <Button variant="outline" size="sm" onClick={onReplace}>
                    <Replace className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Reemplazar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes footer */}
        {notes && (
          <div className="px-5 py-2.5 border-t border-border bg-warning-bg/30 shrink-0">
            <p className="text-[12px] text-warning font-medium">Observación: {notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
