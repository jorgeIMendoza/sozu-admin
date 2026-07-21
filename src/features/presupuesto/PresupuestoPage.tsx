// =============================================================
// Portal Condominio · Presupuesto — página principal.
// Header + selector de ejercicio + badge de estado + pestañas:
// Dashboard · Presupuesto (árbol) · Seguimiento mensual · Erogaciones · Propuestas.
// =============================================================
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/pages/admin/portal-condominio/_helpers";
import { usePresupuestoStore } from "./store";
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
  const aprobarPresupuesto = usePresupuestoStore((s) => s.aprobarPresupuesto);
  const reabrirBorrador = usePresupuestoStore((s) => s.reabrirBorrador);

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
            {presupuesto.estado === "borrador" ? (
              <button
                onClick={() => { aprobarPresupuesto(); toast({ title: "Presupuesto aprobado", description: "El catálogo y montos quedan bloqueados; los cambios requieren Modificación Presupuestal." }); }}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Aprobar presupuesto
              </button>
            ) : (
              <button
                onClick={() => { reabrirBorrador(); toast({ title: "Reabierto a borrador", description: "Edición libre del catálogo y montos." }); }}
                className="h-8 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted"
              >
                Reabrir a borrador
              </button>
            )}
          </div>
        }
      />


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
