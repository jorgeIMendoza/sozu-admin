import { Building2, Calendar, Clock, Receipt, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { DrawerActionFooter, type DrawerAction } from "../DrawerActionFooter";
import { Section, KV, Timeline, TimelineItem, StatusCard } from "./_shared";
import type { PagoExternoEntity, VentaContext } from "../types";

const TIPO_LABEL: Record<PagoExternoEntity["beneficiario_tipo"], string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

export function PagoExternoContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: PagoExternoEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  const cobroConfirmado = entity.ya_se_cobro_al_desarrollador;

  // Actions condicionadas según flag de cobro previo
  const actions: DrawerAction[] = cobroConfirmado
    ? [
        {
          label: "Bloquear pago",
          variant: "destructive",
          requiresNote: true,
          onClick: () => {},
        },
        { label: "Autorizar pago", variant: "primary", onClick: () => {} },
      ]
    : [
        { label: "Bloquear pago", variant: "destructive", onClick: () => {} },
        {
          label: "Autorizar pago",
          variant: "primary",
          disabled: true,
          disabledReason: "Requiere confirmar cobro al desarrollador primero",
          onClick: () => {},
        },
      ];

  return (
    <div className="space-y-6">
      <Section title="Datos de la factura recibida">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio CFDI" value={entity.folio_cfdi} mono />
          <KV icon={Building2} label="Beneficiario" value={entity.beneficiario_nombre} />
          <KV
            icon={Receipt}
            label="Tipo"
            value={TIPO_LABEL[entity.beneficiario_tipo]}
          />
          <KV
            icon={Receipt}
            label="RFC"
            value={entity.beneficiario_rfc || "—"}
            mono
          />
          <KV icon={Calendar} label="Emisión" value={entity.fecha_emision} />
          <KV
            icon={Clock}
            label="Antigüedad"
            value={`${entity.dias_desde_emision} días`}
          />
        </div>
        <div className="mt-3 rounded-md border border-border bg-card p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Monto a pagar
          </span>
          <span className="text-xl font-bold tabular-nums">{fmtMxn(entity.monto)}</span>
        </div>
      </Section>

      <Section title="Estado de cobro previo">
        {cobroConfirmado ? (
          <StatusCard
            tone="success"
            icon={CheckCircle2}
            title="Cobro al desarrollador confirmado"
            body={
              <>
                {entity.factura_cobrar_referencia ? (
                  <>
                    Factura{" "}
                    <span className="font-mono">{entity.factura_cobrar_referencia}</span>{" "}
                    cobrada.
                  </>
                ) : (
                  "Cobro reconocido."
                )}{" "}
                Pago a este externo está habilitado.
              </>
            }
          />
        ) : (
          <StatusCard
            tone="warning"
            icon={AlertTriangle}
            title="Cobro al desarrollador aún pendiente"
            body={
              <>
                {entity.factura_cobrar_referencia ? (
                  <>
                    {entity.factura_cobrar_referencia} emitida hace{" "}
                    {entity.factura_cobrar_emitida_dias ?? "—"} días.{" "}
                  </>
                ) : null}
                SOZU no debe pagar a este externo hasta confirmar cobro — riesgo de
                financiamiento involuntario.
              </>
            }
          />
        )}
      </Section>

      <Section title="Actividad reciente">
        <Timeline>
          <TimelineItem
            label={cobroConfirmado ? "Pago habilitado" : "Esperando cobro al desarrollador"}
            meta={
              cobroConfirmado
                ? "Factura del desarrollador liquidada"
                : "Capa B sin ejecutar · bloqueo automático"
            }
            tone={cobroConfirmado ? "success" : "warning"}
          />
          <TimelineItem
            label="Factura recibida del externo"
            meta={`${entity.fecha_emision} · ${entity.folio_cfdi} · ${fmtMxn(entity.monto)}`}
          />
          <TimelineItem
            label="Comisión externa devengada"
            meta={`${ventaContext.folio} · ${ventaContext.propiedad}`}
            tone="success"
          />
        </Timeline>
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas sobre el pago (requeridas si se bloquea con cobro confirmado)…"
        actions={actions}
      />
    </div>
  );
}
