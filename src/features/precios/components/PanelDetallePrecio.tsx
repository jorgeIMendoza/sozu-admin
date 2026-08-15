import { useEffect, useMemo, useState } from "react";
import { CircleAlert, FileClock, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AlertaCalidad, DesglosePrecio, Modelo, MotorPrecio, Propiedad, Torre } from "../types/dominio";
import {
  formatoFecha,
  formatoM2,
  formatoMoneda,
  formatoMultiplicador,
  formatoPorcentaje,
} from "../lib/formato";
import {
  CAUSAS_OVERRIDE,
  minimoDescripcion,
  useListaStore,
} from "../stores/listaStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolverBaseModelo } from "../engine/pricing";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { registrarEvento } from "../services/auditoria";
import { useBitacoraStore } from "../stores/bitacoraStore";
import { useOfertasStore } from "../stores/ofertasStore";
import { formatoFechaHora } from "../lib/formato";

export interface FilaPrecio {
  propiedad: Propiedad;
  desglose: DesglosePrecio;
  modelo: Modelo | undefined;
  torre: Torre | undefined;
  alertas: AlertaCalidad[];
  productoFactores: number;
}

function Renglon({
  etiqueta,
  valor,
  atenuado,
  separador,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  atenuado?: boolean;
  separador?: boolean;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-3 py-1.5 text-sm",
        separador && "border-t border-border",
        destacado && "rounded-md bg-muted font-bold text-foreground",
        atenuado && "text-muted-foreground/60",
        !destacado && !atenuado && "text-foreground",
      )}
    >
      <span className={cn(!destacado && "text-muted-foreground")}>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

export function PanelDetallePrecio({
  fila,
  motor,
  proyecto,
  abierto,
  onOpenChange,
}: {
  fila: FilaPrecio | null;
  motor: MotorPrecio;
  proyecto: string;
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const overrides = useListaStore((s) => s.overrides);
  const aplicarOverride = useListaStore((s) => s.aplicarOverride);
  const quitarOverride = useListaStore((s) => s.quitarOverride);
  const eventos = useBitacoraStore((s) => s.eventos);
  const ofertas = useOfertasStore((s) => s.ofertas);

  const overrideVigente = fila ? overrides[fila.propiedad.id_propiedad] : undefined;

  const [activo, setActivo] = useState(false);
  const [precio, setPrecio] = useState("");
  const [causa, setCausa] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  useEffect(() => {
    if (!fila) return;
    setActivo(false);
    setConfirmandoQuitar(false);
    setMotivo("");
    setCausa("");
    setPrecio(String(fila.desglose.precio_calculado));
  }, [fila?.propiedad.id_propiedad, abierto]);

  const minimo = minimoDescripcion(causa);
  const bloqueada = fila?.desglose.bloqueada_para_reprecio ?? false;

  const puedeGuardar = useMemo(
    () => !!causa && motivo.trim().length >= minimo && Number(precio) > 0 && !bloqueada,
    [causa, motivo, precio, minimo, bloqueada],
  );

  if (!fila) return null;

  const { propiedad: p, desglose: d, modelo, torre } = fila;
  const areaExt = p.m2_exteriores * motor.k_ext;
  const areaLoft = p.m2_loft * motor.k_loft;
  const base = resolverBaseModelo(motor, p.id_modelo, modelo?.nombre ?? "");
  const subtotalBase = base.precio_base_m2 * d.area_ponderada;

  const factores: Array<[string, number]> = [
    [`Factor torre · ${torre?.nombre ?? "—"}`, d.f_torre],
    [`Factor nivel · Nivel ${p.nivel}`, d.f_nivel],
    [`Factor vista · ${p.vista}`, d.f_vista],
    [`Factor orientación · ${p.orientacion}`, d.f_orientacion],
    ["Factor extras", d.f_extras],
    ["Factor tamaño", d.f_tamano],
  ];

  const chips = [
    p.estatus,
    p.vista,
    `${modelo?.recamaras ?? 0} rec`,
    `${modelo?.banos_completos ?? 0} baños`,
    `${modelo?.medios_banos ?? 0} 1/2 baños`,
  ];

  const ofertaVigente =
    ofertas.find(
      (o) =>
        o.id_propiedad === p.id_propiedad &&
        o.estado === "vigente" &&
        new Date(o.vence_en).getTime() >= Date.now(),
    ) ?? null;

  const historial = eventos
    .filter((e) => e.entidad.id === p.id_propiedad || e.entidad.etiqueta.includes(`Unidad ${p.numero}`))
    .slice()
    .reverse()
    .slice(0, 12);

  const guardar = () => {
    if (bloqueada) return;
    const anterior = overrides[p.id_propiedad] ?? null;
    const ok = aplicarOverride(
      p.id_propiedad,
      Number(precio),
      causa,
      motivo,
      d.precio_calculado,
    );
    if (ok) {
      registrarEvento({
        id_proyecto: p.id_proyecto,
        tipo: "precio.override_aplicado",
        entidad: {
          tipo: "propiedad",
          id: p.id_propiedad,
          etiqueta: `Unidad ${p.numero}`,
        },
        antes: {
          precio: anterior?.precio ?? d.precio_calculado,
          origen: anterior ? "override" : "motor",
        },
        despues: {
          precio: Number(precio),
          precio_motor: d.precio_calculado,
          origen: "override",
        },
        impacto_pesos: Number(precio) - (anterior?.precio ?? d.precio_calculado),
        motivo: { causa, descripcion: motivo.trim() },
      });
      setActivo(false);
      setMotivo("");
      setCausa("");
    }
  };

  const quitar = () => {
    const anterior = overrides[p.id_propiedad] ?? null;
    quitarOverride(p.id_propiedad);
    registrarEvento({
      id_proyecto: p.id_proyecto,
      tipo: "precio.override_removido",
      entidad: { tipo: "propiedad", id: p.id_propiedad, etiqueta: `Unidad ${p.numero}` },
      antes: anterior
        ? { precio: anterior.precio, causa: anterior.causa }
        : null,
      despues: { precio: d.precio_calculado, origen: "motor" },
      impacto_pesos: d.precio_calculado - (anterior?.precio ?? d.precio_calculado),
    });
  };

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-2xl font-bold tabular-nums">
            Unidad {p.numero}
          </SheetTitle>
          <SheetDescription>
            {proyecto} · Torre {torre?.nombre ?? "—"} · {modelo?.nombre ?? "—"} · Nivel{" "}
            <span className="tabular-nums">{p.nivel}</span>
          </SheetDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums"
              >
                {c}
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              Desglose del cálculo
            </h3>
            <div className="rounded-lg border border-border">
              <Renglon
                etiqueta={`Precio base por m² · ${modelo?.nombre ?? "—"}`}
                valor={formatoMoneda(base.precio_base_m2)}
              />
              <Renglon etiqueta="Área interior" valor={formatoM2(p.m2_interiores)} />
              <Renglon
                etiqueta={`Área exterior (× ${motor.k_ext.toFixed(3)})`}
                valor={formatoM2(areaExt)}
                atenuado={areaExt === 0}
              />
              <Renglon
                etiqueta={`Área loft (× ${motor.k_loft.toFixed(3)})`}
                valor={formatoM2(areaLoft)}
                atenuado={areaLoft === 0}
              />
              <Renglon
                etiqueta="Área ponderada"
                valor={formatoM2(d.area_ponderada)}
                separador
              />
              <Renglon etiqueta="Subtotal base" valor={formatoMoneda(subtotalBase)} />

              <div className="mt-1 border-t border-border pt-1">
                {factores.map(([etiqueta, valor]) => (
                  <Renglon
                    key={etiqueta}
                    etiqueta={etiqueta}
                    valor={formatoMultiplicador(valor)}
                    atenuado={formatoMultiplicador(valor) === "1.0000"}
                  />
                ))}
              </div>
              <Renglon
                etiqueta="Producto de factores"
                valor={formatoMultiplicador(fila.productoFactores)}
                separador
              />

              <Renglon
                etiqueta="Componente exento"
                valor={formatoMoneda(d.componente_exento)}
                separador
              />
              <Renglon
                etiqueta={`Cajones (${p.num_cajones} × ${p.tipo_cajon === "tandem" ? "tándem" : "independiente"})`}
                valor={formatoMoneda(
                  p.num_cajones *
                    motor.precio_cajon *
                    (p.tipo_cajon === "tandem" ? motor.factor_cajon_tandem : 1),
                )}
                atenuado={p.num_cajones === 0}
              />
              <Renglon
                etiqueta="Bodega"
                valor={formatoMoneda(p.m2_bodega * motor.precio_m2_bodega)}
                atenuado={p.m2_bodega === 0}
              />
              <Renglon
                etiqueta="Componente gravado"
                valor={formatoMoneda(d.componente_gravado)}
                separador
              />

              <div className="border-t border-border p-1">
                <Renglon
                  etiqueta="PRECIO CALCULADO"
                  valor={formatoMoneda(d.precio_calculado)}
                  destacado
                />
              </div>
              <Renglon
                etiqueta="Precio de lista actual"
                valor={
                  p.precio_lista_actual > 0 ? formatoMoneda(p.precio_lista_actual) : "—"
                }
                atenuado={p.precio_lista_actual === 0}
              />
              <Renglon
                etiqueta="Delta"
                valor={
                  p.precio_lista_actual > 0
                    ? `${formatoPorcentaje(d.delta_pct)} ${d.delta_pct >= 0 ? "▲" : "▼"}`
                    : "—"
                }
                atenuado={p.precio_lista_actual === 0}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Libro: Comercial</p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">Alertas</h3>
            {fila.alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas de calidad para esta unidad.
              </p>
            ) : (
              <div className="space-y-2">
                {fila.alertas.map((a, i) => {
                  const Icono =
                    a.severidad === "critica"
                      ? CircleAlert
                      : a.severidad === "advertencia"
                        ? TriangleAlert
                        : Info;
                  return (
                    <div
                      key={`${a.codigo}-${i}`}
                      className="flex items-start gap-2 rounded-md border border-border p-2.5"
                    >
                      <Icono
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          a.severidad === "critica"
                            ? "text-destructive"
                            : a.severidad === "advertencia"
                              ? "text-amber-600"
                              : "text-muted-foreground",
                        )}
                      />
                      <p className="flex-1 text-sm text-foreground">{a.mensaje}</p>
                      <code className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {a.codigo}
                      </code>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Override manual</h3>

            {overrideVigente && (
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  Override vigente: {formatoMoneda(overrideVigente.precio)}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {overrideVigente.causa}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {overrideVigente.descripcion}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {formatoFecha(overrideVigente.creado_en)}
                </p>
                <div className="mt-3 flex gap-2">
                  {confirmandoQuitar ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          quitar();
                          setConfirmandoQuitar(false);
                        }}
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmandoQuitar(false)}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmandoQuitar(true)}
                    >
                      Quitar override
                    </Button>
                  )}
                </div>
              </div>
            )}

            {d.motivo_bloqueo === "oferta_vigente" && ofertaVigente ? (
              <Alert className="border-amber-200 bg-amber-50">
                <FileClock className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Esta unidad tiene una oferta vigente por{" "}
                  <span className="tabular-nums">
                    {formatoMoneda(ofertaVigente.precio_ofertado)}
                  </span>{" "}
                  con el esquema {ofertaVigente.nombre_esquema}, emitida el{" "}
                  <span className="tabular-nums">
                    {formatoFecha(ofertaVigente.emitida_en)}
                  </span>{" "}
                  y vigente hasta el{" "}
                  <span className="tabular-nums">
                    {new Date(ofertaVigente.vence_en).toLocaleDateString("es-MX")}
                  </span>
                  . El precio no puede modificarse mientras la oferta esté vigente.
                </AlertDescription>
              </Alert>
            ) : null}

            {bloqueada ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-1 text-sm text-foreground">
                  {d.motivo_bloqueo === "oferta_vigente" && ofertaVigente ? (
                    <>
                      <p>
                        Precio bloqueado por oferta vigente hasta el{" "}
                        <span className="tabular-nums">
                          {new Date(ofertaVigente.vence_en).toLocaleDateString("es-MX")}
                        </span>
                        . Se ofertó{" "}
                        <span className="tabular-nums">
                          {formatoMoneda(ofertaVigente.precio_ofertado)}
                        </span>{" "}
                        con el esquema {ofertaVigente.nombre_esquema}.
                      </p>
                      <p className="text-muted-foreground">
                        El artículo 7 de la Ley Federal de Protección al Consumidor obliga a
                        respetar el precio ofertado durante su vigencia.
                      </p>
                      <Link
                        to="/admin/inventario/precios/auditoria/ofertas"
                        className="text-primary hover:underline"
                      >
                        Ver oferta
                      </Link>
                    </>
                  ) : d.motivo_bloqueo === "conversion_pendiente" ? (
                    <>
                      <p>
                        Oferta convertida, inventario sin actualizar. La unidad permanece
                        bloqueada para reprecio hasta que su estatus se actualice a
                        Apartada o Vendida en el inventario.
                      </p>
                      <Link
                        to="/admin/propiedades"
                        className="text-emerald-700 hover:underline"
                      >
                        Abrir ficha de la propiedad
                      </Link>
                    </>
                  ) : (
                    <p>
                      Unidad {p.estatus.toLowerCase()}: su precio no puede modificarse.
                      Existe una operación en firme sobre esta unidad.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="sw-override" className="text-[13px]">
                  Aplicar override de precio
                </Label>
                <Switch id="sw-override" checked={activo} onCheckedChange={setActivo} />
              </div>
            )}

            {activo && !bloqueada && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="in-precio" className="text-[13px]">
                    Precio de override
                  </Label>
                  <Input
                    id="in-precio"
                    className="tabular-nums"
                    value={precio}
                    inputMode="decimal"
                    onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ""))}
                  />
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
                  <Label htmlFor="in-motivo" className="text-[13px]">
                    Descripción del override
                  </Label>
                  <Textarea
                    id="in-motivo"
                    rows={4}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Explica por qué este precio se aparta del motor. Este texto queda en
                    la bitácora y es la evidencia ante una auditoría.{" "}
                    <span className="tabular-nums">
                      {motivo.trim().length}/{minimo}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <Alert>
              <ShieldAlert className="size-4 text-amber-600" />
              <AlertDescription>
                El override rompe la trazabilidad del motor. Un precio manual no se
                recalcula cuando cambian los parámetros y no puede reconstruirse. Úsalo
                solo con causa documentada.
              </AlertDescription>
            </Alert>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">
                Historial de esta unidad
              </h3>
              <Link
                to="/admin/inventario/precios/auditoria/bitacora"
                search={{ unidad: p.numero }}
                className="text-sm text-primary hover:underline"
              >
                Ver en bitácora
              </Link>
            </div>
            {historial.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin eventos registrados para esta unidad.
              </p>
            ) : (
              <ol className="space-y-2 border-l border-border pl-4">
                {historial.map((e) => (
                  <li key={e.id_evento} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border" />
                    <p className="text-foreground">{e.entidad.etiqueta}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatoFechaHora(e.ocurrido_en)} · {e.actor.nombre}
                      {e.impacto_pesos !== null &&
                        ` · ${formatoMoneda(e.impacto_pesos)}`}
                    </p>
                    {e.motivo && (
                      <p className="text-xs text-muted-foreground">
                        {e.motivo.causa}: {e.motivo.descripcion}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button disabled={!activo || !puedeGuardar} onClick={guardar}>
            Guardar override
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
