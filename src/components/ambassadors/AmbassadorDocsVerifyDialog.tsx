import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEmbajadorDocumentos,
  EmbajadorDocEstatus,
  EMB_DOC_STATUS_LABEL,
} from '@/hooks/useEmbajadorDocumentos';
import { PdfViewerDialog } from '@/components/admin/PdfViewerDialog';
import { DocumentStatusChangeDialog } from '@/components/admin/DocumentStatusChangeDialog';

const TONE: Record<EmbajadorDocEstatus, string> = {
  pendiente: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  aprobado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  rechazado: 'bg-destructive/10 text-destructive border-destructive/30',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idPersona?: number | null;
  ambassadorName?: string;
}

export function AmbassadorDocsVerifyDialog({ open, onOpenChange, idPersona, ambassadorName }: Props) {
  const { docs, isLoading, setDocStatus } = useEmbajadorDocumentos(open ? idPersona : null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('Documento');
  const [statusDoc, setStatusDoc] = useState<{ docId: number; name: string; current: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Solo los documentos del embajador que requieren aprobación
  const approvableDocs = docs.filter((d) => d.requiresApproval);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Verificar documentos
            </DialogTitle>
            <DialogDescription>
              {ambassadorName ? `Embajador: ${ambassadorName}` : 'Documentos del embajador'}
            </DialogDescription>
          </DialogHeader>

          {!idPersona ? (
            <p className="text-sm text-muted-foreground py-4">Embajador sin persona asociada.</p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="space-y-2">
              {approvableDocs.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-2 p-3 rounded-md border border-border">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.url ? 'Documento cargado' : 'Sin archivo cargado'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.url && (
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
                    {d.url && d.docId != null && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatusDoc({ docId: d.docId!, name: d.label, current: d.estatusId ?? 1 })
                        }
                      >
                        Revisar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <PdfViewerDialog
        open={!!viewerUrl}
        onOpenChange={(o) => !o && setViewerUrl(null)}
        url={viewerUrl ?? ''}
        title={viewerTitle}
      />

      {statusDoc && (
        <DocumentStatusChangeDialog
          isOpen={!!statusDoc}
          onClose={() => setStatusDoc(null)}
          currentStatus={statusDoc.current}
          documentName={statusDoc.name}
          isLoading={saving}
          onConfirm={async (newStatus) => {
            setSaving(true);
            try {
              await setDocStatus(statusDoc.docId, newStatus);
              toast.success('Estatus del documento actualizado.');
            } catch (err: any) {
              toast.error(err?.message || 'No se pudo actualizar el documento.');
              throw err;
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </>
  );
}
