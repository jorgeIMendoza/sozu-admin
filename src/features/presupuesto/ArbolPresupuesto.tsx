// =============================================================
// Portal Condominio · Presupuesto — Árbol jerárquico + CRUD del catálogo.
// Área → Centro de Costo → Concepto. Acciones inline: crear, renombrar,
// reordenar, mover, activar/desactivar. Borrador = edición libre; Aprobado =
// cada cambio es una Modificación Presupuestal con motivo + auditoría.
// =============================================================
import { useMemo, useState } from "react";
import {
  ChevronRight, ChevronDown, Pencil, Plus, ArrowUp, ArrowDown,
  Power, PowerOff, FolderInput, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { usePresupuestoStore, type Resultado } from "./store";
import {
  derivarArea, derivarCentro, derivarConcepto, derivarTotal,
  presupuestoAnualConcepto, fmtMXN, fmtFecha, semaforoDe, type Semaforo,
} from "./logic";
import { SemaforoBadge, BarraEjercido, Variacion } from "./ui";
import type { Concepto, DerivadoPartida } from "./types";

function celda(n: number) {
  return <span className="tabular-nums">{fmtMXN(n)}</span>;
}

// Intents que abren un formulario (con campos) — crear/renombrar/mover.
type FormIntent =
  | { k: "crearArea" }
  | { k: "renombrarArea"; id: string; actual: string }
  | { k: "crearCentro"; areaId: string; areaNombre: string }
  | { k: "renombrarCentro"; id: string; actual: string }
  | { k: "moverCentro"; id: string; nombre: string }
  | { k: "crearConcepto"; centroId: string; centroNombre: string }
  | { k: "renombrarConcepto"; id: string; actual: string };

// Intents de confirmación — activar/desactivar y reordenar.
type ConfirmIntent =
  | { k: "toggleArea"; id: string; nombre: string; activar: boolean }
  | { k: "toggleCentro"; id: string; nombre: string; activar: boolean }
  | { k: "toggleConcepto"; id: string; nombre: string; activar: boolean }
  | { k: "reordenarArea"; id: string; dir: -1 | 1; nombre: string };

export function ArbolPresupuesto() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const erogaciones = usePresupuestoStore((s) => s.erogaciones);
  const auditoria = usePresupuestoStore((s) => s.auditoria);
  const mesActual = usePresupuestoStore((s) => s.mesActual());
  const st = usePresupuestoStore();

  const esBorrador = presupuesto.estado === "borrador";

  const [abiertasAreas, setAbiertasAreas] = useState<Set<string>>(new Set());
  const [abiertosCentros, setAbiertosCentros] = useState<Set<string>>(new Set());
  const [modif, setModif] = useState<{ concepto: Concepto } | null>(null);
  const [form, setForm] = useState<FormIntent | null>(null);
  const [confirm, setConfirm] = useState<ConfirmIntent | null>(null);
  const [histAbierto, setHistAbierto] = useState(false);

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

  const modificaciones = useMemo(
    () => auditoria.filter((a) => a.accion === "Modificación presupuestal").slice().reverse(),
    [auditoria],
  );

  const areasOrden = [...presupuesto.areas].sort((a, b) => a.numero - b.numero);

  // Ejecuta una acción de reordenar/reactivar que NO requiere confirmación en
  // borrador; en aprobado se enruta por el diálogo de confirmación (motivo).
  const handleResultado = (r: Resultado) => {
    if (!r.ok) toast({ title: "No permitido", description: r.motivo, variant: "destructive" });
  };

  return (
    <div className="space-y-3">
      {/* Barra de catálogo */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {esBorrador
            ? "Borrador: edición libre del catálogo y los montos."
            : "Aprobado: los cambios se registran como Modificación Presupuestal (motivo + auditoría)."}
        </p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setForm({ k: "crearArea" })}>
          <Plus className="h-4 w-4" /> Nueva área
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
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
              <th className="px-3 py-2 text-right w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {areasOrden.map((area, idxArea) => {
              const dArea = derivarArea(area, presupuesto.centrosCosto, presupuesto.conceptos, erogaciones, presupuesto.ejercicio, mesActual);
              const areaAbierta = abiertasAreas.has(area.id);
              const centros = presupuesto.centrosCosto.filter((cc) => cc.areaId === area.id);
              return (
                <ArbolFragment key={area.id}>
                  <tr className={cn("bg-muted/30 hover:bg-muted/50 font-semibold", !area.activo && "opacity-50")}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 cursor-pointer" onClick={() => toggle(setAbiertasAreas, area.id)}>
                        {areaAbierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="text-muted-foreground tabular-nums mr-1">{area.numero}.</span>
                        {area.nombre}
                        {!area.activo && <span className="ml-2 text-[10px] font-normal text-muted-foreground">(inactiva)</span>}
                      </span>
                    </td>
                    <FilasDerivadas d={dArea} mensual={dArea.presupuestoAnual / 12} />
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconBtn title="Subir" disabled={idxArea === 0} onClick={() => (esBorrador ? handleResultado(st.reordenarArea(area.id, -1)) : setConfirm({ k: "reordenarArea", id: area.id, dir: -1, nombre: area.nombre }))}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Bajar" disabled={idxArea === areasOrden.length - 1} onClick={() => (esBorrador ? handleResultado(st.reordenarArea(area.id, 1)) : setConfirm({ k: "reordenarArea", id: area.id, dir: 1, nombre: area.nombre }))}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Renombrar" onClick={() => setForm({ k: "renombrarArea", id: area.id, actual: area.nombre })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Agregar centro" onClick={() => setForm({ k: "crearCentro", areaId: area.id, areaNombre: area.nombre })}><Plus className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title={area.activo ? "Desactivar" : "Activar"} onClick={() => setConfirm({ k: "toggleArea", id: area.id, nombre: area.nombre, activar: !area.activo })}>
                          {area.activo ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-success" />}
                        </IconBtn>
                      </div>
                    </td>
                  </tr>

                  {areaAbierta &&
                    centros.map((centro) => {
                      const dCentro = derivarCentro(centro, presupuesto.conceptos, erogaciones, presupuesto.ejercicio, mesActual);
                      const centroAbierto = abiertosCentros.has(centro.id);
                      const conceptos = presupuesto.conceptos.filter((c) => c.centroCostoId === centro.id);
                      return (
                        <ArbolFragment key={centro.id}>
                          <tr className={cn("hover:bg-muted/30", !centro.activo && "opacity-50")}>
                            <td className="px-3 py-2 pl-8">
                              <span className="inline-flex items-center gap-1.5 font-medium cursor-pointer" onClick={() => toggle(setAbiertosCentros, centro.id)}>
                                {centroAbierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <span className="text-muted-foreground tabular-nums mr-1">{centro.codigo}</span>
                                {centro.nombre}
                                {!centro.activo && <span className="ml-2 text-[10px] font-normal text-muted-foreground">(inactivo)</span>}
                              </span>
                            </td>
                            <FilasDerivadas d={dCentro} mensual={dCentro.presupuestoAnual / 12} />
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-0.5">
                                <IconBtn title="Renombrar" onClick={() => setForm({ k: "renombrarCentro", id: centro.id, actual: centro.nombre })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title="Mover a otra área" onClick={() => setForm({ k: "moverCentro", id: centro.id, nombre: centro.nombre })}><FolderInput className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title="Agregar concepto" onClick={() => setForm({ k: "crearConcepto", centroId: centro.id, centroNombre: centro.nombre })}><Plus className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title={centro.activo ? "Desactivar" : "Activar"} onClick={() => setConfirm({ k: "toggleCentro", id: centro.id, nombre: centro.nombre, activar: !centro.activo })}>
                                  {centro.activo ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-success" />}
                                </IconBtn>
                              </div>
                            </td>
                          </tr>

                          {centroAbierto &&
                            conceptos.map((c) => {
                              const dC = derivarConcepto(c, erogaciones, presupuesto.ejercicio, mesActual);
                              return (
                                <tr key={c.id} className={cn("hover:bg-muted/20", !c.activo && "opacity-50")}>
                                  <td className="px-3 py-2 pl-14 text-foreground/90">
                                    {c.nombre}
                                    {!c.activo && <span className="ml-2 text-[10px] text-muted-foreground">(inactivo)</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {esBorrador ? (
                                      <InlineMonto
                                        valor={c.presupuestoMensual}
                                        onCommit={(v) => handleResultado(st.editarConceptoMensual(c.id, v))}
                                      />
                                    ) : (
                                      <span className="inline-flex items-center justify-end gap-1.5">
                                        {celda(c.presupuestoMensual)}
                                        <button className="text-muted-foreground hover:text-primary" title="Modificar monto (auditado)" onClick={() => setModif({ concepto: c })}>
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
                                  <td className="px-3 py-2">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <IconBtn title="Renombrar" onClick={() => setForm({ k: "renombrarConcepto", id: c.id, actual: c.nombre })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                                      <IconBtn title={c.activo ? "Desactivar" : "Activar"} onClick={() => setConfirm({ k: "toggleConcepto", id: c.id, nombre: c.nombre, activar: !c.activo })}>
                                        {c.activo ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-success" />}
                                      </IconBtn>
                                    </div>
                                  </td>
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
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Histórico de modificaciones presupuestales */}
      <div className="rounded-xl border border-border bg-card">
        <button className="w-full flex items-center justify-between px-4 py-2.5" onClick={() => setHistAbierto((v) => !v)}>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" /> Historial de modificaciones
            <span className="text-xs text-muted-foreground tabular-nums">({modificaciones.length})</span>
          </span>
          {histAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {histAbierto && (
          <div className="border-t border-border divide-y divide-border">
            {modificaciones.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin modificaciones presupuestales registradas.</p>
            ) : (
              modificaciones.map((m) => (
                <div key={m.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{m.usuario}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{fmtFecha(m.timestamp)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.detalle}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modif && (
        <ModificacionMontoDialog
          concepto={modif.concepto}
          onClose={() => setModif(null)}
          onConfirm={(nuevo, just) => {
            st.modificarConceptoAprobado(modif.concepto.id, nuevo, just);
            toast({ title: "Modificación registrada", description: "El cambio quedó en la auditoría." });
            setModif(null);
          }}
        />
      )}

      {form && <FormDialog intent={form} aprobado={!esBorrador} onClose={() => setForm(null)} />}
      {confirm && <ConfirmDialog intent={confirm} aprobado={!esBorrador} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function IconBtn({ children, title, disabled, onClick }: { children: React.ReactNode; title: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

function ArbolFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

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

// ── Diálogo de formulario (crear/renombrar/mover/crear concepto) ──
function FormDialog({ intent, aprobado, onClose }: { intent: FormIntent; aprobado: boolean; onClose: () => void }) {
  const st = usePresupuestoStore();
  const areas = usePresupuestoStore((s) => s.presupuesto.areas);
  const [nombre, setNombre] = useState("actual" in intent ? intent.actual : "");
  const [mensual, setMensual] = useState("0");
  const [areaDestino, setAreaDestino] = useState("");
  const [motivo, setMotivo] = useState("");

  const titulo: Record<FormIntent["k"], string> = {
    crearArea: "Nueva área", renombrarArea: "Renombrar área",
    crearCentro: "Nuevo centro de costo", renombrarCentro: "Renombrar centro",
    moverCentro: "Mover centro de costo", crearConcepto: "Nuevo concepto",
    renombrarConcepto: "Renombrar concepto",
  };

  const necesitaNombre = intent.k !== "moverCentro";
  const necesitaMensual = intent.k === "crearConcepto";
  const necesitaArea = intent.k === "moverCentro";
  const motivoOk = !aprobado || motivo.trim().length > 0;
  const valido =
    (!necesitaNombre || nombre.trim().length > 0) &&
    (!necesitaMensual || Number(mensual) >= 0) &&
    (!necesitaArea || !!areaDestino) &&
    motivoOk;

  const ejecutar = (): Resultado => {
    const m = aprobado ? motivo.trim() : undefined;
    switch (intent.k) {
      case "crearArea": return st.crearArea(nombre, m);
      case "renombrarArea": return st.renombrarArea(intent.id, nombre, m);
      case "crearCentro": return st.crearCentro(intent.areaId, nombre, m);
      case "renombrarCentro": return st.renombrarCentro(intent.id, nombre, m);
      case "moverCentro": return st.moverCentro(intent.id, areaDestino, m);
      case "crearConcepto": return st.crearConcepto(intent.centroId, nombre, Number(mensual), m);
      case "renombrarConcepto": return st.editarConcepto(intent.id, { nombre }, m);
    }
  };

  const guardar = () => {
    const r = ejecutar();
    if (!r.ok) { toast({ title: "No permitido", description: r.motivo, variant: "destructive" }); return; }
    toast({ title: "Cambio aplicado" });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{titulo[intent.k]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {intent.k === "crearCentro" && <p className="text-xs text-muted-foreground">En área: <span className="font-medium">{intent.areaNombre}</span></p>}
          {intent.k === "crearConcepto" && <p className="text-xs text-muted-foreground">En centro: <span className="font-medium">{intent.centroNombre}</span></p>}

          {necesitaNombre && (
            <div className="space-y-1">
              <Label htmlFor="f-nombre">Nombre</Label>
              <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </div>
          )}
          {necesitaMensual && (
            <div className="space-y-1">
              <Label htmlFor="f-mensual">Presupuesto mensual</Label>
              <Input id="f-mensual" type="number" min={0} value={mensual} onChange={(e) => setMensual(e.target.value)} className="tabular-nums" />
            </div>
          )}
          {necesitaArea && (
            <div className="space-y-1">
              <Label>Área destino</Label>
              <Select value={areaDestino} onValueChange={setAreaDestino}>
                <SelectTrigger><SelectValue placeholder="Selecciona área" /></SelectTrigger>
                <SelectContent>
                  {[...areas].sort((a, b) => a.numero - b.numero).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.numero}. {a.nombre}{!a.activo ? " (inactiva)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {aprobado && (
            <div className="space-y-1">
              <Label htmlFor="f-motivo">Justificación (modificación presupuestal) *</Label>
              <Input id="f-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del cambio" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valido} onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo de confirmación (activar/desactivar/reordenar) ──
function ConfirmDialog({ intent, aprobado, onClose }: { intent: ConfirmIntent; aprobado: boolean; onClose: () => void }) {
  const st = usePresupuestoStore();
  const [motivo, setMotivo] = useState("");
  const motivoOk = !aprobado || motivo.trim().length > 0;

  const desactivando = "activar" in intent && !intent.activar;
  const titulo =
    intent.k === "reordenarArea" ? "Reordenar área"
      : desactivando ? "Desactivar" : "Activar";
  const descripcion =
    intent.k === "reordenarArea"
      ? `Cambiar el orden de "${intent.nombre}".`
      : desactivando
        ? `Se desactivará "${intent.nombre}" (soft-disable, conserva historial). Se retira del catálogo vigente y del selector de Tesorería.`
        : `Se reactivará "${intent.nombre}".`;

  const ejecutar = (): Resultado => {
    const m = aprobado ? motivo.trim() : undefined;
    switch (intent.k) {
      case "toggleArea": return st.toggleAreaActiva(intent.id, m);
      case "toggleCentro": return st.toggleCentroActivo(intent.id, m);
      case "toggleConcepto": return st.toggleConceptoActivo(intent.id, m);
      case "reordenarArea": return st.reordenarArea(intent.id, intent.dir, m);
    }
  };

  const confirmar = () => {
    const r = ejecutar();
    if (!r.ok) { toast({ title: "No permitido", description: r.motivo, variant: "destructive" }); return; }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{descripcion}</p>
          {aprobado && (
            <div className="space-y-1">
              <Label htmlFor="c-motivo">Justificación (modificación presupuestal) *</Label>
              <Input id="c-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del cambio" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={desactivando ? "destructive" : "default"} disabled={!motivoOk} onClick={confirmar}>
            {titulo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModificacionMontoDialog({
  concepto, onClose, onConfirm,
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
        <DialogHeader><DialogTitle>Modificación presupuestal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">El presupuesto está aprobado. Este cambio queda registrado en la auditoría.</p>
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
