import { Receipt, Building2, Calendar, Banknote, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { DrawerActionFooter, type DrawerAction } from "../DrawerActionFooter";
import { Section, KV, StatusCard } from "./_shared";
import type { FacturaPorCobrarEntity, VentaContext } from "../types";

export function FacturaPorCobrarContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: FacturaPorCobrarEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  // ─── Acciones según estado ───
  const actions: DrawerAction[] = (() => {
    if (entity.estado === "timbrada_pendiente" || entity.estado === "cobro_parcial") {
      return [
        { label: "Enviar recordatorio", variant: "secondary", onClick: () => {} },
        { label: "Marcar como cobrada", variant: "primary", onClick: () => {} },
      ];
    }
    if (entity.estado === "vencida") {
      return [
        {
          label: "Escalar a Dirección",
          variant: "destructive",
          requiresNote: true,
          onClick: () => {},
        },
        { label: "Enviar recordatorio urgente", variant: "secondary", onClick: () => {} },
        { label: "Marcar como cobrada", variant: "primary", onClick: () => {} },
      ];
    }
    if (entity.estado === "cobrada") {
      return [{ label: "Ver comprobante", variant: "secondary", onClick: () => {} }];
    }
    return [];
  })();

  return (
    <div className="space-y-6">
      <Section title="Datos del CFDI">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio" value={entity.folio_cfdi} mono />
          <KV icon={Calendar} label="Fecha emisión" value={entity.fecha_emision} />
          <KV
            icon={Building2}
            label="Desarrollador"
            value={entity.desarrollador_nombre}
          />
          <KV icon={Receipt} label="RFC" value={entity.desarrollador_rfc} mono />
          <KV icon={Banknote} label="Subtotal" value={fmtMxn(entity.monto_subtotal)} />
          <KV icon={Banknote} label="IVA" value={fmtMxn(entity.iva)} />
        </div>
        <div className="mt-3 rounded-md border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Total CFDI
            </span>
            <span className="text-xl font-bold tabular-nums">
              {fmtMxn(entity.monto_total)}
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground truncate">
            UUID: {entity.uuid_sat}
          </p>
        </div>
      </Section>

      <Section title="Estado de cobro">
        {entity.estado === "timbrada_pendiente" && (
          <StatusCard
            tone="info"
            icon={Clock}
            title="Esperando pago del desarrollador"
            body={
              <>
                Plazo de 30 días — quedan{" "}
                <span className="font-semibold">{Math.max(0, entity.dias_para_vencer)} días</span>.
              </>
            }
          />
        )}
        {entity.estado === "cobro_parcial" && (
          <StatusCard
            tone="warning"
            icon={Clock}
            title="Cobro parcial recibido"
            body={
              <>
                Recibido:{" "}
                <span className="font-semibold tabular-nums">{fmtMxn(entity.monto_cobrado)}</span>{" "}
                de {fmtMxn(entity.monto_total)}. Pendiente:{" "}
                <span className="font-semibold tabular-nums">
                  {fmtMxn(entity.monto_total - entity.monto_cobrado)}
                </span>
                . Quedan {Math.max(0, entity.dias_para_vencer)} días al vencimiento.
              </>
            }
          />
        )}
        {entity.estado === "cobrada" && (
          <StatusCard
            tone="success"
            icon={CheckCircle2}
            title={`Cobrado el ${entity.fecha_pago_real || "—"}`}
            body={
              <>
                Monto recibido:{" "}
                <span className="font-semibold tabular-nums">{fmtMxn(entity.monto_cobrado)}</span>.
              </>
            }
          />
        )}
        {entity.estado === "vencida" && (
          <StatusCard
            tone="danger"
            icon={AlertCircle}
            title={`Vencida hace ${Math.abs(entity.dias_para_vencer)} días`}
            body="Requiere seguimiento inmediato — sin cobro impacta la cadena A→B→C→D."
          />
        )}
        {entity.estado === "cancelada" && (
          <StatusCard
            tone="info"
            icon={Receipt}
            title="CFDI cancelado"
            body="No requiere acción adicional."
          />
        )}
      </Section>

      <Section title="Venta de origen">
        <p className="text-sm text-foreground leading-relaxed">
          Este CFDI corresponde a la comisión por intermediación que SOZU le emitió al
          desarrollador por la venta{" "}
          <span className="font-mono font-semibold">{ventaContext.folio}</span> —{" "}
          {ventaContext.propiedad}. El monto facturado representa el{" "}
          <span className="font-semibold">{ventaContext.porcentaje_comision}%</span> sobre
          el precio de venta de{" "}
          <span className="font-semibold tabular-nums">
            {fmtMxn(ventaContext.precio_venta)}
          </span>
          .
        </p>
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas sobre la acción (requeridas para escalar a Dirección)…"
        actions={actions}
      />
    </div>
  );
}
