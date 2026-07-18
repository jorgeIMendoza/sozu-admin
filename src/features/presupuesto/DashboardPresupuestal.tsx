// =============================================================
// Portal Condominio · Presupuesto — Dashboard presupuestal (default).
// KPIs, cobertura de cuota, composición del gasto por área (mayor→menor),
// áreas sobre-ejercidas y Fondo de Reserva vs umbral. Solo SVG/CSS (sin charts).
// =============================================================
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresupuestoStore, presupuestoAnualTotal } from "./store";
import {
  derivarArea,
  derivarTotal,
  fmtMXN,
  fmtPct,
  semaforoDe,
} from "./logic";
import { SEMAFORO_META, BarraEjercido } from "./ui";
import type { AreaGasto } from "./types";

function KPI({
  title,
  value,
  sub,
  variant = "default",
}: {
  title: string;
  value: string;
  sub?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const ring = {
    default: "border-border",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-destructive/30",
  }[variant];
  return (
    <div className={cn("rounded-xl border bg-card p-4", ring)}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight mt-1.5">{value}</p>
      {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}

export function DashboardPresupuestal() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const erogaciones = usePresupuestoStore((s) => s.erogaciones);
  const mesActual = usePresupuestoStore((s) => s.mesActual());

  const { total, porArea, anual, fondoArea } = useMemo(() => {
    const total = derivarTotal(presupuesto, erogaciones, mesActual);
    const porArea = presupuesto.areas
      .map((area) => ({
        area,
        d: derivarArea(area, presupuesto.centrosCosto, presupuesto.conceptos, erogaciones, presupuesto.ejercicio, mesActual),
      }))
      .sort((a, b) => b.d.presupuestoAnual - a.d.presupuestoAnual);
    const anual = presupuestoAnualTotal(presupuesto);
    // Fondo de Reserva: se identifica por nombre (dato), no por id fijo.
    const fondoArea = porArea.find((x) => x.area.nombre.toLowerCase().includes("fondo de reserva"));
    return { total, porArea, anual, fondoArea };
  }, [presupuesto, erogaciones, mesActual]);

  const semTotal = semaforoDe(total);
  const maxArea = porArea[0]?.d.presupuestoAnual ?? 1;

  // Cobertura: cuánto del presupuesto cubre la cobranza esperada.
  // SWAP POINT: cobranzaEsperadaAnual desde el módulo de Cobranza del condominio.
  const cobranza = presupuesto.cobranzaEsperadaAnual;
  const cobertura = anual > 0 ? (cobranza / anual) * 100 : 0;
  const cubre = cobertura >= 100;

  // Fondo de Reserva vs umbral (≥ % del presupuesto anual).
  const umbralMonto = anual * presupuesto.umbralFondoReserva;
  const fondoAnual = fondoArea?.d.presupuestoAnual ?? 0;
  const fondoAlcanza = fondoAnual >= umbralMonto;

  const sobreEjercidas = porArea.filter((x) => semaforoDe(x.d) === "excedido");

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="Presupuesto anual" value={fmtMXN(total.presupuestoAnual)} sub={`Ejercicio ${presupuesto.ejercicio}`} />
        <KPI title="Erogado YTD" value={fmtMXN(total.erogadoAcumulado)} variant="warning" sub={`Al ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mesActual]}`} />
        <KPI
          title="Disponible"
          value={fmtMXN(total.disponible)}
          variant={total.disponible < 0 ? "danger" : "default"}
        />
        <KPI
          title="% ejercido"
          value={fmtPct(total.porcentajeEjercido, 1)}
          variant={semTotal === "excedido" ? "danger" : semTotal === "cerca" ? "warning" : "success"}
          sub={<BarraEjercido porcentaje={total.porcentajeEjercido} estado={semTotal} />}
        />
      </div>

      {/* Cobertura de cuota + Fondo de Reserva */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cn("rounded-xl border bg-card p-4", cubre ? "border-success/30" : "border-destructive/30")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cobertura de cuota</p>
            {cubre ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
          <p className={cn("text-2xl font-bold tabular-nums mt-1.5", cubre ? "text-success" : "text-destructive")}>
            La cuota cubre el {fmtPct(cobertura)} del presupuesto
          </p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Cobranza esperada {fmtMXN(cobranza)} vs presupuesto {fmtMXN(anual)}
          </p>
          {!cubre && (
            <p className="text-xs text-destructive mt-1 tabular-nums">
              Déficit anual estimado: {fmtMXN(anual - cobranza)}
            </p>
          )}
        </div>

        <div className={cn("rounded-xl border bg-card p-4", fondoAlcanza ? "border-success/30" : "border-warning/30")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fondo de Reserva</p>
            {fondoAlcanza ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
          </div>
          <p className={cn("text-2xl font-bold tabular-nums mt-1.5", fondoAlcanza ? "text-success" : "text-warning")}>
            {fmtMXN(fondoAnual)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Umbral ≥ {fmtPct(presupuesto.umbralFondoReserva * 100)} del presupuesto = {fmtMXN(umbralMonto)}
          </p>
          {!fondoAlcanza && (
            <p className="text-xs text-warning mt-1 tabular-nums">
              Falta {fmtMXN(umbralMonto - fondoAnual)} para alcanzar el umbral.
            </p>
          )}
        </div>
      </div>

      {/* Composición del gasto por área */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Composición del gasto por área</h3>
          <span className="text-xs text-muted-foreground">(presupuesto anual, mayor a menor)</span>
        </div>
        <div className="space-y-2">
          {porArea.map(({ area, d }) => {
            const pct = anual > 0 ? (d.presupuestoAnual / anual) * 100 : 0;
            const ancho = maxArea > 0 ? (d.presupuestoAnual / maxArea) * 100 : 0;
            return (
              <div key={area.id} className="flex items-center gap-3">
                <div className="w-44 shrink-0 text-sm truncate" title={area.nombre}>{area.nombre}</div>
                <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                  <div className="h-full rounded bg-primary/80 flex items-center" style={{ width: `${Math.max(ancho, 2)}%` }} />
                </div>
                <div className="w-14 text-right text-sm tabular-nums font-medium">{fmtPct(pct)}</div>
                <div className="w-28 text-right text-sm tabular-nums text-muted-foreground">{fmtMXN(d.presupuestoAnual)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Áreas sobre-ejercidas */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Áreas sobre-ejercidas</h3>
        {sobreEjercidas.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Ninguna área excede su presupuesto a la fecha.
          </p>
        ) : (
          <div className="space-y-2">
            {sobreEjercidas.map(({ area, d }) => (
              <AreaSobreEjercida key={area.id} area={area} anual={d.presupuestoAnual} erogado={d.erogadoAcumulado} proporcional={d.presupuestoALaFecha} variacion={d.variacion} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AreaSobreEjercida({
  area,
  anual,
  erogado,
  proporcional,
  variacion,
}: {
  area: AreaGasto;
  anual: number;
  erogado: number;
  proporcional: number;
  variacion: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-6 w-6 rounded-md flex items-center justify-center", SEMAFORO_META.excedido.badge)}>
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{area.nombre}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Erogado {fmtMXN(erogado)} vs presupuesto a la fecha {fmtMXN(proporcional)} · anual {fmtMXN(anual)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-destructive tabular-nums">+{fmtMXN(variacion)}</p>
        <p className="text-[11px] text-muted-foreground">sobre lo proporcional</p>
      </div>
    </div>
  );
}
