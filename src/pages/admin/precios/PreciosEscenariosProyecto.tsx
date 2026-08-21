import { useCallback, useEffect, useMemo, useState } from "react";
import { estatusBloqueaReprecio } from "@/features/precios/engine/pricing";

import { Archive, Copy, Download, Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { GraficoAbsorcion } from "@/features/precios/components/GraficoAbsorcion";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import {
  useEscenariosFlujoStore,
  type EscenarioFlujo,
} from "@/features/precios/stores/escenariosFlujoStore";
import { registrarEvento } from "@/features/precios/services/auditoria";
import { esInejecutable } from "@/features/precios/engine/npv";
import { conAuditoria } from "@/features/precios/services/auditoria";
import type { TipoEsquema } from "@/features/precios/types/dominio";
import {
  curvaAbsorcion,
  useEscenariosProyectoStore,
  type EscenarioProyecto,
  type FormaAbsorcion,
} from "@/features/precios/stores/escenariosProyectoStore";
import { descargarCSV } from "@/features/precios/lib/csv";
import { formatoFechaCorta, formatoMoneda } from "@/features/precios/lib/formato";
import { pct2 } from "@/features/precios/lib/formatoVpn";

const SIN_ESCENARIOS: EscenarioProyecto[] = [];

const FORMAS: Array<[FormaAbsorcion, string]> = [
  ["lineal", "Lineal"],
  ["acelerada", "Acelerada al inicio"],
  ["lenta", "Lenta al inicio"],
];

/** Referencia estable para proyectos sin escenarios de flujo guardados. */
const VACIO: EscenarioFlujo[] = [];

function EscenariosProyecto() {
  const {
    idProyecto,
    esquemas,
    esquemaBase,
    basePorRegimen,
    porTorre,
    resultados,
    tasaMes,
    tasaAnual,
  } = useEsquemasVPN();
  const { propiedades, desgloses, indices } = usePreciosProyecto();

  const escenarios = useEscenariosProyectoStore(
    (s) => s.escenariosPorProyecto[idProyecto] ?? SIN_ESCENARIOS,
  );
  const idActivo = useEscenariosProyectoStore(
    (s) => s.idActivoPorProyecto[idProyecto] ?? null,
  );
  const {
    crear: crearBase,
    duplicar,
    actualizar,
    eliminar: eliminarBase,
    seleccionar,
  } = useEscenariosProyectoStore();

  // La auditoría se aplica por envoltura: ninguna acción del store se reescribe.
  const crear = useMemo(
    () =>
      conAuditoria(crearBase, (idProyectoEvento, nombre, mix) => ({
        id_proyecto: idProyectoEvento,
        tipo: "escenario.guardado" as const,
        entidad: { tipo: "escenario", id: nombre, etiqueta: nombre },
        antes: null,
        despues: { nombre, mix },
      })),
    [crearBase],
  );

  const eliminar = useMemo(
    () =>
      conAuditoria(eliminarBase, (idProyectoEvento, idEscenario) => ({
        id_proyecto: idProyectoEvento,
        tipo: "escenario.archivado" as const,
        entidad: { tipo: "escenario", id: idEscenario, etiqueta: idEscenario },
        antes: { estado: "activo" },
        despues: { estado: "archivado" },
      })),
    [eliminarBase],
  );

  const [nombreNuevo, setNombreNuevo] = useState("");

  const ejecutables = useMemo(
    () => esquemas.filter((e) => e.activo && !esInejecutable(resultados[e.id_esquema])),
    [esquemas, resultados],
  );

  // Crea un escenario inicial con el mix repartido en partes iguales.
  useEffect(() => {
    if (escenarios.length === 0 && ejecutables.length > 0) {
      const parte = 1 / ejecutables.length;
      crear(
        idProyecto,
        "Escenario base",
        Object.fromEntries(ejecutables.map((e) => [e.id_esquema, parte])),
      );
    }
  }, [escenarios.length, ejecutables, idProyecto, crear]);

  const escenario =
    escenarios.find((e) => e.id_escenario === idActivo) ?? escenarios[0] ?? null;

  const disponibles = useMemo(() => {
    const bloqueadas = new Set(
      propiedades
        .filter((p) => estatusBloqueaReprecio(p.estatus))
        .map((p) => p.id_propiedad),
    );
    return desgloses.filter((d) => !bloqueadas.has(d.id_propiedad));
  }, [propiedades, desgloses]);

  const valorLista = disponibles.reduce((a, d) => a + d.precio_lista, 0);
  const unidades = disponibles.length;
  const precioPromedio = unidades > 0 ? valorLista / unidades : 0;

  /*
   * El inventario vendible agrupado por modelo.
   *
   * La proyección usaba un solo precio promedio para todo el desarrollo, que
   * mezcla un estudio con un penthouse. Agrupando por modelo cada cohorte de
   * ventas se valúa con el precio de lo que de verdad se vendió.
   */
  const porModelo = useMemo(() => {
    const propPorId = new Map(propiedades.map((p) => [p.id_propiedad, p]));
    const acum = new Map<string, { unidades: number; valor: number }>();
    for (const d of disponibles) {
      const p = propPorId.get(d.id_propiedad);
      if (!p) continue;
      const a = acum.get(p.id_modelo) ?? { unidades: 0, valor: 0 };
      a.unidades += 1;
      a.valor += d.precio_lista;
      acum.set(p.id_modelo, a);
    }
    return [...acum.entries()]
      .map(([id, v]) => ({
        id_modelo: id,
        nombre: indices?.modelosPorId[id]?.nombre ?? id,
        unidades: v.unidades,
        valor: v.valor,
        precioPromedio: v.valor / v.unidades,
      }))
      .sort((a, b) => b.unidades - a.unidades);
  }, [disponibles, propiedades, indices]);

  const mix = useMemo(() => escenario?.mix ?? {}, [escenario]);
  const sumaMix = ejecutables.reduce((a, e) => a + (mix[e.id_esquema] ?? 0), 0);
  const mixOk = Math.abs(sumaMix - 1) <= 0.0005;

  const mixPorModelo = useMemo(() => escenario?.mixPorModelo ?? {}, [escenario]);
  /** La mezcla que le toca a un modelo: la suya si la tiene, si no la del proyecto. */
  const mixDe = useCallback(
    (idModelo: string) => mixPorModelo[idModelo] ?? mix,
    [mixPorModelo, mix],
  );
  const sumaMixDe = (idModelo: string) =>
    ejecutables.reduce((a, e) => a + (mixDe(idModelo)[e.id_esquema] ?? 0), 0);

  /*
   * Un modelo con mezcla propia que no suma 100% no se puede proyectar, igual
   * que el mix del proyecto. Se bloquea la proyección entera en vez de
   * proyectar ese modelo con lo que sea: un total que sale de una mezcla
   * incompleta parece correcto y no lo es.
   */
  const modelosConMixRoto = porModelo
    .filter((m) => mixPorModelo[m.id_modelo])
    .filter((m) => Math.abs(sumaMixDe(m.id_modelo) - 1) > 0.0005);
  const mixModelosOk = modelosConMixRoto.length === 0;

  const fijarMixModelo = (idModelo: string, idEsquema: string, valor: number) => {
    if (!escenario) return;
    actualizar(idProyecto, escenario.id_escenario, {
      mixPorModelo: {
        ...mixPorModelo,
        [idModelo]: { ...mixDe(idModelo), [idEsquema]: valor },
      },
    });
  };

  /** Devuelve el modelo a la mezcla del proyecto quitando su excepción. */
  const soltarMixModelo = (idModelo: string) => {
    if (!escenario) return;
    const resto = { ...mixPorModelo };
    delete resto[idModelo];
    actualizar(idProyecto, escenario.id_escenario, { mixPorModelo: resto });
  };

  const factorDe = useCallback(
    (id: string) => porTorre[id]?.ponderado ?? resultados[id]?.factor_vpn ?? 0,
    [porTorre, resultados],
  );

  /**
   * El referente sin brecha depende del régimen: un esquema de post-entrega
   * no se mide contra la base de preventa. Antes se usaba una sola base para
   * todo el mix, lo que inflaba la brecha y a veces le cambiaba el signo.
   */
  const factorBaseDe = useCallback(
    (tipo: TipoEsquema) => {
      const b = basePorRegimen[tipo];
      return b ? factorDe(b.id_esquema) : esquemaBase ? factorDe(esquemaBase.id_esquema) : 1;
    },
    [basePorRegimen, esquemaBase, factorDe],
  );

  /*
   * La proyección se arma modelo por modelo y se suma.
   *
   * Cada modelo aporta su propia curva de absorción sobre sus unidades, su
   * precio promedio y su mezcla de esquemas. El resultado mensual conserva la
   * forma de antes —mes, unidades, nominal, vp, vp acumulado— para que la
   * gráfica, la tabla y el CSV sigan funcionando sin enterarse.
   *
   * Con todos los modelos usando la mezcla del proyecto, el total ya no es
   * idéntico al de antes: antes cada unidad valía el promedio del desarrollo y
   * ahora vale el promedio de su modelo. La diferencia es el error que
   * promediar introducía.
   */
  const proyeccion = useMemo(() => {
    if (!escenario || !mixOk || !mixModelosOk) return null;

    const n = Math.max(1, Math.round(escenario.meses_absorcion));
    const acumMes = Array.from({ length: n }, () => ({
      unidades: 0,
      nominal: 0,
      vp: 0,
      vpSinBrecha: 0,
    }));

    const detalle = porModelo.map((m) => {
      const mm = mixDe(m.id_modelo);
      // Valor presente de una unidad del modelo bajo su mezcla, sin descontar
      // todavía la espera hasta el mes en que se vende.
      const vpUnidad = ejecutables.reduce(
        (a, e) =>
          a +
          (mm[e.id_esquema] ?? 0) *
            m.precioPromedio *
            (1 + e.pct_ajuste_manual) *
            factorDe(e.id_esquema),
        0,
      );
      const vpUnidadSinBrecha = ejecutables.reduce(
        (a, e) =>
          a + (mm[e.id_esquema] ?? 0) * m.precioPromedio * factorBaseDe(e.tipo_esquema),
        0,
      );

      const ventas = curvaAbsorcion(m.unidades, n, escenario.forma);
      let vpModelo = 0;
      ventas.forEach((u, i) => {
        const desc = 1 / Math.pow(1 + tasaMes, i);
        acumMes[i]!.unidades += u;
        acumMes[i]!.nominal += u * m.precioPromedio;
        acumMes[i]!.vp += u * vpUnidad * desc;
        acumMes[i]!.vpSinBrecha += u * vpUnidadSinBrecha * desc;
        vpModelo += u * vpUnidad * desc;
      });

      return { ...m, vpUnidad, vp: vpModelo, propio: !!mixPorModelo[m.id_modelo] };
    });

    let acumulado = 0;
    let acumuladoSinBrecha = 0;
    const meses = acumMes.map((x, i) => {
      acumulado += x.vp;
      acumuladoSinBrecha += x.vpSinBrecha;
      return {
        mes: i,
        unidades: x.unidades,
        nominal: x.nominal,
        vp: x.vp,
        vpAcumulado: acumulado,
      };
    });

    return {
      meses,
      detalle,
      total: acumulado,
      totalSinBrecha: acumuladoSinBrecha,
      totalNominal: valorLista,
      vpUnidadMix: unidades > 0 ? acumulado / unidades : 0,
    };
  }, [
    escenario,
    mixOk,
    mixModelosOk,
    porModelo,
    mixPorModelo,
    mixDe,
    factorDe,
    factorBaseDe,
    unidades,
    ejecutables,
    tasaMes,
    valorLista,
  ]);

  const flujos = useEscenariosFlujoStore((s) => s.flujosPorProyecto)[idProyecto] ?? VACIO;
  const guardarFlujo = useEscenariosFlujoStore((s) => s.guardarFlujo);
  const eliminarFlujo = useEscenariosFlujoStore((s) => s.eliminarFlujo);
  const [nombreFlujo, setNombreFlujo] = useState("");

  /*
   * Congela la configuracion completa: precios, esquemas y absorcion.
   *
   * Guarda el resultado Y los supuestos. Solo el resultado dejaria un numero sin
   * defensa —meses despues nadie sabria si esos millones salieron de vender todo
   * a contado en seis meses o de un mix realista en tres anos— y solo los
   * supuestos obligaria a recalcular con un motor que ya cambio, que daria otra
   * cifra. Los esquemas se copian, no se referencian: se pueden editar o dar de
   * baja despues y el escenario dejaria de poder explicarse.
   */
  const guardarEscenarioFlujo = () => {
    if (!proyeccion || !escenario) return;
    const guardado = guardarFlujo({
      id_proyecto: idProyecto,
      nombre: nombreFlujo.trim() || escenario.nombre,
      notas: "",
      unidades,
      valor_lista: valorLista,
      tasa_anual: tasaAnual,
      meses_absorcion: escenario.meses_absorcion,
      forma: escenario.forma,
      mix: { ...mix },
      mixPorModelo: structuredClone(mixPorModelo),
      esquemas: ejecutables.map((e) => ({
        id_esquema: e.id_esquema,
        nombre: e.nombre,
        pct_ajuste_manual: e.pct_ajuste_manual,
        participacion: mix[e.id_esquema] ?? 0,
      })),
      vp_total: proyeccion.total,
      vp_sin_brecha: proyeccion.totalSinBrecha,
      meses: proyeccion.meses.map((m) => ({
        mes: m.mes,
        unidades: m.unidades,
        nominal: m.nominal,
        vp: m.vp,
      })),
      modelos: proyeccion.detalle.map((m) => ({
        id_modelo: m.id_modelo,
        nombre: m.nombre,
        unidades: m.unidades,
        valor: m.valor,
        vp: m.vp,
        propio: m.propio,
      })),
    });
    setNombreFlujo("");
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "escenario.guardado",
      entidad: { tipo: "escenario_flujo", id: guardado.id_flujo, etiqueta: guardado.nombre },
      antes: null,
      despues: {
        unidades: guardado.unidades,
        valor_lista: guardado.valor_lista,
        vp_total: guardado.vp_total,
        meses_absorcion: guardado.meses_absorcion,
      },
    });
  };

  /** De mayor a menor ingreso esperado: la pregunta es cuál rinde más. */
  const flujosOrdenados = useMemo(
    () => [...flujos].sort((a, b) => b.vp_total - a.vp_total),
    [flujos],
  );

  const exportar = () => {
    if (!proyeccion || !escenario) return;
    descargarCSV(
      `escenario-${escenario.nombre.replace(/\s+/g, "-")}.csv`,
      ["Mes", "Unidades vendidas", "Valor nominal", "Valor presente", "VP acumulado"],
      proyeccion.meses.map((m) => [
        m.mes,
        m.unidades,
        m.nominal.toFixed(2),
        m.vp.toFixed(2),
        m.vpAcumulado.toFixed(2),
      ]),
    );
  };

  if (!escenario) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay esquemas ejecutables con los que construir un escenario de proyecto.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Escenario</Label>
          <Select
            value={escenario.id_escenario}
            onValueChange={(v) => seleccionar(idProyecto, v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {escenarios.map((e) => (
                <SelectItem key={e.id_escenario} value={e.id_escenario}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nombre</Label>
          <Input
            className="w-56"
            value={escenario.nombre}
            onChange={(e) =>
              actualizar(idProyecto, escenario.id_escenario, { nombre: e.target.value })
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicar(idProyecto, escenario.id_escenario)}
        >
          <Copy className="mr-1.5 size-4" />
          Duplicar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={escenarios.length <= 1}
          onClick={() => eliminar(idProyecto, escenario.id_escenario)}
        >
          <Archive className="mr-1.5 size-4" />
          Archivar
        </Button>
        <div className="ml-auto flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nuevo escenario</Label>
            <Input
              className="w-48"
              placeholder="Nombre"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={nombreNuevo.trim().length < 3}
            onClick={() => {
              crear(idProyecto, nombreNuevo.trim(), { ...escenario.mix });
              setNombreNuevo("");
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Crear
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h3 className="text-base font-semibold text-foreground">Mix de esquemas</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ejecutables.map((e) => (
            <div key={e.id_esquema} className="space-y-1.5">
              <Label className="text-xs">{e.nombre}</Label>
              <Input
                className="tabular-nums"
                value={((mix[e.id_esquema] ?? 0) * 100).toFixed(2)}
                onChange={(ev) => {
                  const n = Number.parseFloat(ev.target.value.replace(",", "."));
                  actualizar(idProyecto, escenario.id_escenario, {
                    mix: {
                      ...escenario.mix,
                      [e.id_esquema]: Number.isFinite(n) ? n / 100 : 0,
                    },
                  });
                }}
              />
            </div>
          ))}
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            mixOk ? "text-muted-foreground" : "text-red-600",
          )}
        >
          El mix suma {pct2(sumaMix)}
          {mixOk ? "." : ". Debe sumar exactamente 100% para proyectar el escenario."}
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Mix por modelo</h3>
          <p className="text-xs text-muted-foreground">
            Un estudio y un penthouse no se colocan con el mismo esquema. Cada modelo
            arranca con la mezcla del proyecto; al capturarle un porcentaje se separa y
            proyecta con la suya.
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Modelo
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Unidades
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Precio prom.
                </th>
                {ejecutables.map((e) => (
                  <th
                    key={e.id_esquema}
                    className="px-3 py-2 text-right font-medium text-muted-foreground"
                  >
                    {e.nombre}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Suma
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {porModelo.map((m) => {
                const propio = !!mixPorModelo[m.id_modelo];
                const suma = sumaMixDe(m.id_modelo);
                const sumaOk = Math.abs(suma - 1) <= 0.0005;
                return (
                  <tr
                    key={m.id_modelo}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {m.nombre}
                      {propio ? (
                        <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                          mix propio
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {m.unidades}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {formatoMoneda(m.precioPromedio)}
                    </td>
                    {ejecutables.map((e) => (
                      <td key={e.id_esquema} className="px-3 py-1.5">
                        <Input
                          aria-label={`${m.nombre} · ${e.nombre}`}
                          className="w-20 text-right tabular-nums"
                          value={((mixDe(m.id_modelo)[e.id_esquema] ?? 0) * 100).toFixed(0)}
                          onChange={(ev) => {
                            const n = Number.parseFloat(ev.target.value.replace(",", "."));
                            fijarMixModelo(
                              m.id_modelo,
                              e.id_esquema,
                              Number.isFinite(n) ? n / 100 : 0,
                            );
                          }}
                        />
                      </td>
                    ))}
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-1.5 text-right tabular-nums",
                        sumaOk ? "text-muted-foreground" : "text-red-600",
                      )}
                    >
                      {pct2(suma)}
                    </td>
                    <td className="px-3 py-1.5">
                      {propio ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => soltarMixModelo(m.id_modelo)}
                        >
                          Usar el del proyecto
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          usa el del proyecto
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mixModelosOk ? null : (
          <p className="text-xs text-red-600">
            {modelosConMixRoto.map((m) => m.nombre).join(", ")}
            {modelosConMixRoto.length === 1 ? " tiene" : " tienen"} un mix propio que no suma
            100%. La proyección se detiene: un total que sale de una mezcla incompleta
            parece correcto y no lo es.
          </p>
        )}
      </Card>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Meses de absorción</Label>
          <Input
            type="number"
            min={1}
            max={60}
            className="w-32 tabular-nums"
            value={escenario.meses_absorcion}
            onChange={(e) =>
              actualizar(idProyecto, escenario.id_escenario, {
                meses_absorcion: Math.max(
                  1,
                  Math.min(60, Math.round(Number(e.target.value) || 1)),
                ),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Forma de la curva</Label>
          <Select
            value={escenario.forma}
            onValueChange={(v) =>
              actualizar(idProyecto, escenario.id_escenario, {
                forma: v as FormaAbsorcion,
              })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAS.map(([v, t]) => (
                <SelectItem key={v} value={v}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {unidades} unidades disponibles · Precio promedio{" "}
          {formatoMoneda(precioPromedio)}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Libro: Comercial</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            className="w-56"
            placeholder="Nombre del escenario de flujo"
            value={nombreFlujo}
            onChange={(e) => setNombreFlujo(e.target.value)}
          />
          <Button size="sm" disabled={!proyeccion} onClick={guardarEscenarioFlujo}>
            <Save className="mr-1.5 size-4" />
            Guardar escenario de flujo
          </Button>
          <Button variant="outline" size="sm" disabled={!proyeccion} onClick={exportar}>
            <Download className="mr-1.5 size-4" />
            Exportar proyección
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Valor de lista disponible" valor={formatoMoneda(valorLista)} />
        <Cifra
          titulo="Valor presente del escenario"
          valor={proyeccion ? formatoMoneda(proyeccion.total) : "—"}
        />
        <Cifra
          titulo="Valor presente sin brechas de política"
          valor={proyeccion ? formatoMoneda(proyeccion.totalSinBrecha) : "—"}
        />
        <Cifra
          titulo="Brecha del escenario"
          valor={
            proyeccion
              ? formatoMoneda(proyeccion.totalSinBrecha - proyeccion.total)
              : "—"
          }
          clase={
            proyeccion && proyeccion.totalSinBrecha - proyeccion.total > 0
              ? "text-red-600"
              : undefined
          }
        />
      </div>

      {proyeccion ? (
        <>
          <Card className="space-y-3 p-4">
            <h3 className="text-base font-semibold text-foreground">
              Curva de absorción y valor presente acumulado
            </h3>
            <GraficoAbsorcion meses={proyeccion.meses} />

            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Modelo
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Unidades
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Valor de lista
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      VP por unidad
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Valor presente
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Del total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proyeccion.detalle.map((m) => (
                    <tr
                      key={m.id_modelo}
                      className="border-t border-border transition-colors hover:bg-muted/40"
                    >
                      <td className="px-3 py-1.5 font-medium text-foreground">
                        {m.nombre}
                        {m.propio ? (
                          <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                            mix propio
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {m.unidades}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                        {formatoMoneda(m.valor)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                        {formatoMoneda(m.vpUnidad)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-medium text-foreground">
                        {formatoMoneda(m.vp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {proyeccion.total > 0 ? pct2(m.vp / proyeccion.total) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              El <strong>VP por unidad</strong> es lo que vale hoy una unidad de ese modelo
              con su mezcla, antes de descontar la espera hasta el mes en que se vende; el
              <strong> valor presente</strong> ya la descuenta. Un modelo puede aportar menos
              de lo que sugiere su valor de lista si su mezcla carga el pago al final.
            </p>
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Unidades</th>
                  <th className="px-3 py-2 text-right font-medium">Valor nominal</th>
                  <th className="px-3 py-2 text-right font-medium">Valor presente</th>
                  <th className="px-3 py-2 text-right font-medium">VP acumulado</th>
                </tr>
              </thead>
              <tbody>
                {proyeccion.meses.map((m) => (
                  <tr key={m.mes} className="border-b border-border/60">
                    <td className="px-3 py-1.5">{m.mes}</td>
                    <td className="px-3 py-1.5 text-right">{m.unidades}</td>
                    <td className="px-3 py-1.5 text-right">{formatoMoneda(m.nominal)}</td>
                    <td className="px-3 py-1.5 text-right">{formatoMoneda(m.vp)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {formatoMoneda(m.vpAcumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    {proyeccion.meses.reduce((a, m) => a + m.unidades, 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatoMoneda(proyeccion.totalNominal)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatoMoneda(proyeccion.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      ) : null}

      {flujos.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Escenarios de flujo guardados
            </h3>
            <p className="text-xs text-muted-foreground">
              Cada uno congela una configuración completa —precios, esquemas y absorción— con
              el resultado que produjo. Se comparan por ingreso esperado.
            </p>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Escenario
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Unidades
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Valor de lista
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Ingreso esperado
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Recuperación
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Absorción
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    vs. el mejor
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {flujosOrdenados.map((f, i) => (
                  <tr
                    key={f.id_flujo}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {f.nombre}
                      {i === 0 ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                          mejor
                        </span>
                      ) : null}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatoFechaCorta(f.creado_en)} · tasa {pct2(f.tasa_anual)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {f.unidades}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {formatoMoneda(f.valor_lista)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-medium text-foreground">
                      {formatoMoneda(f.vp_total)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {f.valor_lista > 0 ? pct2(f.vp_total / f.valor_lista) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {f.meses_absorcion} meses
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-1.5 text-right tabular-nums",
                        i === 0 ? "text-muted-foreground" : "text-red-600",
                      )}
                    >
                      {i === 0
                        ? "—"
                        : formatoMoneda(f.vp_total - (flujosOrdenados[0]?.vp_total ?? 0))}
                    </td>
                    <td className="px-3 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarFlujo(idProyecto, f.id_flujo)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            La <strong>recuperación</strong> es el ingreso esperado sobre el valor de lista:
            cuánto del precio de catálogo se convierte en valor presente después del
            financiamiento y de la espera. Comparar dos escenarios solo tiene sentido si la
            tasa de descuento es la misma; se muestra junto a la fecha por eso.
          </p>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        La proyección descuenta cada cohorte de ventas por el mes en que se firma y por el
        calendario de su esquema. Excluye unidades apartadas y vendidas. No representa
        plusvalía ni rendimiento de inversión: es el valor presente de los ingresos del
        desarrollador bajo la política vigente.
      </p>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: string;
  clase?: string | undefined;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("text-xl font-bold tabular-nums text-foreground", clase)}>
        {valor}
      </p>
    </Card>
  );
}

export default EscenariosProyecto;
