import { useMemo, useState } from "react";
import { PageHeader, KPICard, StatusBadge } from "./_helpers";
import { egresos as egresosBase, formatMXN, getKPIs } from "@/data/portalCondominio/mockData";
import { Plus, AlertTriangle } from "lucide-react";
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

// Egreso local creado en la demo (se muestra en la tabla junto al mock base).
interface EgresoLocal {
  id: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: string;
  proveedor: string;
  estatus: string;
  // Clasificación presupuestal (obligatoria para nuevos egresos).
  conceptoPresupuestalId: string;
  partidaLabel: string;
}

export default function Tesoreria() {
  const k = getKPIs();
  const [nuevos, setNuevos] = useState<EgresoLocal[]>([]);
  const [abierto, setAbierto] = useState(false);

  const egresosTotales = [...nuevos, ...egresosBase];
  const byCat = egresosTotales.reduce<Record<string, number>>((acc, e) => {
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
        <KPICard title="Ingresos del mes" value={formatMXN(k.totalCobrado)} variant="success" />
        <KPICard title="Egresos del mes" value={formatMXN(k.totalEgresos)} variant="warning" />
        <KPICard title="Balance neto" value={formatMXN(k.balanceNeto)} />
        <KPICard title="Egresos pendientes" value={String(egresosTotales.filter((e) => e.estatus !== "pagado").length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {Object.entries(byCat).map(([cat, monto]) => (
          <div key={cat} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{cat}</p>
            <p className="text-lg font-bold tabular-nums">{formatMXN(monto)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
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
            {egresosTotales.map((e) => {
              const partida = (e as EgresoLocal).partidaLabel;
              return (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{e.fecha}</td>
                  <td className="px-3 py-2">{e.categoria}</td>
                  <td className="px-3 py-2">{e.concepto}</td>
                  <td className="px-3 py-2">
                    {partida ? (
                      <span className="text-foreground/90">{partida}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" /> Sin clasificar
                      </span>
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

      {abierto && (
        <NuevoEgresoDialog
          onClose={() => setAbierto(false)}
          onCreate={(egreso) => {
            setNuevos((prev) => [egreso, ...prev]);
            setAbierto(false);
          }}
        />
      )}
    </div>
  );
}

// El "Nuevo egreso" EXIGE clasificar contra un concepto presupuestal
// (cascada Área → Centro de Costo → Concepto). Al guardar, genera la erogación
// en el módulo Presupuesto (fuente única del erogado).
// SWAP POINT: persistencia real del vínculo egreso↔concepto y del egreso.
function NuevoEgresoDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (e: EgresoLocal) => void;
}) {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const registrar = usePresupuestoStore((s) => s.registrarErogacionDesdeTesoreria);
  const cascada = useMemo(() => catalogoCascada(presupuesto), [presupuesto]);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [monto, setMonto] = useState("");
  const [estatus, setEstatus] = useState("pagado");
  const [areaId, setAreaId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [conceptoId, setConceptoId] = useState("");

  const centros = cascada.find((x) => x.area.id === areaId)?.centros ?? [];
  const conceptos = centros.find((x) => x.centro.id === centroId)?.conceptos ?? [];

  const montoNum = Number(monto);
  const valido =
    !!fecha && !!concepto.trim() && !!proveedor.trim() && !isNaN(montoNum) && montoNum > 0 && !!conceptoId;

  const guardar = () => {
    if (!valido) return;
    const area = cascada.find((x) => x.area.id === areaId)?.area;
    const centro = centros.find((x) => x.centro.id === centroId)?.centro;
    const conc = conceptos.find((c) => c.id === conceptoId);
    const partidaLabel = `${area?.nombre ?? "—"} ▸ ${centro?.nombre ?? "—"} ▸ ${conc?.nombre ?? "—"}`;
    const egresoId = `exp-new-${Date.now()}`;

    // Genera la erogación en Presupuesto (actualiza erogado/disponible/variación).
    registrar({
      conceptoId,
      monto: montoNum,
      proveedor: proveedor.trim(),
      concepto: concepto.trim(),
      fecha,
      egresoTesoreriaId: egresoId, // SWAP POINT: id real del egreso
    });

    onCreate({
      id: egresoId,
      categoria: area?.nombre ?? "Egreso",
      concepto: concepto.trim(),
      monto: montoNum,
      fecha,
      proveedor: proveedor.trim(),
      estatus,
      conceptoPresupuestalId: conceptoId,
      partidaLabel,
    });
    toast({ title: "Egreso registrado", description: "Se clasificó y actualizó el presupuesto." });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo egreso</DialogTitle>
        </DialogHeader>
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
              <Select value={estatus} onValueChange={setEstatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="programado">Programado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clasificación presupuestal OBLIGATORIA (cascada) */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clasificación presupuestal *</p>
            <div className="grid grid-cols-1 gap-2">
              <Select value={areaId} onValueChange={(v) => { setAreaId(v); setCentroId(""); setConceptoId(""); }}>
                <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
                <SelectContent>
                  {cascada.map((x) => <SelectItem key={x.area.id} value={x.area.id}>{x.area.numero}. {x.area.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={centroId} onValueChange={(v) => { setCentroId(v); setConceptoId(""); }} disabled={!areaId}>
                <SelectTrigger><SelectValue placeholder="Centro de costo" /></SelectTrigger>
                <SelectContent>
                  {centros.map((x) => <SelectItem key={x.centro.id} value={x.centro.id}>{x.centro.codigo} {x.centro.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={conceptoId} onValueChange={setConceptoId} disabled={!centroId}>
                <SelectTrigger><SelectValue placeholder="Concepto (partida)" /></SelectTrigger>
                <SelectContent>
                  {conceptos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!conceptoId && (
              <p className="text-[11px] text-warning">Selecciona la partida: el egreso debe clasificarse contra un concepto presupuestal.</p>
            )}
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
