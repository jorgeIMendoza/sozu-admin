import { useMemo } from "react";
import { Lock, Pencil, TriangleAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MetricaPlano } from "../stores/listaStore";
import type { FilaPrecio } from "./PanelDetallePrecio";
import { formatoM2, formatoMoneda, formatoPorcentaje } from "../lib/formato";

const ETIQUETA_METRICA: Record<MetricaPlano, string> = {
  precio_calculado: "Precio calculado",
  precio_m2: "Precio por m²",
  delta_pct: "Δ % vs. actual",
  estatus: "Estatus comercial",
  alertas: "Alertas de calidad",
};

/**
 * Escala secuencial de 5 pasos para métricas numéricas (quintiles).
 * Alto contraste: en un plano de 18 niveles la diferencia entre quintiles debe
 * leerse de un vistazo, no compararse celda contra celda.
 */
const ESCALA = [
  "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  "bg-sky-300 text-sky-950 dark:bg-sky-800 dark:text-sky-50",
  "bg-amber-300 text-amber-950 dark:bg-amber-700 dark:text-amber-50",
  "bg-orange-500 text-white dark:bg-orange-600",
  "bg-rose-700 text-white dark:bg-rose-600",
];

const COLOR_ESTATUS: Record<string, string> = {
  Disponible: "bg-emerald-500/15 text-emerald-800",
  Apartada: "bg-amber-500/20 text-amber-900",
  Vendida: "bg-muted text-muted-foreground",
  Bloqueada: "bg-destructive/15 text-destructive",
};

function valorMetrica(fila: FilaPrecio, metrica: MetricaPlano): number | null {
  if (metrica === "precio_calculado") return fila.desglose.precio_lista;
  if (metrica === "precio_m2")
    return fila.desglose.area_ponderada > 0
      ? fila.desglose.precio_lista / fila.desglose.area_ponderada
      : null;
  if (metrica === "delta_pct")
    return fila.propiedad.precio_lista_actual > 0 ? fila.desglose.delta_pct : null;
  return null;
}

function textoMetrica(fila: FilaPrecio, metrica: MetricaPlano): string {
  const v = valorMetrica(fila, metrica);
  if (metrica === "estatus") return fila.propiedad.estatus;
  if (metrica === "alertas")
    return fila.alertas.length === 0 ? "Sin alertas" : `${fila.alertas.length}`;
  if (v === null) return "s/d";
  if (metrica === "delta_pct") return formatoPorcentaje(v);
  if (metrica === "precio_m2") return `${formatoMoneda(v)}/m²`;
  return formatoMoneda(v);
}

/**
 * Plano de torre: niveles en filas descendentes, unidades en columnas.
 * CSS Grid puro, sin librerías de visualización.
 */
export function PlanoTorre({
  filas,
  metrica,
  onMetrica,
  torre,
  onTorre,
  torres,
  onSeleccionar,
}: {
  filas: FilaPrecio[];
  metrica: MetricaPlano;
  onMetrica: (m: MetricaPlano) => void;
  torre: string;
  onTorre: (t: string) => void;
  torres: { id: string; nombre: string }[];
  onSeleccionar: (fila: FilaPrecio) => void;
}) {
  const visibles = useMemo(
    () => (torre === "todas" ? filas : filas.filter((f) => f.propiedad.id_torre === torre)),
    [filas, torre],
  );

  /** Cortes de quintil sobre las unidades visibles con valor definido. */
  const cortes = useMemo(() => {
    const valores = visibles
      .map((f) => valorMetrica(f, metrica))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    if (valores.length === 0) return [];
    return [0.2, 0.4, 0.6, 0.8].map(
      (q) => valores[Math.min(valores.length - 1, Math.floor(q * valores.length))]!,
    );
  }, [visibles, metrica]);

  const niveles = useMemo(() => {
    const mapa = new Map<number, FilaPrecio[]>();
    for (const f of visibles) {
      const lista = mapa.get(f.propiedad.nivel) ?? [];
      lista.push(f);
      mapa.set(f.propiedad.nivel, lista);
    }
    return [...mapa.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([nivel, unidades]) => ({
        nivel,
        unidades: unidades.sort((a, b) => a.propiedad.numero.localeCompare(b.propiedad.numero)),
      }));
  }, [visibles]);

  const maxColumnas = Math.max(1, ...niveles.map((n) => n.unidades.length));

  const claseCelda = (fila: FilaPrecio) => {
    if (metrica === "estatus")
      return COLOR_ESTATUS[fila.propiedad.estatus] ?? "bg-muted";
    if (metrica === "alertas")
      return fila.alertas.length === 0
        ? "bg-muted text-muted-foreground"
        : fila.alertas.length === 1
          ? "bg-amber-500/20 text-amber-900"
          : "bg-destructive/20 text-destructive";
    const v = valorMetrica(fila, metrica);
    if (v === null) return "bg-muted text-muted-foreground";
    const idx = cortes.filter((c) => v > c).length;
    return ESCALA[Math.min(idx, ESCALA.length - 1)]!;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Torre</Label>
          <Select value={torre} onValueChange={onTorre}>
            <SelectTrigger className="mt-1 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las torres</SelectItem>
              {torres.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Métrica</Label>
          <Select value={metrica} onValueChange={(v) => onMetrica(v as MetricaPlano)}>
            <SelectTrigger className="mt-1 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ETIQUETA_METRICA) as MetricaPlano[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {ETIQUETA_METRICA[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
          {metrica === "estatus" || metrica === "alertas" ? (
            <>
              <span>Leyenda:</span>
              {(metrica === "estatus"
                ? Object.entries(COLOR_ESTATUS)
                : ([
                    ["Sin alertas", "bg-muted"],
                    ["1 alerta", "bg-amber-500/20"],
                    ["2 o más", "bg-destructive/20"],
                  ] as [string, string][])
              ).map(([etiqueta, clase]) => (
                <span key={etiqueta} className="inline-flex items-center gap-1">
                  <span className={cn("size-3 rounded-sm", clase.split(" ")[0])} />
                  {etiqueta}
                </span>
              ))}
            </>
          ) : (
            <>
              <span>Menor</span>
              {ESCALA.map((c) => (
                <span key={c} className={cn("size-3 rounded-sm", c.split(" ")[0])} />
              ))}
              <span>Mayor</span>
            </>
          )}
        </div>
      </div>

      {niveles.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          No hay unidades que coincidan con los filtros vigentes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border p-3">
          <div className="min-w-max space-y-1">
            {niveles.map(({ nivel, unidades }) => (
              <div key={nivel} className="flex items-stretch gap-1">
                <div className="flex w-16 shrink-0 items-center justify-end pr-2 text-xs font-medium text-muted-foreground tabular-nums">
                  Nivel {nivel}
                </div>
                <div
                  className="grid flex-1 gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${maxColumnas}, minmax(88px, 1fr))`,
                  }}
                >
                  {unidades.map((f) => (
                    <Tooltip key={f.propiedad.id_propiedad}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSeleccionar(f)}
                          className={cn(
                            "flex h-14 flex-col justify-center rounded-md px-2 text-left transition hover:ring-2 hover:ring-ring",
                            claseCelda(f),
                          )}
                        >
                          <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                            {f.propiedad.numero}
                            {f.desglose.bloqueada_para_reprecio && (
                              <Lock className="size-3 shrink-0" />
                            )}
                            {f.desglose.precio_override !== null && (
                              <Pencil className="size-3 shrink-0" />
                            )}
                            {f.alertas.length > 0 && (
                              <TriangleAlert className="size-3 shrink-0" />
                            )}
                          </span>
                          <span className="truncate text-[11px] tabular-nums">
                            {textoMetrica(f, metrica)}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold tabular-nums">
                          Unidad {f.propiedad.numero} · {f.modelo?.nombre ?? "—"}
                        </p>
                        <p className="tabular-nums">
                          Nivel {f.propiedad.nivel} · {f.propiedad.vista} ·{" "}
                          {f.propiedad.orientacion}
                        </p>
                        <p className="tabular-nums">
                          Área ponderada {formatoM2(f.desglose.area_ponderada)}
                        </p>
                        <p className="tabular-nums">
                          Precio de lista {formatoMoneda(f.desglose.precio_lista)}
                        </p>
                        <p className="tabular-nums">
                          Estatus {f.propiedad.estatus}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
