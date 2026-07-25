import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Info, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ComisionesTable,
  comisionEstatus,
  type ComisionRow,
} from '@/components/admin/comisiones/ComisionesTable';
import { FacturaUploadButton, subirFacturaComision } from '@/components/admin/comisiones/FacturaUploadButton';
import { ModalViewer } from '@/components/ui/modal-viewer';
import {
  useEmbajadoresComisiones,
  useReferidosFacturaColExists,
  type EmbajadorComisionTarget,
  type EmbComision,
} from '@/hooks/useEmbajadorComisiones';

/**
 * Comisiones y pagos del embajador. Misma tabla y misma lógica que el portal de
 * agentes (ComisionesTable + useComisionesPorEmail); lo propio del embajador son
 * las comisiones que solo existen como referido y el copy de las tarjetas.
 *
 * `targets` acepta varios embajadores: con uno se ve su portal (o el del embajador
 * impersonado) y con todos se ve la vista global del admin, que agrega los montos y
 * pinta a quién pertenece cada comisión.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const rowKey = (r: ComisionRow, i: number) => (r as EmbComision).referralId ?? `${r.id_cuenta_cobranza}-${i}`;

/** Sube la factura de la comisión: por cuenta de cobranza o, si es un referido sin
 *  cuenta, directamente en `embajadores_referidos.url_factura`. */
function useSubirFactura(onDone?: () => void) {
  const referidosFacturaColExists = useReferidosFacturaColExists();

  const render = (row: ComisionRow) => {
    const c = row as EmbComision;
    const est = comisionEstatus(c.detailed_status);
    if (est !== 'aprobado' && est !== 'pagada') return null;
    // Dueño de la comisión (en la vista global cada fila puede ser de otro embajador).
    const email = c.embajadorEmail;
    const idPersona = c.embajadorIdPersona;
    if (!email || !idPersona) return null;

    const isReferral = c.id_cuenta_cobranza === 0 && !!c.referralId;
    if (isReferral && !referidosFacturaColExists) {
      return <FacturaUploadButton disabled tooltip="Pendiente de configuración en BD" onUpload={async () => {}} />;
    }

    return (
      <FacturaUploadButton
        title="Factura de comisión"
        subtitle="Sube el PDF de tu factura"
        tooltip="Subir factura (PDF)"
        onUpload={async (file) => {
          if (isReferral) {
            const path = `facturas-comision/ref-${c.referralId}/${Date.now()}-${file.name}`;
            const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
            const { error: updErr } = await (supabase as any)
              .from('embajadores_referidos')
              .update({ url_factura: publicUrl })
              .eq('id', Number(c.referralId));
            if (updErr) throw updErr;
          } else {
            await subirFacturaComision({
              file,
              cuentaId: c.id_cuenta_cobranza,
              personaId: idPersona,
              email,
              supabase,
            });
          }
          onDone?.();
        }}
      />
    );
  };

  return render;
}

// ─────────────────────────── Comisiones ───────────────────────────
export function EmbajadorComisionesSection({ targets, showOwner }: {
  targets: EmbajadorComisionTarget[];
  /** Pinta el embajador dueño de cada comisión (vista global). */
  showOwner?: boolean;
}) {
  const { comisiones, totals, isLoading, refetch } = useEmbajadoresComisiones(targets);
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string } | null>(null);
  const renderFacturaUpload = useSubirFactura(() => { refetch(); toast.success('Factura registrada.'); });

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            {showOwner
              ? 'Vista global: comisiones de todos los embajadores, con su estatus y la factura/recibo asociados. Selecciona un embajador arriba para ver su portal.'
              : 'La comisión se genera cuando tu referido concreta una compra y la operación se valida. Aquí ves tus comisiones por venta, su estatus y la factura/recibo asociados.'}
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
        ) : (
          <ComisionesTable
            rows={comisiones}
            rowKey={rowKey}
            ownerLabel={showOwner ? (r) => (r as EmbComision).embajadorNombre : undefined}
            onView={(url, title) => setViewerDoc({ url, title })}
            renderFacturaUpload={renderFacturaUpload}
            emptyLabel={showOwner ? 'Aún no hay comisiones generadas.' : 'Aún no tienes comisiones generadas.'}
          />
        )}
      </Card>

      <ModalViewer
        open={!!viewerDoc}
        onOpenChange={(v) => { if (!v) setViewerDoc(null); }}
        url={viewerDoc?.url || ''}
        title={viewerDoc?.title || 'Documento'}
      />
    </div>
  );
}

// ─────────────────────────── Pagos ───────────────────────────
export function EmbajadorPagosSection({ targets, showOwner }: {
  targets: EmbajadorComisionTarget[];
  showOwner?: boolean;
}) {
  const { comisiones, isLoading, refetch } = useEmbajadoresComisiones(targets);
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string } | null>(null);
  const renderFacturaUpload = useSubirFactura(() => { refetch(); toast.success('Factura registrada.'); });

  // Pagos = comisiones ya autorizadas (en el flujo de cobro): factura_requerida, programada, pagada
  const pagos = comisiones.filter((c) => ['factura_requerida', 'programada', 'pagada'].includes(c.detailed_status));

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <Receipt className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            {showOwner
              ? 'Vista global: comisiones autorizadas de todos los embajadores y su factura/recibo.'
              : 'Cuando tu comisión es autorizada, sube tu factura. Una vez pagada, podrás descargar tu recibo.'}
          </p>
        </div>
      </Card>

      <Card className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ComisionesTable
            rows={pagos}
            rowKey={rowKey}
            ownerLabel={showOwner ? (r) => (r as EmbComision).embajadorNombre : undefined}
            onView={(url, title) => setViewerDoc({ url, title })}
            renderFacturaUpload={renderFacturaUpload}
            emptyLabel={showOwner ? 'No hay pagos autorizados todavía.' : 'No tienes pagos autorizados todavía.'}
          />
        )}
      </Card>

      <ModalViewer
        open={!!viewerDoc}
        onOpenChange={(v) => { if (!v) setViewerDoc(null); }}
        url={viewerDoc?.url || ''}
        title={viewerDoc?.title || 'Documento'}
      />
    </div>
  );
}
