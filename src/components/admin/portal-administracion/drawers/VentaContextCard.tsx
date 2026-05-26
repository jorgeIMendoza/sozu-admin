import { fmtMxn } from "@/data/administracion/mockData";
import { Pill } from "@/components/admin/portal-administracion/ui";
import { cn } from "@/lib/utils";
import type { VentaContext, EstadoVenta } from "./types";

const ESTADO_TONE: Record<EstadoVenta, string> = {
  "En oferta": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "En apartado": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "En firma": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Vendida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Liquidada: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function VentaContextCard({ ctx }: { ctx: VentaContext }) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4",
      "grid grid-cols-1 sm:grid-cols-3 gap-4"
    )}>
      {/* Col 1 — Identificación */}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Folio
        </p>
        <p className="text-base font-semibold text-foreground font-mono mt-0.5 truncate">
          {ctx.folio}
        </p>
        <p className="text-sm text-muted-foreground mt-1 truncate">{ctx.propiedad}</p>
      </div>

      {/* Col 2 — Cliente y monto */}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Cliente
        </p>
        <p className="text-sm text-foreground mt-0.5 truncate">{ctx.cliente}</p>
        {ctx.precio_venta > 0 ? (
          <p className="text-base font-semibold text-foreground tabular-nums mt-1">
            {fmtMxn(ctx.precio_venta)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic mt-1">Sin precio disponible</p>
        )}
      </div>

      {/* Col 3 — Estado */}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Estado
        </p>
        <div className="mt-0.5">
          <Pill className={ESTADO_TONE[ctx.estado_venta]}>{ctx.estado_venta}</Pill>
        </div>
        <p className="text-xs text-muted-foreground mt-2 tabular-nums">
          {ctx.dias_desde_apartado > 0
            ? `${ctx.dias_desde_apartado} días desde apartado`
            : "—"}
        </p>
      </div>
    </div>
  );
}
