import { registrarEvento } from "../services/auditoria";
import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAUSAS_OVERRIDE,
  minimoDescripcion,
  useListaStore,
} from "../stores/listaStore";
import { formatoMoneda } from "../lib/formato";
import type { DesglosePrecio, Propiedad } from "../types/dominio";

export interface UnidadMasiva {
  propiedad: Propiedad;
  desglose: DesglosePrecio;
}

/**
 * Aplica un override a varias unidades a la vez. Las unidades bloqueadas para
 * reprecio quedan excluidas y se informan explícitamente.
 */
export function ModalOverrideMasivo({
  abierto,
  onOpenChange,
  unidades,
  onAplicado,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  unidades: UnidadMasiva[];
  onAplicado: () => void;
}) {
  const aplicarOverride = useListaStore((s) => s.aplicarOverride);
  const [modo, setModo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [valor, setValor] = useState("0");
  const [causa, setCausa] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const aplicables = useMemo(
    () => unidades.filter((u) => !u.desglose.bloqueada_para_reprecio),
    [unidades],
  );
  const bloqueadas = unidades.length - aplicables.length;

  const nuevoPrecio = (u: UnidadMasiva) => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return u.desglose.precio_calculado;
    return modo === "porcentaje"
      ? Math.round(u.desglose.precio_calculado * (1 + n / 100) * 100) / 100
      : n;
  };

  const minimo = minimoDescripcion(causa);
  const puede =
    aplicables.length > 0 &&
    !!causa &&
    descripcion.trim().length >= minimo &&
    aplicables.every((u) => nuevoPrecio(u) > 0);

  const totalNuevo = aplicables.reduce((a, u) => a + nuevoPrecio(u), 0);
  const totalActual = aplicables.reduce((a, u) => a + u.desglose.precio_lista, 0);

  const aplicar = () => {
    for (const u of aplicables) {
      aplicarOverride(
        u.propiedad.id_propiedad,
        nuevoPrecio(u),
        causa,
        descripcion,
        u.desglose.precio_calculado,
      );
    }
    registrarEvento({
      id_proyecto: aplicables[0]!.propiedad.id_proyecto,
      tipo: "precio.override_masivo",
      entidad: {
        tipo: "lote",
        id: `lote-${Date.now()}`,
        etiqueta: `${aplicables.length} unidades`,
      },
      antes: { total: totalActual, unidades: aplicables.length },
      despues: {
        total: totalNuevo,
        unidades: aplicables.map((u) => u.propiedad.numero),
        excluidas: bloqueadas,
      },
      impacto_pesos: totalNuevo - totalActual,
      motivo: { causa, descripcion: descripcion.trim() },
    });
    setDescripcion("");
    setCausa("");
    onAplicado();
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Override masivo</DialogTitle>
          <DialogDescription>
            Se aplicará a {aplicables.length} unidades.
            {bloqueadas > 0
              ? ` ${bloqueadas} unidades apartadas o vendidas quedan excluidas: su precio no puede modificarse.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentaje">Ajuste porcentual</SelectItem>
                  <SelectItem value="fijo">Precio fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-masivo" className="text-[13px]">
                {modo === "porcentaje" ? "Porcentaje (%)" : "Precio"}
              </Label>
              <Input
                id="valor-masivo"
                className="tabular-nums"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d.-]/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Causa del override</Label>
            <Select value={causa} onValueChange={setCausa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una causa" />
              </SelectTrigger>
              <SelectContent>
                {CAUSAS_OVERRIDE.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc-masivo" className="text-[13px]">
              Descripción
            </Label>
            <Textarea
              id="desc-masivo"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {descripcion.trim().length}/{minimo}
            </p>
          </div>

          <div className="rounded-md border border-border p-3 text-sm tabular-nums">
            <div className="flex justify-between text-muted-foreground">
              <span>Total actual</span>
              <span>{formatoMoneda(totalActual)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>Total con override</span>
              <span>{formatoMoneda(totalNuevo)}</span>
            </div>
          </div>

          <Alert>
            <ShieldAlert className="size-4 text-amber-600" />
            <AlertDescription>
              Un override masivo rompe la trazabilidad del motor en todas las unidades
              seleccionadas. Estos precios dejan de recalcularse.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!puede} onClick={aplicar}>
            Aplicar a {aplicables.length} unidades
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
