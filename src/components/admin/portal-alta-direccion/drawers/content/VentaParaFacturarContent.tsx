import { Calendar, Clock, DollarSign, Building2 } from "lucide-react";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { DrawerActionFooter } from "../DrawerActionFooter";
import { Section, KV, Timeline, TimelineItem } from "./_shared";
import type { VentaContext, VentaParaFacturarEntity } from "../types";

export function VentaParaFacturarContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: VentaParaFacturarEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  // Para el "impacto", calculamos las comisiones externas+internas asociadas
  // como % razonables sobre la comisión total. Demo numbers.
  const comisionExterna = Math.round(ventaContext.comision_total_sozu * 0.4);
  const comisionInterna = Math.round(ventaContext.comision_total_sozu * 0.54);

  return (
    <div className="space-y-6">
      <Section
        title="Por qué requiere tu validación"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Esta venta fue reconocida hace{" "}
            <span className="font-semibold">{entity.dias_esperando} días</span> pero aún
            no se ha emitido factura al desarrollador. Requiere tu autorización para
            proceder con el timbrado.
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
          <KV icon={Calendar} label="Fecha venta reconocida" value={entity.fecha_venta} />
          <KV icon={Clock} label="Días esperando" value={`${entity.dias_esperando} días`} />
          <KV
            icon={DollarSign}
            label="Comisión a facturar"
            value={fmtMxn(entity.monto_factura_desarrollador)}
          />
          <KV icon={Building2} label="Desarrollador" value={entity.desarrollador_nombre} />
        </div>
      </Section>

      <Section
        title="Impacto de la decisión"
        body={
          <p className="text-sm text-foreground leading-relaxed">
            Al autorizar, SOZU emite CFDI por{" "}
            <span className="font-semibold tabular-nums">
              {fmtMxn(entity.monto_factura_desarrollador)}
            </span>{" "}
            al desarrollador. Esto habilita el cobro y, posteriormente, el pago de
            comisiones externas (
            <span className="font-semibold tabular-nums">{fmtMxn(comisionExterna)}</span>) e
            internas (
            <span className="font-semibold tabular-nums">{fmtMxn(comisionInterna)}</span>)
            asociadas a esta venta.
          </p>
        }
      />

      <Section title="Actividad reciente">
        <Timeline>
          <TimelineItem
            label="Pendiente factura al desarrollador"
            meta={`desde ${entity.fecha_venta} · ${entity.dias_esperando} días esperando`}
            tone="warning"
          />
          <TimelineItem
            label="Comisión externa devengada"
            meta={`${entity.fecha_venta} · ${fmtMxn(comisionExterna)}`}
          />
          <TimelineItem
            label="VENTA reconocida"
            meta={`${entity.fecha_venta} · ${entity.comprador_principal}`}
            tone="success"
          />
        </Timeline>
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas opcionales para la autorización (o requeridas si se rechaza)…"
        actions={[
          {
            label: "Rechazar venta",
            variant: "destructive",
            requiresNote: true,
            onClick: () => {},
          },
          {
            label: "Posponer 24h",
            variant: "secondary",
            onClick: () => {},
          },
          {
            label: "Autorizar emisión de factura",
            variant: "primary",
            onClick: () => {},
          },
        ]}
      />
    </div>
  );
}
