import { useRef, useState, type ChangeEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmbajadorDocumentos,
  EmbajadorDocEstatus,
  EMB_DOC_STATUS_LABEL,
  EmbajadorDocKey,
} from '@/hooks/useEmbajadorDocumentos';
import { PdfViewerDialog } from '@/components/admin/PdfViewerDialog';

const TONE: Record<EmbajadorDocEstatus, string> = {
  pendiente: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  aprobado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  rechazado: 'bg-destructive/10 text-destructive border-destructive/30',
};

const dateShort = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX') : '—');

export function EmbajadorDocsCard({ idPersona }: { idPersona?: number | null }) {
  const { docs, isLoading, uploadDoc } = useEmbajadorDocumentos(idPersona);
  const [uploadingKey, setUploadingKey] = useState<EmbajadorDocKey | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('Documento');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKeyRef = useRef<EmbajadorDocKey | null>(null);

  const pickFile = (key: EmbajadorDocKey) => {
    pendingKeyRef.current = key;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = pendingKeyRef.current;
    e.target.value = ''; // permite re-seleccionar el mismo archivo
    if (!file || !key) return;
    setUploadingKey(key);
    try {
      await uploadDoc(key, file);
      toast.success('Documento cargado, queda en revisión.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cargar el documento.');
    } finally {
      setUploadingKey(null);
      pendingKeyRef.current = null;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2 mb-4">
        <FileText className="h-4 w-4 text-primary mt-0.5" />
        <div>
          <div className="font-medium text-sm">Documentación para pago</div>
          <p className="text-xs text-muted-foreground">
            Necesarios para que podamos liquidar tu comisión. Los documentos aprobados ya no se pueden reemplazar.
          </p>
        </div>
      </div>

      {!idPersona ? (
        <p className="text-sm text-muted-foreground py-4">Embajador sin persona asociada.</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const busy = uploadingKey === d.key;
            return (
              <li
                key={d.key}
                className="flex items-center justify-between gap-2 p-3 rounded-md border border-border"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.url ? `Cargado · ${dateShort(d.uploadedAt)}` : 'Sin archivo'}
                    {d.status === 'rechazado' && ' · vuelve a subirlo'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.requiresApproval && d.url && (
                    <Badge variant="outline" className={TONE[d.status]}>
                      {EMB_DOC_STATUS_LABEL[d.status]}
                    </Badge>
                  )}
                  {d.url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setViewerUrl(d.url);
                        setViewerTitle(d.label);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!d.locked && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => pickFile(d.key)}>
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-3 w-3 mr-1" />
                          {d.url ? 'Reemplazar' : 'Cargar'}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={onFileChange}
      />

      <PdfViewerDialog
        open={!!viewerUrl}
        onOpenChange={(o) => !o && setViewerUrl(null)}
        url={viewerUrl ?? ''}
        title={viewerTitle}
      />
    </Card>
  );
}
