// =============================================================
// Portal Condominio · Presupuesto — Propuestas (control de versiones).
// Reemplaza la columna "Eduardo" del Excel: comparativa Aprobado vs Propuesta
// por concepto (solo los que cambian), diferencia por partida e impacto total.
// Acciones: Adoptar (modificación auditada) o Descartar (con nota).
// =============================================================
import { useMemo, useState } from "react";
import { ArrowRight, Check, X, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { usePresupuestoStore } from "./store";
import { fmtMXN, fmtFecha } from "./logic";
import type { Concepto, PropuestaRevision } from "./types";

const ESTADO_META: Record<PropuestaRevision["estado"], { label: string; cls: string }> = {
  abierta: { label: "Abierta", cls: "bg-primary/15 text-primary" },
  adoptada: { label: "Adoptada", cls: "bg-success/15 text-success" },
  descartada: { label: "Descartada", cls: "bg-muted text-muted-foreground" },
};

export function Propuestas() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const propuestas = usePresupuestoStore((s) => s.propuestas);
  const adoptar = usePresupuestoStore((s) => s.adoptarPropuesta);
  const descartar = usePresupuestoStore((s) => s.descartarPropuesta);

  const [abierta, setAbierta] = useState<string | null>(propuestas.find((p) => p.estado === "abierta")?.id ?? null);
  const [descartarId, setDescartarId] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const conceptoById = useMemo(() => {
    const m = new Map<string, Concepto>();
    for (const c of presupuesto.conceptos) m.set(c.id, c);
    return m;
  }, [presupuesto]);

  const sel = propuestas.find((p) => p.id === abierta) ?? null;

  const comparativa = useMemo(() => {
    if (!sel) return [];
    return Object.entries(sel.cambios)
      .map(([cid, nuevo]) => {
        const c = conceptoById.get(cid);
        const actual = c?.presupuestoMensual ?? 0;
        return { concepto: c, cid, actual, nuevo, diffMensual: nuevo - actual };
      })
      .filter((x) => x.concepto);
  }, [sel, conceptoById]);

  const impactoMensual = comparativa.reduce((s, x) => s + x.diffMensual, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Lista de propuestas */}
      <div className="space-y-2">
        {propuestas.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin propuestas de revisión.</p>
        )}
        {propuestas.map((p) => {
          const meta = ESTADO_META[p.estado];
          return (
            <button
              key={p.id}
              onClick={() => setAbierta(p.id)}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition-colors",
                abierta === p.id ? "border-primary bg-primary/[0.04]" : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                  {p.autor}
                </span>
                <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-medium", meta.cls)}>{meta.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{fmtFecha(p.fecha)} · {Object.keys(p.cambios).length} cambio(s)</p>
            </button>
          );
        })}
      </div>

      {/* Detalle comparativo */}
      <div className="rounded-xl border border-border bg-card p-4">
        {!sel ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Selecciona una propuesta para comparar.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold">Propuesta de {sel.autor}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{sel.nota}</p>
              </div>
              {sel.estado === "abierta" && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setDescartarId(sel.id); setNota(""); }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Descartar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      adoptar(sel.id);
                      toast({ title: "Propuesta adoptada", description: "Los cambios se aplicaron como modificación auditada." });
                    }}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Adoptar
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-right">Aprobado (mensual)</th>
                    <th className="px-3 py-2 text-center"></th>
                    <th className="px-3 py-2 text-right">Propuesta (mensual)</th>
                    <th className="px-3 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparativa.map((x) => (
                    <tr key={x.cid} className="hover:bg-muted/20">
                      <td className="px-3 py-2">{x.concepto!.nombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMXN(x.actual)}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground"><ArrowRight className="h-3.5 w-3.5 inline" /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMXN(x.nuevo)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", x.diffMensual > 0 ? "text-destructive" : x.diffMensual < 0 ? "text-success" : "text-muted-foreground")}>
                        {x.diffMensual > 0 ? "+" : ""}{fmtMXN(x.diffMensual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-3 py-2" colSpan={4}>Impacto en el total</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", impactoMensual > 0 ? "text-destructive" : impactoMensual < 0 ? "text-success" : "")}>
                      {impactoMensual > 0 ? "+" : ""}{fmtMXN(impactoMensual)}/mes
                    </td>
                  </tr>
                  <tr className="text-xs text-muted-foreground">
                    <td className="px-3 py-1.5" colSpan={4}>Impacto anual</td>
                    <td className={cn("px-3 py-1.5 text-right tabular-nums", impactoMensual > 0 ? "text-destructive" : impactoMensual < 0 ? "text-success" : "")}>
                      {impactoMensual > 0 ? "+" : ""}{fmtMXN(impactoMensual * 12)}/año
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialog descartar */}
      {descartarId && (
        <Dialog open onOpenChange={(o) => !o && setDescartarId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Descartar propuesta</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Indica el motivo (queda en la auditoría).</p>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Motivo del descarte" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDescartarId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  descartar(descartarId, nota.trim());
                  toast({ title: "Propuesta descartada" });
                  setDescartarId(null);
                }}
              >
                Descartar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
