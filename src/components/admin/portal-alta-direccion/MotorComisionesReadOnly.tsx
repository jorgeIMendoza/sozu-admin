import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, PieChart as PieChartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import type { MotorSnapshot } from "@/hooks/usePortalEstructuraComisiones/useComisionesValidacion";

/**
 * Colores de la dona (hsl LITERAL, no CSS vars: recharts pinta el `fill` como
 * atributo SVG, donde `var()` no resuelve → saldría negro). La dona reparte la
 * comisión total en tres partes.
 */
const EXTERNA_COLOR = "hsl(143, 33%, 51%)";    // verde — canal externo
const DISPERSADA_COLOR = "hsl(210, 92%, 45%)"; // azul — equipo interno
const REMANENTE_COLOR = "hsl(280, 60%, 50%)";  // púrpura — lo que se queda SOZU

type DonutSlice = { label: string; value: number; color: string };
type CanalResumen = {
  name: string;
  total: number;
  externa: number;
  dispersada: number;
  remanente: number;
  slices: DonutSlice[];
};

/**
 * Render de solo lectura del Motor de Comisiones a partir de un snapshot
 * (autocontenido). Reproduce el layout de `CommissionsTab` del Portal
 * Estructura de comisiones (tarjeta por canal con badges, tabla por
 * comisionista y "Resumen del canal"), sin depender del SimulatorContext ni
 * permitir edición.
 *
 * `precioReferenciaInicial` (opcional) prellena el "Precio de venta de
 * referencia" editable; con él se estima el valor en $ de cada comisión
 * (% sobre precio de venta final × precio de referencia).
 */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

export function MotorComisionesReadOnly({
  snapshot,
  precioReferenciaInicial,
}: {
  snapshot: MotorSnapshot;
  precioReferenciaInicial?: number;
}) {
  // Precio de venta de referencia editable; se recalcula al cambiar el
  // prellenado (p. ej. al cambiar de proyecto).
  const [precioRef, setPrecioRef] = useState<number>(precioReferenciaInicial ?? 0);
  useEffect(() => {
    setPrecioRef(precioReferenciaInicial ?? 0);
  }, [precioReferenciaInicial]);

  // Resumen por canal para las donas comparativas. Cada dona reparte la comisión
  // total del canal en tres partes: Externa + Dispersada (todo el equipo interno
  // agregado) + Remanente (lo que se queda SOZU).
  const resumenCanales = useMemo<CanalResumen[]>(() => {
    if (!snapshot) return [];
    return snapshot.channels.map((ch) => {
      const total = ch.totalCommissionPct ?? snapshot.totalCommissionPct ?? 0;
      const externa = ch.externalCommissionPct;
      const dispersada = snapshot.commissionRules
        .filter((r) => r.channelId === ch.id)
        .reduce((s, r) => s + (r.percentage || 0), 0);
      const remanente = total - externa - dispersada;

      const slices: DonutSlice[] = [];
      if (externa > 0.005) slices.push({ label: "Externa", value: +externa.toFixed(2), color: EXTERNA_COLOR });
      if (dispersada > 0.005) slices.push({ label: "Dispersada (equipo interno)", value: +dispersada.toFixed(2), color: DISPERSADA_COLOR });
      if (remanente > 0.005) slices.push({ label: "Remanente (SOZU)", value: +remanente.toFixed(2), color: REMANENTE_COLOR });

      return {
        name: ch.name,
        total: +total.toFixed(2),
        externa: +externa.toFixed(2),
        dispersada: +dispersada.toFixed(2),
        remanente: +remanente.toFixed(2),
        slices,
      };
    });
  }, [snapshot]);

  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Sin datos del motor en esta propuesta.</p>;
  }
  const { channels, roles, roleAssignments, commissionRules } = snapshot;
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const assignmentByRole = new Map(roleAssignments.map((a) => [a.roleId, a]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Modo: A · Sobre Venta · Comisión total{" "}
            {/* Los snapshots nuevos traen el total en cada canal; los previos, uno solo. */}
            <span className="font-semibold text-accent">
              {snapshot.totalCommissionPct != null
                ? `${snapshot.totalCommissionPct}%`
                : "definida por canal"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="precio-referencia" className="whitespace-nowrap text-xs text-muted-foreground">
            Precio de venta de referencia
          </label>
          <Input
            id="precio-referencia"
            type="number"
            min={0}
            step={100000}
            value={precioRef || ""}
            onChange={(e) => setPrecioRef(Math.max(0, Number(e.target.value) || 0))}
            className="h-8 w-40 text-right font-mono text-sm"
            placeholder="0"
          />
        </div>
      </div>

      {resumenCanales.length > 0 && <ComparativoCanalesChart data={resumenCanales} />}

      {channels.map((ch) => {
        const channelRules = commissionRules.filter((r) => r.channelId === ch.id);
        // Filas a mostrar: sin comisionistas en 0% y ordenadas de mayor a menor
        // comisión. El "Resumen del canal" sigue calculándose sobre todas las
        // reglas (channelRules) para no alterar la matemática de dispersión.
        const displayRules = channelRules
          .filter((r) => (r.percentage || 0) > 0)
          .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
        const extPct = ch.externalCommissionPct;
        const comisionTotal = ch.totalCommissionPct ?? snapshot.totalCommissionPct ?? 0;
        const comisionExterna = extPct;
        const comisionInterna = comisionTotal - comisionExterna;
        const sumaDispersada = channelRules.reduce((s, r) => s + (r.percentage || 0), 0);
        const remanente = comisionInterna - sumaDispersada;

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

            {displayRules.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Sin comisionistas con comisión asignada
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Comisionista</th>
                    <th>Rol</th>
                    <th>% sobre precio de venta final</th>
                    <th>Valor comisión estimado</th>
                    <th>Pool</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRules.map((rule, i) => {
                    const role = roleById.get(rule.roleId);
                    const assignment = assignmentByRole.get(rule.roleId);
                    const pct = rule.percentage || 0;
                    const valorEstimado = precioRef > 0 ? (pct / 100) * precioRef : null;
                    return (
                      <tr key={`${rule.channelId}-${rule.roleId}-${i}`}>
                        {/* Los snapshots previos al modelo por persona no traen
                            `comisionista`: ahí solo se conoce el rol. */}
                        <td className="text-sm font-medium">{rule.comisionista ?? "—"}</td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{role?.name ?? "—"}</span>
                            {assignment && role && (
                              <span className="text-[11px] text-muted-foreground">
                                {fmtCurrency(assignment.baseSalary)} / mes · {role.belongsTo === "sozu_central" ? "SOZU" : "Proyecto"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-sm">{pct.toFixed(2)}%</td>
                        <td className="font-mono text-sm">
                          {valorEstimado != null ? fmtCurrency(valorEstimado) : "—"}
                        </td>
                        <td className="text-sm">{rule.pool === "sozu" ? "SOZU" : "Proyecto"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {displayRules.length > 0 && precioRef <= 0 && (
              <p className="mt-2 text-[11px] italic text-muted-foreground">
                Ingresa un precio de venta de referencia arriba para estimar el valor de cada comisión.
              </p>
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

/* ───────────────────────────────────────────────────────────────────────────
 * Distribución de comisión por Canal de Venta — una dona por canal.
 * Cada dona reparte la comisión total del canal en Externa + comisionistas del
 * equipo interno + Remanente (SOZU). Colores hsl LITERAL (ver DONUT_COLORS).
 * ─────────────────────────────────────────────────────────────────────────── */

function ComparativoCanalesChart({ data }: { data: CanalResumen[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PieChartIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Distribución de comisión por canal</h3>
        <span className="text-[11px] text-muted-foreground">
          Comisión total = Externa + Dispersada (equipo interno) + Remanente (SOZU) · % sobre venta
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((canal) => (
          <CanalDonut key={canal.name} canal={canal} />
        ))}
      </div>
    </div>
  );
}

function CanalDonut({ canal }: { canal: CanalResumen }) {
  const hayDatos = canal.slices.length > 0 && canal.total > 0;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h4 className="mb-1 truncate text-sm font-semibold" title={canal.name}>
        {canal.name}
      </h4>
      {!hayDatos ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Sin comisión definida</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative h-[124px] w-[124px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={canal.slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {canal.slices.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <ReTooltip content={<DonutSliceTooltip total={canal.total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold leading-none tabular-nums">{canal.total.toFixed(2)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">total</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1">
            {canal.slices.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={s.label}>
                  {s.label}
                </span>
                <span className="tabular-nums font-medium">{s.value.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DonutSliceTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const s = payload[0]?.payload as DonutSlice | undefined;
  if (!s) return null;
  const share = total > 0 ? Math.round((s.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
        <span className="font-medium text-foreground">{s.label}</span>
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {s.value.toFixed(2)}% · {share}% del total del canal
      </div>
    </div>
  );
}
