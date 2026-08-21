import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FactorPrecio, Propiedad, TipoFactor } from "../types/dominio";
import { useIndicesActivos } from "../hooks/useInventarioActivo";
import type { IndicesProyecto } from "../stores/inventarioStore";
import { useMotorAuditado } from "../hooks/useMotorAuditado";
import { usePreciosProyecto } from "../hooks/usePreciosProyecto";
import { formatoMoneda } from "../lib/formato";

/** ¿La unidad cae en esta categoría del factor? */
function perteneceAlFactor(
  tipo: TipoFactor,
  clave: string,
  p: Propiedad,
  indices: IndicesProyecto,
): boolean {
  switch (tipo) {
    case "torre":
      return indices.torresPorId[p.id_torre]?.nombre === clave;
    case "vista":
      return p.vista === clave;
    case "orientacion":
      return p.orientacion === clave;
    case "plano":
      return indices.modelosPorId[p.id_modelo]?.nombre === clave;
    case "extras":
      return p.caracteristicas_extra.includes(clave);
    default:
      return false;
  }
}

function ChipEfecto({ valor, esExtra }: { valor: number; esExtra: boolean }) {
  const multiplicador = esExtra ? 1 + valor : valor;
  const pct = (multiplicador - 1) * 100;
  if (Math.abs(pct) < 0.00001) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Neutro
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs tabular-nums",
        pct > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
      )}
    >
      {pct > 0 ? "+" : "−"}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

export function TablaFactores({
  tipo,
  factores,
  propiedades,
}: {
  tipo: TipoFactor;
  factores: FactorPrecio[];
  propiedades: Propiedad[];
}) {
  const { actualizarFactor, agregarFactor, cambiarActivo } = useMotorAuditado();
  const { desgloses } = usePreciosProyecto();
  const indices = useIndicesActivos();

  const esExtra = tipo === "extras";
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [valor, setValor] = useState(esExtra ? "0.0000" : "1.0000");

  /**
   * Todo lo que se muestra por renglón, en un solo recorrido del inventario.
   *
   * - `impacto`: cuánto dinero aporta el factor sobre las unidades que afecta,
   *   o sea la diferencia contra el escenario en que ese factor fuera neutro.
   *   Un multiplicador sin unidades detrás no mueve nada, y eso debe verse.
   * - `porM2` y `porUnidad`: los promedios ponderados de esas mismas unidades
   *   con el cálculo vigente. Son la variación que se busca al mover el
   *   multiplicador: el chip de efecto dice el porcentaje en abstracto, esto
   *   dice a cuánto queda el m² y a cuánto la unidad.
   *
   * Los promedios se calculan también para los factores inactivos: sus unidades
   * siguen existiendo y teniendo precio, solo que sin este multiplicador encima.
   */
  const metricas = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const salida: Record<
      string,
      { unidades: number; impacto: number; porM2: number; porUnidad: number }
    > = {};

    for (const f of factores) {
      let unidades = 0;
      let conDesglose = 0;
      let impacto = 0;
      let precio = 0;
      let area = 0;

      for (const p of propiedades) {
        if (!perteneceAlFactor(tipo, f.clave, p, indices)) continue;
        unidades++;

        const d = porId.get(p.id_propiedad);
        if (!d) continue;
        conDesglose++;
        precio += d.precio_calculado;
        area += d.area_ponderada;

        if (!f.activo) continue;
        if (esExtra) {
          if (d.f_extras <= 0) continue;
          const sin = Math.max(d.f_extras - f.valor, 0.0001);
          impacto += d.componente_exento * (1 - sin / d.f_extras);
        } else if (f.valor > 0) {
          impacto += d.componente_exento * (1 - 1 / f.valor);
        }
      }

      salida[f.id_factor] = {
        unidades,
        impacto,
        porM2: area > 0 ? precio / area : 0,
        porUnidad: conDesglose > 0 ? precio / conDesglose : 0,
      };
    }
    return salida;
  }, [factores, propiedades, desgloses, tipo, esExtra, indices]);

  const crear = () => {
    if (!clave.trim()) return;
    agregarFactor(tipo, clave.trim(), etiqueta.trim() || clave.trim(), Number(valor) || 0);
    setClave("");
    setEtiqueta("");
    setValor(esExtra ? "0.0000" : "1.0000");
    setAbierto(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        {esExtra ? (
          <p className="text-xs text-muted-foreground">
            Los extras se suman entre sí. El factor total de extras tiene un tope de 1.0500.
          </p>
        ) : (
          <span />
        )}
        <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
          <Plus className="size-4" />
          {esExtra ? "Nueva Característica" : "Nuevo Factor"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clave</TableHead>
              <TableHead className="w-40">{esExtra ? "Incremento" : "Multiplicador"}</TableHead>
              <TableHead className="w-32">Efecto</TableHead>
              <TableHead className="w-44">Precio promedio ponderado por m²</TableHead>
              <TableHead className="w-44">Precio promedio ponderado</TableHead>
              <TableHead className="w-40">Impacto ($)</TableHead>
              <TableHead className="w-40">Unidades afectadas</TableHead>
              <TableHead className="w-28">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factores.map((f) => (
              <TableRow key={f.id_factor} className={cn(!f.activo && "opacity-50")}>
                <TableCell className="font-medium text-foreground">{f.etiqueta}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step={esExtra ? 0.0001 : 0.0001}
                    value={f.valor.toFixed(4)}
                    onChange={(e) =>
                      actualizarFactor(f.id_factor, Number(e.target.value) || 0)
                    }
                    className="w-32 tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <ChipEfecto valor={f.valor} esExtra={esExtra} />
                </TableCell>
                <TableCell className="tabular-nums text-foreground">
                  {(metricas[f.id_factor]?.unidades ?? 0) === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      {formatoMoneda(metricas[f.id_factor]?.porM2 ?? 0)}
                      <span className="text-xs text-muted-foreground"> /m²</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-foreground">
                  {(metricas[f.id_factor]?.unidades ?? 0) === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    formatoMoneda(metricas[f.id_factor]?.porUnidad ?? 0)
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums",
                    (metricas[f.id_factor]?.impacto ?? 0) > 0.5
                      ? "text-primary"
                      : (metricas[f.id_factor]?.impacto ?? 0) < -0.5
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {formatoMoneda(metricas[f.id_factor]?.impacto ?? 0)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {metricas[f.id_factor]?.unidades ?? 0}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={f.activo}
                      onCheckedChange={(v) =>
                        cambiarActivo(f.id_factor, v)
                      }
                    />
                    {!f.activo ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Inactivo
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Los dos precios promedio son de las unidades que ese factor afecta, con el cálculo
        vigente del motor: al mover el multiplicador se mueven en el acto, junto con los
        promedios del proyecto y los totales del pie. El chip de efecto dice el porcentaje
        en abstracto; estas dos columnas dicen a cuánto queda el m² y a cuánto la unidad.
      </p>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-semibold text-foreground">
              {esExtra ? "Nueva Característica" : "Nuevo Factor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Clave</Label>
              <Input value={clave} onChange={(e) => setClave(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Etiqueta</Label>
              <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Valor</Label>
              <Input
                type="number"
                step={0.0001}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crear}>Crear Factor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
