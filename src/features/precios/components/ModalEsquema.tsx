import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { calcularVPN, repartirBloques } from "../engine/npv";
import type {
  EsquemaFinanciamiento,
  ModoEscalonamiento,
  TipoEsquema,
} from "../types/dominio";
import type { DatosEsquema } from "../stores/esquemasStore";
import { claseBrecha, factor4, pct2, pctFirmado, puntos } from "../lib/formatoVpn";
import { cn } from "@/lib/utils";

const VACIO: DatosEsquema = {
  nombre: "",
  tipo_esquema: "preventa",
  pct_enganche: 0.3,
  pct_mensualidades: 0.4,
  pct_entrega: 0.3,
  num_mensualidades: 10,
  escalonadas: false,
  modo_escalonamiento: "lineal",
  tramos: [{ peso: 0.2 }, { peso: 0.3 }, { peso: 0.5 }],
  factor_crecimiento: 0.05,
  meses_enganche: 1,
  mes_inicio_mensualidades: 1,
  pct_ajuste_manual: 0,
  es_base: false,
  es_contado: false,
};

export function ModalEsquema({
  abierto,
  onOpenChange,
  esquema,
  horizonte,
  tasaAnual,
  esquemaBase,
  onGuardar,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  esquema: EsquemaFinanciamiento | null;
  horizonte: number;
  tasaAnual: number;
  esquemaBase: EsquemaFinanciamiento | null;
  onGuardar: (datos: DatosEsquema) => void;
}) {
  const [d, setD] = useState<DatosEsquema>(VACIO);

  useEffect(() => {
    if (!abierto) return;
    if (esquema) {
      const { id_esquema: _i, id_proyecto: _p, activo: _a, creado_en: _c, ...resto } =
        esquema;
      setD(structuredClone(resto));
    } else {
      setD(structuredClone(VACIO));
    }
  }, [abierto, esquema]);

  const set = <C extends keyof DatosEsquema>(campo: C, valor: DatosEsquema[C]) =>
    setD((s) => ({ ...s, [campo]: valor }));

  const suma = d.pct_enganche + d.pct_mensualidades + d.pct_entrega;
  const sumaOk = Math.abs(suma - 1) <= 0.0001;
  const nombreOk = d.nombre.trim().length > 0;

  const previa = useMemo(() => {
    const simulado: EsquemaFinanciamiento = {
      ...d,
      id_esquema: esquema?.id_esquema ?? "nuevo",
      id_proyecto: esquema?.id_proyecto ?? "",
      activo: true,
      creado_en: new Date().toISOString(),
    };
    return calcularVPN(simulado, horizonte, tasaAnual, esquemaBase, null, {
      horizonteMinimo: horizonte,
    });
  }, [d, esquema, horizonte, tasaAnual, esquemaBase]);

  const bloques = repartirBloques(Math.max(0, Math.round(d.num_mensualidades)));
  const sumaTramos = d.tramos.reduce((a, t) => a + t.peso, 0);

  const num = (v: string) => {
    const n = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {esquema ? "Editar esquema" : "Nuevo esquema de financiamiento"}
          </DialogTitle>
          <DialogDescription>
            Horizonte de referencia: {horizonte} meses a la entrega estimada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bloque 1 — Identificación */}
          <div className="space-y-2">
            <Label htmlFor="esq-nombre">Nombre del esquema</Label>
            <Input
              id="esq-nombre"
              value={d.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Esquema 30-40-30"
            />
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Tipo de esquema</Label>
              <div className="inline-flex gap-1 rounded-md border border-border p-1">
                {(
                  [
                    ["preventa", "Preventa"],
                    ["post_entrega", "Post-entrega"],
                  ] as Array<[TipoEsquema, string]>
                ).map(([v, t]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      setD((s) => ({
                        ...s,
                        tipo_esquema: v,
                        ...(v === "post_entrega" ? { pct_entrega: 0 } : {}),
                      }))
                    }
                    className={cn(
                      "rounded px-3 py-1 text-[13px]",
                      d.tipo_esquema === v ? "bg-muted font-medium" : "text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Preventa: el comprador paga durante la obra y liquida contra entrega. Solo
                puede ofrecerse mientras falten meses para la entrega estimada.
                Post-entrega: el inmueble ya está terminado. Aplica a inventario remanente
                y no incluye pago contra entrega.
              </p>
            </div>
          </div>

          {/* Bloque 2 — Composición */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Composición</h3>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["pct_enganche", "Enganche (%)"],
                  ["pct_mensualidades", "Mensualidades (%)"],
                  ["pct_entrega", "Entrega (%)"],
                ] as Array<[keyof DatosEsquema, string]>
              ).map(([campo, etiqueta]) => (
                <div key={campo} className="space-y-1.5">
                  <Label className="text-xs">{etiqueta}</Label>
                  <Input
                    className="tabular-nums"
                    disabled={campo === "pct_entrega" && d.tipo_esquema === "post_entrega"}
                    value={((d[campo] as number) * 100).toFixed(2)}
                    onChange={(e) => set(campo, (num(e.target.value) / 100) as never)}
                  />
                </div>
              ))}
            </div>
            {d.tipo_esquema === "post_entrega" ? (
              <p className="text-[12px] text-muted-foreground">
                Los esquemas post-entrega no tienen pago contra entrega: el inmueble ya
                está terminado.
              </p>
            ) : null}

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div style={{ width: `${Math.max(0, d.pct_enganche) * 100}%`, background: "#046c4e" }} />
              <div style={{ width: `${Math.max(0, d.pct_mensualidades) * 100}%`, background: "#059669" }} />
              <div style={{ width: `${Math.max(0, d.pct_entrega) * 100}%`, background: "#a7e0bd" }} />
              {suma < 1 ? (
                <div style={{ width: `${(1 - suma) * 100}%`, background: "#dc2626" }} />
              ) : null}
            </div>
            <p className={cn("text-xs tabular-nums", sumaOk ? "text-muted-foreground" : "text-red-600")}>
              {sumaOk
                ? `Total ${pct2(suma)}`
                : `Los porcentajes suman ${pct2(suma)}. Deben sumar exactamente 100%.`}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Número de mensualidades</Label>
                <Input
                  className="tabular-nums"
                  value={d.num_mensualidades}
                  onChange={(e) => set("num_mensualidades", Math.max(0, Math.round(num(e.target.value))))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Enganche en cuántas exhibiciones</Label>
                <Input
                  className="tabular-nums"
                  value={d.meses_enganche}
                  onChange={(e) => {
                    const v = Math.max(1, Math.round(num(e.target.value)));
                    setD((s) => ({ ...s, meses_enganche: v, mes_inicio_mensualidades: v }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bloque 3 — Escalonamiento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Mensualidades escalonadas
              </h3>
              <Switch
                checked={d.escalonadas}
                onCheckedChange={(v) => set("escalonadas", v)}
              />
            </div>

            {d.escalonadas ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex gap-2">
                  {(["lineal", "tramos"] as ModoEscalonamiento[]).map((modo) => (
                    <button
                      key={modo}
                      type="button"
                      onClick={() => set("modo_escalonamiento", modo)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm",
                        d.modo_escalonamiento === modo
                          ? "border border-border bg-background shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {modo === "lineal" ? "Crecimiento lineal" : "Por tramos"}
                    </button>
                  ))}
                </div>

                {d.modo_escalonamiento === "lineal" ? (
                  <div className="w-56 space-y-1.5">
                    <Label className="text-xs">Crecimiento mensual (%)</Label>
                    <Input
                      className="tabular-nums"
                      value={(d.factor_crecimiento * 100).toFixed(2)}
                      onChange={(e) => set("factor_crecimiento", num(e.target.value) / 100)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3">
                      {["Tramo inicial", "Tramo intermedio", "Tramo final"].map((t, i) => (
                        <div key={t} className="space-y-1.5">
                          <Label className="text-xs">{t}</Label>
                          <Input
                            className="tabular-nums"
                            value={((d.tramos[i]?.peso ?? 0) * 100).toFixed(2)}
                            onChange={(e) =>
                              setD((s) => {
                                const tramos = [0, 1, 2].map((k) => ({
                                  peso: s.tramos[k]?.peso ?? 0,
                                }));
                                tramos[i] = { peso: num(e.target.value) / 100 };
                                return { ...s, tramos };
                              })
                            }
                          />
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {bloques[i]} meses
                          </p>
                        </div>
                      ))}
                    </div>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        Math.abs(sumaTramos - 1) <= 0.0001
                          ? "text-muted-foreground"
                          : "text-amber-600",
                      )}
                    >
                      Los pesos suman {pct2(sumaTramos)}.
                    </p>
                  </div>
                )}

                <PreviaMensualidades
                  flujos={previa.flujos.filter((f) => f.concepto === "mensualidad")}
                />
              </div>
            ) : null}
          </div>

          {/* Bloque 4 — Política comercial */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Política comercial</h3>
            <div className="w-64 space-y-1.5">
              <Label className="text-xs">Porcentaje Descuento/Aumento (%)</Label>
              <Input
                className="tabular-nums"
                value={(d.pct_ajuste_manual * 100).toFixed(2)}
                onChange={(e) => set("pct_ajuste_manual", num(e.target.value) / 100)}
              />
              <p className="text-[11px] text-muted-foreground">
                Usa valores negativos para descuentos (ej: −5 = 5% descuento) y valores
                positivos para aumentos (ej: 3 = 3% aumento).
              </p>
            </div>

            <div className="space-y-1.5 rounded-md bg-muted/50 p-3 text-sm tabular-nums">
              <Fila etiqueta="Factor de VPN de este esquema" valor={factor4(previa.factor_vpn)} />
              <Fila
                etiqueta="Ajuste que justifica el VPN"
                valor={esquemaBase ? pctFirmado(previa.ajuste_equivalente) : "—"}
              />
              <Fila etiqueta="Tu ajuste" valor={pctFirmado(d.pct_ajuste_manual)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Brecha</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs tabular-nums",
                    claseBrecha(previa.brecha_politica),
                  )}
                >
                  {puntos(previa.brecha_politica)}
                </span>
              </div>
              {previa.brecha_politica * 100 < -1.5 ? (
                <p className="text-xs text-red-600">
                  Estás otorgando más descuento del que el valor presente justifica.
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="esq-base"
                checked={d.es_base}
                onCheckedChange={(v) => set("es_base", v === true)}
              />
              <div>
                <Label htmlFor="esq-base" className="text-sm">
                  Marcar como esquema base del proyecto
                </Label>
                {d.es_base ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    El esquema base es la referencia contra la cual se calculan todos los
                    precios equivalentes. Solo puede haber uno por proyecto.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!sumaOk || !nombreOk}
            onClick={() => {
              onGuardar({ ...d, nombre: d.nombre.trim() });
              onOpenChange(false);
            }}
          >
            {esquema ? "Guardar cambios" : "Crear esquema"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  );
}

/** Vista previa en vivo de la distribución de mensualidades (SVG plano). */
function PreviaMensualidades({ flujos }: { flujos: Array<{ pct: number }> }) {
  if (flujos.length === 0) return null;
  const max = Math.max(...flujos.map((f) => f.pct), 0.0001);
  const w = 480;
  const h = 70;
  const paso = w / flujos.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[70px] w-full" role="img" aria-label="Vista previa de mensualidades">
      {flujos.map((f, i) => {
        const alto = (f.pct / max) * (h - 6);
        return (
          <rect
            key={i}
            x={i * paso + paso * 0.15}
            y={h - alto}
            width={paso * 0.7}
            height={alto}
            fill="#059669"
            rx={2}
          />
        );
      })}
    </svg>
  );
}
