import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { MODAL_BODY_CLS, ModalFormHeader } from '@/components/ui/modal-form';
import { cn } from '@/lib/utils';
import { Loader2, Upload, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Botón compacto que abre un modal con dropzone para subir un documento de la
 * comisión (factura o evidencia de pago). El guardado se inyecta con `onUpload`,
 * así lo comparten el portal de agentes y el de embajadores.
 */
export function FacturaUploadButton({
  title = 'Factura de comisión',
  subtitle = 'Sube el PDF de tu factura',
  tooltip = 'Subir factura (PDF)',
  pdfOnly = true,
  onUpload,
  onClick,
  disabled,
}: {
  title?: string;
  subtitle?: string;
  tooltip?: string;
  /** Solo PDF (por defecto) o PDF + imagen. */
  pdfOnly?: boolean;
  onUpload: (file: File) => Promise<void>;
  /** Hook para telemetría al abrir el modal. */
  onClick?: () => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);

  const accept = pdfOnly ? '.pdf' : '.pdf,image/*';
  const hint = pdfOnly ? 'Solo PDF' : 'PDF o imagen';

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    const isImg = f.type.startsWith('image/');
    if (pdfOnly ? !isPdf : !(isPdf || isImg)) {
      toast.error(pdfOnly ? 'Solo se permiten archivos PDF.' : 'Solo se permiten PDF o imágenes.');
      return;
    }
    doUpload(f);
  };

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
      toast.success('Documento subido correctamente');
      setOpen(false);
    } catch (err: any) {
      console.error('Error al subir documento:', err);
      toast.error('Error al subir: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <IconButton
        icon={Upload}
        tooltip={tooltip}
        disabled={disabled}
        onClick={() => { onClick?.(); setOpen(true); }}
      />

      <Dialog open={open} onOpenChange={(o) => { if (!uploading) setOpen(o); }}>
        <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col gap-0 overflow-hidden rounded-md bg-card p-0">
          <ModalFormHeader title={title} subtitle={subtitle} />
          <div className={MODAL_BODY_CLS}>
            <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
              onClick={() => !uploading && fileRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
                drag ? 'border-primary bg-primary/5' : 'border-border bg-muted hover:border-primary',
              )}
            >
              {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.6} />}
              <div>
                <p className="text-sm font-bold text-foreground">{uploading ? 'Subiendo…' : 'Arrastra el archivo aquí'}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground/70">o haz clic para seleccionar · {hint}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Sube la factura de comisión (tipo 46) de una cuenta de cobranza y desactiva la
 * anterior si existía. Compartido por los portales que suben su propia factura.
 */
export async function subirFacturaComision({
  file,
  cuentaId,
  personaId,
  email,
  supabase,
}: {
  file: File;
  cuentaId: number;
  personaId: number;
  email: string;
  supabase: any;
}) {
  const path = `facturas-comision/${cuentaId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
  await supabase
    .from('documentos')
    .update({ activo: false })
    .eq('id_cuenta_cobranza', cuentaId)
    .eq('id_tipo_documento', 46)
    .eq('activo', true);
  const { error: insErr } = await supabase.from('documentos').insert({
    id_cuenta_cobranza: cuentaId,
    id_tipo_documento: 46,
    url: publicUrl,
    id_persona: personaId,
    numero: email,
    activo: true,
  });
  if (insErr) throw insErr;
  return publicUrl as string;
}
