import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileCheck } from 'lucide-react';
import { fmtCurrency, fmtDate } from '@/pages/admin/portal-cobranza/cuentaDetalleShared';
import { useActivityLogger } from '@/hooks/useActivityLogger';

// Pago destino al que se le adjunta la evidencia.
export interface EvidenciaTarget {
  id: number;                       // id del pago
  metodo?: string | null;
  monto?: number | null;
  fecha_pago?: string | null;
  clave_rastreo?: string | null;
}

interface CargarEvidenciaDialogProps {
  open: boolean;
  onClose: () => void;
  cuentaId: number;                 // id_cuenta_cobranza (para la ruta del bucket)
  target: EvidenciaTarget | null;
  onDone?: () => void;              // el caller invalida sus queries
  /** RP: captura clave_rastreo si aún no existe en el pago. */
  captureClaveRastreo?: boolean;
  /** RP: registra la subida en la bitácora de actividad. */
  logActivity?: boolean;
}

/**
 * Modal canónico de "Cargar evidencia de pago" del portal de cobranza.
 * Base tomada del detalle de cuenta (CC) — dropzone + checks que deciden
 * bucket (ceps / evidencias_efectivo) y columna (url_cep / url_recibo).
 * Compartido entre CobranzaCuentaDetalle (CC) y CollectionPayments (RP).
 */
export function CargarEvidenciaDialog({
  open,
  onClose,
  cuentaId,
  target,
  onDone,
  captureClaveRastreo = false,
  logActivity = false,
}: CargarEvidenciaDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [esValido, setEsValido] = useState(false);
  const [esCep, setEsCep] = useState(false);
  const [claveRastreo, setClaveRastreo] = useState('');
  const [saving, setSaving] = useState(false);
  const { registrarSubidaDocumento } = useActivityLogger();

  const existingClave = target?.clave_rastreo?.trim() || '';
  const claveEditable = captureClaveRastreo && !existingClave;

  // Reset al abrir/cambiar de pago destino.
  useEffect(() => {
    if (open) {
      setFile(null);
      setEsValido(false);
      setEsCep(false);
      setClaveRastreo(existingClave);
    }
  }, [open, target?.id, existingClave]);

  // Bucket por check "Es CEP"; columna por check "Validado".
  const bucket = esCep ? 'ceps' : 'evidencias_efectivo';
  const columna = esValido ? 'url_cep' : 'url_recibo';

  async function handleSubmit() {
    if (!file) { toast.error('Arrastra o selecciona un archivo'); return; }
    if (!target?.id) { toast.error('No hay pago destino'); return; }
    setSaving(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${cuentaId}/${target.id}/${Date.now()}.${ext}`;
      const { error: se } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (se) throw se;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

      const trimmedClave = claveRastreo.trim();
      const updatePayload: Record<string, string> = { [columna]: pub.publicUrl };
      if (claveEditable && trimmedClave) updatePayload.clave_rastreo = trimmedClave;

      const { error: ue } = await (supabase as any).from('pagos')
        .update(updatePayload).eq('id', target.id);
      if (ue) throw ue;

      if (logActivity) {
        await registrarSubidaDocumento({
          tipo: esCep ? 'cep_pago' : 'evidencia_pago',
          id_pago: target.id,
          id_cuenta_cobranza: cuentaId,
          nombre_archivo: file.name,
          url: pub.publicUrl,
        });
      }

      toast.success('Evidencia cargada');
      onDone?.();
      onClose();
    } catch (err: any) {
      if (logActivity) {
        await registrarSubidaDocumento(
          { tipo: esCep ? 'cep_pago' : 'evidencia_pago', id_pago: target?.id, id_cuenta_cobranza: cuentaId, nombre_archivo: file?.name },
          'error',
          err instanceof Error ? err.message : 'Error desconocido'
        );
      }
      toast.error(err?.message ?? 'Error al subir evidencia');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-[15px]">Cargar evidencia de pago</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            className={`relative rounded-lg border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
          >
            <input
              id="ce-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 py-7 px-4 text-center pointer-events-none">
              {file ? (
                <>
                  <FileCheck className="size-7 text-primary" />
                  <p className="text-[13px] font-medium text-foreground break-all">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · clic para cambiar</p>
                </>
              ) : (
                <>
                  <UploadCloud className="size-7 text-muted-foreground" />
                  <p className="text-[13px] font-medium text-foreground">Arrastra el archivo aquí</p>
                  <p className="text-[11px] text-muted-foreground">o haz clic para seleccionar · PDF, imagen o XML</p>
                </>
              )}
            </div>
          </div>

          {/* Pago destino (registro) */}
          {target && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Método</span>
                <span className="font-medium text-foreground">{target.metodo ?? '—'}</span>
              </div>
              {target.monto != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-medium tabular-nums text-foreground">{fmtCurrency(Number(target.monto))}</span>
                </div>
              )}
              {target.fecha_pago && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Fecha de pago</span>
                  <span className="font-medium text-foreground">{fmtDate(target.fecha_pago)}</span>
                </div>
              )}
            </div>
          )}

          {/* Clave de rastreo — opcional (no todos los métodos la validan).
              Editar una existente se hace en el modal "Detalle de pago". */}
          {captureClaveRastreo && (
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground px-0.5">
                Clave de rastreo
              </label>
              <input
                type="text"
                value={claveRastreo}
                onChange={(e) => setClaveRastreo(e.target.value)}
                disabled={!claveEditable}
                placeholder={claveEditable ? '2024061812345678' : ''}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {!claveEditable && existingClave && (
                <p className="text-[11px] text-muted-foreground">Ya registrada · edítala en «Detalle de pago».</p>
              )}
            </div>
          )}

          {/* Checks */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={esValido} onChange={(e) => setEsValido(e.target.checked)}
                className="size-4 accent-primary" />
              <span className="text-[13px] font-medium text-foreground">Pago validado</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={esCep} onChange={(e) => setEsCep(e.target.checked)}
                className="size-4 accent-primary" />
              <span className="text-[13px] font-medium text-foreground">Es CEP</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose}
            className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !file}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Cargar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
