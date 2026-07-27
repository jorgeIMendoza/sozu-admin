// =============================================================
// Portal Condominio · Presupuesto — Seguimiento mensual (matriz Ene–Dic).
// Filas = área (colapsable a conceptos), columnas = meses. Toggle de vista:
// Erogado / Presupuesto / Variación. Mes actual resaltado; futuros atenuados.
// El erogado se puebla desde erogaciones reales (fuente Tesorería).
// =============================================================
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresupuestoStore } from "./store";
import {
  MESES, erogadoPorMesDe, erogacionesDeConcepto, presupuestoPorMesConcepto, fmtMXN,
} from "./logic";

type Vista = "erogado" | "presupuesto" | "variacion";

function ceros12() { return Array(12).fill(0) as number[]; }
function suma12(a: number[], b: number[]) { return a.map((v, i) => v + (b[i] ?? 0)); }

export function SeguimientoMensual() {
  const presupuesto = usePresupuestoStore((s) => s.presupuesto);
  const erogaciones = usePresupuestoStore((s) => s.erogaciones);
  const mesActual = usePresupuestoStore((s) => s.mesActual());
  const [vista, setVista] = useState<Vista>("erogado");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Precalcula por concepto: presupuestoPorMes y erogadoPorMes.
  const porConcepto = useMemo(() => {
    const map = new Map<string, { pres: number[]; erog: number[] }>();
    for (const c of presupuesto.conceptos) {
      map.set(c.id, {
        pres: presupuestoPorMesConcepto(c),
        erog: erogadoPorMesDe(erogacionesDeConcepto(erogaciones, c.id), presupuesto.ejercicio),
      });
    }
    return map;
  }, [presupuesto, erogaciones]);

  const valorMes = (pres: number[], erog: number[], m: number): number => {
    if (vista === "erogado") return erog[m];
    if (vista === "presupuesto") return pres[m];
    return erog[m] - pres[m]; // variación
  };

  // Filas por área con sus conceptos.
  const areas = [...presupuesto.areas].sort((a, b) => a.numero - b.numero);

  // Totales por mes (todas las áreas).
  const totalPorMes = useMemo(() => {
    let pres = ceros12();
    let erog = ceros12();
    for (const c of presupuesto.conceptos) {
      if (!c.activo) continue;
      const d = porConcepto.get(c.id)!;
      pres = suma12(pres, d.pres);
      erog = suma12(erog, d.erog);
    }
    return { pres, erog };
  }, [presupuesto, porConcepto]);

  const celdaClase = (m: number, valor: number) => {
    const futuro = m > mesActual;
    const base = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
    if (futuro) return cn(base, "text-muted-foreground/40");
    if (vista === "variacion") {
      if (Math.abs(valor) < 0.5) return cn(base, "text-muted-foreground");
      return cn(base, valor > 0 ? "text-destructive font-medium" : "text-success");
    }
    return base;
  };

  const fmtCelda = (valor: number, m: number) => {
    if (vista === "erogado" && valor === 0 && m <= mesActual) return "—";
    if (vista === "variacion") {
      if (Math.abs(valor) < 0.5) return "—";
      return `${valor > 0 ? "+" : ""}${fmtMXN(valor)}`;
    }
    return fmtMXN(valor);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {([
            { k: "erogado", label: "Erogado" },
            { k: "presupuesto", label: "Presupuesto" },
            { k: "variacion", label: "Variación" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setVista(t.k)}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Mes actual: <span className="font-medium text-foreground">{MESES[mesActual]}</span> · meses futuros atenuados
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-muted/50 text-[11px] text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-muted/50 z-10">Área / Concepto</th>
              {MESES.map((mes, i) => (
                <th key={mes} className={cn("px-2 py-2 text-right", i === mesActual && "text-primary font-bold", i > mesActual && "text-muted-foreground/50")}>
                  {mes}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {areas.map((area) => {
              const centrosIds = new Set(presupuesto.centrosCosto.filter((cc) => cc.areaId === area.id).map((cc) => cc.id));
              const conceptos = presupuesto.conceptos.filter((c) => centrosIds.has(c.centroCostoId) && c.activo);
              let pres = ceros12();
              let erog = ceros12();
              for (const c of conceptos) {
                const d = porConcepto.get(c.id)!;
                pres = suma12(pres, d.pres);
                erog = suma12(erog, d.erog);
              }
              const abierta = abiertas.has(area.id);
              const totalFila = MESES.reduce((acc, _, m) => acc + valorMes(pres, erog, m), 0);
              return (
                <FragmentRows key={area.id}>
                  <tr className="bg-muted/30 hover:bg-muted/50 cursor-pointer font-semibold" onClick={() => toggle(area.id)}>
                    <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10">
                      <span className="inline-flex items-center gap-1.5">
                        {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {area.nombre}
                      </span>
                    </td>
                    {MESES.map((_, m) => (
                      <td key={m} className={cn(celdaClase(m, valorMes(pres, erog, m)), m === mesActual && "bg-primary/5")}>
                        {fmtCelda(valorMes(pres, erog, m), m)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtMXN(totalFila)}</td>
                  </tr>
                  {abierta &&
                    conceptos.map((c) => {
                      const d = porConcepto.get(c.id)!;
                      const totalC = MESES.reduce((acc, _, m) => acc + valorMes(d.pres, d.erog, m), 0);
                      return (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 pl-10 text-foreground/80 sticky left-0 bg-card z-10">{c.nombre}</td>
                          {MESES.map((_, m) => (
                            <td key={m} className={cn(celdaClase(m, valorMes(d.pres, d.erog, m)), m === mesActual && "bg-primary/5")}>
                              {fmtCelda(valorMes(d.pres, d.erog, m), m)}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtMXN(totalC)}</td>
                        </tr>
                      );
                    })}
                </FragmentRows>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-foreground text-background font-bold">
              <td className="px-3 py-2.5 sticky left-0 bg-foreground z-10">TOTAL</td>
              {MESES.map((_, m) => (
                <td key={m} className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {fmtCelda(valorMes(totalPorMes.pres, totalPorMes.erog, m), m)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right tabular-nums">
                {fmtMXN(MESES.reduce((acc, _, m) => acc + valorMes(totalPorMes.pres, totalPorMes.erog, m), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
