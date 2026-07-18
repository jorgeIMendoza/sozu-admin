// =============================================================
// Portal Condominio · Presupuesto — Árbol jerárquico colapsable.
// Área → Centro de Costo → Concepto. Presupuesto / Erogado / Disponible / % /
// Variación con semáforo; totales por centro, área y TOTAL GENERAL.
// Editable en borrador; en aprobado solo lectura (editar = modificación auditada).
// =============================================================
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { usePresupuestoStore } from "./store";
import {
  derivarArea, derivarCentro, derivarConcepto, derivarTotal,
  presupuestoAnualConcepto, fmtMXN, semaforoDe, type Semaforo,
} from "./logic";
import { SemaforoBadge, BarraEjercido, Variacion } from "./ui";
import type { Concepto, DerivadoPartida } from "./types";

function celda(n: number) {
  return <span className="tabular-nums">{fmtMXN(n)}</span>;
}

export function ArbolPresupuesto() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const erogaciones = usePresupuestoStore((s) => s.erogaciones);
  const mesActual = usePresupuestoStore((s) => s.mesActual());
  const editarConceptoMensual = usePresupuestoStore((s) => s.editarConceptoMensual);
  const modificarConceptoAprobado = usePresupuestoStore((s) => s.modificarConceptoAprobado);

  const esBorrador = presupuesto.estado === "borrador";

  const [abiertasAreas, setAbiertasAreas] = useState<Set<string>>(new Set());
  const [abiertosCentros, setAbiertosCentros] = useState<Set<string>>(new Set());
  const [modif, setModif] = useState<{ concepto: Concepto } | null>(null);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const total = useMemo(
    () => derivarTotal(presupuesto, erogaciones, mesActual),
    [presupuesto, erogaciones, mesActual],
  );

  const areasOrden = [...presupuesto.areas].sort((a, b) => a.numero - b.numero);

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-muted/50 text-[11px] text-muted-foreground uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Concepto</th>
            <th className="px-3 py-2 text-right">Pres. mensual</th>
            <th className="px-3 py-2 text-right">Pres. anual</th>
            <th className="px-3 py-2 text-right">Erogado</th>
            <th className="px-3 py-2 text-right">Disponible</th>
            <th className="px-3 py-2 text-left w-40">% ejercido</th>
            <th className="px-3 py-2 text-right">Variación</th>
            <th className="px-3 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {areasOrden.map((area) => {
            const dArea = derivarArea(area, presupuesto.centrosCosto, presupuesto.conceptos, erogaciones, presupuesto.ejercicio, mesActual);
            const areaAbierta = abiertasAreas.has(area.id);
            const centros = presupuesto.centrosCosto.filter((cc) => cc.areaId === area.id);
            return (
              <ArbolFragment key={area.id}>
                {/* Fila Área */}
                <tr className="bg-muted/30 hover:bg-muted/50 cursor-pointer font-semibold" onClick={() => toggle(setAbiertasAreas, area.id)}>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {areaAbierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-muted-foreground tabular-nums mr-1">{area.numero}.</span>
                      {area.nombre}
                    </span>
                  </td>
                  <FilasDerivadas d={dArea} mensual={dArea.presupuestoAnual / 12} />
                </tr>

                {areaAbierta &&
                  centros.map((centro) => {
                    const dCentro = derivarCentro(centro, presupuesto.conceptos, erogaciones, presupuesto.ejercicio, mesActual);
                    const centroAbierto = abiertosCentros.has(centro.id);
                    const conceptos = presupuesto.conceptos.filter((c) => c.centroCostoId === centro.id && c.activo);
                    return (
                      <ArbolFragment key={centro.id}>
                        <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => toggle(setAbiertosCentros, centro.id)}>
                          <td className="px-3 py-2 pl-8">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              {centroAbierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <span className="text-muted-foreground tabular-nums mr-1">{centro.codigo}</span>
                              {centro.nombre}
                            </span>
                          </td>
                          <FilasDerivadas d={dCentro} mensual={dCentro.presupuestoAnual / 12} />
                        </tr>

                        {centroAbierto &&
                          conceptos.map((c) => {
                            const dC = derivarConcepto(c, erogaciones, presupuesto.ejercicio, mesActual);
                            return (
                              <tr key={c.id} className="hover:bg-muted/20">
                                <td className="px-3 py-2 pl-14 text-foreground/90">{c.nombre}</td>
                                <td className="px-3 py-2 text-right">
                                  {esBorrador ? (
                                    <InlineMonto
                                      valor={c.presupuestoMensual}
                                      onCommit={(v) => {
                                        const r = editarConceptoMensual(c.id, v);
                                        if (!r.ok) toast({ title: "No editable", description: r.motivo, variant: "destructive" });
                                      }}
                                    />
                                  ) : (
                                    <span className="inline-flex items-center justify-end gap-1.5">
                                      {celda(c.presupuestoMensual)}
                                      <button
                                        className="text-muted-foreground hover:text-primary"
                                        title="Modificar (queda auditado)"
                                        onClick={() => setModif({ concepto: c })}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">{celda(presupuestoAnualConcepto(c))}</td>
                                <td className="px-3 py-2 text-right">{celda(dC.erogadoAcumulado)}</td>
                                <td className={cn("px-3 py-2 text-right", dC.disponible < 0 && "text-destructive")}>{celda(dC.disponible)}</td>
                                <td className="px-3 py-2"><BarraEjercido porcentaje={dC.porcentajeEjercido} estado={semaforoDe(dC)} /></td>
                                <td className="px-3 py-2 text-right"><Variacion monto={dC.variacion} /></td>
                                <td className="px-3 py-2"><SemaforoBadge estado={semaforoDe(dC)} /></td>
                              </tr>
                            );
                          })}
                      </ArbolFragment>
                    );
                  })}
              </ArbolFragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-foreground text-background font-bold">
            <td className="px-3 py-2.5">TOTAL GENERAL</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmtMXN(total.presupuestoAnual / 12)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmtMXN(total.presupuestoAnual)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmtMXN(total.erogadoAcumulado)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmtMXN(total.disponible)}</td>
            <td className="px-3 py-2.5 tabular-nums">{total.porcentajeEjercido.toFixed(1)}%</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{total.variacion > 0 ? "+" : ""}{fmtMXN(total.variacion)}</td>
            <td className="px-3 py-2.5" />
          </tr>
        </tfoot>
      </table>

      {modif && (
        <ModificacionDialog
          concepto={modif.concepto}
          onClose={() => setModif(null)}
          onConfirm={(nuevo, just) => {
            modificarConceptoAprobado(modif.concepto.id, nuevo, just);
            toast({ title: "Modificación registrada", description: "El cambio quedó en la auditoría." });
            setModif(null);
          }}
        />
      )}
    </div>
  );
}

// Fragmento sin nodo DOM extra (para <tbody> con múltiples <tr>).
function ArbolFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Celdas derivadas comunes para filas de Área/Centro (subtotales).
function FilasDerivadas({ d, mensual }: { d: DerivadoPartida; mensual: number }) {
  const sem: Semaforo = semaforoDe(d);
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{fmtMXN(mensual)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtMXN(d.presupuestoAnual)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtMXN(d.erogadoAcumulado)}</td>
      <td className={cn("px-3 py-2 text-right tabular-nums", d.disponible < 0 && "text-destructive")}>{fmtMXN(d.disponible)}</td>
      <td className="px-3 py-2"><BarraEjercido porcentaje={d.porcentajeEjercido} estado={sem} /></td>
      <td className="px-3 py-2 text-right"><Variacion monto={d.variacion} /></td>
      <td className="px-3 py-2"><SemaforoBadge estado={sem} /></td>
    </>
  );
}

function InlineMonto({ valor, onCommit }: { valor: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(valor));
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Number(v);
        if (!isNaN(n) && n !== valor) onCommit(n);
      }}
      className="w-28 h-7 text-right tabular-nums rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

function ModificacionDialog({
  concepto,
  onClose,
  onConfirm,
}: {
  concepto: Concepto;
  onClose: () => void;
  onConfirm: (nuevoMensual: number, justificacion: string) => void;
}) {
  const [monto, setMonto] = useState(String(concepto.presupuestoMensual));
  const [just, setJust] = useState("");
  const n = Number(monto);
  const valido = !isNaN(n) && n >= 0 && just.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modificación presupuestal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            El presupuesto está aprobado. Este cambio queda registrado en la auditoría.
          </p>
          <div className="space-y-1">
            <Label>Concepto</Label>
            <p className="text-sm font-medium">{concepto.nombre}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="modif-monto">Nuevo presupuesto mensual</Label>
            <Input id="modif-monto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="tabular-nums" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="modif-just">Justificación</Label>
            <Input id="modif-just" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Motivo de la modificación" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valido} onClick={() => onConfirm(n, just.trim())}>Registrar modificación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
