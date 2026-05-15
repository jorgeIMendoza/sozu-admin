import { User, Mail, Receipt, Percent, Calendar, Clock } from "lucide-react";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { DrawerActionFooter } from "../DrawerActionFooter";
import { Section, KV, Timeline, TimelineItem, StepList } from "./_shared";
import type { ComisionInternaEntity, VentaContext } from "../types";

export function ComisionInternaContent({
  entity,
  ventaContext,
  onClose,
}: {
  entity: ComisionInternaEntity;
  ventaContext: VentaContext;
  onClose: () => void;
}) {
  const stepStatus = (s: "devengada" | "aprobada" | "autorizada" | "dispersada") => {
    const order = ["devengada", "aprobada", "autorizada", "dispersada"] as const;
    const cur = order.indexOf(entity.estado as (typeof order)[number]);
    const idx = order.indexOf(s);
    if (cur < 0) return "pending" as const;
    if (idx < cur) return "done" as const;
    if (idx === cur) return "current" as const;
    return "pending" as const;
  };

  // Avatar inicial
  const initials = entity.comisionista_nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <Section title="Comisionista">
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {entity.comisionista_nombre}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {entity.comisionista_rol}
            </p>
            {entity.comisionista_email && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{entity.comisionista_email}</span>
              </p>
            )}
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
          <KV icon={Calendar} label="Devengada" value={entity.fecha_devengo || "—"} />
          <KV
            icon={Clock}
            label="Esperando Director"
            value={`${entity.dias_esperando_director} días`}
          />
        </div>
        <div className="mt-3 rounded-md border border-border bg-card p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Monto a dispersar
          </span>
          <span className="text-xl font-bold tabular-nums">{fmtMxn(entity.monto)}</span>
        </div>
      </Section>

      <Section title="Estado en el ciclo">
        <StepList
          steps={[
            { label: "Devengada", status: stepStatus("devengada") },
            { label: "Aprobada por manager", status: stepStatus("aprobada") },
            { label: "Autorización Dirección", status: stepStatus("autorizada") },
            { label: "Dispersada vía nómina", status: stepStatus("dispersada") },
          ]}
        />
      </Section>

      <Section title="Actividad reciente">
        <Timeline>
          <TimelineItem
            label="Esperando autorización Director"
            meta={`${entity.dias_esperando_director} días`}
            tone="warning"
          />
          {entity.fecha_aprobacion && (
            <TimelineItem
              label="Aprobada por manager"
              meta={entity.fecha_aprobacion}
              tone="success"
            />
          )}
          <TimelineItem
            label="Devengada al cerrar venta"
            meta={`${ventaContext.folio} · ${ventaContext.propiedad}`}
            tone="success"
          />
        </Timeline>
      </Section>

      <DrawerActionFooter
        onCancel={onClose}
        notePlaceholder="Notas sobre la autorización (requeridas para devolver)…"
        actions={[
          {
            label: "Devolver para revisión",
            variant: "secondary",
            requiresNote: true,
            onClick: () => {},
          },
          { label: "Autorizar dispersión", variant: "primary", onClick: () => {} },
        ]}
      />
    </div>
  );
}

/** Permite reusar el helper sin re-exportar Mail desde afuera. */
export type { ComisionInternaEntity };
