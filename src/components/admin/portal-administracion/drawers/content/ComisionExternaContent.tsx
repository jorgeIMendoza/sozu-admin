import { Building2, Mail, Receipt, Percent, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { DrawerActionFooter, type DrawerAction } from "../DrawerActionFooter";
import { Section, KV, StatusCard, StepList } from "./_shared";
import type { ComisionExternaEntity, VentaContext } from "../types";

const TIPO_LABEL: Record<ComisionExternaEntity["beneficiario_tipo"], string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

export function ComisionExternaContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: ComisionExternaEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  const cobroOk = entity.ya_se_cobro_al_desarrollador;

  // Stepper status según estado actual
  const stepStatus = (s: "devengada" | "facturada" | "aprobada" | "pagada") => {
    const order = ["devengada", "facturada", "aprobada", "pagada"] as const;
    const cur = order.indexOf(entity.estado as (typeof order)[number]);
    const idx = order.indexOf(s);
    if (cur < 0) return "pending" as const;
    if (idx < cur) return "done" as const;
    if (idx === cur) return "current" as const;
    return "pending" as const;
  };

  // Actions según estado + flag de cobro previo
  const actions: DrawerAction[] = (() => {
    if (entity.estado === "devengada" || entity.estado === "facturada") {
      if (!cobroOk) {
        return [
          {
            label: "Aprobar para pago",
            variant: "primary",
            disabled: true,
            disabledReason: "Requiere cobro previo al desarrollador",
            onClick: () => {},
          },
        ];
      }
      return [{ label: "Aprobar para pago", variant: "primary", onClick: () => {} }];
    }
    if (entity.estado === "aprobada") {
      return [{ label: "Marcar como pagada", variant: "primary", onClick: () => {} }];
    }
    if (entity.estado === "pagada") {
      return [{ label: "Ver CEP", variant: "secondary", onClick: () => {} }];
    }
    return [];
  })();

  return (
    <div className="space-y-6">
      <Section title="Beneficiario">
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {entity.beneficiario_nombre}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {TIPO_LABEL[entity.beneficiario_tipo]}
            </span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Receipt className="h-3 w-3" />
              {entity.beneficiario_rfc}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Datos de la comisión">
        <div className="grid grid-cols-2 gap-3">
          <KV icon={Receipt} label="Folio" value={entity.folio} mono />
          <KV
            icon={Percent}
            label="% aplicado"
            value={`${entity.porcentaje_comision.toFixed(2)}%`}
          />
          <KV icon={Calendar} label="Devengada" value={entity.fecha_devengo} />
          <KV
            icon={Clock}
            label="Antigüedad"
            value={`${entity.dias_desde_devengo} días`}
          />
          {entity.factura_referencia && (
            <KV
              icon={Mail}
              label="Factura asociada"
              value={entity.factura_referencia}
              mono
            />
          )}
          {entity.fecha_pago && (
            <KV icon={Calendar} label="Pagada" value={entity.fecha_pago} />
          )}
        </div>
        <div className="mt-3 rounded-md border border-border bg-card p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Monto comisión
          </span>
          <span className="text-xl font-bold tabular-nums">{fmtMxn(entity.monto)}</span>
        </div>
      </Section>

      <Section title="Estado del flujo">
        <StepList
          steps={[
            { label: "Devengada", status: stepStatus("devengada") },
            { label: "Factura recibida del externo", status: stepStatus("facturada") },
            { label: "Aprobada para pago", status: stepStatus("aprobada") },
            { label: "Pagada", status: stepStatus("pagada") },
          ]}
        />
      </Section>

      {(entity.estado === "devengada" ||
        entity.estado === "facturada" ||
        entity.estado === "aprobada") && (
        <Section title="Flag de cobro previo">
          {cobroOk ? (
            <StatusCard
              tone="success"
              icon={CheckCircle2}
              title="Cobro al desarrollador confirmado"
              body={
                <>
                  Pago a este externo está habilitado por la cadena A→B→C.
                  {entity.factura_referencia && (
                    <>
                      {" "}
                      Factura recibida:{" "}
                      <span className="font-mono">{entity.factura_referencia}</span>.
                    </>
                  )}
                </>
              }
            />
          ) : (
            <StatusCard
              tone="warning"
              icon={AlertTriangle}
              title="Sin cobro al desarrollador"
              body="SOZU no debe pagar a este externo hasta cobrar al desarrollador — riesgo de financiamiento involuntario."
            />
          )}
        </Section>
      )}

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas sobre la acción…"
        actions={actions}
      />
    </div>
  );
}
