// =============================================================
// Portal Condominio · Presupuesto — Erogaciones (registro clasificado).
// Cada erogación = un egreso de Tesorería clasificado contra un concepto.
// Filtros por área / mes / proveedor. Alertas: egreso sin clasificar y egreso
// contra concepto sin presupuesto o que lo excede.
// El erogado NUNCA se teclea aquí: entra por Tesorería (// SWAP POINT).
// =============================================================
import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePresupuestoStore } from "./store";
import {
  MESES, presupuestoAnualConcepto, erogadoPorMesDe, erogacionesDeConcepto, fmtMXN, fmtFecha,
} from "./logic";
import type { Concepto } from "./types";

export function Erogaciones() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const erogaciones = usePresupuestoStore((s) => s.erogaciones);

  const [areaFiltro, setAreaFiltro] = useState<string>("todas");
  const [mesFiltro, setMesFiltro] = useState<string>("todos");
  const [provFiltro, setProvFiltro] = useState<string>("todos");

  // Índices concepto → centro → área para ruta y alertas.
  const conceptoById = useMemo(() => {
    const m = new Map<string, Concepto>();
    for (const c of presupuesto.conceptos) m.set(c.id, c);
    return m;
  }, [presupuesto]);
  const centroById = useMemo(() => {
    const m = new Map(presupuesto.centrosCosto.map((cc) => [cc.id, cc]));
    return m;
  }, [presupuesto]);
  const areaById = useMemo(() => new Map(presupuesto.areas.map((a) => [a.id, a])), [presupuesto]);

  const rutaDe = (conceptoId: string): { area: string; centro: string; concepto: string; areaId: string | null } => {
    const c = conceptoById.get(conceptoId);
    if (!c) return { area: "Sin clasificar", centro: "—", concepto: "—", areaId: null };
    const cc = centroById.get(c.centroCostoId);
    const area = cc ? areaById.get(cc.areaId) : undefined;
    return { area: area?.nombre ?? "—", centro: cc?.nombre ?? "—", concepto: c.nombre, areaId: area?.id ?? null };
  };

  const proveedores = useMemo(
    () => [...new Set(erogaciones.map((e) => e.proveedor))].sort((a, b) => a.localeCompare(b, "es")),
    [erogaciones],
  );

  const filtradas = useMemo(() => {
    return erogaciones
      .filter((e) => {
        const r = rutaDe(e.conceptoId);
        if (areaFiltro !== "todas" && r.areaId !== areaFiltro) return false;
        if (provFiltro !== "todos" && e.proveedor !== provFiltro) return false;
        if (mesFiltro !== "todos") {
          const d = new Date(e.fecha + (e.fecha.length === 10 ? "T00:00:00" : ""));
          if (d.getMonth() !== Number(mesFiltro)) return false;
        }
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erogaciones, areaFiltro, mesFiltro, provFiltro, conceptoById, centroById, areaById]);

  const totalFiltrado = filtradas.reduce((s, e) => s + e.monto, 0);

  // ── Alertas ──
  // (a) egresos sin clasificar (conceptoId no existe en el catálogo).
  const sinClasificar = erogaciones.filter((e) => !conceptoById.has(e.conceptoId));
  // (b) conceptos con erogaciones pero presupuesto anual 0, o excedido.
  const alertasPartida = useMemo(() => {
    const out: { concepto: Concepto; erogado: number; anual: number; tipo: "sin_presupuesto" | "excedido" }[] = [];
    for (const c of presupuesto.conceptos) {
      const erog = erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), presupuesto.ejercicio).reduce((a, b) => a + b, 0);
      if (erog <= 0) continue;
      const anual = presupuestoAnualConcepto(c);
      if (anual <= 0) out.push({ concepto: c, erogado: erog, anual, tipo: "sin_presupuesto" });
      else if (erog > anual) out.push({ concepto: c, erogado: erog, anual, tipo: "excedido" });
    }
    return out;
  }, [presupuesto, erogaciones]);

  const areasOrden = [...presupuesto.areas].sort((a, b) => a.numero - b.numero);

  return (
    <div className="space-y-4">
      {/* Nota de fuente única */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Las erogaciones se generan al clasificar un egreso en <span className="font-medium text-foreground">Tesorería</span>.
          El erogado no se captura aquí. {/* SWAP POINT: feed de egresos desde Tesorería. */}
        </span>
      </div>

      {/* Alertas */}
      {(sinClasificar.length > 0 || alertasPartida.length > 0) && (
        <div className="space-y-2">
          {sinClasificar.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <span className="tabular-nums">{sinClasificar.length}</span> egreso(s) sin clasificar contra una partida presupuestal.
            </div>
          )}
          {alertasPartida.map((a) => (
            <div key={a.concepto.id} className={cn("rounded-lg border px-3 py-2 text-sm flex items-center gap-2", a.tipo === "excedido" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5")}>
              <AlertTriangle className={cn("h-4 w-4 shrink-0", a.tipo === "excedido" ? "text-destructive" : "text-warning")} />
              <span className="min-w-0">
                <span className="font-medium">{a.concepto.nombre}</span>
                {a.tipo === "excedido" ? (
                  <> excede su presupuesto anual: erogado <span className="tabular-nums">{fmtMXN(a.erogado)}</span> vs <span className="tabular-nums">{fmtMXN(a.anual)}</span>.</>
                ) : (
                  <> tiene erogaciones (<span className="tabular-nums">{fmtMXN(a.erogado)}</span>) pero <span className="font-medium">sin presupuesto asignado</span>.</>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={areaFiltro} onValueChange={setAreaFiltro}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las áreas</SelectItem>
            {areasOrden.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mesFiltro} onValueChange={setMesFiltro}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={provFiltro} onValueChange={setProvFiltro}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Proveedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proveedores</SelectItem>
            {proveedores.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {filtradas.length} erogación(es) · {fmtMXN(totalFiltrado)}
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-muted/50 text-[11px] text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Partida (Área ▸ Centro ▸ Concepto)</th>
              <th className="px-3 py-2 text-left">Proveedor</th>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtradas.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Sin erogaciones con estos filtros.</td></tr>
            ) : (
              filtradas.map((e) => {
                const r = rutaDe(e.conceptoId);
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtFecha(e.fecha)}</td>
                    <td className="px-3 py-2">
                      {r.areaId ? (
                        <span className="text-foreground/90">
                          <span className="text-muted-foreground">{r.area} ▸ {r.centro} ▸ </span>{r.concepto}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" /> Sin clasificar
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.proveedor}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.concepto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMXN(e.monto)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
