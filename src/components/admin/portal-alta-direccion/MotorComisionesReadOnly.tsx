import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MotorSnapshot } from "@/hooks/usePortalEstructuraComisiones/useComisionesValidacion";

/**
 * Render de solo lectura del Motor de Comisiones a partir de un snapshot
 * (autocontenido). Reproduce el layout de `CommissionsTab` del Portal
 * Estructura de comisiones (tarjeta por canal con badges, tabla Rol/%/Pool y
 * "Resumen del canal"), sin depender del SimulatorContext ni permitir edición.
 */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

export function MotorComisionesReadOnly({ snapshot }: { snapshot: MotorSnapshot }) {
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Sin datos del motor en esta propuesta.</p>;
  }
  const { channels, roles, roleAssignments, commissionRules } = snapshot;
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const assignmentByRole = new Map(roleAssignments.map((a) => [a.roleId, a]));
  const sobre = snapshot.commissionMode === "on_sale_value" ? "sobre venta" : "sobre remanente";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            Modo: {snapshot.commissionMode === "on_sale_value" ? "A · Sobre Venta" : "B · Sobre Remanente"} · Comisión total{" "}
            <span className="font-semibold text-accent">{snapshot.totalCommissionPct}%</span>
          </p>
        </div>
      </div>

      {channels.map((ch) => {
        const channelRules = commissionRules.filter((r) => r.channelId === ch.id);
        const extPct = ch.externalCommissionPct;
        const comisionTotal = snapshot.totalCommissionPct;
        const comisionExterna = extPct;
        const comisionInterna = comisionTotal - comisionExterna;
        const sumaDispersada = channelRules.reduce((s, r) => s + (r.percentage || 0), 0);
        const remanente = snapshot.commissionMode === "on_sale_value"
          ? comisionInterna - sumaDispersada
          : 100 - sumaDispersada;

        const completo = Math.abs(remanente) < 0.005;
        const statusColor = completo
          ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
          : remanente > 0
            ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
            : "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400";
        const statusText = completo
          ? "Distribución completa"
          : remanente > 0
            ? `Falta por dispersar ${remanente.toFixed(2)}%`
            : `Excedido por ${Math.abs(remanente).toFixed(2)}%`;
        const StatusIcon = completo ? CheckCircle : AlertTriangle;

        return (
          <div key={ch.id} className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{ch.name}</h3>
                <Badge variant="outline" className="text-[10px]">Ext: {extPct}%</Badge>
              </div>
              <div className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${statusColor}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusText}
              </div>
            </div>

            {channelRules.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Sin reglas de comisión definidas</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>% {sobre}</th>
                    <th>Pool</th>
                  </tr>
                </thead>
                <tbody>
                  {channelRules.map((rule, i) => {
                    const role = roleById.get(rule.roleId);
                    const assignment = assignmentByRole.get(rule.roleId);
                    return (
                      <tr key={`${rule.channelId}-${rule.roleId}-${i}`}>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{role?.name ?? "—"}</span>
                            {assignment && role && (
                              <span className="pl-0.5 text-[11px] text-muted-foreground">
                                {fmtCurrency(assignment.baseSalary)} / mes · {role.belongsTo === "sozu_central" ? "SOZU" : "Proyecto"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-sm">{(rule.percentage || 0).toFixed(2)}%</td>
                        <td className="text-sm">{rule.pool === "sozu" ? "SOZU" : "Proyecto"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className={`mt-4 rounded-lg border p-4 ${statusColor}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Resumen del canal</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusText}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Resumen label="Comisión total" value={comisionTotal} />
                <Resumen label="Externa" value={comisionExterna} />
                <Resumen label="Interna esperada" value={comisionInterna} />
                <Resumen label="Dispersada" value={sumaDispersada} />
                <Resumen label="Remanente" value={remanente} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Resumen({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-[10px] uppercase tracking-wide opacity-60">{label}</p>
      <p className="font-mono text-sm font-bold">{value.toFixed(2)}%</p>
    </div>
  );
}
