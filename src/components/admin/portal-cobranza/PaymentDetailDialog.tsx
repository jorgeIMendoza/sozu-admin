import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Loader } from 'lucide-react';
import { fmtCurrency, fmtDate, isImage, SelectSearch } from '@/pages/admin/portal-cobranza/cuentaDetalleShared';
import type { PagoRecord } from '@/hooks/useRelacionPagos';

// Detalle del pago — comprobante a la izquierda (55%), info + edición a la derecha.
// Todo en una vista: campos editables (fecha pagado, monto, método, estatus) + un
// solo Guardar que persiste SOLO lo modificado. Al marcar "coincide": motivo=null
// y monto_real=monto_esperado. Fallback "Sin registro".

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`truncate text-right ${valueClass ?? 'font-medium'}`} title={value}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function PaymentDetailDialog({
  payment, onClose, onSaved,
}: {
  payment: PagoRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fecha: '', metodo: '', estado: '', monto: '' });

  const { data: methods = [] } = useQuery({
    queryKey: ['metodos-pago'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('metodos_pago').select('id, nombre').order('nombre');
      if (error) throw error;
      return (data ?? []) as { id: number; nombre: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: detail, refetch } = useQuery({
    queryKey: ['pago-detalle', payment?.pago_id],
    enabled: !!payment,
    queryFn: async () => {
      const pid = payment!.pago_id;
      const { data: apls } = await (supabase as any).from('aplicaciones_pago')
        .select('id, monto, id_acuerdo_pago').eq('id_pago', pid).eq('activo', true).eq('es_multa', false)
        .order('monto', { ascending: false }).limit(1);
      const apl = apls?.[0] ?? null;
      let concepto: string | null = null, fechaLimite: string | null = null;
      if (apl?.id_acuerdo_pago) {
        const { data: acu } = await (supabase as any).from('acuerdos_pago')
          .select('fecha_pago, id_concepto').eq('id', apl.id_acuerdo_pago).maybeSingle();
        fechaLimite = acu?.fecha_pago ?? null;
        if (acu?.id_concepto) {
          const { data: c } = await (supabase as any).from('conceptos_pago').select('nombre').eq('id', acu.id_concepto).maybeSingle();
          concepto = c?.nombre ?? null;
        }
      }
      const { data: vals } = await (supabase as any).from('pago_validaciones')
        .select('estado, monto_esperado, monto_real').eq('id_pago', pid)
        .order('fecha_creacion', { ascending: false }).limit(1);
      const { data: pg } = await (supabase as any).from('pagos').select('id_metodos_pago').eq('id', pid).maybeSingle();
      return {
        aplId: apl?.id ?? null,
        montoAplicado: apl?.monto ?? null,
        concepto, fechaLimite,
        validacion: vals?.[0] ?? null,
        idMetodo: pg?.id_metodos_pago ?? null,
      };
    },
    staleTime: 30_000,
  });

  const val = detail?.validacion as { estado: string; monto_esperado: number; monto_real: number } | null | undefined;

  useEffect(() => {
    setForm({
      fecha: payment?.fecha_pago ?? '',
      metodo: detail?.idMetodo != null ? String(detail.idMetodo) : '',
      estado: val?.estado ?? '',
      monto: detail?.montoAplicado != null ? String(detail.montoAplicado) : '',
    });
  }, [payment?.pago_id, detail?.idMetodo, val?.estado, payment?.fecha_pago, detail?.montoAplicado]);

  if (!payment) return null;
  const url = payment.url_cep || payment.url_recibo || null;
  const conceptoLabel = detail?.concepto?.toLowerCase().includes('contra entrega') ? 'Pago Final' : (detail?.concepto ?? 'Sin registro');
  const montoAplicado = detail?.montoAplicado;

  const fechaChanged = !!form.fecha && form.fecha !== payment.fecha_pago;
  const metodoChanged = !!form.metodo && Number(form.metodo) !== detail?.idMetodo;
  const montoChanged = form.monto !== '' && detail?.aplId != null && Number(form.monto) !== Number(detail?.montoAplicado);
  const estadoChanged = !!form.estado && form.estado !== (val?.estado ?? '');
  const dirty = fechaChanged || metodoChanged || montoChanged || estadoChanged;

  async function handleSave() {
    if (!payment || !dirty) return;
    setSaving(true);
    try {
      const patchPago: Record<string, unknown> = {};
      if (fechaChanged) patchPago.fecha_pago = form.fecha;
      if (metodoChanged) patchPago.id_metodos_pago = Number(form.metodo);
      if (Object.keys(patchPago).length) {
        const { error } = await (supabase as any).from('pagos').update(patchPago).eq('id', payment.pago_id);
        if (error) throw error;
      }
      if (montoChanged) {
        const { error } = await (supabase as any).from('aplicaciones_pago').update({ monto: Number(form.monto) }).eq('id', detail!.aplId);
        if (error) throw error;
      }
      if (estadoChanged) {
        const patchVal: Record<string, unknown> = form.estado === 'coincide'
          ? { estado: 'coincide', motivo: null, monto_real: val?.monto_esperado ?? 0 }
          : { estado: form.estado };
        const { data: updated } = await (supabase as any).from('pago_validaciones')
          .update(patchVal).eq('id_pago', payment.pago_id).select('id');
        if (!updated || updated.length === 0) {
          const { error: ie } = await (supabase as any).from('pago_validaciones').insert({ id_pago: payment.pago_id, ...patchVal });
          if (ie) throw ie;
        }
      }
      toast.success('Cambios guardados');
      refetch(); onSaved(); onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!payment} onOpenChange={open => !open && onClose()}>
      <DialogContent className="p-0 gap-0 flex flex-col overflow-hidden max-sm:left-0 max-sm:right-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:h-[88vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom sm:max-w-4xl sm:h-[85vh]">
        <DialogTitle className="sr-only">Detalle pago</DialogTitle>
        <div className="flex flex-col sm:flex-row h-full min-h-0">
          {/* Comprobante — 55% en desktop, arriba en móvil */}
          <div className="sm:basis-[55%] shrink-0 min-w-0 min-h-0 h-[38vh] sm:h-full bg-muted/10 border-b sm:border-b-0">
            {url ? (
              isImage(url)
                ? <div className="flex items-center justify-center h-full overflow-auto p-4">
                    <img src={url} alt="Comprobante" className="max-w-full max-h-full object-contain" />
                  </div>
                : <iframe src={url} title="Comprobante" className="w-full h-full border-0" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <FileText className="size-10 text-muted-foreground/20 mb-3" />
                <p className="text-[13px] text-muted-foreground">Sin comprobante adjunto</p>
              </div>
            )}
          </div>

          {/* Info + edición — 45% */}
          <div className="flex-1 sm:border-l border-border flex flex-col bg-card min-w-0 min-h-0">
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-[14px] font-semibold leading-tight">Detalle pago</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Card: monto aplicado */}
              <div className="rounded-xl border px-4 py-4 text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Monto aplicado</span>
                {montoAplicado != null
                  ? <p className="text-[22px] font-bold tabular-nums leading-none text-foreground">{fmtCurrency(Number(montoAplicado))}</p>
                  : <p className="text-[13px] text-muted-foreground/60">Sin registro</p>}
              </div>

              {/* Detalle del pago (read-only) */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detalle del pago</p>
                <div className="space-y-1.5">
                  <DetailRow label="Concepto" value={conceptoLabel} />
                  <DetailRow label="F. límite" value={detail?.fechaLimite ? fmtDate(detail.fechaLimite) : 'Sin registro'} valueClass="tabular-nums" />
                  <DetailRow label="F. pagado" value={payment.fecha_pago ? fmtDate(payment.fecha_pago) : 'Sin registro'} valueClass="tabular-nums text-emerald-600" />
                </div>
              </div>

              {/* Edición: método + estatus (fila 1); fecha + monto (fila 2). Móvil: apilados. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Método de pago">
                  <SelectSearch
                    value={form.metodo}
                    onValueChange={v => setForm(f => ({ ...f, metodo: v }))}
                    options={methods.map(m => ({ value: String(m.id), label: m.nombre }))}
                    placeholder="Sin método"
                  />
                </Field>
                <Field label="Estatus de pago">
                  <SelectSearch
                    value={form.estado}
                    onValueChange={v => setForm(f => ({ ...f, estado: v }))}
                    options={[
                      { value: 'coincide', label: 'Válido' },
                      { value: 'no_coincide', label: 'No coincide' },
                      { value: 'error', label: 'Error' },
                      { value: 'sin_evidencia', label: 'Sin evidencia' },
                      { value: 'monto_ilegible', label: 'Monto ilegible' },
                      { value: 'monto_ausente_db', label: 'Monto ausente' },
                    ]}
                    placeholder="Sin validar"
                  />
                </Field>
                <Field label="Fecha pagado">
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="h-9 w-full block appearance-none [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                  />
                </Field>
                <Field label="Monto">
                  {detail?.aplId != null
                    ? <Input type="number" step="0.01" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} className="h-9 w-full" />
                    : <p className="text-[12px] text-muted-foreground/60 h-9 flex items-center">Sin aplicación registrada</p>}
                </Field>
              </div>
            </div>

            {/* Footer: Guardar */}
            <div className="px-4 py-3 border-t border-border shrink-0 flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="h-9 text-[13px] px-5">
                {saving ? <Loader className="size-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
