import { AlertTriangle, User, Shield } from "lucide-react";
import { fmtMxn } from "@/data/administracion/mockData";
import { DrawerActionFooter } from "../DrawerActionFooter";
import { Section, StatusCard } from "./_shared";
import type { ExcepcionEntity, VentaContext } from "../types";

const TIPO_LABEL: Record<ExcepcionEntity["tipo"], string> = {
  descuento_fuera_politica: "Descuento fuera de política",
  pago_parcial_fuera_esquema: "Pago parcial fuera de esquema",
  ajuste_manual: "Ajuste manual",
  otro: "Otro",
};

export function ExcepcionContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: ExcepcionEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  // Cálculos derivados — válidos para descuento fuera de política
  const deltaPct = entity.monto_impactado > 0
    ? Math.round((entity.delta / entity.monto_impactado) * 1000) / 10
    : 0;
  const comisionSozuAfectada = Math.round(
    entity.delta * (ventaContext.porcentaje_comision / 100)
  );

  // Texto comparativo según tipo
  const comparativoPolicy = (() => {
    if (entity.tipo === "descuento_fuera_politica") {
      const exceso = Math.max(0, deltaPct - 5);
      return `Política actual: descuento máximo 5% para agentes externos sin VoBo. Esta solicitud excede el límite en ${exceso.toFixed(1)} puntos porcentuales.`;
    }
    if (entity.tipo === "pago_parcial_fuera_esquema") {
      return "Política actual: esquema estándar de 3 parcialidades para apartado + enganche. Variaciones requieren VoBo Dirección.";
    }
    return "Esta solicitud queda fuera del flujo automático y requiere VoBo Dirección.";
  })();

  return (
    <div className="space-y-6">
      <Section title="Tipo de excepción solicitada">
        <StatusCard
          tone="warning"
          icon={AlertTriangle}
          title={TIPO_LABEL[entity.tipo]}
          body={entity.descripcion_corta}
        />
        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <User className="h-3 w-3" /> Solicitado por
          </p>
          <p className="text-sm text-foreground mt-0.5">{entity.solicitante}</p>
        </div>
      </Section>

      <Section title="Impacto financiero">
        <div className="space-y-2 text-sm">
          <Row
            label="Monto base de la operación"
            value={fmtMxn(entity.monto_impactado)}
            tone="muted"
          />
          <Row
            label={`Delta solicitado${deltaPct ? ` (${deltaPct.toFixed(1)}%)` : ""}`}
            value={`-${fmtMxn(entity.delta)}`}
            tone="danger"
            strong
          />
          <Row
            label={`Comisión SOZU afectada (${ventaContext.porcentaje_comision}% del delta)`}
            value={`-${fmtMxn(comisionSozuAfectada)}`}
            tone="muted"
          />
        </div>
      </Section>

      <Section title="Comparativo con política">
        <StatusCard tone="info" icon={Shield} title="Política actual" body={comparativoPolicy} />
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Justificación de la decisión (requerida para ambas opciones)…"
        actions={[
          {
            label: "Rechazar excepción",
            variant: "destructive",
            requiresNote: true,
            onClick: () => {},
          },
          {
            label: "Aprobar excepción",
            variant: "primary",
            requiresNote: true,
            onClick: () => {},
          },
        ]}
      />
    </div>
  );
}

function Row({
  label,
  value,
  tone = "muted",
  strong,
}: {
  label: string;
  value: string;
  tone?: "muted" | "danger";
  strong?: boolean;
}) {
  const labelClass = tone === "danger" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground";
  const valueClass = [
    "tabular-nums",
    strong ? "font-bold" : "font-medium",
    tone === "danger" ? "text-rose-700 dark:text-rose-300" : "text-foreground",
  ].join(" ");
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
