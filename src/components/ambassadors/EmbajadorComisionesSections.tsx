import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Info, Loader2, Upload, CheckCircle2, Clock, FileText, AlertCircle, CalendarCheck, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEmbajadorComisiones, EmbComisionStatus, EmbComision } from '@/hooks/useEmbajadorComisiones';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const STATUS: Record<EmbComisionStatus, { label: string; tone: string; icon: typeof Clock }> = {
  pendiente:         { label: 'Pendiente',         tone: 'bg-muted text-muted-foreground',                         icon: Clock },
  en_revision:       { label: 'En revisión',       tone: 'bg-blue-500/10 text-blue-700 border-blue-500/30',        icon: FileText },
  factura_requerida: { label: 'Factura requerida', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30',     icon: AlertCircle },
  programada:        { label: 'Pago programado',   tone: 'bg-purple-500/10 text-purple-700 border-purple-500/30',  icon: CalendarCheck },
  pagada:            { label: 'Pagada',            tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
};

function ComisionRow({ c, children }: { c: EmbComision; children?: React.ReactNode }) {
  const st = STATUS[c.status];
  const Icon = st.icon;
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {c.proyecto || 'Sin proyecto'}{c.propiedad ? ` · ${c.propiedad}` : ''}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {c.cuenta_cobranza_label}
            {c.productoNombre ? ` · ${c.productoNombre}` : c.propiedad ? ` · Depto ${c.propiedad}` : ''}
          </div>
        </div>
        <div className="text-base font-bold shrink-0">{fmt(c.monto_comision)}</div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px] gap-1', st.tone)}>
            <Icon className="h-3 w-3" />{st.label}
          </Badge>
          {c.factura_url && (
            <a href={c.factura_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-medium underline">
              Ver factura
            </a>
          )}
          {c.pagada && c.url_evidencia_pago && (
            <a href={c.url_evidencia_pago} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-medium underline">
              Ver recibo
            </a>
          )}
        </div>
        {c.precio_final > 0 && (
          <span className="text-[10px] text-muted-foreground">Venta: {fmt(c.precio_final)}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────── Comisiones ───────────────────────────
export function EmbajadorComisionesSection({ email }: { email?: string | null }) {
  const { comisiones, totals, isLoading } = useEmbajadorComisiones(email);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            La comisión se genera cuando tu referido concreta una compra y la operación se valida.
            Aquí ves tus comisiones por venta, su estatus y la factura/recibo asociados.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Comisión generada</div><div className="text-2xl font-semibold mt-2 tabular-nums">{totals.generada ? fmt(totals.generada) : '—'}</div></Card>
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Comisión autorizada</div><div className="text-2xl font-semibold mt-2 tabular-nums">{totals.autorizada ? fmt(totals.autorizada) : '—'}</div></Card>
        <Card className="p-4 border-primary/30 bg-primary/5"><div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Comisión pagada</div><div className="text-2xl font-semibold mt-2 tabular-nums">{totals.pagada ? fmt(totals.pagada) : '—'}</div></Card>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : comisiones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aún no tienes comisiones generadas.</p>
        ) : (
          <div className="space-y-2.5">
            {comisiones.map((c, i) => <ComisionRow key={c.referralId ?? `${c.id_cuenta_cobranza}-${i}`} c={c} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────── Pagos ───────────────────────────
function FacturaUploadButton({ cuentaId, email, idPersona, onUploaded }: {
  cuentaId: number; email: string; idPersona: number; onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `facturas-comision/${cuentaId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
      const { error: insErr } = await (supabase as any).from('documentos').insert({
        id_cuenta_cobranza: cuentaId,
        id_tipo_documento: 46,
        url: publicUrl,
        id_persona: idPersona,
        numero: email,
        activo: true,
      });
      if (insErr) throw insErr;
      toast.success('Factura subida correctamente.');
      onUploaded();
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir la factura.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3">
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
        {uploading ? 'Subiendo…' : 'Subir factura'}
      </Button>
    </div>
  );
}

export function EmbajadorPagosSection({ email, idPersona }: { email?: string | null; idPersona?: number | null }) {
  const { comisiones, isLoading, refetch } = useEmbajadorComisiones(email);
  // Pagos = comisiones ya autorizadas (en el flujo de cobro): factura_requerida, programada, pagada
  const pagos = comisiones.filter((c) => ['factura_requerida', 'programada', 'pagada'].includes(c.status));

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <Receipt className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            Cuando tu comisión es autorizada, sube tu factura. Una vez pagada, podrás descargar tu recibo.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tienes pagos autorizados todavía.</p>
        ) : (
          <div className="space-y-2.5">
            {pagos.map((c, i) => (
              <ComisionRow key={c.referralId ?? `${c.id_cuenta_cobranza}-${i}`} c={c}>
                {c.status === 'factura_requerida' && email && idPersona && (
                  <FacturaUploadButton
                    cuentaId={c.id_cuenta_cobranza}
                    email={email}
                    idPersona={idPersona}
                    onUploaded={() => refetch()}
                  />
                )}
                {c.status === 'programada' && (
                  <div className="mt-2 text-[11px] text-muted-foreground">Factura recibida. Pago en proceso.</div>
                )}
              </ComisionRow>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
