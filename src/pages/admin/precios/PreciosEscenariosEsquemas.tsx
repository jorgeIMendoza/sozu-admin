import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Info, Plus, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TarjetaEsquema } from "@/features/precios/components/TarjetaEsquema";
import { ModalEsquema } from "@/features/precios/components/ModalEsquema";
import { useEsquemasVPN } from "@/features/precios/hooks/useEsquemasVPN";
import { esInejecutable } from "@/features/precios/engine/npv";
import { useEsquemasStore } from "@/features/precios/stores/esquemasStore";
import { useVersionesStore } from "@/features/precios/stores/versionesStore";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";
import { ESTATUS_A_LA_VENTA } from "@/features/precios/services/inventarioReal";
import { formatoMoneda } from "@/features/precios/lib/formato";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { soportaCamposDeMotor } from "@/features/precios/services/esquemasReales";
import { registrarEvento } from "@/features/precios/services/auditoria";
import type {
  EsquemaFinanciamiento,
  TipoEsquema,
  VersionLista,
} from "@/features/precios/types/dominio";

/** Referencia estable para proyectos sin escenarios guardados. */
const SIN_VERSIONES: VersionLista[] = [];
import { pct2 } from "@/features/precios/lib/formatoVpn";

function PantallaEsquemas() {
  const {
    idProyecto,
    esquemas,
    esquemaBase,
    resultados,
    horizonteMinimo,
    horizonteMaximo,
    horizontesPorTorre,
    porTorre,
    multiTorre,
    tasaAnual,
    tasaMes,
  } = useEsquemasVPN();

  const errorEscritura = useEsquemasStore((s) => s.errorEscritura);

  /*
   * Si el DDL de los campos del motor no se ha aplicado, el regimen, el mes de
   * inicio y la marca de esquema base no tienen donde guardarse. Se avisa en vez
   * de dejar que se capturen y desaparezcan al recargar.
   */
  const [camposCompletos, setCamposCompletos] = useState(true);
  useEffect(() => {
    let vigente = true;
    void soportaCamposDeMotor().then((ok) => {
      if (vigente) setCamposCompletos(ok);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const crearEsquema = useEsquemasStore((s) => s.crearEsquema);
  const reemplazarEsquema = useEsquemasStore((s) => s.reemplazarEsquema);
  const marcarComoBase = useEsquemasStore((s) => s.marcarComoBase);
  const duplicarEsquema = useEsquemasStore((s) => s.duplicarEsquema);
  const desactivarEsquema = useEsquemasStore((s) => s.desactivarEsquema);
  const reactivarEsquema = useEsquemasStore((s) => s.reactivarEsquema);

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<EsquemaFinanciamiento | null>(null);
  const [infoVisible, setInfoVisible] = useState(true);
  const [infoAbierta, setInfoAbierta] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoEsquema | "todos">("todos");
  /*
   * Arranca en los que se ofrecen.
   *
   * Los dados de baja se conservan —una oferta pudo cotizarse con ellos— pero en
   * un proyecto con historia son mayoría: en Monócolo, 8 de 13. Verlos primero
   * hace parecer que hay trece políticas comerciales vigentes. El contador dice
   * cuántos hay para que se sepa que existen.
   */
  const [filtroEstado, setFiltroEstado] = useState<"activos" | "inactivos" | "todos">(
    "activos",
  );

  const { propiedades, desgloses, indices } = usePreciosProyecto();
  const versionesProyecto =
    useVersionesStore((s) => s.versionesPorProyecto)[idProyecto] ?? SIN_VERSIONES;

  /** `""` = el borrador vivo; si no, el escenario guardado que se está mirando. */
  const [idEscenarioRef, setIdEscenarioRef] = useState("");
  /** `""` = el promedio del proyecto; si no, un modelo. */
  const [idModeloRef, setIdModeloRef] = useState("");

  const escenarioRef = idEscenarioRef
    ? (versionesProyecto.find((v) => v.id_version === idEscenarioRef) ?? null)
    : null;

  /*
   * El precio de cada unidad según el escenario elegido.
   *
   * Del borrador vivo salen los desgloses que el motor calcula ahora; de un
   * escenario guardado, su snapshot. Es la diferencia entre "cuánto cobraría hoy
   * con este esquema" y "cuánto habría cobrado con la lista que guardé el martes".
   */
  const precioDeUnidad = useMemo(() => {
    const m = new Map<string, number>();
    if (escenarioRef) {
      for (const [id, p] of Object.entries(escenarioRef.precios)) {
        m.set(id, (p as { precio_lista: number }).precio_lista);
      }
      return m;
    }
    for (const d of desgloses) m.set(d.id_propiedad, d.precio_lista);
    return m;
  }, [escenarioRef, desgloses]);

  /*
   * Precio promedio ponderado del inventario DISPONIBLE, por modelo.
   *
   * Disponible y no todo el inventario: un esquema se le ofrece a quien todavía
   * puede comprar, y el promedio de lo ya vendido describe el pasado. Es el mismo
   * criterio que el Forecast de Ingresos y que Configuración del Motor, para que
   * las tres pantallas hablen del mismo número.
   */
  const referencias = useMemo(() => {
    const acum = new Map<string, { unidades: number; suma: number }>();
    let unidadesTotal = 0;
    let sumaTotal = 0;
    for (const p of propiedades) {
      if (!ESTATUS_A_LA_VENTA.has(p.estatus)) continue;
      const precio = precioDeUnidad.get(p.id_propiedad);
      if (!precio || precio <= 0) continue;
      const a = acum.get(p.id_modelo) ?? { unidades: 0, suma: 0 };
      a.unidades += 1;
      a.suma += precio;
      acum.set(p.id_modelo, a);
      unidadesTotal += 1;
      sumaTotal += precio;
    }
    const modelos = [...acum.entries()]
      .map(([id, v]) => ({
        id,
        nombre: indices?.modelosPorId[id]?.nombre ?? id,
        unidades: v.unidades,
        precio: v.suma / v.unidades,
      }))
      .sort((a, b) => b.unidades - a.unidades);
    return {
      modelos,
      proyecto: {
        id: "",
        nombre: "Promedio del proyecto",
        unidades: unidadesTotal,
        precio: unidadesTotal > 0 ? sumaTotal / unidadesTotal : 0,
      },
    };
  }, [propiedades, precioDeUnidad, indices]);

  const referencia = idModeloRef
    ? (referencias.modelos.find((m) => m.id === idModeloRef) ?? referencias.proyecto)
    : referencias.proyecto;

  const conteo = {
    todos: esquemas.length,
    preventa: esquemas.filter((e) => e.tipo_esquema !== "post_entrega").length,
    post_entrega: esquemas.filter((e) => e.tipo_esquema === "post_entrega").length,
  };
  const conteoEstado = {
    todos: esquemas.length,
    activos: esquemas.filter((e) => e.activo).length,
    inactivos: esquemas.filter((e) => !e.activo).length,
  };

  const visibles = esquemas
    .filter((e) =>
      filtroTipo === "todos"
        ? true
        : filtroTipo === "post_entrega"
          ? e.tipo_esquema === "post_entrega"
          : e.tipo_esquema !== "post_entrega",
    )
    .filter((e) =>
      filtroEstado === "todos" ? true : filtroEstado === "activos" ? e.activo : !e.activo,
    )
    // Los que se ofrecen, primero: es lo que se está decidiendo.
    .sort((a, b) => Number(b.activo) - Number(a.activo));

  /**
   * Un esquema de preventa deja de poder venderse cuando ya no cabe su calendario
   * antes de la entrega de la torre. La fecha de caducidad es la entrega menos el
   * largo del plan. Ordenado por fecha: lo primero que vence, primero.
   */
  const caducidades = useMemo(() => {
    const filas: Array<{
      esquema: EsquemaFinanciamiento;
      torre: string;
      fecha: Date;
      meses: number;
    }> = [];
    for (const e of esquemas) {
      if (!e.activo || e.tipo_esquema === "post_entrega" || e.es_contado) continue;
      const plan =
        e.meses_enganche + e.mes_inicio_mensualidades + e.num_mensualidades;
      for (const h of horizontesPorTorre) {
        const entrega = new Date(h.torre.fecha_entrega_estimada);
        const fecha = new Date(entrega);
        fecha.setMonth(fecha.getMonth() - plan);
        filas.push({ esquema: e, torre: h.torre.nombre, fecha, meses: plan });
      }
    }
    return filas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [esquemas, horizontesPorTorre]);

  const hoy = new Date();

  /*
   * Una fila por esquema, no una por esquema y torre.
   *
   * Con 5 esquemas y 3 torres eran 15 renglones que casi siempre dicen lo mismo,
   * porque las torres suelen entregarse el mismo mes. Se muestra la fecha más
   * apretada —la que manda— y el detalle por torre solo cuando difieren.
   */
  const caducidadPorEsquema = useMemo(() => {
    const g = new Map<
      string,
      {
        esquema: EsquemaFinanciamiento;
        meses: number;
        peor: Date;
        torres: Array<{ torre: string; fecha: Date }>;
      }
    >();
    for (const f of caducidades) {
      const g0 = g.get(f.esquema.id_esquema) ?? {
        esquema: f.esquema,
        meses: f.meses,
        peor: f.fecha,
        torres: [] as Array<{ torre: string; fecha: Date }>,
      };
      g0.torres.push({ torre: f.torre, fecha: f.fecha });
      if (f.fecha.getTime() < g0.peor.getTime()) g0.peor = f.fecha;
      g.set(f.esquema.id_esquema, g0);
    }
    return [...g.values()].sort((a, b) => a.peor.getTime() - b.peor.getTime());
  }, [caducidades]);

  const vencidos = caducidadPorEsquema.filter(
    (c) => c.peor.getTime() < hoy.getTime(),
  ).length;

  const fechaCorta = (d: Date) =>
    d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });

  return (
    <div className="space-y-5">
      {errorEscritura ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>No se guardo el cambio</AlertTitle>
          <AlertDescription>
            {errorEscritura} Los esquemas que ves siguen siendo los de la base, asi que lo
            que intentaste no quedo a medias.
          </AlertDescription>
        </Alert>
      ) : null}

      {camposCompletos ? null : (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <Info className="size-4 text-amber-600" />
          <AlertTitle className="text-foreground">
            Faltan columnas en la base para guardar todo
          </AlertTitle>
          <AlertDescription className="text-foreground">
            El nombre, los porcentajes, el numero de mensualidades, el ajuste y los tramos
            si se guardan. El <strong>regimen</strong> (preventa o post-entrega), el
            <strong> mes de inicio de mensualidades</strong>, el
            <strong> modo de escalonamiento</strong>, el
            <strong> factor de crecimiento</strong> y la marca de
            <strong> esquema base</strong> no: esas columnas todavia no existen, se derivan
            al leer y se pierden al recargar. Aplica{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              Ejecuciones_manuales/20260821_esquemas_pago_campos_motor_precios.md
            </code>{" "}
            y empiezan a persistirse sin tocar el codigo.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground tabular-nums">
            Tasa de descuento: {(tasaAnual * 100).toFixed(2)}% anual ·{" "}
            {(tasaMes * 100).toFixed(4)}% mensual
          </p>
          <p className="text-xs text-muted-foreground">
            Configurable en{" "}
            <Link to="/admin/inventario/precios/motor" className="underline">
              Configuración del Motor
            </Link>
            .
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground tabular-nums"
            title={horizontesPorTorre
              .map((h) => `${h.torre.nombre}: ${h.meses} meses`)
              .join(" · ")}
          >
            Horizonte:{" "}
            {horizonteMinimo === horizonteMaximo
              ? `${horizonteMinimo} meses`
              : `${horizonteMinimo} a ${horizonteMaximo} meses según torre`}
            .
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo Esquema
        </Button>
      </div>

      {caducidades.length > 0 ? (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Caducidad de esquemas
              </h3>
              {vencidos > 0 ? (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {vencidos} de {caducidadPorEsquema.length} ya vencieron
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  los {caducidadPorEsquema.length} vigentes
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Último día en que el calendario todavía cabe antes de la entrega de la torre.
              Después de esa fecha el esquema ya no es vendible ahí.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Esquema</th>
                  <th className="px-4 py-2 text-right font-medium">Largo del plan</th>
                  <th className="px-4 py-2 text-right font-medium">Caduca</th>
                  <th className="px-4 py-2 text-left font-medium">Torres</th>
                  <th className="px-4 py-2 text-left font-medium" />
                </tr>
              </thead>
              <tbody>
                {caducidadPorEsquema.map((c) => {
                  const vencido = c.peor.getTime() < hoy.getTime();
                  // Con todas las torres entregando el mismo mes, listarlas una por
                  // una no agrega nada; solo se detallan cuando difieren.
                  const distintas = new Set(c.torres.map((t) => t.fecha.getTime())).size > 1;
                  return (
                    <tr
                      key={c.esquema.id_esquema}
                      className="border-t border-border transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2 font-medium text-foreground">
                        {c.esquema.nombre}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {c.meses} meses
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2 text-right tabular-nums",
                          vencido ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {fechaCorta(c.peor)}
                        {vencido ? (
                          <span className="block text-xs font-medium">ya vencido</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {distintas
                          ? c.torres
                              .map((t) => `${t.torre}: ${fechaCorta(t.fecha)}`)
                              .join(" · ")
                          : `${c.torres.map((t) => t.torre).join(", ")} · misma fecha`}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditando(c.esquema);
                            setModal(true);
                          }}
                        >
                          Acortar el plan
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              La fecha no se captura: es la entrega de la torre menos el largo del plan
              —enganche + mes de inicio + mensualidades—. Se mueve por dos lados:
              <strong> acortando el plan</strong> del esquema, aquí mismo, o corrigiendo la
              <strong> fecha de entrega de la torre</strong> en Inventarios → Proyectos →
              Editar Proyecto → Espacios.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Un esquema vencido no se bloquea solo: sigue apareciendo en el comparador y en
              el cotizador. Si ya no se piensa ofrecer, hay que darlo de baja con el
              interruptor de su tarjeta.
            </p>
          </div>
        </div>
      ) : null}

      {infoVisible ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => setInfoAbierta((v) => !v)}
            >
              Qué hace el valor presente aquí
              <ChevronDown className={infoAbierta ? "size-4 rotate-180" : "size-4"} />
            </button>
            <button
              type="button"
              aria-label="Descartar"
              onClick={() => setInfoVisible(false)}
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </AlertTitle>
          {infoAbierta ? (
            <AlertDescription>
              Dos esquemas con el mismo precio de lista no valen lo mismo para el
              desarrollador: el dinero que entra en el mes 0 vale más que el que entra en
              el mes {horizonteMinimo}. El factor de VPN mide cuánto vale realmente cada
              peso de precio bajo cada esquema, descontado al costo de capital del
              proyecto. A partir de ese número se deriva cuánto descuento puede otorgarse
              sin destruir valor.
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {/* SWAP POINT: la tasa debe provenir del contrato de crédito puente del proyecto. */}
      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <TriangleAlert className="size-4" />
        <AlertTitle>La tasa de descuento es un supuesto, no un dato.</AlertTitle>
        <AlertDescription className="text-amber-900/90">
          El 14% anual es un valor de referencia anclado al costo típico de crédito puente
          en México. Todo descuento autorizable que salga de este módulo hereda ese
          supuesto. Sustitúyelo por el costo de capital real del proyecto antes de usar
          estos números para autorizar condiciones comerciales.
        </AlertDescription>
      </Alert>

      <div className="inline-flex gap-1 rounded-md border border-border p-1">
        {(
          [
            ["todos", `Todos (${conteo.todos})`],
            ["preventa", `Preventa (${conteo.preventa})`],
            ["post_entrega", `Post-entrega (${conteo.post_entrega})`],
          ] as Array<[TipoEsquema | "todos", string]>
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFiltroTipo(v)}
            className={
              filtroTipo === v
                ? "rounded bg-muted px-3 py-1 text-[13px] font-medium"
                : "rounded px-3 py-1 text-[13px] text-muted-foreground"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-muted-foreground">
              Modelo de referencia
            </Label>
            <Select value={idModeloRef || "__proyecto__"} onValueChange={(v) => setIdModeloRef(v === "__proyecto__" ? "" : v)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__proyecto__">
                  Promedio del proyecto · {referencias.proyecto.unidades} u.
                </SelectItem>
                {referencias.modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre} · {m.unidades} u.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-muted-foreground">
              Escenario de precios
            </Label>
            <Select value={idEscenarioRef || "__vivo__"} onValueChange={(v) => setIdEscenarioRef(v === "__vivo__" ? "" : v)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__vivo__">Borrador vivo</SelectItem>
                {[...versionesProyecto]
                  .sort((a, b) => b.numero - a.numero)
                  .map((v) => (
                    <SelectItem key={v.id_version} value={v.id_version}>
                      v{v.numero} · {v.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pb-1">
            <p className="text-[11px] text-muted-foreground">Precio de referencia</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {referencia.precio > 0 ? formatoMoneda(referencia.precio) : "—"}
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Es el precio promedio ponderado del inventario <strong>disponible a la venta</strong>
          {" "}de {referencia.nombre.toLowerCase()}, con{" "}
          {escenarioRef ? `el escenario v${escenarioRef.numero}` : "el borrador vivo"}. Cada
          esquema traduce ese precio a enganche, mensualidad y pago a entrega. Se excluye lo
          ya vendido: un esquema se le ofrece a quien todavía puede comprar.
        </p>
        {referencia.unidades === 0 ? (
          <p className="mt-1 text-xs text-destructive">
            No hay unidades disponibles con precio en esta selección, así que las tarjetas
            solo muestran porcentajes y factores.
          </p>
        ) : null}
      </div>

      <div className="inline-flex gap-1 rounded-md border border-border p-1">
        {(
          [
            ["activos", `Se ofrecen (${conteoEstado.activos})`],
            ["inactivos", `Dados de baja (${conteoEstado.inactivos})`],
            ["todos", `Todos (${conteoEstado.todos})`],
          ] as Array<["activos" | "inactivos" | "todos", string]>
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFiltroEstado(v)}
            className={
              filtroEstado === v
                ? "rounded bg-muted px-3 py-1 text-[13px] font-medium"
                : "rounded px-3 py-1 text-[13px] text-muted-foreground"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibles.map((e) => {
          const vpn = resultados[e.id_esquema];
          if (!vpn) return null;
          const bloque = porTorre[e.id_esquema];
          const detalle = multiTorre
            ? horizontesPorTorre.map((h) => {
                const r = bloque?.porTorre[h.torre.id_torre];
                return {
                  id_torre: h.torre.id_torre,
                  nombre: h.torre.nombre,
                  horizonte: h.meses,
                  factor: r?.factor_vpn ?? 0,
                  ejecutable: !esInejecutable(r),
                };
              })
            : undefined;
          return (
            <TarjetaEsquema
              key={e.id_esquema}
              esquema={e}
              vpn={vpn}
              detalleTorres={detalle}
              factorPonderadoProyecto={bloque?.ponderado}
              ponderadoParcial={bloque?.parcial}
              referencia={
                referencia.precio > 0
                  ? {
                      etiqueta: referencia.nombre,
                      precio: referencia.precio,
                      unidades: referencia.unidades,
                    }
                  : undefined
              }
              onEditar={() => {
                setEditando(e);
                setModal(true);
              }}
              onMarcarBase={() => {
                marcarComoBase(e.id_esquema);
                registrarEvento({
                  id_proyecto: idProyecto,
                  tipo: "esquema.marcado_base",
                  entidad: { tipo: "esquema", id: e.id_esquema, etiqueta: e.nombre },
                  antes: { es_base: e.es_base },
                  despues: { es_base: true },
                });
              }}
              onDuplicar={() => duplicarEsquema(e.id_esquema)}
              onAlternarActivo={() => {
                if (e.activo) desactivarEsquema(e.id_esquema);
                else reactivarEsquema(e.id_esquema);
                registrarEvento({
                  id_proyecto: idProyecto,
                  tipo: e.activo ? "esquema.desactivado" : "esquema.actualizado",
                  entidad: { tipo: "esquema", id: e.id_esquema, etiqueta: e.nombre },
                  antes: { activo: e.activo },
                  despues: { activo: !e.activo },
                });
              }}
            />
          );
        })}
        {visibles.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Este proyecto no tiene esquemas de financiamiento. Crea el primero con “Nuevo
            Esquema”.
          </Card>
        ) : null}
      </div>

      <Card className="p-4 text-sm text-muted-foreground">
        El motor no sobrescribe tu política comercial. El ajuste que aplicas a cada
        esquema es una decisión de negocio y se respeta tal cual. El módulo calcula por
        separado cuál sería el ajuste que preserva el valor presente y te muestra la
        diferencia. Cerrar esa brecha, mantenerla por razones competitivas, o ampliarla
        deliberadamente, es una decisión tuya, no del sistema.
      </Card>

      <p className="text-xs text-muted-foreground tabular-nums">
        Suma de composición requerida por esquema: {pct2(1)} · Libro: Comercial
      </p>

      <ModalEsquema
        abierto={modal}
        onOpenChange={setModal}
        esquema={editando}
        horizonte={horizonteMinimo}
        tasaAnual={tasaAnual}
        esquemaBase={esquemaBase}
        onGuardar={(datos) => {
          if (editando) {
            reemplazarEsquema(editando.id_esquema, datos);
            registrarEvento({
              id_proyecto: idProyecto,
              tipo: "esquema.actualizado",
              entidad: {
                tipo: "esquema",
                id: editando.id_esquema,
                etiqueta: datos.nombre,
              },
              antes: editando,
              despues: datos,
            });
          } else {
            crearEsquema(idProyecto, datos);
            registrarEvento({
              id_proyecto: idProyecto,
              tipo: "esquema.creado",
              entidad: { tipo: "esquema", id: "nuevo", etiqueta: datos.nombre },
              antes: null,
              despues: datos,
            });
          }
        }}
      />
    </div>
  );
}

export default PantallaEsquemas;
