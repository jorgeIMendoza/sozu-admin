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
import { MODELOS_POR_ID, TORRES_POR_ID } from "../mocks/inventario";
import { useMotorAuditado } from "../hooks/useMotorAuditado";
import { usePreciosProyecto } from "../hooks/usePreciosProyecto";
import { formatoMoneda } from "../lib/formato";

function contarUnidades(tipo: TipoFactor, clave: string, props: Propiedad[]): number {
  return props.filter((p) => {
    switch (tipo) {
      case "torre":
        return TORRES_POR_ID[p.id_torre]?.nombre === clave;
      case "vista":
        return p.vista === clave;
      case "orientacion":
        return p.orientacion === clave;
      case "plano":
        return MODELOS_POR_ID[p.id_modelo]?.nombre === clave;
      case "extras":
        return p.caracteristicas_extra.includes(clave);
      default:
        return false;
    }
  }).length;
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

  const esExtra = tipo === "extras";
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [valor, setValor] = useState(esExtra ? "0.0000" : "1.0000");

  const conteos = useMemo(
    () =>
      Object.fromEntries(
        factores.map((f) => [f.id_factor, contarUnidades(tipo, f.clave, propiedades)]),
      ),
    [factores, tipo, propiedades],
  );

  /**
   * Cuánto dinero aporta cada factor sobre el inventario afectado: la diferencia
   * entre el componente exento actual y el que habría si el factor fuera neutro.
   * Un multiplicador sin unidades detrás no mueve nada, y eso debe verse.
   */
  const impactos = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const salida: Record<string, number> = {};
    for (const f of factores) {
      if (!f.activo) {
        salida[f.id_factor] = 0;
        continue;
      }
      let total = 0;
      for (const p of propiedades) {
        const d = porId.get(p.id_propiedad);
        if (!d) continue;
        if (esExtra) {
          if (!p.caracteristicas_extra.includes(f.clave)) continue;
          if (d.f_extras <= 0) continue;
          const sin = Math.max(d.f_extras - f.valor, 0.0001);
          total += d.componente_exento * (1 - sin / d.f_extras);
        } else {
          if (contarUnidades(tipo, f.clave, [p]) === 0) continue;
          if (f.valor <= 0) continue;
          total += d.componente_exento * (1 - 1 / f.valor);
        }
      }
      salida[f.id_factor] = total;
    }
    return salida;
  }, [factores, propiedades, desgloses, tipo, esExtra]);

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
                <TableCell
                  className={cn(
                    "tabular-nums",
                    (impactos[f.id_factor] ?? 0) > 0.5
                      ? "text-primary"
                      : (impactos[f.id_factor] ?? 0) < -0.5
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {formatoMoneda(impactos[f.id_factor] ?? 0)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {conteos[f.id_factor] ?? 0}
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
