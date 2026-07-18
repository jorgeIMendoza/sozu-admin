// =============================================================
// Portal Condominio · Presupuesto — página principal.
// Header + selector de ejercicio + badge de estado + pestañas:
// Dashboard · Presupuesto (árbol) · Seguimiento mensual · Erogaciones · Propuestas.
// Controles de demo detrás de import.meta.env.DEV.
// =============================================================
import { useState } from "react";
import { RotateCcw, CalendarClock, Beaker } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/pages/admin/portal-condominio/_helpers";
import { usePresupuestoStore } from "./store";
import { MESES } from "./logic";
import type { EstadoPresupuesto } from "./types";
import { DashboardPresupuestal } from "./DashboardPresupuestal";
import { ArbolPresupuesto } from "./ArbolPresupuesto";
import { SeguimientoMensual } from "./SeguimientoMensual";
import { Erogaciones } from "./Erogaciones";
import { Propuestas } from "./Propuestas";
import { toast } from "@/hooks/use-toast";

type Tab = "dashboard" | "arbol" | "mensual" | "erogaciones" | "propuestas";

const ESTADO_BADGE: Record<EstadoPresupuesto, string> = {
  borrador: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  aprobado: "bg-success/15 text-success",
  cerrado: "bg-muted text-muted-foreground",
};
const ESTADO_LABEL: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  cerrado: "Cerrado",
};

export default function PresupuestoPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const mesActual = usePresupuestoStore((s) => s.mesActual());
  const reset = usePresupuestoStore((s) => s.reset);
  const avanzarMes = usePresupuestoStore((s) => s.avanzarMes);
  const registrar = usePresupuestoStore((s) => s.registrarErogacionDesdeTesoreria);

  const tabs: { k: Tab; label: string }[] = [
    { k: "dashboard", label: "Dashboard" },
    { k: "arbol", label: "Presupuesto" },
    { k: "mensual", label: "Seguimiento mensual" },
    { k: "erogaciones", label: "Erogaciones" },
    { k: "propuestas", label: "Propuestas" },
  ];

  return (
    <div>
      <PageHeader
        title="Presupuesto"
        subtitle={`Ejercicio ${presupuesto.ejercicio} · Margot`}
        actions={
          <div className="flex items-center gap-2">
            {/* Selector de ejercicio: un solo año en esta fase (mock). */}
            <select
              value={presupuesto.ejercicio}
              disabled
              className="h-8 px-2 rounded-md border border-border bg-background text-sm tabular-nums disabled:opacity-70"
              aria-label="Ejercicio"
            >
              <option value={presupuesto.ejercicio}>{presupuesto.ejercicio}</option>
            </select>
            <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium", ESTADO_BADGE[presupuesto.estado])}>
              {ESTADO_LABEL[presupuesto.estado]}
            </span>
          </div>
        }
      />

      {/* Controles de demo (solo DEV) */}
      {import.meta.env.DEV && (
        <div className="flex flex-wrap items-center gap-2 mb-4 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Beaker className="h-3.5 w-3.5" /> Demo
          </span>
          <button
            onClick={() => { reset(); toast({ title: "Datos repoblados" }); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" /> Repoblar
          </button>
          <button
            onClick={() => { avanzarMes(); toast({ title: "Mes avanzado" }); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:bg-muted"
          >
            <CalendarClock className="h-3 w-3" /> Avanzar mes (actual: {MESES[mesActual]})
          </button>
          <button
            onClick={() => {
              // Simula un egreso ya clasificado que entra por Tesorería.
              registrar({
                conceptoId: "k-cfe",
                monto: 22000,
                proveedor: "CFE",
                concepto: `Consumo CFE áreas comunes (${MESES[mesActual]})`,
              });
              toast({ title: "Egreso clasificado simulado", description: "Se registró una erogación contra CFE." });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:bg-muted"
          >
            <Beaker className="h-3 w-3" /> Simular egreso clasificado
          </button>
        </div>
      )}

      {/* Pestañas */}
      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-sm mb-4">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              tab === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardPresupuestal />}
      {tab === "arbol" && <ArbolPresupuesto />}
      {tab === "mensual" && <SeguimientoMensual />}
      {tab === "erogaciones" && <Erogaciones />}
      {tab === "propuestas" && <Propuestas />}
    </div>
  );
}
