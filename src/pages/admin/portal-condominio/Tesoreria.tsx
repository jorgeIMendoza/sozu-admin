import { useMemo, useState } from "react";
import { PageHeader, KPICard, StatusBadge } from "./_helpers";
import { formatMXN } from "@/data/portalCondominio/mockData";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { Plus, AlertTriangle, Tag } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePresupuestoStore, catalogoCascada } from "@/features/presupuesto/store";
import type { Presupuesto } from "@/features/presupuesto/types";

// Etiqueta de la partida presupuestal (Área ▸ Centro ▸ Concepto) de un egreso.
function partidaDe(p: Presupuesto, conceptoId: string | null): string | null {
  if (!conceptoId) return null;
  const c = p.conceptos.find((x) => x.id === conceptoId);
  if (!c) return null;
  const cc = p.centrosCosto.find((x) => x.id === c.centroCostoId);
  const a = cc ? p.areas.find((x) => x.id === cc.areaId) : undefined;
  return `${a?.nombre ?? "—"} ▸ ${cc?.nombre ?? "—"} ▸ ${c.nombre}`;
}

export default function Tesoreria() {
  // Ingresos desde la fuente real del condominio (misma que el Dashboard).
  const { proyectoId } = useCondominio();
  const { data: dataset } = useCondominioDataset(proyectoId);
  const cobrado = dataset?.kpis?.totalCobrado ?? 0;
  const egresos = usePresupuestoStore((s) => s.egresos);
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const [abierto, setAbierto] = useState(false);
  const [clasificando, setClasificando] = useState<string | null>(null);

  const totalEgresos = egresos.reduce((s, e) => s + e.monto, 0);
  const sinClasificar = egresos.filter((e) => !e.conceptoPresupuestalId);
  const pagadosSinClasificar = sinClasificar.filter((e) => e.estatus === "pagado");

  const byCat = egresos.reduce<Record<string, number>>((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + e.monto;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Tesorería"
        subtitle="Ingresos y egresos del condominio"
        actions={
          <button
            onClick={() => setAbierto(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <Plus className="h-4 w-4" /> Nuevo egreso
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <KPICard title="Ingresos (cobrado)" value={formatMXN(cobrado)} variant="success" />
        <KPICard title="Egresos (ejercicio)" value={formatMXN(totalEgresos)} variant="warning" />
        <KPICard title="Balance neto" value={formatMXN(cobrado - totalEgresos)} />
        <KPICard
          title="Sin clasificar"
          value={String(sinClasificar.length)}
          variant={pagadosSinClasificar.length ? "danger" : "default"}
        />
      </div>

      {/* Aviso de integridad: egresos pagados sin clasificar. */}
      {pagadosSinClasificar.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span>
            <span className="font-semibold tabular-nums">{pagadosSinClasificar.length}</span> egreso(s) pagado(s) sin clasificar por{" "}
            <span className="font-semibold tabular-nums">{formatMXN(pagadosSinClasificar.reduce((s, e) => s + e.monto, 0))}</span>.
            No cuentan en el erogado del presupuesto hasta clasificarse.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {Object.entries(byCat).map(([cat, monto]) => (
          <div key={cat} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{cat}</p>
            <p className="text-lg font-bold tabular-nums">{formatMXN(monto)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Partida presupuestal</th>
              <th className="px-3 py-2 text-left">Proveedor</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {egresos.map((e) => {
              const partida = partidaDe(presupuesto, e.conceptoPresupuestalId);
              return (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{e.fecha}</td>
                  <td className="px-3 py-2">{e.categoria}</td>
                  <td className="px-3 py-2">{e.concepto}</td>
                  <td className="px-3 py-2">
                    {partida ? (
                      <span className="text-foreground/90">{partida}</span>
                    ) : (
                      <button
                        onClick={() => setClasificando(e.id)}
                        className="inline-flex items-center gap-1 text-warning text-xs hover:underline"
                        title="Clasificar contra una partida presupuestal"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Sin clasificar
                        <span className="ml-1 inline-flex items-center gap-0.5 text-primary"><Tag className="h-3 w-3" /> Clasificar</span>
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.proveedor}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMXN(e.monto)}</td>
                  <td className="px-3 py-2"><StatusBadge label={e.estatus} tone={e.estatus === "pagado" ? "success" : e.estatus === "programado" ? "info" : "warning"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {abierto && <NuevoEgresoDialog onClose={() => setAbierto(false)} />}
      {clasificando && <ClasificarDialog egresoId={clasificando} onClose={() => setClasificando(null)} />}
    </div>
  );
}

// Cascada Área → Centro → Concepto (solo activos). Reutilizable.
function CascadaPresupuestal({
  areaId, centroId, conceptoId, onArea, onCentro, onConcepto,
}: {
  areaId: string; centroId: string; conceptoId: string;
  onArea: (v: string) => void; onCentro: (v: string) => void; onConcepto: (v: string) => void;
}) {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const cascada = useMemo(() => catalogoCascada(presupuesto), [presupuesto]);
  const centros = cascada.find((x) => x.area.id === areaId)?.centros ?? [];
  const conceptos = centros.find((x) => x.centro.id === centroId)?.conceptos ?? [];
  return (
    <div className="grid grid-cols-1 gap-2">
      <Select value={areaId} onValueChange={onArea}>
        <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
        <SelectContent>
          {cascada.map((x) => <SelectItem key={x.area.id} value={x.area.id}>{x.area.numero}. {x.area.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={centroId} onValueChange={onCentro} disabled={!areaId}>
        <SelectTrigger><SelectValue placeholder="Centro de costo" /></SelectTrigger>
        <SelectContent>
          {centros.map((x) => <SelectItem key={x.centro.id} value={x.centro.id}>{x.centro.codigo} {x.centro.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={conceptoId} onValueChange={onConcepto} disabled={!centroId}>
        <SelectTrigger><SelectValue placeholder="Concepto (partida)" /></SelectTrigger>
        <SelectContent>
          {conceptos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// El "Nuevo egreso" EXIGE clasificar contra un concepto presupuestal.
// Al guardar, crea el egreso en el store (fuente única) y con ello la erogación.
function NuevoEgresoDialog({ onClose }: { onClose: () => void }) {
  const registrarEgreso = usePresupuestoStore((s) => s.registrarEgreso);
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [monto, setMonto] = useState("");
  const [estatus, setEstatus] = useState<"pagado" | "programado" | "pendiente">("pagado");
  const [areaId, setAreaId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [conceptoId, setConceptoId] = useState("");

  const montoNum = Number(monto);
  const valido = !!fecha && !!concepto.trim() && !!proveedor.trim() && !isNaN(montoNum) && montoNum > 0 && !!conceptoId;

  const guardar = () => {
    if (!valido) return;
    const area = presupuesto.areas.find((a) => a.id === areaId);
    registrarEgreso({
      conceptoPresupuestalId: conceptoId,
      monto: montoNum,
      proveedor: proveedor.trim(),
      concepto: concepto.trim(),
      categoria: area?.nombre ?? "Egreso",
      fecha,
      estatus,
    });
    toast({ title: "Egreso registrado", description: "Se clasificó y actualizó el presupuesto." });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo egreso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eg-fecha">Fecha</Label>
              <Input id="eg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eg-monto">Monto</Label>
              <Input id="eg-monto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className="tabular-nums" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="eg-concepto">Concepto / descripción</Label>
            <Input id="eg-concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del egreso" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eg-prov">Proveedor</Label>
              <Input id="eg-prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor" />
            </div>
            <div className="space-y-1">
              <Label>Estatus</Label>
              <Select value={estatus} onValueChange={(v) => setEstatus(v as typeof estatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="programado">Programado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clasificación presupuestal *</p>
            <CascadaPresupuestal
              areaId={areaId} centroId={centroId} conceptoId={conceptoId}
              onArea={(v) => { setAreaId(v); setCentroId(""); setConceptoId(""); }}
              onCentro={(v) => { setCentroId(v); setConceptoId(""); }}
              onConcepto={setConceptoId}
            />
            {!conceptoId && <p className="text-[11px] text-warning">Selecciona la partida: el egreso debe clasificarse contra un concepto presupuestal.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valido} onClick={guardar}>Registrar egreso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Clasifica un egreso ya existente contra una partida (lo saca de "pendientes").
function ClasificarDialog({ egresoId, onClose }: { egresoId: string; onClose: () => void }) {
  const clasificarEgreso = usePresupuestoStore((s) => s.clasificarEgreso);
  const egreso = usePresupuestoStore((s) => s.egresos.find((e) => e.id === egresoId));
  const [areaId, setAreaId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [conceptoId, setConceptoId] = useState("");

  const guardar = () => {
    if (!conceptoId) return;
    clasificarEgreso(egresoId, conceptoId);
    toast({ title: "Egreso clasificado", description: "Ahora cuenta en el erogado del presupuesto." });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Clasificar egreso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {egreso && (
            <p className="text-sm text-muted-foreground">
              {egreso.concepto} · <span className="tabular-nums">{formatMXN(egreso.monto)}</span> · {egreso.proveedor}
            </p>
          )}
          <CascadaPresupuestal
            areaId={areaId} centroId={centroId} conceptoId={conceptoId}
            onArea={(v) => { setAreaId(v); setCentroId(""); setConceptoId(""); }}
            onCentro={(v) => { setCentroId(v); setConceptoId(""); }}
            onConcepto={setConceptoId}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!conceptoId} onClick={guardar}>Clasificar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
