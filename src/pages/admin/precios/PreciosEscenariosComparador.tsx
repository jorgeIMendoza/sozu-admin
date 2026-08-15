import { useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GraficoBrechas } from "@/features/precios/components/GraficoBrechas";
import {
  COLORES_SERIE,
  GraficoSensibilidad,
} from "@/features/precios/components/GraficoSensibilidad";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import {
  calcularVPN,
  esInejecutable,
  horizonteEfectivo,
  motivoCritico,
  precioNominalEquivalente,
} from "@/features/precios/engine/npv";
import { formatoMoneda } from "@/features/precios/lib/formato";
import {
  claseBrecha,
  factor4,
  pct2,
  pctFirmado,
  puntos,
} from "@/features/precios/lib/formatoVpn";
import type { TipoEsquema } from "@/features/precios/types/dominio";

  component: Comparador,
});

type Orden = "captura" | "vpn" | "realizado";

const ESTATUS_BLOQUEADOS = ["Apartada", "Vendida"];
const TASAS = [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2];

function Comparador() {
  const {
    motor,
    esquemas,
    esquemaBase,
    resultados,
    porTorre,
    torres,
    multiTorre,
    horizonteMinimo,
    tasaAnual,
  } = useEsquemasVPN();
  const { propiedades, desgloses } = usePreciosProyecto();

  const [idUnidad, setIdUnidad] = useState<string | null>(null);
  const [generico, setGenerico] = useState(false);
  const [orden, setOrden] = useState<Orden>("captura");
  const [mix, setMix] = useState<Record<string, number>>({});
  const [regimen, setRegimen] = useState<TipoEsquema>("preventa");
  const [vistaTorre, setVistaTorre] = useState<string>("ponderado");
  const [sensAbierta, setSensAbierta] = useState(false);
  const [sensMetrica, setSensMetrica] = useState<"descuento" | "factor">("descuento");

  const activos = useMemo(
    () =>
      esquemas.filter(
        (e) =>
          e.activo &&
          (regimen === "post_entrega"
            ? e.tipo_esquema === "post_entrega"
            : e.tipo_esquema !== "post_entrega"),
      ),
    [esquemas, regimen],
  );

  const unidadMediana = useMemo(() => {
    if (desgloses.length === 0) return null;
    const ordenados = [...desgloses].sort((a, b) => a.precio_lista - b.precio_lista);
    return ordenados[Math.floor(ordenados.length / 2)] ?? null;
  }, [desgloses]);

  const desgloseSel =
    desgloses.find((d) => d.id_propiedad === idUnidad) ?? unidadMediana ?? null;
  const propiedadSel = propiedades.find(
    (p) => p.id_propiedad === desgloseSel?.id_propiedad,
  );
  const precioReferencia = generico ? 1_000_000 : (desgloseSel?.precio_lista ?? 0);

  /** Torre efectiva de la vista: la seleccionada, o la de la unidad de referencia. */
  const torreVista =
    vistaTorre !== "ponderado"
      ? vistaTorre
      : multiTorre
        ? null
        : (torres[0]?.id_torre ?? null);

  const factorDe = (idEsquema: string): number => {
    const bloque = porTorre[idEsquema];
    if (!bloque) return resultados[idEsquema]?.factor_vpn ?? 0;
    if (torreVista && bloque.porTorre[torreVista])
      return bloque.porTorre[torreVista]!.factor_vpn;
    return bloque.ponderado;
  };

  const factorBase = esquemaBase ? factorDe(esquemaBase.id_esquema) : 1;
  const objetivo = motor.vpn_objetivo_factor ?? factorBase;

  const filas = useMemo(() => {
    const lista = activos.map((e) => {
      const vpn = resultados[e.id_esquema]!;
      const factor = factorDe(e.id_esquema);
      const inejecutable =
        esInejecutable(vpn) ||
        (torreVista ? esInejecutable(porTorre[e.id_esquema]?.porTorre[torreVista]) : false);
      const ajusteEquivalente = factor > 0 ? factorBase / factor - 1 : 0;
      const descMax = factor > 0 ? 1 - objetivo / factor : 0;
      const brecha = e.pct_ajuste_manual - ajusteEquivalente;
      const equivalente = precioNominalEquivalente(precioReferencia, factorBase, factor);
      const conAjuste = precioReferencia * (1 + e.pct_ajuste_manual);
      return {
        esquema: e,
        vpn,
        factor,
        inejecutable,
        ajusteEquivalente,
        descMax,
        brecha,
        equivalente,
        conAjuste,
        diferencia: conAjuste - equivalente,
        realizado: conAjuste * factor,
      };
    });
    if (orden === "vpn") lista.sort((a, b) => b.factor - a.factor);
    if (orden === "realizado") lista.sort((a, b) => b.realizado - a.realizado);
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activos, resultados, porTorre, precioReferencia, factorBase, objetivo, orden, torreVista]);

  const comparables = filas.filter((f) => !f.inejecutable);
  const mejor = comparables.reduce<number>(
    (a, f) => Math.max(a, f.realizado),
    Number.NEGATIVE_INFINITY,
  );
  const peor = comparables.reduce<number>(
    (a, f) => Math.min(a, f.realizado),
    Number.POSITIVE_INFINITY,
  );

  // ---- Impacto agregado sobre inventario disponible ----
  const ejecutables = comparables;

  const mixEfectivo = useMemo(() => {
    const base: Record<string, number> = {};
    const n = ejecutables.length || 1;
    for (const f of ejecutables) {
      base[f.esquema.id_esquema] = mix[f.esquema.id_esquema] ?? 1 / n;
    }
    return base;
  }, [ejecutables, mix]);

  const sumaMix = Object.values(mixEfectivo).reduce((a, v) => a + v, 0);
  const mixOk = Math.abs(sumaMix - 1) <= 0.0005;

  const disponibles = useMemo(() => {
    const bloqueadas = new Set(
      propiedades
        .filter((p) => ESTATUS_BLOQUEADOS.includes(p.estatus))
        .map((p) => p.id_propiedad),
    );
    return desgloses.filter((d) => !bloqueadas.has(d.id_propiedad));
  }, [propiedades, desgloses]);

  const valorLista = disponibles.reduce((a, d) => a + d.precio_lista, 0);

  const vpnActual = mixOk
    ? ejecutables.reduce(
        (a, f) =>
          a +
          valorLista *
            (mixEfectivo[f.esquema.id_esquema] ?? 0) *
            (1 + f.esquema.pct_ajuste_manual) *
            f.factor,
        0,
      )
    : 0;

  const vpnSinBrecha = mixOk
    ? ejecutables.reduce(
        (a, f) => a + valorLista * (mixEfectivo[f.esquema.id_esquema] ?? 0) * factorBase,
        0,
      )
    : 0;

  // ---- Sensibilidad a la tasa ----
  // SWAP POINT: la tasa debe provenir del contrato de crédito puente del proyecto.
  const sensibilidad = useMemo(() => {
    const columnas = filas.filter((f) => !f.inejecutable).map((f) => f.esquema);
    const matriz = TASAS.map((t) => {
      const rBase = esquemaBase
        ? calcularVPN(
            esquemaBase,
            horizonteEfectivo(esquemaBase, horizonteMinimo),
            t,
            esquemaBase,
            null,
            { horizonteMinimo },
          )
        : null;
      const fBase = rBase?.factor_vpn ?? 1;
      const obj = motor.vpn_objetivo_factor ?? fBase;
      const celdas = columnas.map((e) => {
        const r = calcularVPN(
          e,
          horizonteEfectivo(e, horizonteMinimo),
          t,
          esquemaBase,
          null,
          { horizonteMinimo },
        );
        return {
          id: e.id_esquema,
          factor: r.factor_vpn,
          descuento: r.factor_vpn > 0 ? 1 - obj / r.factor_vpn : 0,
        };
      });
      return { tasa: t, celdas };
    });
    return { columnas, matriz };
  }, [filas, esquemaBase, horizonteMinimo, motor.vpn_objetivo_factor]);

  const series = sensibilidad.columnas.map((e, i) => ({
    nombre: e.nombre,
    color: COLORES_SERIE[i % COLORES_SERIE.length]!,
    puntos: sensibilidad.matriz.map((fila) => ({
      tasa: fila.tasa,
      valor:
        sensMetrica === "descuento"
          ? Math.max(0, fila.celdas.find((c) => c.id === e.id_esquema)?.descuento ?? 0)
          : (fila.celdas.find((c) => c.id === e.id_esquema)?.factor ?? 0),
    })),
  }));

  const primera = sensibilidad.columnas[0];
  const lectura = (() => {
    if (!primera) return null;
    const bajo = Math.max(
      0,
      sensibilidad.matriz[0]?.celdas.find((c) => c.id === primera.id_esquema)?.descuento ?? 0,
    );
    const alto = Math.max(
      0,
      sensibilidad.matriz[sensibilidad.matriz.length - 1]?.celdas.find(
        (c) => c.id === primera.id_esquema,
      )?.descuento ?? 0,
    );
    const factorVar = bajo > 0 ? alto / bajo : 0;
    return { nombre: primera.nombre, bajo, alto, factorVar };
  })();

  const money = (v: number) => formatoMoneda(v);
  const noEjecutablesMix = filas.filter((f) => f.inejecutable);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado
          valor={regimen}
          onCambio={(v) => setRegimen(v as TipoEsquema)}
          opciones={[
            ["preventa", "Preventa"],
            ["post_entrega", "Post-entrega"],
          ]}
        />
        {multiTorre ? (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Torre</Label>
            <Select value={vistaTorre} onValueChange={setVistaTorre}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ponderado">Ponderado del proyecto</SelectItem>
                {torres.map((t) => (
                  <SelectItem key={t.id_torre} value={t.id_torre}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Los esquemas de preventa y post-entrega corresponden a regímenes comerciales
        distintos y no son comparables entre sí.
      </p>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Unidad de referencia</Label>
          <Select
            value={desgloseSel?.id_propiedad ?? ""}
            onValueChange={(v) => {
              setIdUnidad(v);
              const p = propiedades.find((x) => x.id_propiedad === v);
              if (p && multiTorre) setVistaTorre(p.id_torre);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {propiedades.map((p) => (
                <SelectItem key={p.id_propiedad} value={p.id_propiedad}>
                  {p.numero} · Nivel {p.nivel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          Precio de lista de referencia:{" "}
          <span className="font-medium text-foreground">{money(precioReferencia)}</span>
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
            Libro: Comercial
          </span>
          {propiedadSel ? (
            <span className="ml-2 text-xs">Unidad {propiedadSel.numero}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="generico" checked={generico} onCheckedChange={setGenerico} />
          <Label htmlFor="generico" className="text-sm">
            Usar precio genérico de $1,000,000
          </Label>
        </div>
      </Card>

      <Segmentado
        valor={orden}
        onCambio={(v) => setOrden(v as Orden)}
        opciones={[
          ["captura", "Orden de captura"],
          ["vpn", "Factor de VPN"],
          ["realizado", "VPN realizado"],
        ]}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Métrica
              </th>
              {filas.map((f) => (
                <th
                  key={f.esquema.id_esquema}
                  className={cn(
                    "px-3 py-2 text-right",
                    f.esquema.es_base && !f.inejecutable && "bg-muted/50",
                    f.inejecutable && "bg-red-50/60",
                  )}
                >
                  <div
                    className={cn(
                      "font-semibold",
                      f.inejecutable ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {f.esquema.nombre}
                  </div>
                  {f.esquema.es_base ? (
                    <span className="mt-0.5 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                      Base
                    </span>
                  ) : null}
                  {f.inejecutable ? (
                    <span
                      title={motivoCritico(f.vpn)}
                      className="mt-0.5 inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700"
                    >
                      No ejecutable
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Fila titulo="Enganche" filas={filas} render={(f) => pct2(f.esquema.pct_enganche)} />
            <Fila
              titulo="Mensualidades"
              filas={filas}
              render={(f) =>
                f.esquema.num_mensualidades > 0
                  ? `${pct2(f.esquema.pct_mensualidades)} en ${f.esquema.num_mensualidades}`
                  : "—"
              }
            />
            <Fila
              titulo="Entrega"
              filas={filas}
              render={(f) => (f.esquema.pct_entrega > 0 ? pct2(f.esquema.pct_entrega) : "—")}
            />
            <Fila
              titulo="Plazo promedio"
              filas={filas}
              render={(f) => `${f.vpn.plazo_promedio_ponderado.toFixed(1)} meses`}
            />
            <Fila
              titulo="Factor de VPN"
              filas={filas}
              destacada
              render={(f) => factor4(f.factor)}
            />
            <Fila
              titulo="Ajuste equivalente"
              filas={filas}
              render={(f) =>
                f.esquema.es_base || f.inejecutable ? "—" : pctFirmado(f.ajusteEquivalente)
              }
            />
            <Fila
              titulo="Ajuste aplicado hoy"
              filas={filas}
              render={(f) => pctFirmado(f.esquema.pct_ajuste_manual)}
            />
            <Fila
              titulo="Brecha"
              filas={filas}
              render={(f) =>
                f.esquema.es_base || f.inejecutable ? (
                  "—"
                ) : (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      claseBrecha(f.brecha),
                    )}
                  >
                    {puntos(f.brecha)}
                  </span>
                )
              }
            />
            <Fila
              titulo="Precio nominal equivalente"
              filas={filas}
              render={(f) => money(f.equivalente)}
            />
            <Fila
              titulo="Precio con ajuste aplicado"
              filas={filas}
              render={(f) => money(f.conAjuste)}
            />
            <Fila
              titulo="Diferencia contra equivalente"
              filas={filas}
              render={(f) =>
                f.esquema.es_base
                  ? "—"
                  : `${f.diferencia < 0 ? "−" : "+"}${money(Math.abs(f.diferencia))}`
              }
            />
            <Fila
              titulo="Descuento máx. autorizable"
              filas={filas}
              render={(f) => (f.inejecutable ? "—" : pct2(Math.max(0, f.descMax)))}
            />
            <Fila
              titulo="VPN realizado por unidad"
              filas={filas}
              render={(f) =>
                f.inejecutable ? (
                  "—"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    {money(f.realizado)}
                    {f.realizado === mejor ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Mejor
                      </span>
                    ) : null}
                    {f.realizado === peor ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                        Peor
                      </span>
                    ) : null}
                  </span>
                )
              }
            />
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Las columnas atenuadas corresponden a esquemas que no pueden ejecutarse con el
        horizonte actual del proyecto. Sus cifras de valor presente son aritméticamente
        válidas pero comercialmente inaplicables.
      </p>

      <Card className="space-y-2 p-4">
        <h3 className="text-base font-semibold text-foreground">
          Brecha entre la política aplicada y el valor presente
        </h3>
        <GraficoBrechas
          datos={filas
            .filter((f) => !f.esquema.es_base)
            .map((f) => ({ nombre: f.esquema.nombre, brecha: f.brecha }))}
        />
        <p className="text-xs text-muted-foreground">
          Las barras rojas indican esquemas donde se otorga más descuento del que el valor
          presente justifica.
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <h3 className="text-base font-semibold text-foreground">
          Impacto agregado sobre el inventario disponible
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ejecutables.map((f) => (
            <div key={f.esquema.id_esquema} className="space-y-1.5">
              <Label className="text-xs">{f.esquema.nombre}</Label>
              <Input
                className="tabular-nums"
                value={((mixEfectivo[f.esquema.id_esquema] ?? 0) * 100).toFixed(2)}
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value.replace(",", "."));
                  setMix((s) => ({
                    ...s,
                    [f.esquema.id_esquema]: Number.isFinite(n) ? n / 100 : 0,
                  }));
                }}
              />
            </div>
          ))}
          {noEjecutablesMix.map((f) => (
            <div key={f.esquema.id_esquema} className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                {f.esquema.nombre}
                <span
                  title={motivoCritico(f.vpn)}
                  className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700"
                >
                  No ejecutable
                </span>
              </Label>
              <Input className="tabular-nums" value="0.00" disabled readOnly />
            </div>
          ))}
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            mixOk ? "text-muted-foreground" : "text-red-600",
          )}
        >
          {mixOk
            ? `El mix suma ${pct2(sumaMix)}.`
            : `El mix suma ${pct2(sumaMix)}. Debe sumar exactamente 100% para calcular el impacto.`}
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Cifra titulo="Valor de lista del inventario disponible" valor={money(valorLista)} />
          <Cifra
            titulo="Valor presente bajo el mix y política actual"
            valor={mixOk ? money(vpnActual) : "—"}
          />
          <Cifra
            titulo="Valor presente si se cerraran las brechas"
            valor={mixOk ? money(vpnSinBrecha) : "—"}
          />
        </div>

        {mixOk ? (
          <span
            className={cn(
              "inline-block rounded-full border px-3 py-1 text-sm tabular-nums",
              claseBrecha((vpnSinBrecha - vpnActual) / (vpnSinBrecha || 1)),
            )}
          >
            Brecha total: {money(vpnSinBrecha - vpnActual)}
          </span>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Libro: Comercial · Calculado sobre las unidades disponibles, excluyendo
          apartadas y vendidas.{" "}
          {multiTorre ? "Factor de VPN ponderado del proyecto." : null}
        </p>
      </Card>

      <Card className="p-4">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left"
          onClick={() => setSensAbierta((v) => !v)}
        >
          <span>
            <span className="block text-base font-semibold text-foreground">
              Sensibilidad a la tasa de descuento
            </span>
            <span className="block text-xs text-muted-foreground">
              Cómo cambian los descuentos autorizables según el costo de capital que se
              asuma.
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0", sensAbierta && "rotate-180")} />
        </button>

        {sensAbierta ? (
          <div className="mt-4 space-y-4">
            <Segmentado
              valor={sensMetrica}
              onCambio={(v) => setSensMetrica(v as "descuento" | "factor")}
              opciones={[
                ["descuento", "Descuento autorizable"],
                ["factor", "Factor de VPN"],
              ]}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Tasa anual</th>
                    {sensibilidad.columnas.map((e) => (
                      <th key={e.id_esquema} className="px-3 py-2 text-right font-medium">
                        {e.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensibilidad.matriz.map((fila) => {
                    const vigente = Math.abs(fila.tasa - tasaAnual) < 1e-9;
                    return (
                      <tr
                        key={fila.tasa}
                        className={cn(
                          "border-b border-border/60",
                          vigente && "bg-muted/50 font-semibold",
                        )}
                      >
                        <td className="px-3 py-2">
                          {(fila.tasa * 100).toFixed(2)}%
                          {vigente ? (
                            <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-normal text-emerald-700">
                              Vigente
                            </span>
                          ) : null}
                        </td>
                        {fila.celdas.map((c) => {
                          if (sensMetrica === "factor")
                            return (
                              <td key={c.id} className="px-3 py-2 text-right">
                                {factor4(c.factor)}
                              </td>
                            );
                          const v = c.descuento;
                          return (
                            <td
                              key={c.id}
                              className={cn(
                                "px-3 py-2 text-right",
                                v <= 0 && "text-muted-foreground",
                              )}
                            >
                              {pct2(Math.max(0, v))}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <GraficoSensibilidad
              series={series}
              tasaVigente={tasaAnual}
              etiquetaY={
                sensMetrica === "descuento"
                  ? "Descuento máximo autorizable"
                  : "Factor de VPN"
              }
            />

            <div className="flex flex-wrap gap-3">
              {series.map((s) => (
                <span key={s.nombre} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.nombre}
                </span>
              ))}
            </div>

            {lectura ? (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-foreground tabular-nums">
                A una tasa de 8%, el descuento máximo autorizable para {lectura.nombre} es
                de {pct2(lectura.bajo)}. A una tasa de 20%, es de {pct2(lectura.alto)}. La
                autoridad de descuento que se delegue varía en un factor de{" "}
                {lectura.factorVar.toFixed(1)}× dependiendo del costo de capital que se
                asuma.
              </div>
            ) : null}

            <p className="text-xs text-amber-700">
              Antes de usar estas cifras para autorizar condiciones comerciales, sustituye
              la tasa por el costo de capital real del proyecto. El valor vigente de{" "}
              {(tasaAnual * 100).toFixed(2)}% es una referencia anclada al costo típico de
              crédito puente en México, no un dato de SOZU.
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Segmentado({
  valor,
  onCambio,
  opciones,
}: {
  valor: string;
  onCambio: (v: string) => void;
  opciones: Array<[string, string]>;
}) {
  return (
    <div className="inline-flex gap-1 rounded-md border border-border p-1">
      {opciones.map(([v, t]) => (
        <button
          key={v}
          type="button"
          onClick={() => onCambio(v)}
          className={cn(
            "rounded px-3 py-1 text-[13px]",
            valor === v ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

type FilaDato = {
  esquema: { id_esquema: string; es_base: boolean };
  inejecutable: boolean;
};

function Fila<T extends FilaDato>({
  titulo,
  filas,
  render,
  destacada,
}: {
  titulo: string;
  filas: T[];
  render: (f: T) => React.ReactNode;
  destacada?: boolean;
}) {
  return (
    <tr className={cn("border-b border-border/60", destacada && "bg-muted/50")}>
      <td
        className={cn(
          "sticky left-0 z-10 bg-background px-3 py-2 text-left text-muted-foreground",
          destacada && "bg-muted/50 font-semibold text-foreground",
        )}
      >
        {titulo}
      </td>
      {filas.map((f) => (
        <td
          key={f.esquema.id_esquema}
          className={cn(
            "px-3 py-2 text-right",
            f.esquema.es_base && !f.inejecutable && "bg-muted/50",
            f.inejecutable && "bg-red-50/40 text-muted-foreground opacity-50",
            destacada && !f.inejecutable && "font-semibold text-foreground",
          )}
        >
          {render(f)}
        </td>
      ))}
    </tr>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-xl font-bold text-foreground tabular-nums">{valor}</p>
    </div>
  );
}
